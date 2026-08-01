"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { praticaSchema, PraticaInput } from "@/lib/validazione";
import { CampoTesto, CampoData, CampoCheckbox, CampoSelezione } from "@/components/forms/Campi";
import { WizardProgress, useWizard } from "@/components/forms/Wizard";
import { ConfirmModal } from "@/components/ConfirmModal";

interface PraticaFormProps {
  aperto: boolean;
  modalita: "crea" | "modifica";
  valoriIniziali?: Partial<PraticaInput>;
  statoPredefinito?: PraticaInput["stato"];
  onSalva: (dati: PraticaInput) => Promise<void>;
  onChiudi: () => void;
  onRichiediEliminazione?: () => void;
}

const STATO_OPZIONI = [
  { valore: "PENDENTI", etichetta: "Pendenti" },
  { valore: "CONCLUSE", etichetta: "Concluse" },
  { valore: "IN_ESECUZIONE", etichetta: "In esecuzione" },
  { valore: "DA_PAGARE", etichetta: "Da pagare" },
  { valore: "DIMESSI_ESCLUSI", etichetta: "Dimessi/Esclusi" },
];

const CATEGORIA_OPZIONI = [
  { valore: "RAIDER", etichetta: "Raider" },
  { valore: "CAUSA_SINGOLA", etichetta: "Causa singola" },
  { valore: "DA_CLASSIFICARE", etichetta: "Da classificare" },
];

function toInputDate(v?: string | Date | null): string {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function calcolaValoriForm(valoriIniziali: Partial<PraticaInput> | undefined, statoPredefinito: PraticaInput["stato"] | undefined): PraticaInput {
  return {
    stato: statoPredefinito ?? "PENDENTI",
    categoria: "DA_CLASSIFICARE",
    driveFolderUrl: "",
    cartaceo: false,
    procura: false,
    pagatoCapitale: false,
    pagatoSpeseLegali: false,
    ...valoriIniziali,
    scadenza: toInputDate(valoriIniziali?.scadenza as any) as any,
    impugnativa: toInputDate(valoriIniziali?.impugnativa as any) as any,
    dataLicenziamento: toInputDate(valoriIniziali?.dataLicenziamento as any) as any,
  };
}

export function PraticaForm({ aperto, modalita, valoriIniziali, statoPredefinito, onSalva, onChiudi, onRichiediEliminazione }: PraticaFormProps) {
  const {
    register,
    handleSubmit,
    trigger,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PraticaInput>({
    resolver: zodResolver(praticaSchema),
    defaultValues: calcolaValoriForm(valoriIniziali, statoPredefinito),
  });

  // useForm applica i defaultValues solo al primo mount: questo componente
  // resta montato tra un'apertura e l'altra del modale, quindi va
  // reinizializzato esplicitamente ogni volta che si apre (stesso bug/fix
  // gia' visto in CausaForm/ClienteForm).
  useEffect(() => {
    if (aperto) {
      reset(calcolaValoriForm(valoriIniziali, statoPredefinito));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aperto, valoriIniziali]);

  const steps = [
    {
      titolo: "Dati generali",
      campi: ["stato", "categoria", "tipologia", "driveFolderUrl", "rg", "citta"],
      contenuto: (
        <div className="grid grid-cols-2 gap-4">
          <CampoSelezione label="Stato" name="stato" register={register} errors={errors} opzioni={STATO_OPZIONI} required />
          <CampoSelezione label="Categoria" name="categoria" register={register} errors={errors} opzioni={CATEGORIA_OPZIONI} required />
          <CampoTesto label="Tipologia" name="tipologia" register={register} errors={errors} />
          <CampoTesto label="R.G." name="rg" register={register} errors={errors} />
          <CampoTesto label="Città" name="citta" register={register} errors={errors} />
          <div className="col-span-2">
            <CampoTesto
              label="Link cartella Drive"
              name="driveFolderUrl"
              register={register}
              errors={errors}
              required
              placeholder="https://drive.google.com/drive/folders/..."
            />
            <p className="mt-1 text-xs text-ink-400">
              La cartella deve già esistere su Drive: qui va solo incollato il link (è anche la chiave usata per
              abbinare le righe importate dal file Excel), non viene creata nulla.
            </p>
          </div>
        </div>
      ),
    },
    {
      titolo: "Anagrafica e contatti",
      campi: ["nome", "cognome", "datiAnagrafici", "controparte", "email", "telefono"],
      contenuto: (
        <div className="grid grid-cols-2 gap-4">
          <CampoTesto label="Nome" name="nome" register={register} errors={errors} />
          <CampoTesto label="Cognome" name="cognome" register={register} errors={errors} />
          <div className="col-span-2">
            <CampoTesto label="Indirizzo e codice fiscale" name="datiAnagrafici" register={register} errors={errors} textarea />
            <p className="mt-1 text-xs text-ink-400">Dato sensibile: viene cifrato prima di essere salvato.</p>
          </div>
          <CampoTesto label="Controparte" name="controparte" register={register} errors={errors} />
          <CampoTesto label="Email" name="email" register={register} errors={errors} />
          <CampoTesto label="Telefono" name="telefono" register={register} errors={errors} />
        </div>
      ),
    },
    {
      titolo: "Scadenze e note",
      campi: ["scadenza", "impugnativa", "dataLicenziamento", "appuntamenti", "note", "cartaceo", "procura"],
      contenuto: (
        <div className="grid grid-cols-2 gap-4">
          <CampoData label="Scadenza" name="scadenza" register={register} errors={errors} />
          <CampoData label="Impugnativa" name="impugnativa" register={register} errors={errors} />
          <CampoData label="Data licenziamento" name="dataLicenziamento" register={register} errors={errors} />
          <CampoCheckbox label="Cartaceo" name="cartaceo" register={register} />
          <CampoCheckbox label="Procura" name="procura" register={register} />
          <div className="col-span-2">
            <CampoTesto label="Appuntamenti" name="appuntamenti" register={register} errors={errors} textarea />
          </div>
          <div className="col-span-2">
            <CampoTesto label="Note" name="note" register={register} errors={errors} textarea />
          </div>
        </div>
      ),
    },
    {
      titolo: "Pagamenti ed esecuzione",
      campi: ["emissioneFatturaSpeseLegali", "pagatoCapitale", "pagatoSpeseLegali", "precetto", "esecuzione"],
      contenuto: (
        <div className="grid grid-cols-2 gap-4">
          <CampoTesto label="Emissione fattura spese legali" name="emissioneFatturaSpeseLegali" register={register} errors={errors} />
          <div />
          <CampoCheckbox label="Pagato capitale" name="pagatoCapitale" register={register} />
          <CampoCheckbox label="Pagato spese legali" name="pagatoSpeseLegali" register={register} />
          <div className="col-span-2">
            <CampoTesto label="Precetto" name="precetto" register={register} errors={errors} textarea />
          </div>
          <div className="col-span-2">
            <CampoTesto label="Esecuzione" name="esecuzione" register={register} errors={errors} textarea />
          </div>
        </div>
      ),
    },
  ];

  const wizard = useWizard(steps.length);
  const [confermaAperta, setConfermaAperta] = useState(false);
  const [datiPendenti, setDatiPendenti] = useState<PraticaInput | null>(null);
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
    const ok = await trigger(steps[wizard.step].campi as (keyof PraticaInput)[]);
    if (ok) wizard.avanti();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
        <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-xl">
          <h2 className="mb-4 text-lg font-bold uppercase tracking-wide text-ink-900">
            {modalita === "crea" ? "Nuova pratica" : "Modifica pratica"}
          </h2>

          {modalita === "crea" && <WizardProgress step={wizard.step} steps={steps} />}

          {erroreServer && <div className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erroreServer}</div>}

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
                      Crea pratica
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
        titolo="Conferma modifica pratica"
        messaggio="Confermi di voler salvare le modifiche a questa pratica?"
        inCorso={salvataggioInCorso}
        onConferma={confermaSalvataggio}
        onAnnulla={() => setConfermaAperta(false)}
      />
    </>
  );
}
