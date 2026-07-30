"use client";

import { useCallback, useEffect, useState } from "react";
import { CausaForm } from "@/components/forms/CausaForm";
import { CausaInput } from "@/lib/validazione";

type TipoSuggerimento = "NUOVA_CAUSA" | "CONFLITTO_RG" | "NON_RICONOSCIUTA";

interface CandidatoCausa {
  causaId: string;
  fascicolo: string;
  tribunale: string | null;
}

interface Suggerimento {
  id: string;
  driveFolderId: string;
  driveFolderUrl: string | null;
  nomeCartella: string;
  anno: string | null;
  rg: string | null;
  tipo: TipoSuggerimento;
  causeCandidate: CandidatoCausa[] | null;
  createdAt: string;
}

const ETICHETTA_TIPO: Record<TipoSuggerimento, string> = {
  NUOVA_CAUSA: "Nuova causa",
  CONFLITTO_RG: "R.G. ambiguo",
  NON_RICONOSCIUTA: "Nome non riconosciuto",
};

const COLORE_TIPO: Record<TipoSuggerimento, string> = {
  NUOVA_CAUSA: "bg-blue-50 text-blue-700 border-blue-200",
  CONFLITTO_RG: "bg-amber-50 text-amber-700 border-amber-200",
  NON_RICONOSCIUTA: "bg-studio-100 text-studio-600 border-studio-200",
};

export default function SuggerimentiDrivePage() {
  const [suggerimenti, setSuggerimenti] = useState<Suggerimento[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [suggerimentoPerNuovaCausa, setSuggerimentoPerNuovaCausa] = useState<Suggerimento | null>(null);

  const carica = useCallback(async () => {
    setCaricamento(true);
    const res = await fetch("/api/drive/suggerimenti");
    if (res.ok) setSuggerimenti(await res.json());
    setCaricamento(false);
  }, []);

  useEffect(() => {
    carica();
  }, [carica]);

  const collega = async (suggerimentoId: string, causaId: string) => {
    setErrore(null);
    const res = await fetch(`/api/drive/suggerimenti/${suggerimentoId}/collega`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ causaId }),
    });
    if (!res.ok) {
      const risposta = await res.json();
      setErrore(risposta.errore ?? "Errore durante il collegamento");
      return;
    }
    await carica();
  };

  const rifiuta = async (suggerimentoId: string) => {
    setErrore(null);
    const res = await fetch(`/api/drive/suggerimenti/${suggerimentoId}/rifiuta`, { method: "POST" });
    if (!res.ok) {
      const risposta = await res.json();
      setErrore(risposta.errore ?? "Errore durante il rifiuto del suggerimento");
      return;
    }
    await carica();
  };

  const creaNuovaCausa = async (dati: CausaInput) => {
    if (!suggerimentoPerNuovaCausa) return;

    const res = await fetch("/api/cause", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dati),
    });
    const risposta = await res.json();
    if (!res.ok) {
      throw new Error(risposta.errore ?? "Errore durante la creazione del fascicolo");
    }

    await fetch(`/api/drive/suggerimenti/${suggerimentoPerNuovaCausa.id}/collega`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ causaId: risposta.id }),
    });

    setSuggerimentoPerNuovaCausa(null);
    await carica();
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-studio-900">Suggerimenti dalla scansione Drive</h1>
        <p className="text-xs text-studio-500">
          Cartelle trovate nella scansione periodica della cartella &quot;cause pendenti&quot; che non sono state
          collegate in automatico. Nessuna causa viene mai creata da sola: qui si conferma o si ignora ogni proposta.
        </p>
      </div>

      {errore && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errore}</div>
      )}

      <div className="flex-1 overflow-auto rounded-lg border border-studio-200 bg-white">
        {caricamento ? (
          <div className="flex h-full items-center justify-center text-studio-400">Caricamento...</div>
        ) : suggerimenti.length === 0 ? (
          <div className="flex h-full items-center justify-center text-studio-400">
            Nessun suggerimento in attesa. Tutte le cartelle scansionate sono già collegate o gestite.
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-studio-100">
              <tr>
                <th className="border border-studio-200 px-3 py-2 text-left">Tipo</th>
                <th className="border border-studio-200 px-3 py-2 text-left">Cartella</th>
                <th className="border border-studio-200 px-3 py-2 text-left">Anno/RG</th>
                <th className="border border-studio-200 px-3 py-2 text-left">Candidati</th>
                <th className="border border-studio-200 px-3 py-2 text-left">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {suggerimenti.map((s) => (
                <tr key={s.id}>
                  <td className="border border-studio-200 px-3 py-2">
                    <span className={`rounded border px-2 py-0.5 text-xs font-medium ${COLORE_TIPO[s.tipo]}`}>
                      {ETICHETTA_TIPO[s.tipo]}
                    </span>
                  </td>
                  <td className="border border-studio-200 px-3 py-2">
                    <div>{s.nomeCartella}</div>
                    {s.driveFolderUrl && (
                      <a href={s.driveFolderUrl} target="_blank" rel="noreferrer" className="text-xs text-studio-700 underline">
                        Apri su Drive
                      </a>
                    )}
                  </td>
                  <td className="border border-studio-200 px-3 py-2">{s.rg ? `${s.rg}/${s.anno}` : "-"}</td>
                  <td className="border border-studio-200 px-3 py-2">
                    {s.causeCandidate && s.causeCandidate.length > 0 ? (
                      <ul className="space-y-1">
                        {s.causeCandidate.map((c) => (
                          <li key={c.causaId} className="flex items-center justify-between gap-2">
                            <span>
                              {c.fascicolo} {c.tribunale ? `— ${c.tribunale}` : ""}
                            </span>
                            <button
                              onClick={() => collega(s.id, c.causaId)}
                              className="shrink-0 rounded border border-studio-300 px-2 py-0.5 text-xs text-studio-700 hover:bg-studio-50"
                            >
                              Collega
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-studio-400">-</span>
                    )}
                  </td>
                  <td className="border border-studio-200 px-3 py-2">
                    <div className="flex gap-2">
                      {s.tipo === "NUOVA_CAUSA" && (
                        <button
                          onClick={() => setSuggerimentoPerNuovaCausa(s)}
                          className="rounded bg-studio-700 px-2 py-1 text-xs font-medium text-white hover:bg-studio-800"
                        >
                          Crea nuovo fascicolo
                        </button>
                      )}
                      <button
                        onClick={() => rifiuta(s.id)}
                        className="rounded border border-studio-300 px-2 py-1 text-xs text-studio-700 hover:bg-studio-50"
                      >
                        Ignora
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {suggerimentoPerNuovaCausa && (
        <CausaForm
          aperto
          modalita="crea"
          statoPredefinito="PENDENTI"
          valoriIniziali={{
            rg: suggerimentoPerNuovaCausa.rg && suggerimentoPerNuovaCausa.anno
              ? `${suggerimentoPerNuovaCausa.rg}/${suggerimentoPerNuovaCausa.anno}`
              : undefined,
            driveFolderUrl: suggerimentoPerNuovaCausa.driveFolderUrl ?? undefined,
          }}
          onSalva={creaNuovaCausa}
          onChiudi={() => setSuggerimentoPerNuovaCausa(null)}
        />
      )}
    </div>
  );
}
