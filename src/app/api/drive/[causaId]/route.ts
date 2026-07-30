import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { utenteAutorizzato, gestisciErrore } from "@/lib/apiHelpers";
import { elencaFileCartella, caricaFile, verificaElementoDrive } from "@/lib/googleDrive";
import { registraAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Le cartelle Drive dei fascicoli sono create a mano dallo studio seguendo
// la convenzione di nomenclatura (anno_rg_parte_controparte_tribunale) e
// collegate incollando il link nella scheda del fascicolo: questa piattaforma
// non crea mai cartelle, verifica solo che quella collegata esista ancora.
async function richiediCartellaEsistente(userId: string, causaId: string) {
  const causa = await prisma.causa.findUnique({ where: { id: causaId } });
  if (!causa) {
    const err = new Error("Causa non trovata");
    (err as any).status = 404;
    throw err;
  }
  if (!causa.driveFolderId) {
    const err = new Error(
      "Nessuna cartella Drive collegata a questo fascicolo. Aggiungere il link della cartella nella scheda del fascicolo."
    );
    (err as any).status = 400;
    throw err;
  }

  // Verifica che la cartella esista ancora (non sia stata spostata/eliminata)
  await verificaElementoDrive(userId, causa.driveFolderId, "cartella");

  return causa;
}

export async function GET(_req: NextRequest, { params }: { params: { causaId: string } }) {
  const auth = await utenteAutorizzato("drive:leggi");
  if (auth.errore) return auth.errore;

  try {
    const causa = await richiediCartellaEsistente(auth.utente!.id, params.causaId);
    const file = await elencaFileCartella(auth.utente!.id, causa.driveFolderId!);
    return NextResponse.json(file);
  } catch (e) {
    return gestisciErrore(e);
  }
}

export async function POST(req: NextRequest, { params }: { params: { causaId: string } }) {
  const auth = await utenteAutorizzato("drive:scrivi");
  if (auth.errore) return auth.errore;

  try {
    const causa = await richiediCartellaEsistente(auth.utente!.id, params.causaId);

    const formData = await req.formData();
    const file = formData.get("file");
    const tipo = formData.get("tipo")?.toString() ?? null;
    if (!(file instanceof File)) {
      return NextResponse.json({ errore: "File mancante" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const caricato = await caricaFile(auth.utente!.id, causa.driveFolderId!, file.name, file.type || "application/octet-stream", buffer);

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
