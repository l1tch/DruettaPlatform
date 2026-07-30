// Convenzione di nomenclatura delle cartelle Drive dei fascicoli, decisa
// dallo studio (le cartelle NON vengono create da questa piattaforma, sono
// create a mano seguendo questa convenzione):
//
//   anno_rg_parte[+...]_controparte[+...]_tribunale
//
// Esempio: 2025_8271_IBHAROGA_DELIVEROO_TRIB TORINO
//
// Questo modulo genera il nome "atteso" a partire dai dati del fascicolo, per
// segnalare (in modo non bloccante) eventuali link Drive collegati alla
// cartella sbagliata.

function rimuoviAccenti(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function normalizzaParte(nome: string): string {
  return nome
    .split(/,|\/| e |\+|&/i)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => rimuoviAccenti(p).replace(/[^a-zA-Z0-9]/g, "").toUpperCase())
    .join("+");
}

function normalizzaTribunale(tribunale: string): string {
  const senzaPrefisso = tribunale.replace(/^tribunale\s+(ordinario\s+)?(di\s+)?/i, "").trim();
  const pulito = rimuoviAccenti(senzaPrefisso)
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .toUpperCase()
    .trim();
  return `TRIB ${pulito}`;
}

function estraiAnnoRg(rg?: string | null): { numero: string; anno: string } | null {
  if (!rg) return null;
  const match = rg.match(/(\d+)\s*\/\s*(\d{4})/);
  if (!match) return null;
  return { numero: match[1], anno: match[2] };
}

interface DatiCausaPerNome {
  rg?: string | null;
  ricorrenti?: string | null;
  controparte?: string | null;
  tribunale?: string | null;
}

// Restituisce null quando mancano dati sufficienti per costruire il nome
// atteso (es. R.G. non ancora nel formato "numero/anno"): in quel caso non
// si può fare alcuna verifica automatica.
export function nomeCartellaAtteso(causa: DatiCausaPerNome): string | null {
  const rgInfo = estraiAnnoRg(causa.rg);
  if (!rgInfo || !causa.ricorrenti?.trim() || !causa.controparte?.trim() || !causa.tribunale?.trim()) {
    return null;
  }
  const parte = normalizzaParte(causa.ricorrenti);
  const controparte = normalizzaParte(causa.controparte);
  const tribunale = normalizzaTribunale(causa.tribunale);
  if (!parte || !controparte) return null;
  return [rgInfo.anno, rgInfo.numero, parte, controparte, tribunale].join("_");
}

export function nomeCorrisponde(nomeReale: string, nomeAtteso: string | null): boolean {
  if (!nomeAtteso) return true; // dati insufficienti per verificare: non blocchiamo nulla
  const normalizza = (s: string) => s.trim().toUpperCase().replace(/\s+/g, " ");
  return normalizza(nomeReale) === normalizza(nomeAtteso);
}
