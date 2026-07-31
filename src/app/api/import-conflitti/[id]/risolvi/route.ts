import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { utenteAutorizzato, gestisciErrore } from "@/lib/apiHelpers";
import { registraAudit } from "@/lib/audit";
import { z } from "zod";
import { StatoCausa } from "@prisma/client";

export const dynamic = "force-dynamic";

const schema = z.object({ scelta: z.enum(["attuale", "excel"]) });

const CAMPI_DATA = new Set(["ultimaUdienza", "dataUdienza", "termine", "dataProposta"]);
const CAMPI_BOOL = new Set(["fattoONo", "propostaTrasmessa", "procure185"]);

// Converte il valore testuale salvato nel conflitto (sempre stringa/null nel
// modello ImportCauseConflitto) nel tipo reale del campo Causa corrispondente.
function tipizzaValore(campo: string, valoreTesto: string | null): unknown {
  if (valoreTesto === null || valoreTesto === "") return null;
  if (campo === "stato") return valoreTesto as StatoCausa;
  if (CAMPI_DATA.has(campo)) return new Date(valoreTesto);
  if (CAMPI_BOOL.has(campo)) return valoreTesto === "true";
  return valoreTesto;
}

// Risolve un conflitto generato dall'import Excel: "attuale" tiene il valore
// già presente in piattaforma (nessuna scrittura), "excel" applica il
// valore del file. Nessuna delle due scelte avviene mai in automatico.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await utenteAutorizzato("cause:scrivi");
  if (auth.errore) return auth.errore;

  try {
    const { scelta } = schema.parse(await req.json());

    const conflitto = await prisma.importCauseConflitto.findUnique({ where: { id: params.id } });
    if (!conflitto) return NextResponse.json({ errore: "Conflitto non trovato" }, { status: 404 });
    if (conflitto.stato !== "IN_ATTESA") {
      return NextResponse.json({ errore: "Conflitto già risolto" }, { status: 409 });
    }

    if (scelta === "excel") {
      const prima = await prisma.causa.findUnique({ where: { id: conflitto.causaId } });
      const dopo = await prisma.causa.update({
        where: { id: conflitto.causaId },
        data: { [conflitto.campo]: tipizzaValore(conflitto.campo, conflitto.valoreExcel) },
      });
      await registraAudit({
        azione: "MODIFICA",
        entita: "Causa",
        entitaId: conflitto.causaId,
        utenteId: auth.utente!.id,
        prima,
        dopo,
        causaId: conflitto.causaId,
      });
    }

    const aggiornato = await prisma.importCauseConflitto.update({
      where: { id: params.id },
      data: { stato: scelta === "excel" ? "APPLICATO_VALORE_EXCEL" : "TENUTO_VALORE_ATTUALE" },
    });

    return NextResponse.json(aggiornato);
  } catch (e) {
    return gestisciErrore(e);
  }
}
