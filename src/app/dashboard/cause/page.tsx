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
            <a href={getValue() as string} target="_blank" rel="noreferrer" className="text-studio-700 underline" onClick={(e) => e.stopPropagation()}>
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
      { header: "Ultima udienza", accessorKey: "ultimaUdienza" },
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
    if (causaSelezionata) {
      await fetch(`/api/cause/${causaSelezionata.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dati),
      });
    } else {
      await fetch("/api/cause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dati),
      });
    }
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
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-studio-100 p-1">
          {SCHEDE.map((s) => (
            <button
              key={s.valore}
              onClick={() => cambiaScheda(s.valore)}
              className={clsx(
                "rounded-md px-4 py-1.5 text-sm font-medium transition",
                stato === s.valore ? "bg-white text-studio-900 shadow-sm" : "text-studio-600 hover:text-studio-900"
              )}
            >
              {s.etichetta}
            </button>
          ))}
        </div>
        <button onClick={apriNuovo} className="rounded bg-studio-700 px-4 py-2 text-sm font-medium text-white hover:bg-studio-800">
          + Nuovo fascicolo
        </button>
      </div>

      <div className="flex-1 overflow-hidden rounded-lg border border-studio-200 bg-white">
        {caricamento ? (
          <div className="flex h-full items-center justify-center text-studio-400">Caricamento...</div>
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
