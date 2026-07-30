"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import clsx from "clsx";
import { Role } from "@prisma/client";

const VOCI = [
  { href: "/dashboard", etichetta: "Panoramica" },
  { href: "/dashboard/cause", etichetta: "Cause" },
  { href: "/dashboard/clienti", etichetta: "Clienti" },
  { href: "/dashboard/collegamenti", etichetta: "Collegamenti" },
  { href: "/dashboard/suggerimenti-drive", etichetta: "Suggerimenti Drive" },
];

const ETICHETTA_RUOLO: Record<Role, string> = {
  ADMIN: "Amministratore",
  AVVOCATO: "Avvocato",
  SEGRETERIA: "Segreteria",
  SOLA_LETTURA: "Sola lettura",
};

export function Nav({ nome, ruolo }: { nome: string; ruolo: Role }) {
  const pathname = usePathname();

  return (
    <nav className="flex h-14 items-center justify-between bg-brand-500 px-6">
      <div className="flex items-center gap-6">
        <span className="text-lg tracking-tight text-white">
          <span className="font-normal">la</span>
          <span className="font-extrabold">comune</span>
        </span>
        <div className="flex gap-1">
          {VOCI.map((v) => (
            <Link
              key={v.href}
              href={v.href}
              className={clsx(
                "px-3 py-1.5 text-sm font-medium uppercase tracking-wide transition",
                pathname === v.href ? "bg-white text-brand-600" : "text-white hover:bg-brand-600"
              )}
            >
              {v.etichetta}
            </Link>
          ))}
          {ruolo === "ADMIN" && (
            <Link
              href="/dashboard/utenti"
              className={clsx(
                "px-3 py-1.5 text-sm font-medium uppercase tracking-wide transition",
                pathname === "/dashboard/utenti" ? "bg-white text-brand-600" : "text-white hover:bg-brand-600"
              )}
            >
              Utenti
            </Link>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-white/90">
          {nome} · {ETICHETTA_RUOLO[ruolo]}
        </span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="border border-white/70 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-white hover:bg-white hover:text-brand-600"
        >
          Esci
        </button>
      </div>
    </nav>
  );
}
