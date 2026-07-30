"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
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

export function CausaForm({ aperto, modalita, valoriIniziali, statoPredefinito, onSalva, onChiudi, onRichiediEliminazione }: CausaFormProps) {
  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<CausaInput>({
    resolver: zodResolver(causaSchema),
    defaultValues: {
      stato: statoPredefinito ?? "PENDENTI",
      fattoONo: false,
      propostaTrasmessa: false,
      procure185: false,
      ...valoriIniziali,
      dataUdienza: toInputDate(valoriIniziali?.dataUdienza as any) as any,
      termine: toInputDate(valoriIniziali?.termine as any) as any,
      dataProposta: toInputDate(valoriIniziali?.dataProposta as any) as any,
    },
  });

  const steps = [
    {
      titolo: "Dati generali",
      campi: ["stato", "fascicolo", "tribunale", "rg", "ricorrenti", "controparte"],
      contenuto: (
        <div className="grid grid-cols-2 gap-4">
          <CampoSelezione label="Stato" name="stato" register={register} errors={errors} opzioni={STATO_OPZIONI} required />
          <CampoTesto label="Fascicolo" name="fascicolo" register={register} errors={errors} required />
          <CampoTesto label="Tribunale" name="tribunale" register={register} errors={errors} />
          <CampoTesto label="R.G." name="rg" register={register} errors={errors} />
          <CampoTesto label="Nomi ricorrenti" name="ricorrenti" register={register} errors={errors} />
          <CampoTesto label="Controparte" name="controparte" register={register} errors={errors} />
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

  if (!aperto) return null;

  const inviaForm = handleSubmit(async (dati) => {
    if (modalita === "modifica") {
      setDatiPendenti(dati);
      setConfermaAperta(true);
    } else {
      await onSalva(dati);
    }
  });

  const confermaSalvataggio = async () => {
    if (datiPendenti) await onSalva(datiPendenti);
    setConfermaAperta(false);
  };

  const passoAvanti = async () => {
    const ok = await trigger(steps[wizard.step].campi as (keyof CausaInput)[]);
    if (ok) wizard.avanti();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
        <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
          <h2 className="mb-4 text-lg font-semibold text-studio-900">
            {modalita === "crea" ? "Nuovo fascicolo" : "Modifica fascicolo"}
          </h2>

          {modalita === "crea" && <WizardProgress step={wizard.step} steps={steps} />}

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
                      Crea fascicolo
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
        titolo="Conferma modifica fascicolo"
        messaggio={`Confermi di voler salvare le modifiche al fascicolo "${datiPendenti?.fascicolo ?? ""}"?`}
        onConferma={confermaSalvataggio}
        onAnnulla={() => setConfermaAperta(false)}
      />
    </>
  );
}
