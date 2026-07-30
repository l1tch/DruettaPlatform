import { richiediRuolo } from "@/lib/session";

export default async function UtentiLayout({ children }: { children: React.ReactNode }) {
  await richiediRuolo(["ADMIN"]);
  return <>{children}</>;
}
