"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataGrid } from "@/components/DataGrid";
import { CollegamentoForm } from "@/components/forms/CollegamentoForm";
import { ConfirmModal } from "@/components/ConfirmModal";
import { CollegamentoInput } from "@/lib/validazione";

interface Collegamento {
  id: string;
  clienteId: string;
  causaId: string;
  ruoloCliente?: string | null;
  ultimoDocumentoNome?: string | null;
  ultimoDocumentoUrl?: string | null;
  ultimoDocumentoData?: string | null;
  cliente: { id: string; cognome: string; nome: string };
  causa: { id: string; fascicolo: string; rg: string | null };
}

function formattaData(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("it-IT");
}

export default function CollegamentiPage() {
  const [collegamenti, setCollegamenti] = useState<Collegamento[]>([]);
  const [clienti, setClienti] = useState<{ id: string; cognome: string; nome: string }[]>([]);
  const [cause, setCause] = useState<{ id: string; fascicolo: string; rg: string | null }[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [formAperto, setFormAperto] = useState(false);
  const [selezionato, setSelezionato] = useState<Collegamento | null>(null);
  const [eliminaAperto, setEliminaAperto] = useState(false);

  const caricaDati = useCallback(async () => {
    setCaricamento(true);
    const [resCollegamenti, resClienti, resCause] = await Promise.all([
      fetch("/api/collegamenti"),
      fetch("/api/clienti"),
      fetch("/api/cause"),
    ]);
    setCollegamenti(await resCollegamenti.json());
    setClienti(await resClienti.json());
    setCause(await resCause.json());
    setCaricamento(false);
  }, []);

  useEffect(() => {
    caricaDati();
  }, [caricaDati]);

  const columns = useMemo<ColumnDef<Collegamento, any>[]>(
    () => [
      { header: "Cliente", accessorFn: (r) => `${r.cliente.cognome} ${r.cliente.nome}` },
      { header: "Fascicolo", accessorFn: (r) => r.causa.fascicolo },
      { header: "RG", accessorFn: (r) => r.causa.rg ?? "" },
      { header: "Ruolo cliente", accessorKey: "ruoloCliente" },
      { header: "Ultimo documento", accessorKey: "ultimoDocumentoNome" },
      {
        header: "Link Drive",
        accessorKey: "ultimoDocumentoUrl",
        cell: ({ getValue }) =>
          getValue() ? (
            <a href={getValue() as string} target="_blank" rel="noreferrer" className="text-studio-700 underline" onClick={(e) => e.stopPropagation()}>
              Apri
            </a>
          ) : (
            "-"
          ),
      },
      { header: "Data documento", accessorKey: "ultimoDocumentoData", cell: ({ getValue }) => formattaData(getValue() as string) },
    ],
    []
  );

  const opzioniClienti = useMemo(() => clienti.map((c) => ({ id: c.id, etichetta: `${c.cognome} ${c.nome}` })), [clienti]);
  const opzioniCause = useMemo(() => cause.map((c) => ({ id: c.id, etichetta: `${c.fascicolo}${c.rg ? ` (RG ${c.rg})` : ""}` })), [cause]);

  const apriNuovo = () => {
    setSelezionato(null);
    setFormAperto(true);
  };

  const apriModifica = (c: Collegamento) => {
    setSelezionato(c);
    setFormAperto(true);
  };

  const salva = async (dati: CollegamentoInput) => {
    if (selezionato) {
      await fetch(`/api/collegamenti/${selezionato.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dati),
      });
    } else {
      await fetch("/api/collegamenti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dati),
      });
    }
    setFormAperto(false);
    setSelezionato(null);
    await caricaDati();
  };

  const elimina = async () => {
    if (selezionato) {
      await fetch(`/api/collegamenti/${selezionato.id}`, { method: "DELETE" });
    }
    setEliminaAperto(false);
    setFormAperto(false);
    setSelezionato(null);
    await caricaDati();
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-studio-900">Collegamenti clienti / cause</h1>
          <p className="text-xs text-studio-500">Raccorda ogni cliente al fascicolo (RG) e all&apos;ultimo documento Drive (verbali ecc.)</p>
        </div>
        <button onClick={apriNuovo} className="rounded bg-studio-700 px-4 py-2 text-sm font-medium text-white hover:bg-studio-800">
          + Nuovo collegamento
        </button>
      </div>

      <div className="flex-1 overflow-hidden rounded-lg border border-studio-200 bg-white">
        {caricamento ? (
          <div className="flex h-full items-center justify-center text-studio-400">Caricamento...</div>
        ) : (
          <DataGrid columns={columns} data={collegamenti} onRowClick={apriModifica} filtroPlaceholder="Cerca per cliente, fascicolo, RG..." />
        )}
      </div>

      <CollegamentoForm
        aperto={formAperto}
        modalita={selezionato ? "modifica" : "crea"}
        clienti={opzioniClienti}
        cause={opzioniCause}
        valoriIniziali={selezionato ?? undefined}
        onSalva={salva}
        onChiudi={() => {
          setFormAperto(false);
          setSelezionato(null);
        }}
        onRichiediEliminazione={() => setEliminaAperto(true)}
      />

      <ConfirmModal
        aperto={eliminaAperto}
        titolo="Elimina collegamento"
        messaggio="Confermi l'eliminazione di questo collegamento cliente-causa?"
        pericoloso
        confermaLabel="Elimina"
        onConferma={elimina}
        onAnnulla={() => setEliminaAperto(false)}
      />
    </div>
  );
}
