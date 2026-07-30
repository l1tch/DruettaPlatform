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
      <h1 className="mb-6 text-xl font-semibold text-studio-900">Panoramica studio</h1>

      <div className="mb-8 grid grid-cols-4 gap-4">
        {schede.map((s) => (
          <Link key={s.titolo} href={s.href} className="rounded-lg border border-studio-200 bg-white p-5 shadow-sm transition hover:shadow-md">
            <p className="text-sm text-studio-500">{s.titolo}</p>
            <p className="mt-2 text-3xl font-semibold text-studio-900">{s.valore}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-lg border border-studio-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-studio-800">Udienze nei prossimi 7 giorni</h2>
        {prossimeUdienze.length === 0 ? (
          <p className="text-sm text-studio-400">Nessuna udienza in programma.</p>
        ) : (
          <ul className="divide-y divide-studio-100">
            {prossimeUdienze.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium text-studio-800">{c.fascicolo}</span>
                <span className="text-studio-500">{c.tribunale}</span>
                <span className="text-studio-600">
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
