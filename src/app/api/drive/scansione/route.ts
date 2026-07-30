import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scansionaCartellaPendenti } from "@/lib/driveScan";

export const dynamic = "force-dynamic";

// Endpoint invocato da un job schedulato per scansionare la cartella Drive
// radice delle cause pendenti, collegare automaticamente le corrispondenze
// non ambigue e mettere il resto in coda di revisione. Protetto da
// CRON_SECRET, NON da sessione utente, come /api/email/automatiche.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ errore: "Non autorizzato" }, { status: 401 });
  }

  const rootFolderId = process.env.GOOGLE_DRIVE_CARTELLA_PENDENTI_ID;
  if (!rootFolderId) {
    return NextResponse.json({ errore: "GOOGLE_DRIVE_CARTELLA_PENDENTI_ID non configurato" }, { status: 500 });
  }

  const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
  const admin = adminEmail ? await prisma.user.findUnique({ where: { email: adminEmail } }) : null;
  if (!admin) {
    return NextResponse.json({ errore: "Nessun utente configurato (INITIAL_ADMIN_EMAIL)" }, { status: 500 });
  }

  try {
    const risultato = await scansionaCartellaPendenti(admin.id, rootFolderId);
    return NextResponse.json(risultato);
  } catch (e) {
    return NextResponse.json({ errore: e instanceof Error ? e.message : "Errore durante la scansione" }, { status: 500 });
  }
}
