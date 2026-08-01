import { Role } from "@prisma/client";

// Permessi centralizzati per ruolo. Tenere questa mappa come unica fonte di
// verita': le API route e la UI la interrogano invece di duplicare la logica.

export type Permesso =
  | "cause:leggi"
  | "cause:scrivi"
  | "cause:elimina"
  | "pratiche:leggi"
  | "pratiche:scrivi"
  | "pratiche:elimina"
  | "clienti:leggi"
  | "clienti:scrivi"
  | "clienti:elimina"
  | "drive:leggi"
  | "drive:scrivi"
  | "email:invia"
  | "utenti:gestisci";

const MATRICE: Record<Role, Permesso[]> = {
  ADMIN: [
    "cause:leggi",
    "cause:scrivi",
    "cause:elimina",
    "pratiche:leggi",
    "pratiche:scrivi",
    "pratiche:elimina",
    "clienti:leggi",
    "clienti:scrivi",
    "clienti:elimina",
    "drive:leggi",
    "drive:scrivi",
    "email:invia",
    "utenti:gestisci",
  ],
  AVVOCATO: [
    "cause:leggi",
    "cause:scrivi",
    "cause:elimina",
    "pratiche:leggi",
    "pratiche:scrivi",
    "pratiche:elimina",
    "clienti:leggi",
    "clienti:scrivi",
    "clienti:elimina",
    "drive:leggi",
    "drive:scrivi",
    "email:invia",
  ],
  SEGRETERIA: [
    "cause:leggi",
    "cause:scrivi",
    "pratiche:leggi",
    "pratiche:scrivi",
    "clienti:leggi",
    "clienti:scrivi",
    "drive:leggi",
    "drive:scrivi",
    "email:invia",
  ],
  SOLA_LETTURA: ["cause:leggi", "pratiche:leggi", "clienti:leggi", "drive:leggi"],
};

export function haPermesso(ruolo: Role, permesso: Permesso): boolean {
  return MATRICE[ruolo]?.includes(permesso) ?? false;
}

export function assertPermesso(ruolo: Role, permesso: Permesso) {
  if (!haPermesso(ruolo, permesso)) {
    const err = new Error(`Permesso negato: ${permesso} richiesto per il ruolo ${ruolo}`);
    (err as any).status = 403;
    throw err;
  }
}
