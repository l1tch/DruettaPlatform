import { verificaElementoDrive } from "@/lib/googleDrive";
import { nomeCartellaAtteso, nomeCorrisponde } from "@/lib/convenzioneNomi";

interface DatiPerNomeCartella {
  rg?: string | null;
  ricorrenti?: string | null;
  controparte?: string | null;
  tribunale?: string | null;
}

interface RisultatoCartella {
  driveFolderId: string | null;
  driveFolderUrl: string | null;
  avviso?: string;
}

// Risolve e verifica il link a una cartella Drive incollato nel form di un
// fascicolo. La cartella deve già esistere (creata a mano dallo studio): qui
// non viene mai creata, solo controllata. Se il nome reale della cartella non
// rispetta la convenzione (anno_rg_parte_controparte_tribunale) viene
// restituito un avviso non bloccante, cosi' l'utente puo' accorgersi di aver
// collegato la cartella sbagliata senza che il salvataggio venga impedito.
export async function risolviCartellaDriveCausa(
  userId: string,
  driveFolderUrl: string | null | undefined,
  datiPerNome: DatiPerNomeCartella
): Promise<RisultatoCartella> {
  if (!driveFolderUrl?.trim()) {
    return { driveFolderId: null, driveFolderUrl: null };
  }

  const elemento = await verificaElementoDrive(userId, driveFolderUrl, "cartella");
  const atteso = nomeCartellaAtteso(datiPerNome);
  const avviso = !nomeCorrisponde(elemento.nome, atteso)
    ? `Il nome della cartella Drive collegata ("${elemento.nome}") non corrisponde alla convenzione attesa` +
      (atteso ? ` ("${atteso}")` : "") +
      ": verificare di aver incollato il link della cartella corretta."
    : undefined;

  return {
    driveFolderId: elemento.id,
    driveFolderUrl: elemento.webViewLink ?? driveFolderUrl,
    avviso,
  };
}
