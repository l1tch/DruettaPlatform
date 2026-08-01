import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { utenteAutorizzato, gestisciErrore } from "@/lib/apiHelpers";
import { registraAudit } from "@/lib/audit";
import { z } from "zod";
import { StatoPratica, CategoriaPratica, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const schema = z.object({ scelta: z.enum(["attuale", "excel"]) });

const CAMPI_DATA = new Set(["scadenza", "impugnativa", "dataLicenziamento"]);
const CAMPI_BOOL = new Set(["cartaceo", "procura", "pagatoCapitale", "pagatoSpeseLegali"]);

// Converte il valore testuale salvato nel conflitto nel tipo reale del campo
// Pratica corrispondente. Il campo "datiAnagrafici" è gestito a parte dal
// chiamante: qui arriva solo ciphertext, mai un valore da tipizzare.
function tipizzaValore(campo: string, valoreTesto: string | null): unknown {
  if (valoreTesto === null || valoreTesto === "") return null;
  if (campo === "stato") return valoreTesto as StatoPratica;
  if (campo === "categoria") return valoreTesto as CategoriaPratica;
  if (CAMPI_DATA.has(campo)) return new Date(valoreTesto);
  if (CAMPI_BOOL.has(campo)) return valoreTesto === "true";
  return valoreTesto;
}

// Risolve un conflitto generato dall'import Excel: "attuale" tiene il valore
// già presente in piattaforma (nessuna scrittura), "excel" applica il
// valore del file. Nessuna delle due scelte avviene mai in automatico.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await utenteAutorizzato("pratiche:scrivi");
  if (auth.errore) return auth.errore;

  try {
    const { scelta } = schema.parse(await req.json());

    const conflitto = await prisma.importPraticaConflitto.findUnique({ where: { id: params.id } });
    if (!conflitto) return NextResponse.json({ errore: "Conflitto non trovato" }, { status: 404 });
    if (conflitto.stato !== "IN_ATTESA") {
      return NextResponse.json({ errore: "Conflitto già risolto" }, { status: 409 });
    }

    if (scelta === "excel") {
      const prima = await prisma.pratica.findUnique({ where: { id: conflitto.praticaId } });

      // "datiAnagrafici" è cifrato anche nel conflitto: il valore salvato è
      // già nel formato scritto da encryptField, va copiato direttamente nel
      // campo *Cifrato della pratica, senza decifrarlo/tipizzarlo qui.
      const data: Prisma.PraticaUpdateInput =
        conflitto.campo === "datiAnagrafici"
          ? { datiAnagraficiCifrato: conflitto.valoreExcel }
          : { [conflitto.campo]: tipizzaValore(conflitto.campo, conflitto.valoreExcel) };

      const dopo = await prisma.pratica.update({ where: { id: conflitto.praticaId }, data });
      await registraAudit({
        azione: "MODIFICA",
        entita: "Pratica",
        entitaId: conflitto.praticaId,
        utenteId: auth.utente!.id,
        prima: prima ? { ...prima, datiAnagraficiCifrato: undefined } : prima,
        dopo: { ...dopo, datiAnagraficiCifrato: undefined },
      });
    }

    const aggiornato = await prisma.importPraticaConflitto.update({
      where: { id: params.id },
      data: { stato: scelta === "excel" ? "APPLICATO_VALORE_EXCEL" : "TENUTO_VALORE_ATTUALE" },
    });

    return NextResponse.json(aggiornato);
  } catch (e) {
    return gestisciErrore(e);
  }
}
