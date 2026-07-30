import { richiediUtente } from "@/lib/session";
import { Nav } from "@/components/Nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const utente = await richiediUtente();

  return (
    <div className="flex h-screen flex-col">
      <Nav nome={utente.name ?? utente.email ?? "Utente"} ruolo={utente.role} />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
