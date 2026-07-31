import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { importaCauseDaExcel } from "@/lib/excelImport";
import { cronAutorizzato, gestisciErrore } from "@/lib/apiHelpers";
import { assertPermesso } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// Importa le cause dal file Excel su Drive. Invocabile in due modi:
// - da un job schedulato (Vercel Cron via GET, o cron esterno via POST) con
//   l'header di autorizzazione cron, come /api/email/automatiche;
// - manualmente da un utente autenticato con permesso "cause:scrivi" (il
//   pulsante "Importa ora" nella pagina Cause).
async function eseguiImport(req: NextRequest) {
  let eseguitoDaId: string | undefined;

  const nonAutorizzatoCron = cronAutorizzato(req);
  if (nonAutorizzatoCron) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ errore: "Non autorizzato" }, { status: 401 });
    }
    try {
      assertPermesso(session.user.role, "cause:scrivi");
    } catch (e) {
      return NextResponse.json({ errore: (e as Error).message }, { status: 403 });
    }
    eseguitoDaId = session.user.id;
  }

  const driveFileId = process.env.GOOGLE_DRIVE_FILE_CAUSE_ID;
  if (!driveFileId) {
    return NextResponse.json({ errore: "GOOGLE_DRIVE_FILE_CAUSE_ID non configurato" }, { status: 500 });
  }

  const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
  const admin = adminEmail ? await prisma.user.findUnique({ where: { email: adminEmail } }) : null;
  if (!admin) {
    return NextResponse.json({ errore: "Nessun utente configurato (INITIAL_ADMIN_EMAIL)" }, { status: 500 });
  }

  try {
    const risultato = await importaCauseDaExcel(admin.id, driveFileId, eseguitoDaId);
    return NextResponse.json(risultato);
  } catch (e) {
    return gestisciErrore(e);
  }
}

export const GET = eseguiImport;
export const POST = eseguiImport;
