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

export async function GET() {
  const auth = await utenteAutorizzato("clienti:leggi");
  if (auth.errore) return auth.errore;

  const clienti = await prisma.cliente.findMany({ orderBy: { cognome: "asc" } });
  return NextResponse.json(clienti.map(mascheraCliente));
}

export async function POST(req: NextRequest) {
  const auth = await utenteAutorizzato("clienti:scrivi");
  if (auth.errore) return auth.errore;

  try {
    const body = await req.json();
    const { codiceFiscale, ...dati } = clienteSchema.parse(body);

    const cliente = await prisma.cliente.create({
      data: {
        ...dati,
        codiceFiscaleCifrato: codiceFiscale ? encryptField(codiceFiscale) : null,
      },
    });

    await registraAudit({
      azione: "CREAZIONE",
      entita: "Cliente",
      entitaId: cliente.id,
      utenteId: auth.utente!.id,
      dopo: mascheraCliente(cliente),
      clienteId: cliente.id,
    });

    return NextResponse.json(mascheraCliente(cliente), { status: 201 });
  } catch (e) {
    return gestisciErrore(e);
  }
}
