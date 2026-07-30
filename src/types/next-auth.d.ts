import { Role } from "@prisma/client";
import "next-auth";
import "next-auth/adapters";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    role: Role;
  }
}

declare module "next-auth/adapters" {
  interface AdapterUser {
    role: Role;
  }
}
