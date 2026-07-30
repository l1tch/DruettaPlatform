import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function getSessionUtente() {
  return getServerSession(authOptions);
}

export async function richiediUtente() {
  const session = await getSessionUtente();
  if (!session?.user) {
    redirect("/login");
  }
  return session.user;
}

export async function richiediRuolo(ruoliConsentiti: Role[]) {
  const utente = await richiediUtente();
  if (!ruoliConsentiti.includes(utente.role)) {
    redirect("/dashboard?errore=permesso-negato");
  }
  return utente;
}

// Recupera l'access token Google (Drive/Gmail) valido per l'utente corrente,
// rinnovandolo tramite refresh token se scaduto.
export async function ottieniAccessTokenGoogle(userId: string): Promise<string> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });
  if (!account) throw new Error("Nessun account Google collegato per questo utente.");

  const scaduto = !account.expires_at || account.expires_at * 1000 < Date.now() + 60_000;
  if (!scaduto && account.access_token) return account.access_token;

  if (!account.refresh_token) {
    throw new Error("Token Google scaduto e nessun refresh token disponibile: rieffettuare il login.");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
    }),
  });

  if (!res.ok) {
    throw new Error("Impossibile rinnovare il token Google: rieffettuare il login.");
  }

  const refreshed = (await res.json()) as { access_token: string; expires_in: number };

  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: refreshed.access_token,
      expires_at: Math.floor(Date.now() / 1000) + refreshed.expires_in,
    },
  });

  return refreshed.access_token;
}
