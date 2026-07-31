import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { scaricaFile } from "@/lib/googleDrive";
import { estraiIdDaLinkDrive } from "@/lib/googleDrive";
import { registraAudit } from "@/lib/audit";
import { encryptField, decryptField } from "@/lib/crypto";
import { estraiTestoCella, estraiUrlCella } from "@/lib/excelCellUtils";
import { normalizzaIntestazione, analizzaBooleano, analizzaData, valoreVuoto, valoriDiversi } from "@/lib/excelValueParsing";
import { StatoPratica, CategoriaPratica, Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Mappatura intestazioni Excel -> campi Pratica
// ---------------------------------------------------------------------------

// Il file reale (LICENZIAMENTI_CAUSE_SINGOLE.xlsx) ha intestazioni leggermente
// diverse da foglio a foglio (es. "Cartella drive" vs "wo" per la prima
// colonna, "Licenziamento " vs "Licenziamento / data contatto" per la data):
// ogni campo accetta tutte le varianti osservate.
const ALIAS_COLONNE_PRATICA: Record<string, string[]> = {
  driveFolderUrl: ["cartella drive", "wo", "drive"],
  rg: ["rg", "r g"],
  citta: ["citta"],
  tipologia: ["tipologia", "tipologia pratica"],
  nome: ["nome"],
  cognome: ["cognome"],
  datiAnagrafici: ["indirizzo e cf", "cf"],
  controparte: ["controparte"],
  appuntamenti: ["appuntamenti"],
  note: ["note"],
  email: ["email"],
  telefono: ["numero di telefono", "telefono"],
  scadenza: ["scadenza"],
  impugnativa: ["impugnativa"],
  dataLicenziamento: ["licenziamento", "licenziamento data contatto"],
  cartaceo: ["cartaceo"],
  procura: ["procura"],
  emissioneFatturaSpeseLegali: ["emissione fattura spese legali"],
  pagatoCapitale: ["pagato capitale"],
  pagatoSpeseLegali: ["pagato spese legali"],
  precetto: ["precetto"],
  esecuzione: ["esecuzione"],
};

// Solo i 5 fogli di stato riconosciuti vengono importati: un foglio con nome
// diverso (es. un foglio di appunti, un riepilogo) viene ignorato invece di
// essere importato per errore come PENDENTI (a differenza dell'importer
// Causa, qui non c'e' un fallback: i nomi dei fogli in questo file sono
// affidabili e un foglio sconosciuto e' quasi certamente non una pratica).
const FOGLIO_A_STATO_PRATICA: Record<string, StatoPratica> = {
  pendenti: StatoPratica.PENDENTI,
  concluse: StatoPratica.CONCLUSE,
  "in esecuzione": StatoPratica.IN_ESECUZIONE,
  "da pagare": StatoPratica.DA_PAGARE,
  dimessiesclusi: StatoPratica.DIMESSI_ESCLUSI,
  "dimessi esclusi": StatoPratica.DIMESSI_ESCLUSI,
};

// Foglio -> categoria di provenienza (raider vs causa singola): usato solo
// come indizio per derivaCategoria quando la Tipologia non basta a decidere.
const FOGLIO_A_CATEGORIA: Record<string, CategoriaPratica> = {
  licenziamenti: CategoriaPratica.RAIDER,
  cause_singole_infortuni_sinistri: CategoriaPratica.CAUSA_SINGOLA,
  "cause singoleinfortunisinistri": CategoriaPratica.CAUSA_SINGOLA,
};

function testoONull(raw: unknown): string | null {
  return estraiTestoCella(raw);
}

// Deriva la categoria (Raider / Causa singola) dal testo di Tipologia. Se non
// riconosciuto, usa il foglio di provenienza come indizio secondario; se
// nemmeno quello aiuta, la riga viene comunque importata ma marcata "da
// classificare" per revisione manuale invece di essere scartata.
function derivaCategoria(tipologia: string | null, nomeFoglioNormalizzato: string): CategoriaPratica {
  if (tipologia) {
    const t = normalizzaIntestazione(tipologia);
    if (t.includes("rider") || t.includes("raider")) return CategoriaPratica.RAIDER;
    if (t.includes("infortun") || t.includes("sinistr") || t.includes("causa")) return CategoriaPratica.CAUSA_SINGOLA;
  }
  const dalFoglio = FOGLIO_A_CATEGORIA[nomeFoglioNormalizzato];
  return dalFoglio ?? CategoriaPratica.DA_CLASSIFICARE;
}

// ---------------------------------------------------------------------------
// Riga grezza -> riga tipizzata + validata
// ---------------------------------------------------------------------------

export interface PraticaDaImport {
  driveFolderId: string;
  driveFolderUrl: string;
  stato: StatoPratica;
  categoria: CategoriaPratica;
  tipologia: string | null;
  rg: string | null;
  citta: string | null;
  nome: string | null;
  cognome: string | null;
  // Testo in chiaro (indirizzo + codice fiscale): cifrato solo al momento
  // della scrittura su Prisma (vedi datiAnagraficiCifrato nello schema), mai
  // qui, cosi' il parsing resta puro e testabile senza FIELD_ENCRYPTION_KEY.
  datiAnagrafici: string | null;
  controparte: string | null;
  appuntamenti: string | null;
  note: string | null;
  email: string | null;
  telefono: string | null;
  scadenza: Date | null;
  impugnativa: Date | null;
  dataLicenziamento: Date | null;
  // null = nessuna informazione nella cella (distinto da "false" esplicito).
  cartaceo: boolean | null;
  procura: boolean | null;
  emissioneFatturaSpeseLegali: string | null;
  pagatoCapitale: boolean | null;
  pagatoSpeseLegali: boolean | null;
  precetto: string | null;
  esecuzione: string | null;
}

export interface RigaPraticaParsata {
  numeroRiga: number;
  nomeFoglio: string;
  stato: StatoPratica;
  scartata: string | null; // motivo, se la riga va esclusa del tutto
  avvisi: string[]; // problemi non bloccanti (valori non riconosciuti, ecc.)
  dati: PraticaDaImport | null; // null se scartata
}

// Trasforma una riga grezza in una riga validata. Pura: nessuna chiamata a
// Drive o al database, per essere testabile in isolamento. A differenza
// dell'importer Causa, qui la chiave di abbinamento e' il link alla cartella
// Drive (non l'RG, che nel file reale e' spesso assente o poco affidabile):
// una riga senza un vero link Drive viene scartata, non creata "orfana".
export function elaboraRigaPratica(numeroRiga: number, nomeFoglio: string, stato: StatoPratica, grezza: Record<string, unknown>): RigaPraticaParsata {
  const avvisi: string[] = [];

  const driveFolderUrl = estraiUrlCella(grezza.driveFolderUrl);
  if (!driveFolderUrl) {
    return { numeroRiga, nomeFoglio, stato, scartata: "Nessun link alla cartella Drive (chiave di abbinamento mancante)", avvisi, dati: null };
  }
  let driveFolderId: string;
  try {
    driveFolderId = estraiIdDaLinkDrive(driveFolderUrl);
  } catch {
    return { numeroRiga, nomeFoglio, stato, scartata: `Link Drive non riconosciuto: "${driveFolderUrl}"`, avvisi, dati: null };
  }

  const tipologia = testoONull(grezza.tipologia);
  const categoria = derivaCategoria(tipologia, nomeFoglio);
  if (categoria === CategoriaPratica.DA_CLASSIFICARE) {
    avvisi.push(`Tipologia non riconosciuta ("${tipologia ?? ""}"): categoria da classificare manualmente`);
  }

  const nome = testoONull(grezza.nome);
  const cognome = testoONull(grezza.cognome);
  const datiAnagrafici = testoONull(grezza.datiAnagrafici);

  const scadenza = analizzaData(grezza.scadenza);
  if (!scadenza.riconosciuto) avvisi.push(`Scadenza non riconosciuta: "${grezza.scadenza}"`);

  const impugnativa = analizzaData(grezza.impugnativa);
  if (!impugnativa.riconosciuto) avvisi.push(`Impugnativa non riconosciuta: "${grezza.impugnativa}"`);

  const dataLicenziamento = analizzaData(grezza.dataLicenziamento);
  if (!dataLicenziamento.riconosciuto) avvisi.push(`Data licenziamento non riconosciuta: "${grezza.dataLicenziamento}"`);

  const cartaceo = analizzaBooleano(grezza.cartaceo);
  if (!cartaceo.riconosciuto) avvisi.push(`"Cartaceo" non riconosciuto: "${grezza.cartaceo}", ignorato come se fosse vuoto`);

  const procura = analizzaBooleano(grezza.procura);
  if (!procura.riconosciuto) avvisi.push(`"Procura" non riconosciuto: "${grezza.procura}", ignorato come se fosse vuoto`);

  const pagatoCapitale = analizzaBooleano(grezza.pagatoCapitale);
  if (!pagatoCapitale.riconosciuto) avvisi.push(`"Pagato capitale" non riconosciuto: "${grezza.pagatoCapitale}", ignorato come se fosse vuoto`);

  const pagatoSpeseLegali = analizzaBooleano(grezza.pagatoSpeseLegali);
  if (!pagatoSpeseLegali.riconosciuto)
    avvisi.push(`"Pagato spese legali" non riconosciuto: "${grezza.pagatoSpeseLegali}", ignorato come se fosse vuoto`);

  return {
    numeroRiga,
    nomeFoglio,
    stato,
    scartata: null,
    avvisi,
    dati: {
      driveFolderId,
      driveFolderUrl,
      stato,
      categoria,
      tipologia,
      rg: testoONull(grezza.rg),
      citta: testoONull(grezza.citta),
      nome,
      cognome,
      datiAnagrafici,
      controparte: testoONull(grezza.controparte),
      appuntamenti: testoONull(grezza.appuntamenti),
      note: testoONull(grezza.note),
      email: testoONull(grezza.email),
      telefono: testoONull(grezza.telefono),
      scadenza: scadenza.valore,
      impugnativa: impugnativa.valore,
      dataLicenziamento: dataLicenziamento.valore,
      cartaceo: cartaceo.valore,
      procura: procura.valore,
      emissioneFatturaSpeseLegali: testoONull(grezza.emissioneFatturaSpeseLegali),
      pagatoCapitale: pagatoCapitale.valore,
      pagatoSpeseLegali: pagatoSpeseLegali.valore,
      precetto: testoONull(grezza.precetto),
      esecuzione: testoONull(grezza.esecuzione),
    },
  };
}

// ---------------------------------------------------------------------------
// Decisione: crea / completa campi vuoti / segnala conflitto
// ---------------------------------------------------------------------------

// driveFolderId e' la chiave di abbinamento (non si confronta con se
// stesso); stato e categoria sono trattati a parte piu' sotto.
const CAMPI_CONFRONTABILI_PRATICA = [
  "rg",
  "citta",
  "tipologia",
  "nome",
  "cognome",
  "datiAnagrafici",
  "controparte",
  "appuntamenti",
  "note",
  "email",
  "telefono",
  "scadenza",
  "impugnativa",
  "dataLicenziamento",
  "cartaceo",
  "procura",
  "emissioneFatturaSpeseLegali",
  "pagatoCapitale",
  "pagatoSpeseLegali",
  "precetto",
  "esecuzione",
] as const;

export interface PraticaEsistentePerImport {
  id: string;
  driveFolderId: string | null;
  stato: StatoPratica;
  categoria: CategoriaPratica;
  // NB: la chiave "datiAnagrafici" va valorizzata dal chiamante con il testo
  // GIA' DECIFRATO (decryptField(datiAnagraficiCifrato)): questa funzione
  // confronta solo valori in chiaro, non sa nulla di cifratura.
  [campo: string]: unknown;
}

const CAMPI_SENSIBILI_PRATICA = new Set(["datiAnagrafici"]);

export interface ConflittoCampoPratica {
  campo: string;
  valoreAttuale: unknown;
  valoreExcel: unknown;
}

// Variante di PraticaDaImport per i payload di scrittura verso Prisma: i
// booleani "senza informazione" (null) non arrivano mai qui.
type PraticaScrivibile = Omit<PraticaDaImport, "cartaceo" | "procura" | "pagatoCapitale" | "pagatoSpeseLegali"> & {
  cartaceo: boolean;
  procura: boolean;
  pagatoCapitale: boolean;
  pagatoSpeseLegali: boolean;
};

export type AzioneImportRigaPratica =
  | { tipo: "crea"; riga: RigaPraticaParsata; dati: PraticaDaImport }
  | { tipo: "completa"; riga: RigaPraticaParsata; praticaId: string; campiDaRiempire: Partial<PraticaScrivibile> }
  | { tipo: "conflitto"; riga: RigaPraticaParsata; praticaId: string; conflitti: ConflittoCampoPratica[] }
  | { tipo: "invariata"; riga: RigaPraticaParsata; praticaId: string }
  | { tipo: "scartata"; riga: RigaPraticaParsata };

// Logica pura di decisione: nessuna chiamata a Drive/DB. Le pratiche
// esistenti vanno passate gia' filtrate/indicizzabili per driveFolderId dal
// chiamante.
export function pianificaImportazionePratiche(
  righe: RigaPraticaParsata[],
  praticheEsistenti: PraticaEsistentePerImport[]
): AzioneImportRigaPratica[] {
  const azioni: AzioneImportRigaPratica[] = [];
  const esistentiPerCartella = new Map(praticheEsistenti.filter((p) => p.driveFolderId).map((p) => [p.driveFolderId as string, p]));

  for (const riga of righe) {
    if (riga.scartata || !riga.dati) {
      azioni.push({ tipo: "scartata", riga });
      continue;
    }

    const candidato = esistentiPerCartella.get(riga.dati.driveFolderId);

    if (!candidato) {
      azioni.push({ tipo: "crea", riga, dati: riga.dati });
      continue;
    }

    const campiDaRiempire: Partial<PraticaScrivibile> = {};
    const conflitti: ConflittoCampoPratica[] = [];

    // Stato e categoria: il file traccia sempre uno stato affidabile (ogni
    // foglio e' un vero foglio di stato dedicato, non un'unica vista con
    // colonna stato), quindi a differenza dell'importer Causa qui il
    // confronto e' sempre attivo. Mai applicato in automatico: sempre da
    // confermare come gli altri conflitti.
    if (riga.stato !== candidato.stato) {
      conflitti.push({ campo: "stato", valoreAttuale: candidato.stato, valoreExcel: riga.stato });
    }
    if (riga.dati.categoria !== CategoriaPratica.DA_CLASSIFICARE && riga.dati.categoria !== candidato.categoria) {
      conflitti.push({ campo: "categoria", valoreAttuale: candidato.categoria, valoreExcel: riga.dati.categoria });
    }

    for (const campo of CAMPI_CONFRONTABILI_PRATICA) {
      const valoreExcel = riga.dati[campo];
      const valoreAttuale = candidato[campo];

      if (valoreVuoto(valoreExcel)) continue; // l'Excel non dice nulla su questo campo: non tocchiamo l'esistente

      if (valoreVuoto(valoreAttuale)) {
        (campiDaRiempire as Record<string, unknown>)[campo] = valoreExcel;
        continue;
      }

      if (valoriDiversi(valoreAttuale, valoreExcel)) {
        conflitti.push({ campo, valoreAttuale, valoreExcel });
      }
    }

    if (conflitti.length > 0) {
      azioni.push({ tipo: "conflitto", riga, praticaId: candidato.id, conflitti });
    } else if (Object.keys(campiDaRiempire).length > 0) {
      azioni.push({ tipo: "completa", riga, praticaId: candidato.id, campiDaRiempire });
    } else {
      azioni.push({ tipo: "invariata", riga, praticaId: candidato.id });
    }
  }

  return azioni;
}

// ---------------------------------------------------------------------------
// Orchestratore: scarica il file da Drive, lo interpreta, applica gli effetti
// ---------------------------------------------------------------------------

export interface RisultatoImportPratiche {
  righeTotali: number;
  righeCreate: number;
  righeAggiornate: number;
  righeInvariate: number;
  righeConflitto: number;
  righeScartate: number;
  dettagliScartate: { riga: number; motivo: string }[];
  logId: string;
}

// Interpreta un file .xlsx gia' scaricato (buffer in memoria) in righe
// validate. Isolata da importaPraticheDaExcel così da poter essere testata
// con un file .xlsx generato al volo, senza credenziali Drive.
export async function estraiRigheDaWorkbookPratiche(buffer: Buffer): Promise<RigaPraticaParsata[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const righe: RigaPraticaParsata[] = [];

  workbook.eachSheet((worksheet) => {
    const nomeFoglio = normalizzaIntestazione(worksheet.name);
    const stato = FOGLIO_A_STATO_PRATICA[nomeFoglio];
    if (!stato) return; // foglio non riconosciuto: ignorato, non importato come fallback

    const headerRow = worksheet.getRow(1);
    const colonnaPerCampo: Record<string, number> = {};
    headerRow.eachCell((cell, colNumber) => {
      const intestazione = normalizzaIntestazione(String(cell.value ?? ""));
      for (const [campo, alias] of Object.entries(ALIAS_COLONNE_PRATICA)) {
        if (alias.includes(intestazione)) colonnaPerCampo[campo] = colNumber;
      }
    });

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // intestazione

      const grezza: Record<string, unknown> = {};
      for (const [campo, colNumber] of Object.entries(colonnaPerCampo)) {
        grezza[campo] = row.getCell(colNumber).value;
      }
      // Riga completamente vuota (es. riga vuota di margine): ignorata senza segnalarla.
      if (Object.values(grezza).every((v) => v === null || v === undefined || v === "")) return;

      righe.push(elaboraRigaPratica(rowNumber, nomeFoglio, stato, grezza));
    });
  });

  return righe;
}

export async function importaPraticheDaExcel(userId: string, driveFileId: string, eseguitoDaId?: string): Promise<RisultatoImportPratiche> {
  const buffer = await scaricaFile(userId, driveFileId);
  const righe = await estraiRigheDaWorkbookPratiche(buffer);

  const cartelleCoinvolte = Array.from(new Set(righe.map((r) => r.dati?.driveFolderId).filter((id): id is string => !!id)));
  const praticheEsistenti =
    cartelleCoinvolte.length > 0
      ? await prisma.pratica.findMany({ where: { driveFolderId: { in: cartelleCoinvolte } } })
      : [];
  // Il confronto con l'Excel avviene sempre in chiaro: la versione cifrata
  // non viene mai esposta alla logica di pianificazione.
  const praticheEsistentiPerConfronto: PraticaEsistentePerImport[] = praticheEsistenti.map((p) => ({
    ...p,
    datiAnagrafici: decryptField(p.datiAnagraficiCifrato),
  }));

  const azioni = pianificaImportazionePratiche(righe, praticheEsistentiPerConfronto);

  const risultato: RisultatoImportPratiche = {
    righeTotali: righe.length,
    righeCreate: 0,
    righeAggiornate: 0,
    righeInvariate: 0,
    righeConflitto: 0,
    righeScartate: 0,
    dettagliScartate: [],
    logId: "",
  };

  const conflittiDaSalvare: Omit<Prisma.ImportPraticaConflittoCreateManyInput, "importLogId">[] = [];

  for (const azione of azioni) {
    switch (azione.tipo) {
      case "crea": {
        const { datiAnagrafici, ...datiSenzaAnagrafici } = azione.dati;
        const pratica = await prisma.pratica.create({
          data: {
            ...datiSenzaAnagrafici,
            datiAnagraficiCifrato: datiAnagrafici ? encryptField(datiAnagrafici) : null,
            cartaceo: azione.dati.cartaceo ?? false,
            procura: azione.dati.procura ?? false,
            pagatoCapitale: azione.dati.pagatoCapitale ?? false,
            pagatoSpeseLegali: azione.dati.pagatoSpeseLegali ?? false,
          },
        });
        await registraAudit({ azione: "CREAZIONE", entita: "Pratica", entitaId: pratica.id, utenteId: eseguitoDaId, dopo: { ...pratica, datiAnagraficiCifrato: undefined } });
        risultato.righeCreate++;
        break;
      }
      case "completa": {
        const { datiAnagrafici, ...campiSenzaAnagrafici } = azione.campiDaRiempire;
        const campiScrittura: Prisma.PraticaUpdateInput = { ...campiSenzaAnagrafici };
        if (datiAnagrafici !== undefined) {
          campiScrittura.datiAnagraficiCifrato = datiAnagrafici ? encryptField(datiAnagrafici) : null;
        }
        const prima = await prisma.pratica.findUnique({ where: { id: azione.praticaId } });
        const dopo = await prisma.pratica.update({ where: { id: azione.praticaId }, data: campiScrittura });
        await registraAudit({
          azione: "MODIFICA",
          entita: "Pratica",
          entitaId: azione.praticaId,
          utenteId: eseguitoDaId,
          prima: prima ? { ...prima, datiAnagraficiCifrato: undefined } : prima,
          dopo: { ...dopo, datiAnagraficiCifrato: undefined },
        });
        risultato.righeAggiornate++;
        break;
      }
      case "conflitto": {
        for (const c of azione.conflitti) {
          // Il testo in chiaro dei campi sensibili (indirizzo/CF) non finisce
          // mai nella tabella dei conflitti: solo un promemoria che rimanda
          // alla scheda della pratica per la revisione.
          const redatto = CAMPI_SENSIBILI_PRATICA.has(c.campo);
          conflittiDaSalvare.push({
            praticaId: azione.praticaId,
            campo: c.campo,
            valoreAttuale: redatto
              ? "[dato sensibile cifrato: vedere la scheda della pratica]"
              : c.valoreAttuale instanceof Date
                ? c.valoreAttuale.toISOString()
                : String(c.valoreAttuale ?? ""),
            valoreExcel: redatto
              ? "[dato sensibile cifrato: vedere la scheda della pratica]"
              : c.valoreExcel instanceof Date
                ? c.valoreExcel.toISOString()
                : String(c.valoreExcel ?? ""),
            rigaExcel: azione.riga.numeroRiga,
          });
        }
        risultato.righeConflitto++;
        break;
      }
      case "invariata":
        risultato.righeInvariate++;
        break;
      case "scartata":
        risultato.righeScartate++;
        risultato.dettagliScartate.push({ riga: azione.riga.numeroRiga, motivo: azione.riga.scartata ?? "Motivo sconosciuto" });
        break;
    }
  }

  const log = await prisma.importPraticaLog.create({
    data: {
      eseguitoDaId,
      righeTotali: risultato.righeTotali,
      righeCreate: risultato.righeCreate,
      righeAggiornate: risultato.righeAggiornate,
      righeInvariate: risultato.righeInvariate,
      righeConflitto: risultato.righeConflitto,
      righeScartate: risultato.righeScartate,
      dettagliScartate: risultato.dettagliScartate,
    },
  });

  if (conflittiDaSalvare.length > 0) {
    await prisma.importPraticaConflitto.createMany({
      data: conflittiDaSalvare.map((c) => ({ ...c, importLogId: log.id })),
    });
  }

  risultato.logId = log.id;
  return risultato;
}
