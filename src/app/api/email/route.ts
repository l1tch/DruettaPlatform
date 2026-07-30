import { NextRequest, NextResponse } from "next/server";
import { emailSchema } from "@/lib/validazione";
import { utenteAutorizzato, gestisciErrore } from "@/lib/apiHelpers";
import { inviaEmail } from "@/lib/gmail";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await utenteAutorizzato("email:invia");
  if (auth.errore) return auth.errore;

  try {
    const body = await req.json();
    const dati = emailSchema.parse(body);
    const session = await getServerSession(authOptions);

    await inviaEmail({
      userId: auth.utente!.id,
      mittente: session!.user.email!,
      destinatario: dati.destinatario,
      oggetto: dati.oggetto,
      corpoHtml: dati.corpoHtml,
      causaId: dati.causaId ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return gestisciErrore(e);
  }
}
