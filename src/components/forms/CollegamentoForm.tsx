"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
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

function calcolaValoriForm(
  valoriIniziali: CollegamentoFormProps["valoriIniziali"],
  clienti: Opzione[],
  cause: Opzione[]
): CollegamentoInput {
  return {
    clienteId: clienti[0]?.id ?? "",
    causaId: cause[0]?.id ?? "",
    ...valoriIniziali,
    ultimoDocumentoData: toInputDate(valoriIniziali?.ultimoDocumentoData as any) as any,
  };
}

export function CollegamentoForm({ aperto, modalita, clienti, cause, valoriIniziali, onSalva, onChiudi, onRichiediEliminazione }: CollegamentoFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CollegamentoInput>({
    resolver: zodResolver(collegamentoSchema),
    defaultValues: calcolaValoriForm(valoriIniziali, clienti, cause),
  });

  // Il form resta montato tra un'apertura e l'altra: senza questo reset,
  // "Modifica" mostrerebbe sempre i valori del primo mount invece dei dati
  // del collegamento selezionato (i defaultValues di useForm si applicano
  // una sola volta).
  useEffect(() => {
    if (aperto) {
      reset(calcolaValoriForm(valoriIniziali, clienti, cause));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aperto, valoriIniziali]);

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
        <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto bg-white p-6 shadow-xl">
          <h2 className="mb-4 text-lg font-bold uppercase tracking-wide text-ink-900">
            {modalita === "crea" ? "Nuovo collegamento cliente-causa" : "Modifica collegamento"}
          </h2>

          {erroreServer && (
            <div className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erroreServer}</div>
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

            <div className="mt-6 flex items-center justify-between border-t border-ink-100 pt-4">
              <div className="flex gap-2">
                <button type="button" onClick={onChiudi} className="border border-ink-300 px-4 py-2 text-sm font-medium uppercase tracking-wide text-ink-700 hover:bg-ink-50">
                  Annulla
                </button>
                {modalita === "modifica" && onRichiediEliminazione && (
                  <button
                    type="button"
                    onClick={onRichiediEliminazione}
                    className="border border-brand-300 px-4 py-2 text-sm font-medium uppercase tracking-wide text-brand-600 hover:bg-brand-50"
                  >
                    Elimina
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-4 py-2 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50 ${
                  modalita === "crea" ? "bg-brand-500 hover:bg-brand-600" : "bg-ink-900 hover:bg-black"
                }`}
              >
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
