// exceljs non restituisce sempre una stringa/numero/Date "nuda" per il
// valore di una cella: un link inserito con "Inserisci collegamento
// ipertestuale" (es. link a una cartella Drive, o un indirizzo email
// mailto:) arriva come oggetto { text, hyperlink }, e un testo con
// formattazione mista come { richText: [{ text }, ...] }. Trattare questi
// oggetti come stringhe con String(raw) produce "[object Object]": questo
// modulo centralizza l'estrazione corretta, usata da tutti gli importer.

interface CellaHyperlink {
  text?: unknown;
  hyperlink?: unknown;
}

interface CellaRichText {
  richText: { text?: unknown }[];
}

function isHyperlink(v: unknown): v is CellaHyperlink {
  return typeof v === "object" && v !== null && "hyperlink" in v;
}

function isRichText(v: unknown): v is CellaRichText {
  return typeof v === "object" && v !== null && "richText" in v && Array.isArray((v as CellaRichText).richText);
}

// Estrae il testo "leggibile" di una cella, qualunque sia la sua forma reale.
export function estraiTestoCella(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (isHyperlink(raw)) {
    const testo = raw.text !== undefined && raw.text !== null ? String(raw.text).trim() : "";
    return testo || null;
  }
  if (isRichText(raw)) {
    const testo = raw.richText
      .map((r) => (r.text !== undefined && r.text !== null ? String(r.text) : ""))
      .join("")
      .trim();
    return testo || null;
  }
  const s = String(raw).trim();
  return s === "" ? null : s;
}

// Estrae l'URL di una cella-link (es. collegamento a una cartella Drive). Se
// la cella non è un vero hyperlink ma contiene comunque del testo che
// sembra un URL, lo usa come fallback.
export function estraiUrlCella(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (isHyperlink(raw) && raw.hyperlink) {
    return String(raw.hyperlink).trim();
  }
  const testo = estraiTestoCella(raw);
  if (testo && /^https?:\/\//i.test(testo)) return testo;
  return null;
}
