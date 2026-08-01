import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { importaPraticheDaExcel } from "@/lib/praticheImport";
import { cronAutorizzato, gestisciErrore } from "@/lib/apiHelpers";
import { assertPermesso } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// Importa le pratiche (licenziamenti/cause singole) dal file Excel su Drive.
// Stesso schema di autorizzazione di /api/cause/importa-excel: job
// schedulato con l'header/bearer cron, o utente autenticato con permesso
// "pratiche:scrivi" (pulsante "Importa ora" nella pagina Pratiche).
async function eseguiImport(req: NextRequest) {
  let eseguitoDaId: string | undefined;

  const nonAutorizzatoCron = cronAutorizzato(req);
  if (nonAutorizzatoCron) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ errore: "Non autorizzato" }, { status: 401 });
    }
    try {
      assertPermesso(session.user.role, "pratiche:scrivi");
    } catch (e) {
      return NextResponse.json({ errore: (e as Error).message }, { status: 403 });
    }
    eseguitoDaId = session.user.id;
  }

  const driveFileId = process.env.GOOGLE_DRIVE_FILE_PRATICHE_ID;
  if (!driveFileId) {
    return NextResponse.json({ errore: "GOOGLE_DRIVE_FILE_PRATICHE_ID non configurato" }, { status: 500 });
  }

  const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
  const admin = adminEmail ? await prisma.user.findUnique({ where: { email: adminEmail } }) : null;
  if (!admin) {
    return NextResponse.json({ errore: "Nessun utente configurato (INITIAL_ADMIN_EMAIL)" }, { status: 500 });
  }

  try {
    const risultato = await importaPraticheDaExcel(admin.id, driveFileId, eseguitoDaId);
    return NextResponse.json(risultato);
  } catch (e) {
    return gestisciErrore(e);
  }
}

export const GET = eseguiImport;
export const POST = eseguiImport;
