"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const MESSAGGI_ERRORE: Record<string, string> = {
  AccessDenied: "Il tuo account Google non è autorizzato ad accedere a questa piattaforma. Contatta l'amministratore dello studio.",
  Default: "Si è verificato un errore durante l'accesso. Riprova.",
};

function ErroreAccesso() {
  const params = useSearchParams();
  const errore = params.get("error");
  if (!errore) return null;
  return (
    <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      {MESSAGGI_ERRORE[errore] ?? MESSAGGI_ERRORE.Default}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-studio-950 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-xl">
        <h1 className="text-center text-xl font-semibold text-studio-900">Studio Legale</h1>
        <p className="mt-1 text-center text-sm text-studio-500">Piattaforma gestionale cause e clienti</p>

        <Suspense fallback={null}>
          <ErroreAccesso />
        </Suspense>

        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded border border-studio-300 bg-white px-4 py-2.5 text-sm font-medium text-studio-800 shadow-sm transition hover:bg-studio-50"
        >
          Accedi con Google
        </button>

        <p className="mt-6 text-center text-xs text-studio-400">
          L&apos;accesso è riservato al personale autorizzato dello studio. L&apos;account Google è utilizzato anche per
          l&apos;invio delle email e l&apos;accesso ai documenti su Drive.
        </p>
      </div>
    </div>
  );
}
