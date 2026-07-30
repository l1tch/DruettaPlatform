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
    <nav className="flex h-14 items-center justify-between border-b border-studio-200 bg-white px-6">
      <div className="flex items-center gap-6">
        <span className="text-sm font-semibold text-studio-900">Studio Legale</span>
        <div className="flex gap-1">
          {VOCI.map((v) => (
            <Link
              key={v.href}
              href={v.href}
              className={clsx(
                "rounded px-3 py-1.5 text-sm font-medium transition",
                pathname === v.href ? "bg-studio-100 text-studio-900" : "text-studio-600 hover:bg-studio-50"
              )}
            >
              {v.etichetta}
            </Link>
          ))}
          {ruolo === "ADMIN" && (
            <Link
              href="/dashboard/utenti"
              className={clsx(
                "rounded px-3 py-1.5 text-sm font-medium transition",
                pathname === "/dashboard/utenti" ? "bg-studio-100 text-studio-900" : "text-studio-600 hover:bg-studio-50"
              )}
            >
              Utenti
            </Link>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-studio-500">
          {nome} · {ETICHETTA_RUOLO[ruolo]}
        </span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="rounded border border-studio-300 px-3 py-1.5 text-xs font-medium text-studio-700 hover:bg-studio-50"
        >
          Esci
        </button>
      </div>
    </nav>
  );
}
