import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { utenteAutorizzato, gestisciErrore } from "@/lib/apiHelpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await utenteAutorizzato("utenti:gestisci");
  if (auth.errore) return auth.errore;

  const utenti = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, attivo: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(utenti);
}
