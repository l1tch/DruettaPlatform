import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { utenteAutorizzato } from "@/lib/apiHelpers";

export const dynamic = "force-dynamic";

// Conflitti in attesa generati dall'import Excel: un valore diverso da
// quello già presente in piattaforma, mai scritto in automatico.
export async function GET() {
  const auth = await utenteAutorizzato("cause:leggi");
  if (auth.errore) return auth.errore;

  const conflitti = await prisma.importCauseConflitto.findMany({
    where: { stato: "IN_ATTESA" },
    include: { causa: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(conflitti);
}
