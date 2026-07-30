import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { collegamentoSchema } from "@/lib/validazione";
import { utenteAutorizzato, gestisciErrore } from "@/lib/apiHelpers";
import { registraAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await utenteAutorizzato("clienti:scrivi");
  if (auth.errore) return auth.errore;

  try {
    const body = await req.json();
    const dati = collegamentoSchema.partial().parse(body);

    const prima = await prisma.clienteCausa.findUnique({ where: { id: params.id } });
    if (!prima) return NextResponse.json({ errore: "Collegamento non trovato" }, { status: 404 });

    const dopo = await prisma.clienteCausa.update({
      where: { id: params.id },
      data: dati,
      include: { cliente: true, causa: true },
    });

    await registraAudit({
      azione: "MODIFICA",
      entita: "ClienteCausa",
      entitaId: params.id,
      utenteId: auth.utente!.id,
      prima,
      dopo,
      causaId: prima.causaId,
      clienteId: prima.clienteId,
    });

    return NextResponse.json(dopo);
  } catch (e) {
    return gestisciErrore(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await utenteAutorizzato("clienti:elimina");
  if (auth.errore) return auth.errore;

  try {
    const prima = await prisma.clienteCausa.findUnique({ where: { id: params.id } });
    if (!prima) return NextResponse.json({ errore: "Collegamento non trovato" }, { status: 404 });

    await prisma.clienteCausa.delete({ where: { id: params.id } });

    await registraAudit({
      azione: "ELIMINAZIONE",
      entita: "ClienteCausa",
      entitaId: params.id,
      utenteId: auth.utente!.id,
      prima,
      causaId: prima.causaId,
      clienteId: prima.clienteId,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return gestisciErrore(e);
  }
}
