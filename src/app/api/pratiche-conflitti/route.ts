import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { utenteAutorizzato } from "@/lib/apiHelpers";
import { decryptField } from "@/lib/crypto";

export const dynamic = "force-dynamic";

const CAMPI_SENSIBILI = new Set(["datiAnagrafici"]);

// Conflitti in attesa generati dall'import Excel delle Pratiche: un valore
// diverso da quello già presente in piattaforma, mai scritto in automatico.
// I campi sensibili (indirizzo/CF) sono cifrati nella tabella: vengono
// decifrati solo qui, per un utente già autorizzato a leggere le pratiche.
export async function GET() {
  const auth = await utenteAutorizzato("pratiche:leggi");
  if (auth.errore) return auth.errore;

  const conflitti = await prisma.importPraticaConflitto.findMany({
    where: { stato: "IN_ATTESA" },
    include: { pratica: true },
    orderBy: { createdAt: "desc" },
  });

  const decifrati = conflitti.map((c) =>
    CAMPI_SENSIBILI.has(c.campo)
      ? { ...c, valoreAttuale: decryptField(c.valoreAttuale), valoreExcel: decryptField(c.valoreExcel) }
      : c
  );

  return NextResponse.json(decifrati);
}
