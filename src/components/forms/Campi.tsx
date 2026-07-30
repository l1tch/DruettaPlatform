"use client";

import { FieldErrors, UseFormRegister } from "react-hook-form";

function erroreDi(errors: FieldErrors, name: string): string | undefined {
  const parti = name.split(".");
  let cur: any = errors;
  for (const p of parti) {
    if (!cur) return undefined;
    cur = cur[p];
  }
  return cur?.message as string | undefined;
}

interface BaseProps {
  label: string;
  name: string;
  register: UseFormRegister<any>;
  errors: FieldErrors;
  required?: boolean;
}

const baseInputClass =
  "w-full border border-ink-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

function Wrapper({ label, name, errors, required, children }: BaseProps & { children: React.ReactNode }) {
  const errore = erroreDi(errors, name);
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-700">
        {label}
        {required && <span className="text-brand-500"> *</span>}
      </span>
      {children}
      {errore && <span className="mt-1 block text-xs text-brand-600">{errore}</span>}
    </label>
  );
}

export function CampoTesto(props: BaseProps & { placeholder?: string; textarea?: boolean }) {
  return (
    <Wrapper {...props}>
      {props.textarea ? (
        <textarea rows={3} {...props.register(props.name)} placeholder={props.placeholder} className={baseInputClass} />
      ) : (
        <input type="text" {...props.register(props.name)} placeholder={props.placeholder} className={baseInputClass} />
      )}
    </Wrapper>
  );
}

export function CampoData(props: BaseProps) {
  return (
    <Wrapper {...props}>
      <input
        type="date"
        {...props.register(props.name, {
          setValueAs: (v) => (v ? v : null),
        })}
        className={baseInputClass}
      />
    </Wrapper>
  );
}

export function CampoCheckbox({ label, name, register }: Omit<BaseProps, "errors">) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink-700">
      <input type="checkbox" {...register(name)} className="h-4 w-4 border-ink-300 accent-brand-500" />
      {label}
    </label>
  );
}

export function CampoSelezione(
  props: BaseProps & { opzioni: { valore: string; etichetta: string }[] }
) {
  return (
    <Wrapper {...props}>
      <select {...props.register(props.name)} className={baseInputClass}>
        {props.opzioni.map((o) => (
          <option key={o.valore} value={o.valore}>
            {o.etichetta}
          </option>
        ))}
      </select>
    </Wrapper>
  );
}
