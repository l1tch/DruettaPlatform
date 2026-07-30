import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Permesso, assertPermesso } from "@/lib/rbac";

export async function utenteAutorizzato(permesso: Permesso) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { errore: NextResponse.json({ errore: "Non autenticato" }, { status: 401 }) };
  }
  try {
    assertPermesso(session.user.role, permesso);
  } catch (e) {
    return { errore: NextResponse.json({ errore: (e as Error).message }, { status: 403 }) };
  }
  return { utente: session.user };
}

export function gestisciErrore(e: unknown) {
  const status = (e as { status?: number })?.status ?? 400;
  const messaggio = e instanceof Error ? e.message : "Errore imprevisto";
  return NextResponse.json({ errore: messaggio }, { status });
}
