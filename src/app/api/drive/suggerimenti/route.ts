import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { utenteAutorizzato } from "@/lib/apiHelpers";

export const dynamic = "force-dynamic";

// Coda di revisione delle cartelle Drive trovate dalla scansione periodica
// che non sono state collegate in automatico (nessuna causa corrispondente,
// R.G. duplicato/ambiguo, o nome cartella non conforme alla convenzione).
export async function GET() {
  const auth = await utenteAutorizzato("cause:leggi");
  if (auth.errore) return auth.errore;

  const suggerimenti = await prisma.suggerimentoCartella.findMany({
    where: { stato: "IN_ATTESA" },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(suggerimenti);
}
