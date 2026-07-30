"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataGrid } from "@/components/DataGrid";
import { ClienteForm } from "@/components/forms/ClienteForm";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ClienteInput } from "@/lib/validazione";

interface Cliente extends ClienteInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

function formattaData(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("it-IT");
}

export default function ClientiPage() {
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [formAperto, setFormAperto] = useState(false);
  const [clienteSelezionato, setClienteSelezionato] = useState<Cliente | null>(null);
  const [eliminaAperto, setEliminaAperto] = useState(false);

  const caricaDati = useCallback(async () => {
    setCaricamento(true);
    const res = await fetch("/api/clienti");
    setClienti(await res.json());
    setCaricamento(false);
  }, []);

  useEffect(() => {
    caricaDati();
  }, [caricaDati]);

  const columns = useMemo<ColumnDef<Cliente, any>[]>(
    () => [
      { header: "Città", accessorKey: "citta" },
      { header: "Cognome", accessorKey: "cognome" },
      { header: "Nome", accessorKey: "nome" },
      { header: "Piattaforma", accessorKey: "piattaforma" },
      { header: "Note", accessorKey: "note" },
      { header: "Nato a", accessorKey: "natoA" },
      { header: "Il", accessorKey: "natoIl", cell: ({ getValue }) => formattaData(getValue() as string) },
      { header: "Residente in", accessorKey: "residenteIn" },
      { header: "Codice fiscale", accessorKey: "codiceFiscale" },
      { header: "Richiesta dati", accessorKey: "richiestaDati", cell: ({ getValue }) => (getValue() ? "Sì" : "No") },
      { header: "Orario", accessorKey: "orario" },
      { header: "Periodo di lavoro", accessorKey: "periodoDiLavoro" },
      { header: "Mezzo", accessorKey: "mezzo" },
      { header: "Data ricev.", accessorKey: "dataRicevimento", cell: ({ getValue }) => formattaData(getValue() as string) },
      { header: "E-mail", accessorKey: "email" },
      { header: "Numero", accessorKey: "numero" },
      { header: "Pagamento", accessorKey: "pagamento" },
      { header: "Iscritto", accessorKey: "iscritto", cell: ({ getValue }) => (getValue() ? "Sì" : "No") },
      { header: "Doc. mancanti", accessorKey: "docMancanti" },
    ],
    []
  );

  const apriNuovo = () => {
    setClienteSelezionato(null);
    setFormAperto(true);
  };

  const apriModifica = (c: Cliente) => {
    setClienteSelezionato(c);
    setFormAperto(true);
  };

  const salvaCliente = async (dati: ClienteInput) => {
    const res = clienteSelezionato
      ? await fetch(`/api/clienti/${clienteSelezionato.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dati),
        })
      : await fetch("/api/clienti", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dati),
        });

    if (!res.ok) {
      const risposta = await res.json();
      throw new Error(risposta.errore ?? "Errore durante il salvataggio del cliente");
    }

    setFormAperto(false);
    setClienteSelezionato(null);
    await caricaDati();
  };

  const eliminaCliente = async () => {
    if (clienteSelezionato) {
      await fetch(`/api/clienti/${clienteSelezionato.id}`, { method: "DELETE" });
    }
    setEliminaAperto(false);
    setFormAperto(false);
    setClienteSelezionato(null);
    await caricaDati();
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <span className="section-kicker" />
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-ink-900">Clienti</h1>
        </div>
        <button onClick={apriNuovo} className="bg-brand-500 px-4 py-2 text-sm font-bold uppercase tracking-wide text-white hover:bg-brand-600">
          + Nuovo cliente
        </button>
      </div>

      <div className="flex-1 overflow-hidden border border-ink-200 bg-white">
        {caricamento ? (
          <div className="flex h-full items-center justify-center text-ink-400">Caricamento...</div>
        ) : (
          <DataGrid columns={columns} data={clienti} onRowClick={apriModifica} filtroPlaceholder="Cerca per cognome, nome, email..." />
        )}
      </div>

      <ClienteForm
        aperto={formAperto}
        modalita={clienteSelezionato ? "modifica" : "crea"}
        valoriIniziali={clienteSelezionato ?? undefined}
        onSalva={salvaCliente}
        onChiudi={() => {
          setFormAperto(false);
          setClienteSelezionato(null);
        }}
        onRichiediEliminazione={() => setEliminaAperto(true)}
      />

      <ConfirmModal
        aperto={eliminaAperto}
        titolo="Elimina cliente"
        messaggio="Questa operazione è irreversibile. Confermi l'eliminazione del cliente?"
        pericoloso
        confermaLabel="Elimina"
        onConferma={eliminaCliente}
        onAnnulla={() => setEliminaAperto(false)}
      />
    </div>
  );
}
