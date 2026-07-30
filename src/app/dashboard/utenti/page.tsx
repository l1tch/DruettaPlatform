"use client";

import { useCallback, useEffect, useState } from "react";

interface Utente {
  id: string;
  name: string | null;
  email: string;
  role: "ADMIN" | "AVVOCATO" | "SEGRETERIA" | "SOLA_LETTURA";
  attivo: boolean;
}

const RUOLI: Utente["role"][] = ["ADMIN", "AVVOCATO", "SEGRETERIA", "SOLA_LETTURA"];

export default function UtentiPage() {
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [caricamento, setCaricamento] = useState(true);

  const carica = useCallback(async () => {
    setCaricamento(true);
    const res = await fetch("/api/utenti");
    if (res.ok) setUtenti(await res.json());
    setCaricamento(false);
  }, []);

  useEffect(() => {
    carica();
  }, [carica]);

  const aggiornaRuolo = async (id: string, role: Utente["role"]) => {
    await fetch(`/api/utenti/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    await carica();
  };

  const aggiornaAttivo = async (id: string, attivo: boolean) => {
    await fetch(`/api/utenti/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attivo }),
    });
    await carica();
  };

  if (caricamento) return <div className="p-6 text-ink-400">Caricamento...</div>;

  return (
    <div className="h-full overflow-auto p-6">
      <span className="section-kicker" />
      <h1 className="mb-6 text-2xl font-extrabold uppercase tracking-tight text-ink-900">Gestione utenti e ruoli</h1>
      <table className="w-full border-collapse bg-white text-sm">
        <thead className="bg-ink-50">
          <tr>
            <th className="border-b-2 border-ink-900 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-ink-900">Nome</th>
            <th className="border-b-2 border-ink-900 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-ink-900">Email</th>
            <th className="border-b-2 border-ink-900 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-ink-900">Ruolo</th>
            <th className="border-b-2 border-ink-900 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-ink-900">Attivo</th>
          </tr>
        </thead>
        <tbody>
          {utenti.map((u) => (
            <tr key={u.id}>
              <td className="border-b border-ink-200 px-3 py-1.5">{u.name}</td>
              <td className="border-b border-ink-200 px-3 py-1.5">{u.email}</td>
              <td className="border-b border-ink-200 px-3 py-1.5">
                <select
                  value={u.role}
                  onChange={(e) => aggiornaRuolo(u.id, e.target.value as Utente["role"])}
                  className="border border-ink-300 px-2 py-1 focus:border-brand-500 focus:outline-none"
                >
                  {RUOLI.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </td>
              <td className="border-b border-ink-200 px-3 py-1.5">
                <input
                  type="checkbox"
                  checked={u.attivo}
                  onChange={(e) => aggiornaAttivo(u.id, e.target.checked)}
                  className="h-4 w-4 accent-brand-500"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
