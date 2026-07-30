import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { inviaEmail, corpoPromemoriaUdienza, corpoPromemoriaTermine } from "@/lib/gmail";

export const dynamic = "force-dynamic";

// Endpoint invocato da un job schedulato (es. cron esterno) per inviare
// automaticamente promemoria udienze/termini in scadenza nelle prossime 48 ore.
// Protetto da CRON_SECRET, NON da sessione utente (nessun utente e' loggato
// quando parte il cron).
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ errore: "Non autorizzato" }, { status: 401 });
  }

  const mittente = process.env.INITIAL_ADMIN_EMAIL;
  const admin = mittente ? await prisma.user.findUnique({ where: { email: mittente } }) : null;
  if (!admin) {
    return NextResponse.json({ errore: "Nessun mittente configurato (INITIAL_ADMIN_EMAIL)" }, { status: 500 });
  }

  const ora = new Date();
  const tra48h = new Date(ora.getTime() + 48 * 60 * 60 * 1000);

  const causeConUdienza = await prisma.causa.findMany({
    where: { dataUdienza: { gte: ora, lte: tra48h }, stato: { not: "CONCLUSE" } },
    include: { clienti: { include: { cliente: true } } },
  });

  const causeConTermine = await prisma.causa.findMany({
    where: { termine: { gte: ora, lte: tra48h }, stato: { not: "CONCLUSE" } },
    include: { clienti: { include: { cliente: true } } },
  });

  let inviate = 0;
  const errori: string[] = [];

  for (const causa of causeConUdienza) {
    for (const { cliente } of causa.clienti) {
      if (!cliente.email) continue;
      try {
        await inviaEmail({
          userId: admin.id,
          mittente: admin.email,
          destinatario: cliente.email,
          oggetto: `Promemoria udienza - Fascicolo ${causa.fascicolo}`,
          corpoHtml: corpoPromemoriaUdienza(causa.fascicolo, causa.dataUdienza!, causa.tribunale),
          causaId: causa.id,
          automatica: true,
        });
        inviate++;
      } catch (e) {
        errori.push(`${causa.fascicolo}/${cliente.email}: ${(e as Error).message}`);
      }
    }
  }

  for (const causa of causeConTermine) {
    for (const { cliente } of causa.clienti) {
      if (!cliente.email) continue;
      try {
        await inviaEmail({
          userId: admin.id,
          mittente: admin.email,
          destinatario: cliente.email,
          oggetto: `Promemoria termine - Fascicolo ${causa.fascicolo}`,
          corpoHtml: corpoPromemoriaTermine(causa.fascicolo, causa.termine!, causa.adempimenti),
          causaId: causa.id,
          automatica: true,
        });
        inviate++;
      } catch (e) {
        errori.push(`${causa.fascicolo}/${cliente.email}: ${(e as Error).message}`);
      }
    }
  }

  return NextResponse.json({ inviate, errori });
}
