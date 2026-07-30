import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { causaSchema } from "@/lib/validazione";
import { utenteAutorizzato, gestisciErrore } from "@/lib/apiHelpers";
import { registraAudit } from "@/lib/audit";
import { risolviCartellaDriveCausa } from "@/lib/driveCausa";

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

    let avviso: string | undefined;
    const datiAggiornati: typeof dati & { driveFolderId?: string | null } = { ...dati };

    // Rivalidiamo il link Drive solo se e' stato effettivamente inviato in
    // questa richiesta (il form di modifica invia sempre tutti i campi, ma
    // eventuali PATCH parziali potrebbero non toccarlo).
    if (dati.driveFolderUrl !== undefined) {
      const cartella = await risolviCartellaDriveCausa(auth.utente!.id, dati.driveFolderUrl, {
        rg: dati.rg !== undefined ? dati.rg : prima.rg,
        ricorrenti: dati.ricorrenti !== undefined ? dati.ricorrenti : prima.ricorrenti,
        controparte: dati.controparte !== undefined ? dati.controparte : prima.controparte,
        tribunale: dati.tribunale !== undefined ? dati.tribunale : prima.tribunale,
      });
      datiAggiornati.driveFolderId = cartella.driveFolderId;
      datiAggiornati.driveFolderUrl = cartella.driveFolderUrl;
      avviso = cartella.avviso;
    }

    const dopo = await prisma.causa.update({ where: { id: params.id }, data: datiAggiornati });

    await registraAudit({
      azione: "MODIFICA",
      entita: "Causa",
      entitaId: params.id,
      utenteId: auth.utente!.id,
      prima,
      dopo,
      causaId: params.id,
    });

    return NextResponse.json({ ...dopo, avviso });
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
