import { estraiTestoCella } from "@/lib/excelCellUtils";

// Normalizzazione/validazione dei valori letti da una cella Excel, condivisa
// da tutti gli importer (cause, pratiche, ...): accenti/maiuscole/punteggiatura
// non contano per intestazioni e valori testuali "enum-like" (booleani), le
// celle vuote non vengono mai confuse con un valore esplicito.

export function rimuoviAccenti(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function normalizzaIntestazione(s: string): string {
  return rimuoviAccenti(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const VALORI_VERI = new Set(["si", "sì", "vero", "true", "x", "ok", "fatto", "trasmessa", "1"]);
const VALORI_FALSI = new Set(["no", "falso", "false", "", "0", "non trasmessa", "-"]);

export interface RisultatoBooleano {
  // null = cella vuota, nessuna informazione (va distinto da "false"
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

export interface RisultatoData {
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

export function valoreVuoto(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

export function valoriDiversi(a: unknown, b: unknown): boolean {
  if (a instanceof Date || b instanceof Date) {
    const ta = a instanceof Date ? a.getTime() : NaN;
    const tb = b instanceof Date ? b.getTime() : NaN;
    return ta !== tb;
  }
  return a !== b;
}
