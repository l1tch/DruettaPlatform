import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { scaricaFile } from "@/lib/googleDrive";
import { estraiAnnoRg } from "@/lib/convenzioneNomi";
import { registraAudit } from "@/lib/audit";
import { estraiTestoCella, estraiUrlCella } from "@/lib/excelCellUtils";
import { StatoCausa, Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Mappatura intestazioni Excel -> campi Causa
// ---------------------------------------------------------------------------

function rimuoviAccenti(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function normalizzaIntestazione(s: string): string {
  return rimuoviAccenti(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Ogni campo accetta più varianti di intestazione (case/accenti/punteggiatura
// non contano, già normalizzati sopra), per tollerare piccole differenze nel
// file reale rispetto ai nomi "canonici".
const ALIAS_COLONNE: Record<string, string[]> = {
  fascicolo: ["fascicolo"],
  driveFolderUrl: ["drive", "drive link", "link drive", "cartella drive"],
  tribunale: ["tribunale"],
  rg: ["rg", "r g"],
  ricorrenti: ["nomi ricorrenti", "ricorrenti"],
  controparte: ["controparte"],
  ultimaUdienza: ["ultima udienza", "data ultima udienza"],
  dataUdienza: ["data udienza", "prossima udienza", "data prossima udienza"],
  adempimenti: ["adempimenti"],
  termine: ["termine"],
  fattoONo: ["fatto o no", "fatto"],
  propostaTrasmessa: ["proposta trasmessa"],
  dataProposta: ["data proposta"],
  note: ["note"],
  procure185: ["procure 185", "procure185"],
};

// Nome del foglio -> stato causa. Un foglio con nome non riconosciuto viene
// comunque importato come PENDENTI (comportamento di fallback), ma segnalato.
const FOGLIO_A_STATO: Record<string, StatoCausa> = {
  pendenti: StatoCausa.PENDENTI,
  concluse: StatoCausa.CONCLUSE,
  esecuzioni: StatoCausa.ESECUZIONI,
};

// ---------------------------------------------------------------------------
// Normalizzazione/validazione dei singoli valori (pura, senza I/O)
// ---------------------------------------------------------------------------

const VALORI_VERI = new Set(["si", "sì", "vero", "true", "x", "ok", "fatto", "trasmessa", "1"]);
const VALORI_FALSI = new Set(["no", "falso", "false", "", "0", "non trasmessa", "-"]);

interface RisultatoBooleano {
  // null = cella vuota, nessuna informazione (va distinto da "false
  // esplicito" per non far scattare un completamento/conflitto su un campo
  // su cui l'Excel semplicemente non dice nulla).
  valore: boolean | null;
  riconosciuto: boolean;
}

export function analizzaBooleano(raw: unknown): RisultatoBooleano {
  if (typeof raw === "boolean") return { valore: raw, riconosciuto: true };
  if (typeof raw === "number") return { valore: raw !== 0, riconosciuto: true };
  if (raw === null || raw === undefined) return { valore: null, riconosciuto: true };

  const testoGrezzo = estraiTestoCella(raw);
  if (testoGrezzo === null) return { valore: null, riconosciuto: true };
  const testo = normalizzaIntestazione(testoGrezzo);
  if (testo === "") return { valore: null, riconosciuto: true };
  if (VALORI_VERI.has(testo)) return { valore: true, riconosciuto: true };
  if (VALORI_FALSI.has(testo)) return { valore: false, riconosciuto: true };
  return { valore: null, riconosciuto: false };
}

interface RisultatoData {
  valore: Date | null;
  riconosciuto: boolean;
}

export function analizzaData(raw: unknown): RisultatoData {
  if (raw === null || raw === undefined || raw === "") return { valore: null, riconosciuto: true };
  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? { valore: null, riconosciuto: false } : { valore: raw, riconosciuto: true };
  }
  if (typeof raw === "number") {
    // Numero seriale Excel (giorni dal 1899-12-30).
    const ms = Math.round((raw - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? { valore: null, riconosciuto: false } : { valore: d, riconosciuto: true };
  }

  const testoGrezzo = estraiTestoCella(raw);
  if (testoGrezzo === null) return { valore: null, riconosciuto: true };
  const testo = testoGrezzo;
  const isoMatch = testo.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const d = new Date(testo);
    return isNaN(d.getTime()) ? { valore: null, riconosciuto: false } : { valore: d, riconosciuto: true };
  }
  const itMatch = testo.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (itMatch) {
    const [, giorno, mese, anno] = itMatch;
    const d = new Date(Number(anno), Number(mese) - 1, Number(giorno));
    return isNaN(d.getTime()) ? { valore: null, riconosciuto: false } : { valore: d, riconosciuto: true };
  }
  return { valore: null, riconosciuto: false };
}

// Normalizza "8271 / 2025" -> "8271/2025". Non garantisce che il formato sia
// corretto: la validazione vera e propria è in validaRg.
function normalizzaRg(raw: string): string {
  return raw.trim().replace(/\s*\/\s*/, "/");
}

const RG_VALIDO = /^\d+\/\d{4}$/;

// ---------------------------------------------------------------------------
// Riga grezza -> riga tipizzata + validata
// ---------------------------------------------------------------------------

export interface CausaDaImport {
  fascicolo: string;
  driveFolderUrl: string | null;
  tribunale: string | null;
  rg: string | null;
  ricorrenti: string | null;
  controparte: string | null;
  ultimaUdienza: Date | null;
  dataUdienza: Date | null;
  adempimenti: string | null;
  termine: Date | null;
  // null = nessuna informazione nella cella (distinto da "false" esplicito).
  fattoONo: boolean | null;
  propostaTrasmessa: boolean | null;
  dataProposta: Date | null;
  note: string | null;
  procure185: boolean | null;
}

export interface RigaParsata {
  numeroRiga: number;
  stato: StatoCausa;
  scartata: string | null; // motivo, se la riga va esclusa del tutto
  avvisi: string[]; // problemi non bloccanti (valori non riconosciuti, ecc.)
  dati: CausaDaImport | null; // null se scartata
}

// Estrae il testo di una cella gestendo anche celle-hyperlink e rich text
// (vedi src/lib/excelCellUtils.ts): un link "Inserisci collegamento
// ipertestuale" non è una stringa nuda in exceljs.
function testoONull(raw: unknown): string | null {
  return estraiTestoCella(raw);
}

// Trasforma una riga grezza (oggetto con chiavi = nomi di campo Causa, valori
// = valore cella così come letto dal foglio) in una riga validata. Pura:
// nessuna chiamata a Drive o al database, per essere testabile in isolamento.
export function elaboraRiga(numeroRiga: number, stato: StatoCausa, grezza: Record<string, unknown>): RigaParsata {
  const avvisi: string[] = [];

  const fascicolo = testoONull(grezza.fascicolo);
  if (!fascicolo) {
    return { numeroRiga, stato, scartata: "Fascicolo mancante", avvisi, dati: null };
  }

  let rg = testoONull(grezza.rg);
  if (rg) {
    rg = normalizzaRg(rg);
    if (!RG_VALIDO.test(rg)) {
      return { numeroRiga, stato, scartata: `R.G. non nel formato numero/anno: "${rg}"`, avvisi, dati: null };
    }
  }

  const ultimaUdienza = analizzaData(grezza.ultimaUdienza);
  if (!ultimaUdienza.riconosciuto) avvisi.push(`Data ultima udienza non riconosciuta: "${grezza.ultimaUdienza}"`);

  const dataUdienza = analizzaData(grezza.dataUdienza);
  if (!dataUdienza.riconosciuto) avvisi.push(`Data udienza non riconosciuta: "${grezza.dataUdienza}"`);

  const termine = analizzaData(grezza.termine);
  if (!termine.riconosciuto) avvisi.push(`Termine non riconosciuto: "${grezza.termine}"`);

  const dataProposta = analizzaData(grezza.dataProposta);
  if (!dataProposta.riconosciuto) avvisi.push(`Data proposta non riconosciuta: "${grezza.dataProposta}"`);

  const fattoONo = analizzaBooleano(grezza.fattoONo);
  if (!fattoONo.riconosciuto) avvisi.push(`"Fatto o no" non riconosciuto: "${grezza.fattoONo}", ignorato come se fosse vuoto`);

  const propostaTrasmessa = analizzaBooleano(grezza.propostaTrasmessa);
  if (!propostaTrasmessa.riconosciuto)
    avvisi.push(`"Proposta trasmessa" non riconosciuto: "${grezza.propostaTrasmessa}", ignorato come se fosse vuoto`);

  const procure185 = analizzaBooleano(grezza.procure185);
  if (!procure185.riconosciuto)
    avvisi.push(`"Procure 185" non riconosciuto: "${grezza.procure185}", ignorato come se fosse vuoto`);

  return {
    numeroRiga,
    stato,
    scartata: null,
    avvisi,
    dati: {
      fascicolo,
      driveFolderUrl: estraiUrlCella(grezza.driveFolderUrl),
      tribunale: testoONull(grezza.tribunale),
      rg,
      ricorrenti: testoONull(grezza.ricorrenti),
      controparte: testoONull(grezza.controparte),
      ultimaUdienza: ultimaUdienza.valore,
      dataUdienza: dataUdienza.valore,
      adempimenti: testoONull(grezza.adempimenti),
      termine: termine.valore,
      fattoONo: fattoONo.valore,
      propostaTrasmessa: propostaTrasmessa.valore,
      dataProposta: dataProposta.valore,
      note: testoONull(grezza.note),
      procure185: procure185.valore,
    },
  };
}

// ---------------------------------------------------------------------------
// Decisione: crea / completa campi vuoti / segnala conflitto
// ---------------------------------------------------------------------------

// I soli campi confrontati per completamento/conflitto: RG è la chiave di
// abbinamento (non si confronta con se stesso), fascicolo è quasi sempre
// popolato in entrambe le fonti e viene lasciato all'immissione manuale.
const CAMPI_CONFRONTABILI = [
  "driveFolderUrl",
  "tribunale",
  "ricorrenti",
  "controparte",
  "ultimaUdienza",
  "dataUdienza",
  "adempimenti",
  "termine",
  "fattoONo",
  "propostaTrasmessa",
  "dataProposta",
  "note",
  "procure185",
] as const;

export interface CausaEsistentePerImport {
  id: string;
  rg: string | null;
  stato: StatoCausa;
  [campo: string]: unknown;
}

export interface ConflittoCampo {
  campo: string;
  valoreAttuale: unknown;
  valoreExcel: unknown;
}

// Variante di CausaDaImport usata per i payload di scrittura verso Prisma:
// i booleani "senza informazione" (null) non arrivano mai qui, la logica di
// pianificazione li esclude prima (vedi valoreVuoto più sotto).
type CausaScrivibile = Omit<CausaDaImport, "fattoONo" | "propostaTrasmessa" | "procure185"> & {
  fattoONo: boolean;
  propostaTrasmessa: boolean;
  procure185: boolean;
};

export type AzioneImportRiga =
  | { tipo: "crea"; riga: RigaParsata; dati: CausaDaImport }
  | { tipo: "completa"; riga: RigaParsata; causaId: string; campiDaRiempire: Partial<CausaScrivibile> }
  | { tipo: "conflitto"; riga: RigaParsata; causaId: string; conflitti: ConflittoCampo[] }
  | { tipo: "invariata"; riga: RigaParsata; causaId: string }
  | { tipo: "scartata"; riga: RigaParsata };

function valoreVuoto(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

function valoriDiversi(a: unknown, b: unknown): boolean {
  if (a instanceof Date || b instanceof Date) {
    const ta = a instanceof Date ? a.getTime() : NaN;
    const tb = b instanceof Date ? b.getTime() : NaN;
    return ta !== tb;
  }
  return a !== b;
}

// Logica pura di decisione: nessuna chiamata a Drive/DB. Le cause esistenti
// vanno passate già filtrate/indicizzabili per R.G. dal chiamante.
export function pianificaImportazione(righe: RigaParsata[], causeEsistenti: CausaEsistentePerImport[]): AzioneImportRiga[] {
  const azioni: AzioneImportRiga[] = [];

  // Lo stato viene confrontato/segnalato SOLO se il file dimostra di
  // tracciare più stati (es. fogli "Pendenti" + "Concluse" con righe in
  // entrambi). Un file con un solo foglio (tipicamente solo le pendenti) non
  // porta nessuna informazione affidabile sullo stato delle altre cause:
  // confrontarlo comunque genererebbe un conflitto "stato" per ogni causa
  // già conclusa/in esecuzione ancora presente nel foglio, ad ogni singolo
  // import. In quel caso lo stato non viene mai toccato né segnalato.
  const statiTracciati = new Set(righe.filter((r) => !r.scartata).map((r) => r.stato));
  const statoAffidabile = statiTracciati.size > 1;

  for (const riga of righe) {
    if (riga.scartata || !riga.dati) {
      azioni.push({ tipo: "scartata", riga });
      continue;
    }

    const rgInfo = riga.dati.rg ? estraiAnnoRg(riga.dati.rg) : null;
    const candidato = rgInfo
      ? causeEsistenti.find((c) => {
          const info = estraiAnnoRg(c.rg);
          return info?.anno === rgInfo.anno && info?.numero === rgInfo.numero;
        })
      : undefined;

    if (!candidato) {
      azioni.push({ tipo: "crea", riga, dati: riga.dati });
      continue;
    }

    const campiDaRiempire: Partial<CausaScrivibile> = {};
    const conflitti: ConflittoCampo[] = [];

    // Lo stato non è mai "vuoto" (ha sempre un valore di default): se il file
    // dimostra di tracciare più stati (più fogli con righe reali), un foglio
    // diverso da quello in cui si trova la causa oggi è un potenziale
    // cambiamento voluto e va confermato come gli altri conflitti, mai
    // applicato in automatico. Con un file a foglio unico lo stato non è un
    // segnale affidabile e non viene toccato né segnalato.
    if (statoAffidabile && riga.stato !== candidato.stato) {
      conflitti.push({ campo: "stato", valoreAttuale: candidato.stato, valoreExcel: riga.stato });
    }

    for (const campo of CAMPI_CONFRONTABILI) {
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
      azioni.push({ tipo: "conflitto", riga, causaId: candidato.id, conflitti });
    } else if (Object.keys(campiDaRiempire).length > 0) {
      azioni.push({ tipo: "completa", riga, causaId: candidato.id, campiDaRiempire });
    } else {
      azioni.push({ tipo: "invariata", riga, causaId: candidato.id });
    }
  }

  return azioni;
}

// ---------------------------------------------------------------------------
// Orchestratore: scarica il file da Drive, lo interpreta, applica gli effetti
// ---------------------------------------------------------------------------

export interface RisultatoImport {
  righeTotali: number;
  righeCreate: number;
  righeAggiornate: number;
  righeInvariate: number;
  righeConflitto: number;
  righeScartate: number;
  dettagliScartate: { riga: number; motivo: string }[];
  logId: string;
}

// Interpreta un file .xlsx già scaricato (buffer in memoria) in righe
// validate. Isolata da importaCauseDaExcel così da poter essere testata con
// un file .xlsx generato al volo, senza credenziali Drive.
export async function estraiRigheDaWorkbook(buffer: Buffer): Promise<RigaParsata[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const righe: RigaParsata[] = [];

  workbook.eachSheet((worksheet) => {
    const nomeFoglio = normalizzaIntestazione(worksheet.name);
    const stato = FOGLIO_A_STATO[nomeFoglio] ?? StatoCausa.PENDENTI;

    const headerRow = worksheet.getRow(1);
    const colonnaPerCampo: Record<string, number> = {};
    headerRow.eachCell((cell, colNumber) => {
      const intestazione = normalizzaIntestazione(String(cell.value ?? ""));
      for (const [campo, alias] of Object.entries(ALIAS_COLONNE)) {
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

      righe.push(elaboraRiga(rowNumber, stato, grezza));
    });
  });

  return righe;
}

export async function importaCauseDaExcel(userId: string, driveFileId: string, eseguitoDaId?: string): Promise<RisultatoImport> {
  const buffer = await scaricaFile(userId, driveFileId);
  const righe = await estraiRigheDaWorkbook(buffer);

  const anniCoinvolti = Array.from(
    new Set(righe.map((r) => (r.dati?.rg ? estraiAnnoRg(r.dati.rg)?.anno : null)).filter((a): a is string => !!a))
  );
  const causeEsistenti =
    anniCoinvolti.length > 0
      ? await prisma.causa.findMany({
          where: { OR: anniCoinvolti.map((anno) => ({ rg: { contains: `/${anno}` } })) },
        })
      : [];

  const azioni = pianificaImportazione(righe, causeEsistenti as unknown as CausaEsistentePerImport[]);

  const risultato: RisultatoImport = {
    righeTotali: righe.length,
    righeCreate: 0,
    righeAggiornate: 0,
    righeInvariate: 0,
    righeConflitto: 0,
    righeScartate: 0,
    dettagliScartate: [],
    logId: "",
  };

  const conflittiDaSalvare: Prisma.ImportCauseConflittoCreateManyInput[] = [];

  for (const azione of azioni) {
    switch (azione.tipo) {
      case "crea": {
        const causa = await prisma.causa.create({
          data: {
            ...azione.dati,
            stato: azione.riga.stato,
            fattoONo: azione.dati.fattoONo ?? false,
            propostaTrasmessa: azione.dati.propostaTrasmessa ?? false,
            procure185: azione.dati.procure185 ?? false,
          },
        });
        await registraAudit({ azione: "CREAZIONE", entita: "Causa", entitaId: causa.id, utenteId: eseguitoDaId, dopo: causa, causaId: causa.id });
        risultato.righeCreate++;
        break;
      }
      case "completa": {
        const prima = await prisma.causa.findUnique({ where: { id: azione.causaId } });
        const dopo = await prisma.causa.update({ where: { id: azione.causaId }, data: azione.campiDaRiempire });
        await registraAudit({ azione: "MODIFICA", entita: "Causa", entitaId: azione.causaId, utenteId: eseguitoDaId, prima, dopo, causaId: azione.causaId });
        risultato.righeAggiornate++;
        break;
      }
      case "conflitto": {
        for (const c of azione.conflitti) {
          conflittiDaSalvare.push({
            importLogId: "", // valorizzato dopo la creazione del log
            causaId: azione.causaId,
            campo: c.campo,
            valoreAttuale: c.valoreAttuale instanceof Date ? c.valoreAttuale.toISOString() : String(c.valoreAttuale ?? ""),
            valoreExcel: c.valoreExcel instanceof Date ? c.valoreExcel.toISOString() : String(c.valoreExcel ?? ""),
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

  const log = await prisma.importCauseLog.create({
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
    await prisma.importCauseConflitto.createMany({
      data: conflittiDaSalvare.map((c) => ({ ...c, importLogId: log.id })),
    });
  }

  risultato.logId = log.id;
  return risultato;
}
