"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import clsx from "clsx";
import { DataGrid } from "@/components/DataGrid";
import { CausaForm } from "@/components/forms/CausaForm";
import { ConfirmModal } from "@/components/ConfirmModal";
import { CausaInput } from "@/lib/validazione";

type StatoCausa = "PENDENTI" | "CONCLUSE" | "ESECUZIONI";

interface Causa extends CausaInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

const SCHEDE: { valore: StatoCausa; etichetta: string }[] = [
  { valore: "PENDENTI", etichetta: "Pendenti" },
  { valore: "CONCLUSE", etichetta: "Concluse" },
  { valore: "ESECUZIONI", etichetta: "Esecuzioni" },
];

function formattaData(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("it-IT");
}

export default function CausePage() {
  const params = useSearchParams();
  const router = useRouter();
  const statoIniziale = (params.get("stato") as StatoCausa) ?? "PENDENTI";

  const [stato, setStato] = useState<StatoCausa>(statoIniziale);
  const [cause, setCause] = useState<Causa[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [formAperto, setFormAperto] = useState(false);
  const [causaSelezionata, setCausaSelezionata] = useState<Causa | null>(null);
  const [eliminaAperto, setEliminaAperto] = useState(false);
  const [avviso, setAvviso] = useState<string | null>(null);

  const caricaDati = useCallback(async (s: StatoCausa) => {
    setCaricamento(true);
    const res = await fetch(`/api/cause?stato=${s}`);
    const dati = await res.json();
    setCause(dati);
    setCaricamento(false);
  }, []);

  useEffect(() => {
    caricaDati(stato);
  }, [stato, caricaDati]);

  const cambiaScheda = (s: StatoCausa) => {
    setStato(s);
    router.replace(`/dashboard/cause?stato=${s}`);
  };

  const columns = useMemo<ColumnDef<Causa, any>[]>(
    () => [
      { header: "Fascicolo", accessorKey: "fascicolo" },
      {
        header: "Drive",
        accessorKey: "driveFolderUrl",
        cell: ({ getValue }) =>
          getValue() ? (
            <a href={getValue() as string} target="_blank" rel="noreferrer" className="text-brand-600 underline" onClick={(e) => e.stopPropagation()}>
              Apri
            </a>
          ) : (
            "-"
          ),
      },
      { header: "Tribunale", accessorKey: "tribunale" },
      { header: "RG", accessorKey: "rg" },
      { header: "Nomi ricorrenti", accessorKey: "ricorrenti" },
      { header: "Controparte", accessorKey: "controparte" },
      { header: "Ultima udienza", accessorKey: "ultimaUdienza", cell: ({ getValue }) => formattaData(getValue() as string) },
      { header: "Data udienza", accessorKey: "dataUdienza", cell: ({ getValue }) => formattaData(getValue() as string) },
      { header: "Adempimenti", accessorKey: "adempimenti" },
      { header: "Termine", accessorKey: "termine", cell: ({ getValue }) => formattaData(getValue() as string) },
      { header: "Fatto o no", accessorKey: "fattoONo", cell: ({ getValue }) => (getValue() ? "Sì" : "No") },
      { header: "Proposta trasmessa", accessorKey: "propostaTrasmessa", cell: ({ getValue }) => (getValue() ? "Sì" : "No") },
      { header: "Data proposta", accessorKey: "dataProposta", cell: ({ getValue }) => formattaData(getValue() as string) },
      { header: "Note", accessorKey: "note" },
      { header: "Procure 185", accessorKey: "procure185", cell: ({ getValue }) => (getValue() ? "Sì" : "No") },
    ],
    []
  );

  const apriNuovo = () => {
    setCausaSelezionata(null);
    setFormAperto(true);
  };

  const apriModifica = (c: Causa) => {
    setCausaSelezionata(c);
    setFormAperto(true);
  };

  const salvaCausa = async (dati: CausaInput) => {
    const res = causaSelezionata
      ? await fetch(`/api/cause/${causaSelezionata.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dati),
        })
      : await fetch("/api/cause", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dati),
        });

    const risposta = await res.json();
    if (!res.ok) {
      throw new Error(risposta.errore ?? "Errore durante il salvataggio del fascicolo");
    }

    setAvviso(risposta.avviso ?? null);
    setFormAperto(false);
    setCausaSelezionata(null);
    await caricaDati(stato);
  };

  const eliminaCausa = async () => {
    if (causaSelezionata) {
      await fetch(`/api/cause/${causaSelezionata.id}`, { method: "DELETE" });
    }
    setEliminaAperto(false);
    setFormAperto(false);
    setCausaSelezionata(null);
    await caricaDati(stato);
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-center justify-between border-b border-ink-200">
        <div className="flex gap-6">
          {SCHEDE.map((s) => (
            <button
              key={s.valore}
              onClick={() => cambiaScheda(s.valore)}
              className={clsx(
                "-mb-px border-b-2 px-1 py-3 text-sm font-bold uppercase tracking-wide transition",
                stato === s.valore ? "border-brand-500 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-800"
              )}
            >
              {s.etichetta}
            </button>
          ))}
        </div>
        <button onClick={apriNuovo} className="mb-2 bg-brand-500 px-4 py-2 text-sm font-bold uppercase tracking-wide text-white hover:bg-brand-600">
          + Nuovo fascicolo
        </button>
      </div>

      {avviso && (
        <div className="mt-4 flex items-start justify-between gap-4 border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <span>{avviso}</span>
          <button onClick={() => setAvviso(null)} className="shrink-0 text-amber-700 hover:text-amber-900">
            ✕
          </button>
        </div>
      )}

      <div className="mt-4 flex-1 overflow-hidden border border-ink-200 bg-white">
        {caricamento ? (
          <div className="flex h-full items-center justify-center text-ink-400">Caricamento...</div>
        ) : (
          <DataGrid columns={columns} data={cause} onRowClick={apriModifica} filtroPlaceholder="Cerca per fascicolo, RG, ricorrente..." />
        )}
      </div>

      <CausaForm
        aperto={formAperto}
        modalita={causaSelezionata ? "modifica" : "crea"}
        statoPredefinito={stato}
        valoriIniziali={causaSelezionata ?? undefined}
        onSalva={salvaCausa}
        onChiudi={() => {
          setFormAperto(false);
          setCausaSelezionata(null);
        }}
        onRichiediEliminazione={() => setEliminaAperto(true)}
      />

      <ConfirmModal
        aperto={eliminaAperto}
        titolo="Elimina fascicolo"
        messaggio="Questa operazione è irreversibile. Confermi l'eliminazione del fascicolo?"
        pericoloso
        confermaLabel="Elimina"
        onConferma={eliminaCausa}
        onAnnulla={() => setEliminaAperto(false)}
      />
    </div>
  );
}
