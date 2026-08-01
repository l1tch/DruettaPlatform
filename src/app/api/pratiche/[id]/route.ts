import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { praticaSchema } from "@/lib/validazione";
import { utenteAutorizzato, gestisciErrore } from "@/lib/apiHelpers";
import { registraAudit } from "@/lib/audit";
import { encryptField, decryptField } from "@/lib/crypto";
import { risolviCartellaDrivePratica } from "@/lib/drivePratica";

export const dynamic = "force-dynamic";

function mascheraPratica<T extends { datiAnagraficiCifrato: string | null }>(p: T) {
  const { datiAnagraficiCifrato, ...resto } = p;
  return { ...resto, datiAnagrafici: decryptField(datiAnagraficiCifrato) };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await utenteAutorizzato("pratiche:leggi");
  if (auth.errore) return auth.errore;

  const pratica = await prisma.pratica.findUnique({ where: { id: params.id } });
  if (!pratica) return NextResponse.json({ errore: "Pratica non trovata" }, { status: 404 });
  return NextResponse.json(mascheraPratica(pratica));
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await utenteAutorizzato("pratiche:scrivi");
  if (auth.errore) return auth.errore;

  try {
    const body = await req.json();
    const { datiAnagrafici, driveFolderUrl, ...dati } = praticaSchema.partial().parse(body);

    const prima = await prisma.pratica.findUnique({ where: { id: params.id } });
    if (!prima) return NextResponse.json({ errore: "Pratica non trovata" }, { status: 404 });

    const datiAggiornati: typeof dati & { driveFolderId?: string; driveFolderUrl?: string; datiAnagraficiCifrato?: string | null } = {
      ...dati,
    };

    if (driveFolderUrl !== undefined) {
      const cartella = await risolviCartellaDrivePratica(auth.utente!.id, driveFolderUrl);
      datiAggiornati.driveFolderId = cartella.driveFolderId;
      datiAggiornati.driveFolderUrl = cartella.driveFolderUrl;
    }
    if (datiAnagrafici !== undefined) {
      datiAggiornati.datiAnagraficiCifrato = datiAnagrafici ? encryptField(datiAnagrafici) : null;
    }

    const dopo = await prisma.pratica.update({ where: { id: params.id }, data: datiAggiornati });

    await registraAudit({
      azione: "MODIFICA",
      entita: "Pratica",
      entitaId: params.id,
      utenteId: auth.utente!.id,
      prima: mascheraPratica(prima),
      dopo: mascheraPratica(dopo),
    });

    return NextResponse.json(mascheraPratica(dopo));
  } catch (e) {
    return gestisciErrore(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await utenteAutorizzato("pratiche:elimina");
  if (auth.errore) return auth.errore;

  try {
    const prima = await prisma.pratica.findUnique({ where: { id: params.id } });
    if (!prima) return NextResponse.json({ errore: "Pratica non trovata" }, { status: 404 });

    await prisma.pratica.delete({ where: { id: params.id } });

    await registraAudit({
      azione: "ELIMINAZIONE",
      entita: "Pratica",
      entitaId: params.id,
      utenteId: auth.utente!.id,
      prima: mascheraPratica(prima),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return gestisciErrore(e);
  }
}
