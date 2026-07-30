"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { causaSchema, CausaInput } from "@/lib/validazione";
import { CampoTesto, CampoData, CampoCheckbox, CampoSelezione } from "@/components/forms/Campi";
import { WizardProgress, useWizard } from "@/components/forms/Wizard";
import { ConfirmModal } from "@/components/ConfirmModal";

interface CausaFormProps {
  aperto: boolean;
  modalita: "crea" | "modifica";
  valoriIniziali?: Partial<CausaInput>;
  statoPredefinito?: CausaInput["stato"];
  onSalva: (dati: CausaInput) => Promise<void>;
  onChiudi: () => void;
  onRichiediEliminazione?: () => void;
}

const STATO_OPZIONI = [
  { valore: "PENDENTI", etichetta: "Pendenti" },
  { valore: "CONCLUSE", etichetta: "Concluse" },
  { valore: "ESECUZIONI", etichetta: "Esecuzioni" },
];

function toInputDate(v?: string | Date | null): string {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function calcolaValoriForm(valoriIniziali: Partial<CausaInput> | undefined, statoPredefinito: CausaInput["stato"] | undefined): CausaInput {
  return {
    stato: statoPredefinito ?? "PENDENTI",
    fascicolo: "",
    fattoONo: false,
    propostaTrasmessa: false,
    procure185: false,
    ...valoriIniziali,
    dataUdienza: toInputDate(valoriIniziali?.dataUdienza as any) as any,
    termine: toInputDate(valoriIniziali?.termine as any) as any,
    dataProposta: toInputDate(valoriIniziali?.dataProposta as any) as any,
  };
}

export function CausaForm({ aperto, modalita, valoriIniziali, statoPredefinito, onSalva, onChiudi, onRichiediEliminazione }: CausaFormProps) {
  const {
    register,
    handleSubmit,
    trigger,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CausaInput>({
    resolver: zodResolver(causaSchema),
    defaultValues: calcolaValoriForm(valoriIniziali, statoPredefinito),
  });

  // useForm applica i defaultValues solo al primo mount: questo componente
  // resta montato tra un'apertura e l'altra del modale, quindi bisogna
  // reinizializzare esplicitamente il form ogni volta che si apre, altrimenti
  // "Modifica" mostrerebbe i campi vuoti invece dei dati del fascicolo.
  useEffect(() => {
    if (aperto) {
      reset(calcolaValoriForm(valoriIniziali, statoPredefinito));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aperto, valoriIniziali]);

  const steps = [
    {
      titolo: "Dati generali",
      campi: ["stato", "fascicolo", "tribunale", "rg", "ricorrenti", "controparte", "driveFolderUrl"],
      contenuto: (
        <div className="grid grid-cols-2 gap-4">
          <CampoSelezione label="Stato" name="stato" register={register} errors={errors} opzioni={STATO_OPZIONI} required />
          <CampoTesto label="Fascicolo" name="fascicolo" register={register} errors={errors} required />
          <CampoTesto label="Tribunale" name="tribunale" register={register} errors={errors} />
          <CampoTesto label="R.G." name="rg" register={register} errors={errors} placeholder="es. 8271/2025" />
          <CampoTesto label="Nomi ricorrenti" name="ricorrenti" register={register} errors={errors} />
          <CampoTesto label="Controparte" name="controparte" register={register} errors={errors} />
          <div className="col-span-2">
            <CampoTesto
              label="Link cartella Drive"
              name="driveFolderUrl"
              register={register}
              errors={errors}
              placeholder="https://drive.google.com/drive/folders/..."
            />
            <p className="mt-1 text-xs text-ink-400">
              La cartella deve già esistere su Drive (creata a mano seguendo la convenzione
              anno_rg_parte_controparte_tribunale): qui va solo incollato il link, non viene creata nulla.
            </p>
          </div>
        </div>
      ),
    },
    {
      titolo: "Udienza e termini",
      campi: ["ultimaUdienza", "dataUdienza", "adempimenti", "termine"],
      contenuto: (
        <div className="grid grid-cols-2 gap-4">
          <CampoTesto label="Ultima udienza" name="ultimaUdienza" register={register} errors={errors} />
          <CampoData label="Data udienza" name="dataUdienza" register={register} errors={errors} />
          <CampoTesto label="Adempimenti" name="adempimenti" register={register} errors={errors} textarea />
          <CampoData label="Termine" name="termine" register={register} errors={errors} />
        </div>
      ),
    },
    {
      titolo: "Esito e note",
      campi: ["fattoONo", "propostaTrasmessa", "dataProposta", "note", "procure185"],
      contenuto: (
        <div className="grid grid-cols-2 gap-4">
          <CampoCheckbox label="Fatto" name="fattoONo" register={register} />
          <CampoCheckbox label="Proposta trasmessa" name="propostaTrasmessa" register={register} />
          <CampoData label="Data proposta" name="dataProposta" register={register} errors={errors} />
          <CampoCheckbox label="Procure 185" name="procure185" register={register} />
          <div className="col-span-2">
            <CampoTesto label="Note" name="note" register={register} errors={errors} textarea />
          </div>
        </div>
      ),
    },
  ];

  const wizard = useWizard(steps.length);
  const [confermaAperta, setConfermaAperta] = useState(false);
  const [datiPendenti, setDatiPendenti] = useState<CausaInput | null>(null);
  const [erroreServer, setErroreServer] = useState<string | null>(null);
  const [salvataggioInCorso, setSalvataggioInCorso] = useState(false);

  useEffect(() => {
    if (aperto) {
      wizard.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aperto]);

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
    const ok = await trigger(steps[wizard.step].campi as (keyof CausaInput)[]);
    if (ok) wizard.avanti();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
        <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-xl">
          <h2 className="mb-4 text-lg font-bold uppercase tracking-wide text-ink-900">
            {modalita === "crea" ? "Nuovo fascicolo" : "Modifica fascicolo"}
          </h2>

          {modalita === "crea" && <WizardProgress step={wizard.step} steps={steps} />}

          {erroreServer && (
            <div className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erroreServer}</div>
          )}

          <form onSubmit={inviaForm} className="space-y-4">
            {modalita === "crea" ? steps[wizard.step].contenuto : steps.map((s) => <div key={s.titolo}>{s.contenuto}</div>)}

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

              {modalita === "crea" ? (
                <div className="flex gap-2">
                  {!wizard.isPrimo && (
                    <button type="button" onClick={wizard.indietro} className="border border-ink-300 px-4 py-2 text-sm font-medium uppercase tracking-wide text-ink-700 hover:bg-ink-50">
                      Indietro
                    </button>
                  )}
                  {!wizard.isUltimo ? (
                    <button type="button" onClick={passoAvanti} className="bg-ink-900 px-4 py-2 text-sm font-bold uppercase tracking-wide text-white hover:bg-black">
                      Avanti
                    </button>
                  ) : (
                    <button type="submit" disabled={isSubmitting} className="bg-brand-500 px-4 py-2 text-sm font-bold uppercase tracking-wide text-white hover:bg-brand-600 disabled:opacity-50">
                      Crea fascicolo
                    </button>
                  )}
                </div>
              ) : (
                <button type="submit" disabled={isSubmitting} className="bg-ink-900 px-4 py-2 text-sm font-bold uppercase tracking-wide text-white hover:bg-black disabled:opacity-50">
                  Salva modifiche
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      <ConfirmModal
        aperto={confermaAperta}
        titolo="Conferma modifica fascicolo"
        messaggio={`Confermi di voler salvare le modifiche al fascicolo "${datiPendenti?.fascicolo ?? ""}"?`}
        inCorso={salvataggioInCorso}
        onConferma={confermaSalvataggio}
        onAnnulla={() => setConfermaAperta(false)}
      />
    </>
  );
}
