import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { utenteAutorizzato, gestisciErrore } from "@/lib/apiHelpers";
import { elencaFileCartella, caricaFile, creaCartellaFascicolo } from "@/lib/googleDrive";
import { registraAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { causaId: string } }) {
  const auth = await utenteAutorizzato("drive:leggi");
  if (auth.errore) return auth.errore;

  try {
    const causa = await prisma.causa.findUnique({ where: { id: params.causaId } });
    if (!causa) return NextResponse.json({ errore: "Causa non trovata" }, { status: 404 });

    let folderId = causa.driveFolderId;
    if (!folderId) {
      folderId = await creaCartellaFascicolo(auth.utente!.id, causa.fascicolo);
      await prisma.causa.update({ where: { id: causa.id }, data: { driveFolderId: folderId } });
    }

    const file = await elencaFileCartella(auth.utente!.id, folderId);
    return NextResponse.json(file);
  } catch (e) {
    return gestisciErrore(e);
  }
}

export async function POST(req: NextRequest, { params }: { params: { causaId: string } }) {
  const auth = await utenteAutorizzato("drive:scrivi");
  if (auth.errore) return auth.errore;

  try {
    const causa = await prisma.causa.findUnique({ where: { id: params.causaId } });
    if (!causa) return NextResponse.json({ errore: "Causa non trovata" }, { status: 404 });

    let folderId = causa.driveFolderId;
    if (!folderId) {
      folderId = await creaCartellaFascicolo(auth.utente!.id, causa.fascicolo);
      await prisma.causa.update({ where: { id: causa.id }, data: { driveFolderId: folderId } });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const tipo = formData.get("tipo")?.toString() ?? null;
    if (!(file instanceof File)) {
      return NextResponse.json({ errore: "File mancante" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const caricato = await caricaFile(auth.utente!.id, folderId, file.name, file.type || "application/octet-stream", buffer);

    const documento = await prisma.documentoDrive.create({
      data: {
        causaId: causa.id,
        driveFileId: caricato.id,
        nome: caricato.nome,
        mimeType: caricato.mimeType,
        webViewLink: caricato.webViewLink,
        tipo,
        caricatoDaId: auth.utente!.id,
      },
    });

    await registraAudit({
      azione: "CREAZIONE",
      entita: "DocumentoDrive",
      entitaId: documento.id,
      utenteId: auth.utente!.id,
      dopo: documento,
      causaId: causa.id,
    });

    return NextResponse.json(documento, { status: 201 });
  } catch (e) {
    return gestisciErrore(e);
  }
}
