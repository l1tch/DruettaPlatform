import { prisma } from "@/lib/prisma";
import { richiediUtente } from "@/lib/session";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await richiediUtente();

  const [pendenti, concluse, esecuzioni, clienti] = await Promise.all([
    prisma.causa.count({ where: { stato: "PENDENTI" } }),
    prisma.causa.count({ where: { stato: "CONCLUSE" } }),
    prisma.causa.count({ where: { stato: "ESECUZIONI" } }),
    prisma.cliente.count(),
  ]);

  const ora = new Date();
  const tra7Giorni = new Date(ora.getTime() + 7 * 24 * 60 * 60 * 1000);
  const prossimeUdienze = await prisma.causa.findMany({
    where: { dataUdienza: { gte: ora, lte: tra7Giorni } },
    orderBy: { dataUdienza: "asc" },
    take: 10,
  });

  const schede = [
    { titolo: "Cause pendenti", valore: pendenti, href: "/dashboard/cause?stato=PENDENTI" },
    { titolo: "Cause concluse", valore: concluse, href: "/dashboard/cause?stato=CONCLUSE" },
    { titolo: "Esecuzioni", valore: esecuzioni, href: "/dashboard/cause?stato=ESECUZIONI" },
    { titolo: "Clienti", valore: clienti, href: "/dashboard/clienti" },
  ];

  return (
    <div className="h-full overflow-auto p-6">
      <span className="section-kicker" />
      <h1 className="mb-6 text-2xl font-extrabold uppercase tracking-tight text-ink-900">Panoramica studio</h1>

      <div className="mb-8 grid grid-cols-4 gap-4">
        {schede.map((s) => (
          <Link key={s.titolo} href={s.href} className="border border-ink-200 border-t-4 border-t-brand-500 bg-white p-5 transition hover:border-ink-400">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-500">{s.titolo}</p>
            <p className="mt-2 text-3xl font-extrabold text-ink-900">{s.valore}</p>
          </Link>
        ))}
      </div>

      <div className="border border-ink-200 bg-white p-5">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-800">Udienze nei prossimi 7 giorni</h2>
        {prossimeUdienze.length === 0 ? (
          <p className="text-sm text-ink-400">Nessuna udienza in programma.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {prossimeUdienze.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium text-ink-800">{c.fascicolo}</span>
                <span className="text-ink-500">{c.tribunale}</span>
                <span className="text-ink-600">
                  {c.dataUdienza?.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
