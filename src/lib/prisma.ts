import { PrismaClient } from "@prisma/client";

// Déclaration globale pour éviter les connexions multiples en mode développement
declare global {
  var prisma: PrismaClient | undefined;
}

// Utilisation d'une instance unique de PrismaClient (singleton)
export const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") global.prisma = prisma;
