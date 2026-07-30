"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { clienteSchema, ClienteInput } from "@/lib/validazione";
import { CampoTesto, CampoData, CampoCheckbox } from "@/components/forms/Campi";
import { WizardProgress, useWizard } from "@/components/forms/Wizard";
import { ConfirmModal } from "@/components/ConfirmModal";

interface ClienteFormProps {
  aperto: boolean;
  modalita: "crea" | "modifica";
  valoriIniziali?: Partial<ClienteInput>;
  onSalva: (dati: ClienteInput) => Promise<void>;
  onChiudi: () => void;
  onRichiediEliminazione?: () => void;
}

function toInputDate(v?: string | Date | null): string {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function ClienteForm({ aperto, modalita, valoriIniziali, onSalva, onChiudi, onRichiediEliminazione }: ClienteFormProps) {
  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<ClienteInput>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      richiestaDati: false,
      iscritto: false,
      ...valoriIniziali,
      natoIl: toInputDate(valoriIniziali?.natoIl as any) as any,
      dataRicevimento: toInputDate(valoriIniziali?.dataRicevimento as any) as any,
    },
  });

  const steps = [
    {
      titolo: "Anagrafica",
      campi: ["cognome", "nome", "citta", "natoA", "natoIl", "residenteIn", "codiceFiscale"],
      contenuto: (
        <div className="grid grid-cols-2 gap-4">
          <CampoTesto label="Cognome" name="cognome" register={register} errors={errors} required />
          <CampoTesto label="Nome" name="nome" register={register} errors={errors} required />
          <CampoTesto label="Città" name="citta" register={register} errors={errors} />
          <CampoTesto label="Nato a" name="natoA" register={register} errors={errors} />
          <CampoData label="Nato il" name="natoIl" register={register} errors={errors} />
          <CampoTesto label="Residente in" name="residenteIn" register={register} errors={errors} />
          <CampoTesto label="Codice fiscale" name="codiceFiscale" register={register} errors={errors} />
        </div>
      ),
    },
    {
      titolo: "Contatti e lavoro",
      campi: ["email", "numero", "piattaforma", "orario", "periodoDiLavoro", "mezzo"],
      contenuto: (
        <div className="grid grid-cols-2 gap-4">
          <CampoTesto label="E-mail" name="email" register={register} errors={errors} />
          <CampoTesto label="Numero" name="numero" register={register} errors={errors} />
          <CampoTesto label="Piattaforma" name="piattaforma" register={register} errors={errors} />
          <CampoTesto label="Orario" name="orario" register={register} errors={errors} />
          <CampoTesto label="Periodo di lavoro" name="periodoDiLavoro" register={register} errors={errors} />
          <CampoTesto label="Mezzo" name="mezzo" register={register} errors={errors} />
        </div>
      ),
    },
    {
      titolo: "Amministrativo",
      campi: ["richiestaDati", "dataRicevimento", "pagamento", "iscritto", "docMancanti", "note"],
      contenuto: (
        <div className="grid grid-cols-2 gap-4">
          <CampoCheckbox label="Richiesta dati" name="richiestaDati" register={register} />
          <CampoData label="Data ricevimento" name="dataRicevimento" register={register} errors={errors} />
          <CampoTesto label="Pagamento" name="pagamento" register={register} errors={errors} />
          <CampoCheckbox label="Iscritto" name="iscritto" register={register} />
          <CampoTesto label="Doc. mancanti" name="docMancanti" register={register} errors={errors} />
          <div className="col-span-2">
            <CampoTesto label="Note" name="note" register={register} errors={errors} textarea />
          </div>
        </div>
      ),
    },
  ];

  const wizard = useWizard(steps.length);
  const [confermaAperta, setConfermaAperta] = useState(false);
  const [datiPendenti, setDatiPendenti] = useState<ClienteInput | null>(null);
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

  const passoAvanti = async () => {
    const ok = await trigger(steps[wizard.step].campi as (keyof ClienteInput)[]);
    if (ok) wizard.avanti();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
        <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
          <h2 className="mb-4 text-lg font-semibold text-studio-900">
            {modalita === "crea" ? "Nuovo cliente" : "Modifica cliente"}
          </h2>

          {modalita === "crea" && <WizardProgress step={wizard.step} steps={steps} />}

          {erroreServer && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erroreServer}</div>
          )}

          <form onSubmit={inviaForm} className="space-y-4">
            {modalita === "crea" ? steps[wizard.step].contenuto : steps.map((s) => <div key={s.titolo}>{s.contenuto}</div>)}

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

              {modalita === "crea" ? (
                <div className="flex gap-2">
                  {!wizard.isPrimo && (
                    <button type="button" onClick={wizard.indietro} className="rounded border border-studio-300 px-4 py-2 text-sm text-studio-700 hover:bg-studio-50">
                      Indietro
                    </button>
                  )}
                  {!wizard.isUltimo ? (
                    <button type="button" onClick={passoAvanti} className="rounded bg-studio-700 px-4 py-2 text-sm font-medium text-white hover:bg-studio-800">
                      Avanti
                    </button>
                  ) : (
                    <button type="submit" disabled={isSubmitting} className="rounded bg-studio-700 px-4 py-2 text-sm font-medium text-white hover:bg-studio-800 disabled:opacity-50">
                      Crea cliente
                    </button>
                  )}
                </div>
              ) : (
                <button type="submit" disabled={isSubmitting} className="rounded bg-studio-700 px-4 py-2 text-sm font-medium text-white hover:bg-studio-800 disabled:opacity-50">
                  Salva modifiche
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      <ConfirmModal
        aperto={confermaAperta}
        titolo="Conferma modifica cliente"
        messaggio={`Confermi di voler salvare le modifiche al cliente "${datiPendenti?.cognome ?? ""} ${datiPendenti?.nome ?? ""}"?`}
        inCorso={salvataggioInCorso}
        onConferma={confermaSalvataggio}
        onAnnulla={() => setConfermaAperta(false)}
      />
    </>
  );
}
