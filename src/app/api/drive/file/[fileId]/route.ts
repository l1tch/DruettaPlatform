import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { utenteAutorizzato, gestisciErrore } from "@/lib/apiHelpers";
import { aggiornaFile, scaricaFile } from "@/lib/googleDrive";
import { registraAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Aggiorna il contenuto di un file Drive già collegato a una causa.
export async function PATCH(req: NextRequest, { params }: { params: { fileId: string } }) {
  const auth = await utenteAutorizzato("drive:scrivi");
  if (auth.errore) return auth.errore;

  try {
    const documento = await prisma.documentoDrive.findUnique({ where: { driveFileId: params.fileId } });
    if (!documento) return NextResponse.json({ errore: "Documento non trovato" }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ errore: "File mancante" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const aggiornato = await aggiornaFile(auth.utente!.id, params.fileId, file.type || "application/octet-stream", buffer);

    const dopo = await prisma.documentoDrive.update({
      where: { id: documento.id },
      data: { nome: aggiornato.nome, mimeType: aggiornato.mimeType, webViewLink: aggiornato.webViewLink },
    });

    await registraAudit({
      azione: "MODIFICA",
      entita: "DocumentoDrive",
      entitaId: documento.id,
      utenteId: auth.utente!.id,
      prima: documento,
      dopo,
      causaId: documento.causaId,
    });

    return NextResponse.json(dopo);
  } catch (e) {
    return gestisciErrore(e);
  }
}

export async function GET(_req: NextRequest, { params }: { params: { fileId: string } }) {
  const auth = await utenteAutorizzato("drive:leggi");
  if (auth.errore) return auth.errore;

  try {
    const buffer = await scaricaFile(auth.utente!.id, params.fileId);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    return new NextResponse(new Blob([arrayBuffer]), {
      headers: { "Content-Type": "application/octet-stream" },
    });
  } catch (e) {
    return gestisciErrore(e);
  }
}
