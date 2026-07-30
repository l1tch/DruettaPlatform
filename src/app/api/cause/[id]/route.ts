import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { causaSchema } from "@/lib/validazione";
import { utenteAutorizzato, gestisciErrore } from "@/lib/apiHelpers";
import { registraAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await utenteAutorizzato("cause:leggi");
  if (auth.errore) return auth.errore;

  const causa = await prisma.causa.findUnique({
    where: { id: params.id },
    include: { clienti: { include: { cliente: true } }, documenti: true },
  });
  if (!causa) return NextResponse.json({ errore: "Causa non trovata" }, { status: 404 });
  return NextResponse.json(causa);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await utenteAutorizzato("cause:scrivi");
  if (auth.errore) return auth.errore;

  try {
    const body = await req.json();
    const dati = causaSchema.partial().parse(body);

    const prima = await prisma.causa.findUnique({ where: { id: params.id } });
    if (!prima) return NextResponse.json({ errore: "Causa non trovata" }, { status: 404 });

    const dopo = await prisma.causa.update({ where: { id: params.id }, data: dati });

    await registraAudit({
      azione: "MODIFICA",
      entita: "Causa",
      entitaId: params.id,
      utenteId: auth.utente!.id,
      prima,
      dopo,
      causaId: params.id,
    });

    return NextResponse.json(dopo);
  } catch (e) {
    return gestisciErrore(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await utenteAutorizzato("cause:elimina");
  if (auth.errore) return auth.errore;

  try {
    const prima = await prisma.causa.findUnique({ where: { id: params.id } });
    if (!prima) return NextResponse.json({ errore: "Causa non trovata" }, { status: 404 });

    await prisma.causa.delete({ where: { id: params.id } });

    await registraAudit({
      azione: "ELIMINAZIONE",
      entita: "Causa",
      entitaId: params.id,
      utenteId: auth.utente!.id,
      prima,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return gestisciErrore(e);
  }
}
