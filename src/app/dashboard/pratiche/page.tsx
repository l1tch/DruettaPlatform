"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import clsx from "clsx";
import { DataGrid } from "@/components/DataGrid";
import { PraticaForm } from "@/components/forms/PraticaForm";
import { ConfirmModal } from "@/components/ConfirmModal";
import { PraticaInput } from "@/lib/validazione";

type StatoPratica = "PENDENTI" | "CONCLUSE" | "IN_ESECUZIONE" | "DA_PAGARE" | "DIMESSI_ESCLUSI";
type CategoriaPratica = "RAIDER" | "CAUSA_SINGOLA" | "DA_CLASSIFICARE";

interface Pratica extends PraticaInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

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
  pratica: { id: string; nome: string | null; cognome: string | null; rg: string | null };
}

const SCHEDE: { valore: StatoPratica; etichetta: string }[] = [
  { valore: "PENDENTI", etichetta: "Pendenti" },
  { valore: "CONCLUSE", etichetta: "Concluse" },
  { valore: "IN_ESECUZIONE", etichetta: "In esecuzione" },
  { valore: "DA_PAGARE", etichetta: "Da pagare" },
  { valore: "DIMESSI_ESCLUSI", etichetta: "Dimessi/Esclusi" },
];

const PILLS: { valore: CategoriaPratica | "TUTTI"; etichetta: string }[] = [
  { valore: "TUTTI", etichetta: "Tutti" },
  { valore: "RAIDER", etichetta: "Raider" },
  { valore: "CAUSA_SINGOLA", etichetta: "Cause singole" },
  { valore: "DA_CLASSIFICARE", etichetta: "Da classificare" },
];

const ETICHETTA_CATEGORIA: Record<CategoriaPratica, string> = {
  RAIDER: "Raider",
  CAUSA_SINGOLA: "Causa singola",
  DA_CLASSIFICARE: "Da classificare",
};

const ETICHETTA_CAMPO: Record<string, string> = {
  stato: "Stato (foglio)",
  categoria: "Categoria",
  tipologia: "Tipologia",
  rg: "R.G.",
  citta: "Città",
  nome: "Nome",
  cognome: "Cognome",
  datiAnagrafici: "Indirizzo/CF",
  controparte: "Controparte",
  appuntamenti: "Appuntamenti",
  note: "Note",
  email: "Email",
  telefono: "Telefono",
  scadenza: "Scadenza",
  impugnativa: "Impugnativa",
  dataLicenziamento: "Data licenziamento",
  cartaceo: "Cartaceo",
  procura: "Procura",
  emissioneFatturaSpeseLegali: "Emissione fattura spese legali",
  pagatoCapitale: "Pagato capitale",
  pagatoSpeseLegali: "Pagato spese legali",
  precetto: "Precetto",
  esecuzione: "Esecuzione",
};

const CAMPI_DATA = new Set(["scadenza", "impugnativa", "dataLicenziamento"]);
const CAMPI_BOOL = new Set(["cartaceo", "procura", "pagatoCapitale", "pagatoSpeseLegali"]);

function formattaData(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("it-IT");
}

function formattaValoreConflitto(campo: string, v: string | null): string {
  if (!v) return "-";
  if (CAMPI_DATA.has(campo)) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d.toLocaleDateString("it-IT");
  }
  if (CAMPI_BOOL.has(campo)) return v === "true" ? "Sì" : "No";
  if (campo === "categoria") return ETICHETTA_CATEGORIA[v as CategoriaPratica] ?? v;
  return v;
}

export default function PratichePage() {
  const params = useSearchParams();
  const router = useRouter();
  const statoIniziale = (params.get("stato") as StatoPratica) ?? "PENDENTI";

  const [stato, setStato] = useState<StatoPratica>(statoIniziale);
  const [categoria, setCategoria] = useState<CategoriaPratica | "TUTTI">("TUTTI");
  const [pratiche, setPratiche] = useState<Pratica[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [formAperto, setFormAperto] = useState(false);
  const [praticaSelezionata, setPraticaSelezionata] = useState<Pratica | null>(null);
  const [eliminaAperto, setEliminaAperto] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const [ultimoImport, setUltimoImport] = useState<ImportLog | null>(null);
  const [conflitti, setConflitti] = useState<ConflittoImport[]>([]);
  const [importInCorso, setImportInCorso] = useState(false);
  const [conflittiAperti, setConflittiAperti] = useState(false);

  const caricaDati = useCallback(async (s: StatoPratica) => {
    setCaricamento(true);
    const res = await fetch(`/api/pratiche?stato=${s}`);
    const dati = await res.json();
    setPratiche(dati);
    setCaricamento(false);
  }, []);

  const caricaImport = useCallback(async () => {
    const [resLog, resConflitti] = await Promise.all([fetch("/api/pratiche/importa-excel/ultimo"), fetch("/api/pratiche-conflitti")]);
    if (resLog.ok) setUltimoImport(await resLog.json());
    if (resConflitti.ok) setConflitti(await resConflitti.json());
  }, []);

  useEffect(() => {
    caricaDati(stato);
  }, [stato, caricaDati]);

  useEffect(() => {
    caricaImport();
  }, [caricaImport]);

  const cambiaScheda = (s: StatoPratica) => {
    setStato(s);
    router.replace(`/dashboard/pratiche?stato=${s}`);
  };

  const praticheFiltrate = useMemo(
    () => (categoria === "TUTTI" ? pratiche : pratiche.filter((p) => p.categoria === categoria)),
    [pratiche, categoria]
  );

  const columns = useMemo<ColumnDef<Pratica, any>[]>(
    () => [
      {
        header: "Categoria",
        accessorKey: "categoria",
        cell: ({ getValue }) => ETICHETTA_CATEGORIA[getValue() as CategoriaPratica] ?? getValue(),
      },
      { header: "Tipologia", accessorKey: "tipologia" },
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
      { header: "R.G.", accessorKey: "rg" },
      { header: "Città", accessorKey: "citta" },
      { header: "Nome", accessorKey: "nome" },
      { header: "Cognome", accessorKey: "cognome" },
      { header: "Controparte", accessorKey: "controparte" },
      { header: "Email", accessorKey: "email" },
      { header: "Telefono", accessorKey: "telefono" },
      { header: "Scadenza", accessorKey: "scadenza", cell: ({ getValue }) => formattaData(getValue() as string) },
      { header: "Impugnativa", accessorKey: "impugnativa", cell: ({ getValue }) => formattaData(getValue() as string) },
      { header: "Note", accessorKey: "note" },
    ],
    []
  );

  const apriNuovo = () => {
    setPraticaSelezionata(null);
    setFormAperto(true);
  };

  const apriModifica = (p: Pratica) => {
    setPraticaSelezionata(p);
    setFormAperto(true);
  };

  const salvaPratica = async (dati: PraticaInput) => {
    const res = praticaSelezionata
      ? await fetch(`/api/pratiche/${praticaSelezionata.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dati),
        })
      : await fetch("/api/pratiche", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dati),
        });

    const risposta = await res.json();
    if (!res.ok) {
      throw new Error(risposta.errore ?? "Errore durante il salvataggio della pratica");
    }

    setFormAperto(false);
    setPraticaSelezionata(null);
    await caricaDati(stato);
  };

  const eliminaPratica = async () => {
    if (praticaSelezionata) {
      await fetch(`/api/pratiche/${praticaSelezionata.id}`, { method: "DELETE" });
    }
    setEliminaAperto(false);
    setFormAperto(false);
    setPraticaSelezionata(null);
    await caricaDati(stato);
  };

  const importaOra = async () => {
    setErrore(null);
    setImportInCorso(true);
    const res = await fetch("/api/pratiche/importa-excel", { method: "POST" });
    if (!res.ok) {
      const risposta = await res.json();
      setErrore(risposta.errore ?? "Errore durante l'import");
    }
    setImportInCorso(false);
    await Promise.all([caricaImport(), caricaDati(stato)]);
  };

  const risolviConflitto = async (conflittoId: string, scelta: "attuale" | "excel") => {
    setErrore(null);
    const res = await fetch(`/api/pratiche-conflitti/${conflittoId}/risolvi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scelta }),
    });
    if (!res.ok) {
      const risposta = await res.json();
      setErrore(risposta.errore ?? "Errore durante la risoluzione del conflitto");
      return;
    }
    await Promise.all([caricaImport(), caricaDati(stato)]);
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center justify-between border-b border-ink-200">
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
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {PILLS.map((p) => (
              <button
                key={p.valore}
                onClick={() => setCategoria(p.valore)}
                className={clsx(
                  "rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide transition",
                  categoria === p.valore ? "border-ink-900 bg-ink-900 text-white" : "border-ink-300 text-ink-600 hover:border-ink-500"
                )}
              >
                {p.etichetta}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-4 flex shrink-0 flex-col items-end gap-2">
          <button onClick={apriNuovo} className="bg-brand-500 px-4 py-2 text-sm font-bold uppercase tracking-wide text-white hover:bg-brand-600">
            + Nuova pratica
          </button>
          <button
            onClick={importaOra}
            disabled={importInCorso}
            className="border border-ink-300 px-4 py-2 text-xs font-bold uppercase tracking-wide text-ink-700 hover:bg-ink-50 disabled:opacity-50"
          >
            {importInCorso ? "Import in corso..." : "Importa da Excel"}
          </button>
          {conflitti.length > 0 && (
            <button onClick={() => setConflittiAperti((v) => !v)} className="text-xs font-bold uppercase tracking-wide text-brand-600 underline">
              {conflitti.length} conflitt{conflitti.length === 1 ? "o" : "i"} da risolvere
            </button>
          )}
        </div>
      </div>

      {errore && (
        <div className="mb-4 flex items-start justify-between gap-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <span>{errore}</span>
          <button onClick={() => setErrore(null)} className="shrink-0 text-red-600 hover:text-red-800">
            ✕
          </button>
        </div>
      )}

      {ultimoImport && (
        <p className="mb-2 text-xs text-ink-400">
          Ultimo import: {new Date(ultimoImport.eseguitoIl).toLocaleString("it-IT")} — {ultimoImport.righeCreate} create,{" "}
          {ultimoImport.righeAggiornate} completate, {ultimoImport.righeConflitto} conflitti, {ultimoImport.righeScartate} scartate
        </p>
      )}

      {conflittiAperti && conflitti.length > 0 && (
        <div className="mb-4 border border-ink-200 bg-white">
          <h2 className="border-b border-ink-200 px-5 py-3 text-xs font-bold uppercase tracking-wide text-ink-800">Conflitti da risolvere</h2>
          <table className="w-full border-collapse text-sm">
            <thead className="bg-ink-50">
              <tr>
                <th className="border-b-2 border-ink-900 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-ink-900">Pratica</th>
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
                    {[c.pratica.nome, c.pratica.cognome].filter(Boolean).join(" ") || "(senza nome)"} {c.pratica.rg ? `(RG ${c.pratica.rg})` : ""}
                  </td>
                  <td className="border-b border-ink-200 px-3 py-2">{ETICHETTA_CAMPO[c.campo] ?? c.campo}</td>
                  <td className="border-b border-ink-200 px-3 py-2">{formattaValoreConflitto(c.campo, c.valoreAttuale)}</td>
                  <td className="border-b border-ink-200 px-3 py-2">{formattaValoreConflitto(c.campo, c.valoreExcel)}</td>
                  <td className="border-b border-ink-200 px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => risolviConflitto(c.id, "attuale")}
                        className="border border-ink-300 px-2 py-1 text-xs uppercase tracking-wide text-ink-700 hover:bg-ink-50"
                      >
                        Tieni attuale
                      </button>
                      <button
                        onClick={() => risolviConflitto(c.id, "excel")}
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
        </div>
      )}

      <div className="mt-2 flex-1 overflow-hidden border border-ink-200 bg-white">
        {caricamento ? (
          <div className="flex h-full items-center justify-center text-ink-400">Caricamento...</div>
        ) : (
          <DataGrid columns={columns} data={praticheFiltrate} onRowClick={apriModifica} filtroPlaceholder="Cerca per nome, cognome, RG, città..." />
        )}
      </div>

      <PraticaForm
        aperto={formAperto}
        modalita={praticaSelezionata ? "modifica" : "crea"}
        statoPredefinito={stato}
        valoriIniziali={praticaSelezionata ?? undefined}
        onSalva={salvaPratica}
        onChiudi={() => {
          setFormAperto(false);
          setPraticaSelezionata(null);
        }}
        onRichiediEliminazione={() => setEliminaAperto(true)}
      />

      <ConfirmModal
        aperto={eliminaAperto}
        titolo="Elimina pratica"
        messaggio="Questa operazione è irreversibile. Confermi l'eliminazione della pratica?"
        pericoloso
        confermaLabel="Elimina"
        onConferma={eliminaPratica}
        onAnnulla={() => setEliminaAperto(false)}
      />
    </div>
  );
}
