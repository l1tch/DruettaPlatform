import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { causaSchema } from "@/lib/validazione";
import { utenteAutorizzato, gestisciErrore } from "@/lib/apiHelpers";
import { registraAudit } from "@/lib/audit";
import { risolviCartellaDriveCausa } from "@/lib/driveCausa";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await utenteAutorizzato("cause:leggi");
  if (auth.errore) return auth.errore;

  const stato = req.nextUrl.searchParams.get("stato");
  const cause = await prisma.causa.findMany({
    where: stato ? { stato: stato as "PENDENTI" | "CONCLUSE" | "ESECUZIONI" } : undefined,
    orderBy: { updatedAt: "desc" },
    include: { clienti: { include: { cliente: true } } },
  });
  return NextResponse.json(cause);
}

export async function POST(req: NextRequest) {
  const auth = await utenteAutorizzato("cause:scrivi");
  if (auth.errore) return auth.errore;

  try {
    const body = await req.json();
    const dati = causaSchema.parse(body);

    const cartella = await risolviCartellaDriveCausa(auth.utente!.id, dati.driveFolderUrl, dati);

    const causa = await prisma.causa.create({
      data: { ...dati, driveFolderId: cartella.driveFolderId, driveFolderUrl: cartella.driveFolderUrl },
    });
    await registraAudit({
      azione: "CREAZIONE",
      entita: "Causa",
      entitaId: causa.id,
      utenteId: auth.utente!.id,
      dopo: causa,
      causaId: causa.id,
    });
    return NextResponse.json({ ...causa, avviso: cartella.avviso }, { status: 201 });
  } catch (e) {
    return gestisciErrore(e);
  }
}
