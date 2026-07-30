"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { collegamentoSchema, CollegamentoInput } from "@/lib/validazione";
import { CampoTesto, CampoData, CampoSelezione } from "@/components/forms/Campi";
import { ConfirmModal } from "@/components/ConfirmModal";

interface Opzione {
  id: string;
  etichetta: string;
}

interface CollegamentoFormProps {
  aperto: boolean;
  modalita: "crea" | "modifica";
  clienti: Opzione[];
  cause: Opzione[];
  valoriIniziali?: Partial<Omit<CollegamentoInput, "ultimoDocumentoData">> & {
    ultimoDocumentoData?: string | Date | null;
  };
  onSalva: (dati: CollegamentoInput) => Promise<void>;
  onChiudi: () => void;
  onRichiediEliminazione?: () => void;
}

function toInputDate(v?: string | Date | null): string {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function CollegamentoForm({ aperto, modalita, clienti, cause, valoriIniziali, onSalva, onChiudi, onRichiediEliminazione }: CollegamentoFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CollegamentoInput>({
    resolver: zodResolver(collegamentoSchema),
    defaultValues: {
      clienteId: clienti[0]?.id ?? "",
      causaId: cause[0]?.id ?? "",
      ...valoriIniziali,
      ultimoDocumentoData: toInputDate(valoriIniziali?.ultimoDocumentoData as any) as any,
    },
  });

  const [confermaAperta, setConfermaAperta] = useState(false);
  const [datiPendenti, setDatiPendenti] = useState<CollegamentoInput | null>(null);
  const [erroreServer, setErroreServer] = useState<string | null>(null);
  const [salvataggioInCorso, setSalvataggioInCorso] = useState(false);

  if (!aperto) return null;

  const inviaForm = handleSubmit(async (dati) => {
    setErroreServer(null);
    if (modalita === "modifica") {
      setDatiPendenti(dati);
      setConfermaAperta(true);
    } else {
      try {
        setSalvataggioInCorso(true);
        await onSalva(dati);
      } catch (e) {
        setErroreServer(e instanceof Error ? e.message : "Errore durante il salvataggio");
      } finally {
        setSalvataggioInCorso(false);
      }
    }
  });

  const confermaSalvataggio = async () => {
    if (!datiPendenti) return;
    try {
      setSalvataggioInCorso(true);
      setErroreServer(null);
      await onSalva(datiPendenti);
      setConfermaAperta(false);
    } catch (e) {
      setErroreServer(e instanceof Error ? e.message : "Errore durante il salvataggio");
      setConfermaAperta(false);
    } finally {
      setSalvataggioInCorso(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
        <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
          <h2 className="mb-4 text-lg font-semibold text-studio-900">
            {modalita === "crea" ? "Nuovo collegamento cliente-causa" : "Modifica collegamento"}
          </h2>

          {erroreServer && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erroreServer}</div>
          )}

          <form onSubmit={inviaForm} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <CampoSelezione
                label="Cliente"
                name="clienteId"
                register={register}
                errors={errors}
                required
                opzioni={clienti.map((c) => ({ valore: c.id, etichetta: c.etichetta }))}
              />
              <CampoSelezione
                label="Causa (fascicolo / R.G.)"
                name="causaId"
                register={register}
                errors={errors}
                required
                opzioni={cause.map((c) => ({ valore: c.id, etichetta: c.etichetta }))}
              />
              <CampoTesto label="Ruolo cliente" name="ruoloCliente" register={register} errors={errors} placeholder="es. ricorrente" />
              <CampoTesto label="Ultimo documento (nome)" name="ultimoDocumentoNome" register={register} errors={errors} placeholder="es. Verbale udienza" />
              <CampoTesto label="Link documento Drive" name="ultimoDocumentoUrl" register={register} errors={errors} />
              <CampoData label="Data ultimo documento" name="ultimoDocumentoData" register={register} errors={errors} />
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-studio-100 pt-4">
              <div className="flex gap-2">
                <button type="button" onClick={onChiudi} className="rounded border border-studio-300 px-4 py-2 text-sm text-studio-700 hover:bg-studio-50">
                  Annulla
                </button>
                {modalita === "modifica" && onRichiediEliminazione && (
                  <button
                    type="button"
                    onClick={onRichiediEliminazione}
                    className="rounded border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    Elimina
                  </button>
                )}
              </div>
              <button type="submit" disabled={isSubmitting} className="rounded bg-studio-700 px-4 py-2 text-sm font-medium text-white hover:bg-studio-800 disabled:opacity-50">
                {modalita === "crea" ? "Crea collegamento" : "Salva modifiche"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmModal
        aperto={confermaAperta}
        titolo="Conferma modifica collegamento"
        inCorso={salvataggioInCorso}
        onConferma={confermaSalvataggio}
        onAnnulla={() => setConfermaAperta(false)}
      />
    </>
  );
}
