import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { praticaSchema } from "@/lib/validazione";
import { utenteAutorizzato, gestisciErrore } from "@/lib/apiHelpers";
import { registraAudit } from "@/lib/audit";
import { encryptField, decryptField } from "@/lib/crypto";
import { risolviCartellaDrivePratica } from "@/lib/drivePratica";
import { StatoPratica, CategoriaPratica } from "@prisma/client";

export const dynamic = "force-dynamic";

function mascheraPratica<T extends { datiAnagraficiCifrato: string | null }>(p: T) {
  const { datiAnagraficiCifrato, ...resto } = p;
  return { ...resto, datiAnagrafici: decryptField(datiAnagraficiCifrato) };
}

export async function GET(req: NextRequest) {
  const auth = await utenteAutorizzato("pratiche:leggi");
  if (auth.errore) return auth.errore;

  const stato = req.nextUrl.searchParams.get("stato");
  const categoria = req.nextUrl.searchParams.get("categoria");

  const pratiche = await prisma.pratica.findMany({
    where: {
      stato: stato ? (stato as StatoPratica) : undefined,
      categoria: categoria ? (categoria as CategoriaPratica) : undefined,
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(pratiche.map(mascheraPratica));
}

export async function POST(req: NextRequest) {
  const auth = await utenteAutorizzato("pratiche:scrivi");
  if (auth.errore) return auth.errore;

  try {
    const body = await req.json();
    const { datiAnagrafici, driveFolderUrl, ...dati } = praticaSchema.parse(body);

    const cartella = await risolviCartellaDrivePratica(auth.utente!.id, driveFolderUrl);

    const pratica = await prisma.pratica.create({
      data: {
        ...dati,
        driveFolderId: cartella.driveFolderId,
        driveFolderUrl: cartella.driveFolderUrl,
        datiAnagraficiCifrato: datiAnagrafici ? encryptField(datiAnagrafici) : null,
      },
    });

    await registraAudit({
      azione: "CREAZIONE",
      entita: "Pratica",
      entitaId: pratica.id,
      utenteId: auth.utente!.id,
      dopo: mascheraPratica(pratica),
    });

    return NextResponse.json(mascheraPratica(pratica), { status: 201 });
  } catch (e) {
    return gestisciErrore(e);
  }
}
