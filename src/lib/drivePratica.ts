import { verificaElementoDrive } from "@/lib/googleDrive";

interface RisultatoCartellaPratica {
  driveFolderId: string;
  driveFolderUrl: string;
}

// Risolve e verifica il link a una cartella Drive incollato nel form di una
// pratica. La cartella deve già esistere: qui non viene mai creata, solo
// controllata. A differenza di Causa non esiste una convenzione di
// nomenclatura nota per queste cartelle, quindi nessun avviso sul nome.
export async function risolviCartellaDrivePratica(userId: string, driveFolderUrl: string): Promise<RisultatoCartellaPratica> {
  const elemento = await verificaElementoDrive(userId, driveFolderUrl, "cartella");
  return {
    driveFolderId: elemento.id,
    driveFolderUrl: elemento.webViewLink ?? driveFolderUrl,
  };
}
