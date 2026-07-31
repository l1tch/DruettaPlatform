"use client";

import { useCallback, useEffect, useState } from "react";

interface ImportLog {
  id: string;
  eseguitoIl: string;
  righeTotali: number;
  righeCreate: number;
  righeAggiornate: number;
  righeInvariate: number;
  righeConflitto: number;
  righeScartate: number;
  dettagliScartate: { riga: number; motivo: string }[] | null;
}

interface ConflittoImport {
  id: string;
  campo: string;
  valoreAttuale: string | null;
  valoreExcel: string | null;
  rigaExcel: number;
  causa: { id: string; fascicolo: string; rg: string | null };
}

const ETICHETTA_CAMPO: Record<string, string> = {
  driveFolderUrl: "Link Drive",
  tribunale: "Tribunale",
  ricorrenti: "Nomi ricorrenti",
  controparte: "Controparte",
  ultimaUdienza: "Data ultima udienza",
  dataUdienza: "Data udienza",
  adempimenti: "Adempimenti",
  termine: "Termine",
  fattoONo: "Fatto o no",
  propostaTrasmessa: "Proposta trasmessa",
  dataProposta: "Data proposta",
  note: "Note",
  procure185: "Procure 185",
  stato: "Stato (foglio)",
};

function formattaValore(campo: string, v: string | null): string {
  if (!v) return "-";
  if (["ultimaUdienza", "dataUdienza", "termine", "dataProposta"].includes(campo)) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d.toLocaleDateString("it-IT");
  }
  if (["fattoONo", "propostaTrasmessa", "procure185"].includes(campo)) return v === "true" ? "Sì" : "No";
  return v;
}

export default function ImportExcelPage() {
  const [ultimoImport, setUltimoImport] = useState<ImportLog | null>(null);
  const [conflitti, setConflitti] = useState<ConflittoImport[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [importInCorso, setImportInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const carica = useCallback(async () => {
    setCaricamento(true);
    const [resLog, resConflitti] = await Promise.all([
      fetch("/api/cause/importa-excel/ultimo"),
      fetch("/api/import-conflitti"),
    ]);
    if (resLog.ok) setUltimoImport(await resLog.json());
    if (resConflitti.ok) setConflitti(await resConflitti.json());
    setCaricamento(false);
  }, []);

  useEffect(() => {
    carica();
  }, [carica]);

  const importaOra = async () => {
    setErrore(null);
    setImportInCorso(true);
    const res = await fetch("/api/cause/importa-excel", { method: "POST" });
    if (!res.ok) {
      const risposta = await res.json();
      setErrore(risposta.errore ?? "Errore durante l'import");
    }
    setImportInCorso(false);
    await carica();
  };

  const risolvi = async (conflittoId: string, scelta: "attuale" | "excel") => {
    setErrore(null);
    const res = await fetch(`/api/import-conflitti/${conflittoId}/risolvi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scelta }),
    });
    if (!res.ok) {
      const risposta = await res.json();
      setErrore(risposta.errore ?? "Errore durante la risoluzione del conflitto");
      return;
    }
    await carica();
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <span className="section-kicker" />
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-ink-900">Import cause da Excel</h1>
          <p className="mt-1 text-xs text-ink-500">
            Le cause vengono sincronizzate ogni ora dal file Excel su Drive. I fascicoli nuovi vengono creati
            automaticamente; se un valore in Excel è diverso da uno già presente in piattaforma, viene segnalato qui
            e non viene mai scritto senza conferma.
          </p>
        </div>
        <button
          onClick={importaOra}
          disabled={importInCorso}
          className="bg-brand-500 px-4 py-2 text-sm font-bold uppercase tracking-wide text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {importInCorso ? "Import in corso..." : "Importa ora"}
        </button>
      </div>

      {errore && <div className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errore}</div>}

      {caricamento ? (
        <div className="flex flex-1 items-center justify-center text-ink-400">Caricamento...</div>
      ) : (
        <div className="flex-1 overflow-auto space-y-6">
          <div className="border border-ink-200 bg-white p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-800">Ultimo import</h2>
            {!ultimoImport ? (
              <p className="text-sm text-ink-400">Nessun import eseguito finora.</p>
            ) : (
              <>
                <p className="mb-3 text-sm text-ink-600">
                  {new Date(ultimoImport.eseguitoIl).toLocaleString("it-IT")}
                </p>
                <div className="grid grid-cols-6 gap-4 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-ink-500">Righe totali</p>
                    <p className="text-xl font-bold text-ink-900">{ultimoImport.righeTotali}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-ink-500">Create</p>
                    <p className="text-xl font-bold text-ink-900">{ultimoImport.righeCreate}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-ink-500">Completate</p>
                    <p className="text-xl font-bold text-ink-900">{ultimoImport.righeAggiornate}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-ink-500">Invariate</p>
                    <p className="text-xl font-bold text-ink-900">{ultimoImport.righeInvariate}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-ink-500">Conflitti</p>
                    <p className="text-xl font-bold text-brand-600">{ultimoImport.righeConflitto}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-ink-500">Scartate</p>
                    <p className="text-xl font-bold text-ink-900">{ultimoImport.righeScartate}</p>
                  </div>
                </div>
                {ultimoImport.dettagliScartate && ultimoImport.dettagliScartate.length > 0 && (
                  <ul className="mt-4 space-y-1 border-t border-ink-100 pt-3 text-xs text-ink-600">
                    {ultimoImport.dettagliScartate.map((d, i) => (
                      <li key={i}>
                        Riga {d.riga}: {d.motivo}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div className="border border-ink-200 bg-white">
            <h2 className="border-b border-ink-200 px-5 py-3 text-xs font-bold uppercase tracking-wide text-ink-800">
              Conflitti da risolvere
            </h2>
            {conflitti.length === 0 ? (
              <p className="p-5 text-sm text-ink-400">Nessun conflitto in attesa.</p>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead className="bg-ink-50">
                  <tr>
                    <th className="border-b-2 border-ink-900 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-ink-900">Fascicolo</th>
                    <th className="border-b-2 border-ink-900 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-ink-900">Campo</th>
                    <th className="border-b-2 border-ink-900 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-ink-900">Valore attuale</th>
                    <th className="border-b-2 border-ink-900 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-ink-900">Valore Excel</th>
                    <th className="border-b-2 border-ink-900 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-ink-900">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {conflitti.map((c) => (
                    <tr key={c.id}>
                      <td className="border-b border-ink-200 px-3 py-2">
                        {c.causa.fascicolo} {c.causa.rg ? `(RG ${c.causa.rg})` : ""}
                      </td>
                      <td className="border-b border-ink-200 px-3 py-2">{ETICHETTA_CAMPO[c.campo] ?? c.campo}</td>
                      <td className="border-b border-ink-200 px-3 py-2">{formattaValore(c.campo, c.valoreAttuale)}</td>
                      <td className="border-b border-ink-200 px-3 py-2">{formattaValore(c.campo, c.valoreExcel)}</td>
                      <td className="border-b border-ink-200 px-3 py-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => risolvi(c.id, "attuale")}
                            className="border border-ink-300 px-2 py-1 text-xs uppercase tracking-wide text-ink-700 hover:bg-ink-50"
                          >
                            Tieni attuale
                          </button>
                          <button
                            onClick={() => risolvi(c.id, "excel")}
                            className="bg-brand-500 px-2 py-1 text-xs font-bold uppercase tracking-wide text-white hover:bg-brand-600"
                          >
                            Usa Excel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
