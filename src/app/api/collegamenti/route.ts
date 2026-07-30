import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { collegamentoSchema } from "@/lib/validazione";
import { utenteAutorizzato, gestisciErrore } from "@/lib/apiHelpers";
import { registraAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Foglio di raccordo: elenca i collegamenti cliente<->causa con RG e ultimo
// documento Drive noto (verbali ecc.).
export async function GET() {
  const auth = await utenteAutorizzato("clienti:leggi");
  if (auth.errore) return auth.errore;

  const collegamenti = await prisma.clienteCausa.findMany({
    include: { cliente: true, causa: true },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(collegamenti);
}

export async function POST(req: NextRequest) {
  const auth = await utenteAutorizzato("clienti:scrivi");
  if (auth.errore) return auth.errore;

  try {
    const body = await req.json();
    const dati = collegamentoSchema.parse(body);
    const collegamento = await prisma.clienteCausa.create({
      data: dati,
      include: { cliente: true, causa: true },
    });

    await registraAudit({
      azione: "CREAZIONE",
      entita: "ClienteCausa",
      entitaId: collegamento.id,
      utenteId: auth.utente!.id,
      dopo: collegamento,
      causaId: dati.causaId,
      clienteId: dati.clienteId,
    });

    return NextResponse.json(collegamento, { status: 201 });
  } catch (e) {
    return gestisciErrore(e);
  }
}
