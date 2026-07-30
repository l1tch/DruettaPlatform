import { google } from "googleapis";
import { Readable } from "stream";
import { ottieniAccessTokenGoogle } from "@/lib/session";

async function driveClient(userId: string) {
  const accessToken = await ottieniAccessTokenGoogle(userId);
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth });
}

export interface FileDrive {
  id: string;
  nome: string;
  mimeType: string;
  webViewLink?: string | null;
  modificatoIl?: string | null;
}

// Crea (se non esiste) la sottocartella Drive dedicata a un fascicolo, dentro
// la cartella radice dello studio.
export async function creaCartellaFascicolo(userId: string, nomeFascicolo: string): Promise<string> {
  const drive = await driveClient(userId);
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!rootId) throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID non configurato.");

  const esistente = await drive.files.list({
    q: `'${rootId}' in parents and name = '${nomeFascicolo.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
  });
  if (esistente.data.files && esistente.data.files.length > 0) {
    return esistente.data.files[0].id!;
  }

  const cartella = await drive.files.create({
    requestBody: {
      name: nomeFascicolo,
      mimeType: "application/vnd.google-apps.folder",
      parents: [rootId],
    },
    fields: "id",
  });
  return cartella.data.id!;
}

export async function elencaFileCartella(userId: string, folderId: string): Promise<FileDrive[]> {
  const drive = await driveClient(userId);
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, webViewLink, modifiedTime)",
    orderBy: "modifiedTime desc",
  });
  return (res.data.files ?? []).map((f) => ({
    id: f.id!,
    nome: f.name!,
    mimeType: f.mimeType!,
    webViewLink: f.webViewLink,
    modificatoIl: f.modifiedTime,
  }));
}

export async function caricaFile(
  userId: string,
  folderId: string,
  nome: string,
  mimeType: string,
  contenuto: Buffer
): Promise<FileDrive> {
  const drive = await driveClient(userId);
  const res = await drive.files.create({
    requestBody: { name: nome, parents: [folderId] },
    media: { mimeType, body: Readable.from(contenuto) },
    fields: "id, name, mimeType, webViewLink, modifiedTime",
  });
  return {
    id: res.data.id!,
    nome: res.data.name!,
    mimeType: res.data.mimeType!,
    webViewLink: res.data.webViewLink,
    modificatoIl: res.data.modifiedTime,
  };
}

export async function aggiornaFile(
  userId: string,
  fileId: string,
  mimeType: string,
  contenuto: Buffer
): Promise<FileDrive> {
  const drive = await driveClient(userId);
  const res = await drive.files.update({
    fileId,
    media: { mimeType, body: Readable.from(contenuto) },
    fields: "id, name, mimeType, webViewLink, modifiedTime",
  });
  return {
    id: res.data.id!,
    nome: res.data.name!,
    mimeType: res.data.mimeType!,
    webViewLink: res.data.webViewLink,
    modificatoIl: res.data.modifiedTime,
  };
}

export async function scaricaFile(userId: string, fileId: string): Promise<Buffer> {
  const drive = await driveClient(userId);
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data as ArrayBuffer);
}
