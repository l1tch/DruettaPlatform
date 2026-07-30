import { prisma } from "@/lib/prisma";
import { AuditAzione } from "@prisma/client";

interface RegistraAuditParams {
  azione: AuditAzione;
  entita: "Causa" | "Cliente" | "ClienteCausa" | "DocumentoDrive" | "Utente";
  entitaId?: string;
  utenteId?: string | null;
  prima?: unknown;
  dopo?: unknown;
  causaId?: string;
  clienteId?: string;
}

// Ogni modifica ai dati di una causa/cliente deve lasciare una traccia
// verificabile: chi, quando, cosa e' cambiato. Requisito minimo di
// accountability per dati trattati da uno studio legale.
export async function registraAudit(params: RegistraAuditParams) {
  await prisma.auditLog.create({
    data: {
      azione: params.azione,
      entita: params.entita,
      entitaId: params.entitaId,
      utenteId: params.utenteId ?? undefined,
      prima: params.prima ? JSON.parse(JSON.stringify(params.prima)) : undefined,
      dopo: params.dopo ? JSON.parse(JSON.stringify(params.dopo)) : undefined,
      causaId: params.causaId,
      clienteId: params.clienteId,
    },
  });
}
