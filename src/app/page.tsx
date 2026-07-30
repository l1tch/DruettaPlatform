import { redirect } from "next/navigation";
import { getSessionUtente } from "@/lib/session";

export default async function Home() {
  const session = await getSessionUtente();
  redirect(session?.user ? "/dashboard" : "/login");
}
