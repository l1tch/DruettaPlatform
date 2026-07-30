import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  // Accesso ai soli file creati/aperti dall'app + lettura metadati cartella studio
  "https://www.googleapis.com/auth/drive",
  // Invio email per conto dell'utente autenticato
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

function dominiAutorizzati(): string[] {
  const raw = process.env.ALLOWED_EMAIL_DOMAINS ?? "";
  return raw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database", maxAge: 8 * 60 * 60 }, // 8 ore: sessione allineata all'orario di lavoro dello studio
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          scope: GOOGLE_SCOPES,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const domini = dominiAutorizzati();
      if (domini.length === 0) return true;
      const emailDomain = user.email?.split("@")[1]?.toLowerCase();
      if (!emailDomain || !domini.includes(emailDomain)) {
        return false; // rifiuta account Google non appartenenti allo studio
      }
      return true;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = user.role;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      const adminEmail = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase();
      if (adminEmail && user.email?.toLowerCase() === adminEmail) {
        await prisma.user.update({ where: { id: user.id }, data: { role: Role.ADMIN } });
      }
    },
  },
};
