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

const MIME_CARTELLA = "application/vnd.google-apps.folder";

// Estrae l'ID di un file/cartella da un link Google Drive. Accetta anche un
// ID "nudo" (senza URL), cosi' i campi possono essere popolati sia con un
// link completo sia con il solo ID.
export function estraiIdDaLinkDrive(linkOId: string): string {
  const valore = linkOId.trim();

  const pattern = [/\/folders\/([a-zA-Z0-9_-]+)/, /\/d\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/];
  for (const p of pattern) {
    const match = valore.match(p);
    if (match) return match[1];
  }

  if (!valore.includes("/") && !valore.includes("http")) {
    return valore; // già un ID
  }

  throw new Error(`Impossibile riconoscere un ID Drive valido nel link: "${linkOId}"`);
}

interface ElementoDrive {
  id: string;
  nome: string;
  mimeType: string;
  webViewLink?: string | null;
  isCartella: boolean;
}

// Le cartelle/i documenti su Drive NON vengono mai creati automaticamente da
// questa piattaforma: devono già esistere e vengono collegati incollando il
// link Drive nel form. Questa funzione verifica che l'elemento indicato
// esista davvero, sia accessibile con l'account Google connesso e non sia
// nel cestino, restituendo un errore parlante altrimenti.
export async function verificaElementoDrive(
  userId: string,
  linkOId: string,
  tipoAtteso?: "cartella" | "file"
): Promise<ElementoDrive> {
  const id = estraiIdDaLinkDrive(linkOId);
  const drive = await driveClient(userId);

  let res;
  try {
    res = await drive.files.get({
      fileId: id,
      fields: "id, name, mimeType, webViewLink, trashed",
    });
  } catch (e: any) {
    if (e?.code === 404 || e?.response?.status === 404) {
      throw new Error("L'elemento Drive indicato non è stato trovato: verificare il link o i permessi di accesso.");
    }
    throw new Error("Impossibile verificare l'elemento su Drive: " + (e?.message ?? "errore sconosciuto"));
  }

  if (res.data.trashed) {
    throw new Error(`L'elemento "${res.data.name}" è presente nel cestino di Drive.`);
  }

  const isCartella = res.data.mimeType === MIME_CARTELLA;
  if (tipoAtteso === "cartella" && !isCartella) {
    throw new Error(`Il link indicato punta a un file ("${res.data.name}"), non a una cartella.`);
  }
  if (tipoAtteso === "file" && isCartella) {
    throw new Error(`Il link indicato punta a una cartella ("${res.data.name}"), non a un file.`);
  }

  return {
    id: res.data.id!,
    nome: res.data.name!,
    mimeType: res.data.mimeType!,
    webViewLink: res.data.webViewLink,
    isCartella,
  };
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
