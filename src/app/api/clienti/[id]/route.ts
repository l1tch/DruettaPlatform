import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clienteSchema } from "@/lib/validazione";
import { utenteAutorizzato, gestisciErrore } from "@/lib/apiHelpers";
import { registraAudit } from "@/lib/audit";
import { encryptField, decryptField } from "@/lib/crypto";

export const dynamic = "force-dynamic";

function mascheraCliente<T extends { codiceFiscaleCifrato: string | null }>(c: T) {
  const { codiceFiscaleCifrato, ...resto } = c;
  return { ...resto, codiceFiscale: decryptField(codiceFiscaleCifrato) };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await utenteAutorizzato("clienti:leggi");
  if (auth.errore) return auth.errore;

  const cliente = await prisma.cliente.findUnique({
    where: { id: params.id },
    include: { cause: { include: { causa: true } } },
  });
  if (!cliente) return NextResponse.json({ errore: "Cliente non trovato" }, { status: 404 });
  return NextResponse.json({ ...mascheraCliente(cliente), cause: cliente.cause });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await utenteAutorizzato("clienti:scrivi");
  if (auth.errore) return auth.errore;

  try {
    const body = await req.json();
    const { codiceFiscale, ...dati } = clienteSchema.partial().parse(body);

    const prima = await prisma.cliente.findUnique({ where: { id: params.id } });
    if (!prima) return NextResponse.json({ errore: "Cliente non trovato" }, { status: 404 });

    const dopo = await prisma.cliente.update({
      where: { id: params.id },
      data: {
        ...dati,
        ...(codiceFiscale !== undefined
          ? { codiceFiscaleCifrato: codiceFiscale ? encryptField(codiceFiscale) : null }
          : {}),
      },
    });

    await registraAudit({
      azione: "MODIFICA",
      entita: "Cliente",
      entitaId: params.id,
      utenteId: auth.utente!.id,
      prima: mascheraCliente(prima),
      dopo: mascheraCliente(dopo),
      clienteId: params.id,
    });

    return NextResponse.json(mascheraCliente(dopo));
  } catch (e) {
    return gestisciErrore(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await utenteAutorizzato("clienti:elimina");
  if (auth.errore) return auth.errore;

  try {
    const prima = await prisma.cliente.findUnique({ where: { id: params.id } });
    if (!prima) return NextResponse.json({ errore: "Cliente non trovato" }, { status: 404 });

    await prisma.cliente.delete({ where: { id: params.id } });

    await registraAudit({
      azione: "ELIMINAZIONE",
      entita: "Cliente",
      entitaId: params.id,
      utenteId: auth.utente!.id,
      prima: mascheraCliente(prima),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return gestisciErrore(e);
  }
}
