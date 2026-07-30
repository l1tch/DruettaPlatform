"use client";

interface ConfirmModalProps {
  aperto: boolean;
  titolo: string;
  messaggio?: string;
  confermaLabel?: string;
  annullaLabel?: string;
  pericoloso?: boolean;
  inCorso?: boolean;
  onConferma: () => void;
  onAnnulla: () => void;
}

// Modale di conferma richiesta prima di applicare qualsiasi modifica a un
// record esistente (cause/clienti/collegamenti), per evitare modifiche
// accidentali su dati sensibili dello studio.
export function ConfirmModal({
  aperto,
  titolo,
  messaggio = "Confermi di voler salvare le modifiche?",
  confermaLabel = "Conferma",
  annullaLabel = "Annulla",
  pericoloso = false,
  inCorso = false,
  onConferma,
  onAnnulla,
}: ConfirmModalProps) {
  if (!aperto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-studio-900">{titolo}</h3>
        <p className="mt-2 text-sm text-studio-600">{messaggio}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onAnnulla}
            disabled={inCorso}
            className="rounded border border-studio-300 px-4 py-2 text-sm font-medium text-studio-700 hover:bg-studio-50 disabled:opacity-50"
          >
            {annullaLabel}
          </button>
          <button
            type="button"
            onClick={onConferma}
            disabled={inCorso}
            className={`rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
              pericoloso ? "bg-red-600 hover:bg-red-700" : "bg-studio-700 hover:bg-studio-800"
            }`}
          >
            {inCorso ? "Attendere..." : confermaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
