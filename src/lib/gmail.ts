import { google } from "googleapis";
import { ottieniAccessTokenGoogle } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { EmailStato } from "@prisma/client";

function base64Url(input: string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function costruisciMessaggioRaw(mittente: string, destinatario: string, oggetto: string, corpoHtml: string): string {
  const messaggio = [
    `From: ${mittente}`,
    `To: ${destinatario}`,
    "Content-Type: text/html; charset=utf-8",
    "MIME-Version: 1.0",
    `Subject: =?utf-8?B?${Buffer.from(oggetto).toString("base64")}?=`,
    "",
    corpoHtml,
  ].join("\n");
  return base64Url(messaggio);
}

interface InviaEmailParams {
  userId: string;
  mittente: string;
  destinatario: string;
  oggetto: string;
  corpoHtml: string;
  causaId?: string;
  automatica?: boolean;
}

// Invia un'email tramite l'account Gmail dell'utente autenticato (o del
// servizio, per i promemoria automatici) e registra l'esito nel log email
// (tracciabilita' delle comunicazioni verso i clienti).
export async function inviaEmail(params: InviaEmailParams): Promise<void> {
  const log = await prisma.emailLog.create({
    data: {
      causaId: params.causaId,
      destinatario: params.destinatario,
      oggetto: params.oggetto,
      corpo: params.corpoHtml,
      stato: EmailStato.IN_CODA,
      inviataDaId: params.userId,
      automatica: params.automatica ?? false,
    },
  });

  try {
    const accessToken = await ottieniAccessTokenGoogle(params.userId);
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: "v1", auth });

    const raw = costruisciMessaggioRaw(params.mittente, params.destinatario, params.oggetto, params.corpoHtml);

    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

    await prisma.emailLog.update({
      where: { id: log.id },
      data: { stato: EmailStato.INVIATA },
    });
  } catch (err) {
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { stato: EmailStato.FALLITA, errore: err instanceof Error ? err.message : String(err) },
    });
    throw err;
  }
}

export function corpoPromemoriaUdienza(fascicolo: string, dataUdienza: Date, tribunale: string | null): string {
  const data = dataUdienza.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
  return `
    <p>Gentile cliente,</p>
    <p>Le ricordiamo che il fascicolo <strong>${fascicolo}</strong>${tribunale ? ` presso il ${tribunale}` : ""}
    ha udienza fissata per il <strong>${data}</strong>.</p>
    <p>Cordiali saluti,<br/>Studio Legale</p>
  `;
}

export function corpoPromemoriaTermine(fascicolo: string, termine: Date, adempimenti: string | null): string {
  const data = termine.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
  return `
    <p>Gentile cliente,</p>
    <p>Le segnaliamo che per il fascicolo <strong>${fascicolo}</strong> è in scadenza il termine del
    <strong>${data}</strong>${adempimenti ? ` per: ${adempimenti}` : ""}.</p>
    <p>Cordiali saluti,<br/>Studio Legale</p>
  `;
}
