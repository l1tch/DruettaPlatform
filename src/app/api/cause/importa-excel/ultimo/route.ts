import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { utenteAutorizzato } from "@/lib/apiHelpers";

export const dynamic = "force-dynamic";

// Ultimo esito dell'import da Excel, per mostrare "Ultimo aggiornamento: ..."
// nella pagina Cause.
export async function GET() {
  const auth = await utenteAutorizzato("cause:leggi");
  if (auth.errore) return auth.errore;

  const ultimo = await prisma.importCauseLog.findFirst({ orderBy: { eseguitoIl: "desc" } });
  return NextResponse.json(ultimo);
}
