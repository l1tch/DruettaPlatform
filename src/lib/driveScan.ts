import { prisma } from "@/lib/prisma";
import { elencaFileCartella } from "@/lib/googleDrive";
import { estraiAnnoRg, estraiAnnoRgDaNomeCartella, nomeCartellaAtteso, nomeCorrisponde } from "@/lib/convenzioneNomi";
import { registraAudit } from "@/lib/audit";
import { StatoCausa } from "@prisma/client";

const MIME_CARTELLA = "application/vnd.google-apps.folder";

export interface CartellaDaValutare {
  id: string;
  nome: string;
  webViewLink: string | null;
  mimeType: string;
}

export interface CausaPerScan {
  id: string;
  fascicolo: string;
  rg: string | null;
  ricorrenti: string | null;
  controparte: string | null;
  tribunale: string | null;
  driveFolderId: string | null;
}

export type AzioneScansione =
  | { tipo: "collega_automatico"; cartella: CartellaDaValutare; causaId: string }
  | { tipo: "gia_collegata"; cartella: CartellaDaValutare; causaId: string }
  | {
      tipo: "suggerisci";
      cartella: CartellaDaValutare;
      suggerimentoTipo: "NUOVA_CAUSA" | "CONFLITTO_RG" | "NON_RICONOSCIUTA";
      anno: string | null;
      rg: string | null;
      causeCandidate: { causaId: string; fascicolo: string; tribunale: string | null }[] | null;
    };

// Logica pura di decisione (nessuna chiamata a Drive/DB): per ogni cartella
// stabilisce se collegarla in automatico a una causa pendente (match non
// ambiguo su ANNO_RG, causa non ancora collegata ad altro), se e' gia'
// collegata correttamente, oppure se va messa in coda di revisione (nessuna
// corrispondenza, R.G. duplicato/ambiguo, o collegata gia' a un'altra
// cartella). Separata dall'orchestratore per essere testabile senza Drive/DB.
export function pianificaAzioniScansione(cartelle: CartellaDaValutare[], causePendenti: CausaPerScan[]): AzioneScansione[] {
  const azioni: AzioneScansione[] = [];

  for (const cartella of cartelle.filter((c) => c.mimeType === MIME_CARTELLA)) {
    const parsed = estraiAnnoRgDaNomeCartella(cartella.nome);

    if (!parsed) {
      azioni.push({ tipo: "suggerisci", cartella, suggerimentoTipo: "NON_RICONOSCIUTA", anno: null, rg: null, causeCandidate: null });
      continue;
    }

    const { anno, numero } = parsed;
    const candidati = causePendenti.filter((c) => {
      const rgInfo = estraiAnnoRg(c.rg);
      return rgInfo?.anno === anno && rgInfo?.numero === numero;
    });

    if (candidati.length === 0) {
      azioni.push({ tipo: "suggerisci", cartella, suggerimentoTipo: "NUOVA_CAUSA", anno, rg: numero, causeCandidate: null });
      continue;
    }

    let candidato = candidati[0];
    if (candidati.length > 1) {
      const disambiguati = candidati.filter((c) => nomeCorrisponde(cartella.nome, nomeCartellaAtteso(c)));
      if (disambiguati.length !== 1) {
        azioni.push({
          tipo: "suggerisci",
          cartella,
          suggerimentoTipo: "CONFLITTO_RG",
          anno,
          rg: numero,
          causeCandidate: candidati.map((c) => ({ causaId: c.id, fascicolo: c.fascicolo, tribunale: c.tribunale })),
        });
        continue;
      }
      candidato = disambiguati[0];
    }

    if (candidato.driveFolderId === cartella.id) {
      azioni.push({ tipo: "gia_collegata", cartella, causaId: candidato.id });
      continue;
    }

    if (!candidato.driveFolderId) {
      azioni.push({ tipo: "collega_automatico", cartella, causaId: candidato.id });
      continue;
    }

    // La causa con questo ANNO_RG è già collegata a UN'ALTRA cartella: non
    // sovrascriviamo mai in automatico un collegamento esistente diverso.
    azioni.push({
      tipo: "suggerisci",
      cartella,
      suggerimentoTipo: "CONFLITTO_RG",
      anno,
      rg: numero,
      causeCandidate: [{ causaId: candidato.id, fascicolo: candidato.fascicolo, tribunale: candidato.tribunale }],
    });
  }

  return azioni;
}

export interface RisultatoScansione {
  cartelleTrovate: number;
  collegateAutomaticamente: number;
  giaCollegate: number;
  nuoveProposte: number;
  conflitti: number;
  nonRiconosciute: number;
}

// Orchestratore: legge cartelle da Drive e cause dal DB, applica la logica
// pura di pianificaAzioniScansione, poi esegue gli effetti (aggiorna Causa,
// crea/aggiorna SuggerimentoCartella). Non crea mai una nuova causa da sola.
export async function scansionaCartellaPendenti(userId: string, rootFolderId: string): Promise<RisultatoScansione> {
  const elementi = await elencaFileCartella(userId, rootFolderId);
  const cartelle: CartellaDaValutare[] = elementi.map((e) => ({
    id: e.id,
    nome: e.nome,
    webViewLink: e.webViewLink ?? null,
    mimeType: e.mimeType,
  }));

  const causePendenti = await prisma.causa.findMany({ where: { stato: StatoCausa.PENDENTI } });
  const azioni = pianificaAzioniScansione(cartelle, causePendenti);

  const risultato: RisultatoScansione = {
    cartelleTrovate: cartelle.filter((c) => c.mimeType === MIME_CARTELLA).length,
    collegateAutomaticamente: 0,
    giaCollegate: 0,
    nuoveProposte: 0,
    conflitti: 0,
    nonRiconosciute: 0,
  };

  for (const azione of azioni) {
    switch (azione.tipo) {
      case "collega_automatico": {
        const prima = await prisma.causa.findUnique({ where: { id: azione.causaId } });
        const dopo = await prisma.causa.update({
          where: { id: azione.causaId },
          data: { driveFolderId: azione.cartella.id, driveFolderUrl: azione.cartella.webViewLink },
        });
        await registraAudit({ azione: "MODIFICA", entita: "Causa", entitaId: azione.causaId, prima, dopo, causaId: azione.causaId });
        await risolviSuggerimentoEsistente(azione.cartella.id, azione.causaId);
        risultato.collegateAutomaticamente++;
        break;
      }
      case "gia_collegata": {
        await risolviSuggerimentoEsistente(azione.cartella.id, azione.causaId);
        risultato.giaCollegate++;
        break;
      }
      case "suggerisci": {
        await segnalaSeNuovo(
          azione.cartella.id,
          azione.cartella.webViewLink,
          azione.cartella.nome,
          azione.anno,
          azione.rg,
          azione.suggerimentoTipo,
          azione.causeCandidate
        );
        if (azione.suggerimentoTipo === "NUOVA_CAUSA") risultato.nuoveProposte++;
        else if (azione.suggerimentoTipo === "CONFLITTO_RG") risultato.conflitti++;
        else risultato.nonRiconosciute++;
        break;
      }
    }
  }

  return risultato;
}

async function segnalaSeNuovo(
  driveFolderId: string,
  driveFolderUrl: string | null,
  nomeCartella: string,
  anno: string | null,
  rg: string | null,
  tipo: "NUOVA_CAUSA" | "CONFLITTO_RG" | "NON_RICONOSCIUTA",
  causeCandidate: { causaId: string; fascicolo: string; tribunale: string | null }[] | null
) {
  const esistente = await prisma.suggerimentoCartella.findUnique({ where: { driveFolderId } });
  // Rispettiamo la decisione già presa da un utente (approvata o rifiutata):
  // non facciamo ricomparire un suggerimento già gestito ad ogni scansione.
  if (esistente && esistente.stato !== "IN_ATTESA") return;

  await prisma.suggerimentoCartella.upsert({
    where: { driveFolderId },
    update: { driveFolderUrl, nomeCartella, anno, rg, tipo, causeCandidate: causeCandidate ?? undefined },
    create: { driveFolderId, driveFolderUrl, nomeCartella, anno, rg, tipo, causeCandidate: causeCandidate ?? undefined },
  });
}

async function risolviSuggerimentoEsistente(driveFolderId: string, causaId: string) {
  const esistente = await prisma.suggerimentoCartella.findUnique({ where: { driveFolderId } });
  if (!esistente || esistente.stato !== "IN_ATTESA") return;
  await prisma.suggerimentoCartella.update({
    where: { driveFolderId },
    data: { stato: "APPROVATA", causaCollegataId: causaId },
  });
}
