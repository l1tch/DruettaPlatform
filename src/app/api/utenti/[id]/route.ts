import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { utenteAutorizzato, gestisciErrore } from "@/lib/apiHelpers";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  role: z.enum(["ADMIN", "AVVOCATO", "SEGRETERIA", "SOLA_LETTURA"]).optional(),
  attivo: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await utenteAutorizzato("utenti:gestisci");
  if (auth.errore) return auth.errore;

  try {
    const dati = schema.parse(await req.json());
    const utente = await prisma.user.update({
      where: { id: params.id },
      data: dati,
      select: { id: true, name: true, email: true, role: true, attivo: true },
    });
    return NextResponse.json(utente);
  } catch (e) {
    return gestisciErrore(e);
  }
}
