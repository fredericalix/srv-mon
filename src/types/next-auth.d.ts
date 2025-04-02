import NextAuth, { DefaultSession } from "next-auth";

// Étendre le type User pour inclure les champs supplémentaires
declare module "next-auth" {
  interface User {
    id: string;
    role: "USER" | "ADMIN" | "SUPER_ADMIN";
  }

  interface Session {
    user: {
      id: string;
      role: "USER" | "ADMIN" | "SUPER_ADMIN";
    } & DefaultSession["user"];
  }
}
