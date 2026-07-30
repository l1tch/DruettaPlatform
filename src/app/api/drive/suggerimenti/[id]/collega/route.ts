import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { utenteAutorizzato, gestisciErrore } from "@/lib/apiHelpers";
import { registraAudit } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({ causaId: z.string().min(1) });

// Collega manualmente la cartella di un suggerimento a una causa esistente:
// usato sia per risolvere un CONFLITTO_RG (scelta tra più candidati) sia per
// segnare come risolto un suggerimento dopo che l'utente ha creato una nuova
// causa a partire da una cartella NUOVA_CAUSA tramite il form guidato.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await utenteAutorizzato("cause:scrivi");
  if (auth.errore) return auth.errore;

  try {
    const { causaId } = schema.parse(await req.json());

    const suggerimento = await prisma.suggerimentoCartella.findUnique({ where: { id: params.id } });
    if (!suggerimento) return NextResponse.json({ errore: "Suggerimento non trovato" }, { status: 404 });

    const causa = await prisma.causa.findUnique({ where: { id: causaId } });
    if (!causa) return NextResponse.json({ errore: "Causa non trovata" }, { status: 404 });

    if (causa.driveFolderId !== suggerimento.driveFolderId) {
      const dopo = await prisma.causa.update({
        where: { id: causaId },
        data: { driveFolderId: suggerimento.driveFolderId, driveFolderUrl: suggerimento.driveFolderUrl },
      });
      await registraAudit({
        azione: "MODIFICA",
        entita: "Causa",
        entitaId: causaId,
        utenteId: auth.utente!.id,
        prima: causa,
        dopo,
        causaId,
      });
    }

    const suggerimentoAggiornato = await prisma.suggerimentoCartella.update({
      where: { id: params.id },
      data: { stato: "APPROVATA", causaCollegataId: causaId },
    });

    return NextResponse.json(suggerimentoAggiornato);
  } catch (e) {
    return gestisciErrore(e);
  }
}
