"use client";

import { ReactNode, useState } from "react";
import clsx from "clsx";

export interface WizardStep {
  titolo: string;
  contenuto: ReactNode;
  // Nomi dei campi del form da validare prima di poter avanzare
  campi: string[];
}

interface WizardProps {
  step: number;
  steps: WizardStep[];
}

// Barra di avanzamento del form guidato: mostra in quale passaggio si trova
// l'utente durante l'inserimento di una nuova causa/cliente.
export function WizardProgress({ step, steps }: WizardProps) {
  return (
    <ol className="mb-6 flex items-center gap-2">
      {steps.map((s, idx) => (
        <li key={s.titolo} className="flex flex-1 items-center gap-2">
          <div
            className={clsx(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              idx === step
                ? "bg-studio-700 text-white"
                : idx < step
                ? "bg-studio-300 text-studio-800"
                : "bg-studio-100 text-studio-500"
            )}
          >
            {idx + 1}
          </div>
          <span className={clsx("text-xs", idx === step ? "font-semibold text-studio-800" : "text-studio-500")}>
            {s.titolo}
          </span>
          {idx < steps.length - 1 && <div className="h-px flex-1 bg-studio-200" />}
        </li>
      ))}
    </ol>
  );
}

export function useWizard(totale: number) {
  const [step, setStep] = useState(0);
  return {
    step,
    isPrimo: step === 0,
    isUltimo: step === totale - 1,
    avanti: () => setStep((s) => Math.min(s + 1, totale - 1)),
    indietro: () => setStep((s) => Math.max(s - 1, 0)),
    reset: () => setStep(0),
  };
}
