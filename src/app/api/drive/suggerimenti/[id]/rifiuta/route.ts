import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { utenteAutorizzato, gestisciErrore } from "@/lib/apiHelpers";

export const dynamic = "force-dynamic";

// Ignora un suggerimento (falso positivo, cartella non pertinente, ecc.):
// non ricomparirà più nelle scansioni successive per la stessa cartella.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await utenteAutorizzato("cause:scrivi");
  if (auth.errore) return auth.errore;

  try {
    const suggerimento = await prisma.suggerimentoCartella.findUnique({ where: { id: params.id } });
    if (!suggerimento) return NextResponse.json({ errore: "Suggerimento non trovato" }, { status: 404 });

    const aggiornato = await prisma.suggerimentoCartella.update({
      where: { id: params.id },
      data: { stato: "RIFIUTATA" },
    });
    return NextResponse.json(aggiornato);
  } catch (e) {
    return gestisciErrore(e);
  }
}
