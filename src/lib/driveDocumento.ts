import { verificaElementoDrive } from "@/lib/googleDrive";

interface RisultatoDocumento {
  driveId: string | null;
  url: string | null;
}

// Verifica che il link a un documento Drive (es. verbale) incollato in un
// collegamento cliente-causa esista davvero e sia un file (non una cartella).
// Come per le cartelle dei fascicoli, il documento deve già esistere: non
// viene mai creato da questa piattaforma.
export async function risolviDocumentoDrive(userId: string, url: string | null | undefined): Promise<RisultatoDocumento> {
  if (!url?.trim()) {
    return { driveId: null, url: null };
  }
  const elemento = await verificaElementoDrive(userId, url, "file");
  return { driveId: elemento.id, url: elemento.webViewLink ?? url };
}
