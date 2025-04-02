import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Schéma pour la création et la mise à jour d'un serveur
const serverSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  type: z.enum(["DATABASE", "APPLICATION", "MAIL", "OTHER"]),
  description: z.string().optional(),
  groups: z.array(z.string()).min(1, "Au moins un groupe est requis"),
});

// GET - Récupérer tous les serveurs accessibles pour l'utilisateur connecté
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }
    
    // Récupérer les serveurs auxquels l'utilisateur a accès via ses groupes
    let servers;
    
    // Super admin peut voir tous les serveurs
    if (session.user.role === "SUPER_ADMIN") {
      servers = await prisma.server.findMany({
        include: {
          createdBy: {
            select: { name: true },
          },
          probes: true,
          groups: {
            select: { id: true, name: true },
          },
        },
        orderBy: {
          name: "asc",
        },
      });
    } else {
      // Utilisateur normal voit seulement les serveurs de ses groupes
      const userGroups = await prisma.groupUser.findMany({
        where: {
          userId: session.user.id,
        },
        select: {
          groupId: true,
        },
      });
      
      const groupIds = userGroups.map((ug) => ug.groupId);
      
      servers = await prisma.server.findMany({
        where: {
          groups: {
            some: {
              id: {
                in: groupIds,
              },
            },
          },
        },
        include: {
          createdBy: {
            select: { name: true },
          },
          probes: true,
          groups: {
            select: { id: true, name: true },
          },
        },
        orderBy: {
          name: "asc",
        },
      });
    }
    
    return NextResponse.json({ servers });
  } catch (error) {
    console.error("Error fetching servers:", error);
    return NextResponse.json(
      { message: "Une erreur est survenue lors de la récupération des serveurs" },
      { status: 500 }
    );
  }
}

// POST - Créer un nouveau serveur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }
    
    const body = await request.json();
    
    // Valider les données d'entrée
    const validationResult = serverSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { message: "Données d'entrée invalides", errors: validationResult.error.flatten() },
        { status: 400 }
      );
    }
    
    const { name, type, description, groups } = validationResult.data;
    
    // Vérifier que l'utilisateur a accès aux groupes sélectionnés
    const userGroups = await prisma.groupUser.findMany({
      where: {
        userId: session.user.id,
        groupId: {
          in: groups,
        },
      },
    });
    
    const accessibleGroupIds = userGroups.map((ug) => ug.groupId);
    
    // Super admin peut ajouter à n'importe quel groupe
    let authorizedGroups = groups;
    
    if (session.user.role !== "SUPER_ADMIN") {
      // Vérifier que tous les groupes demandés sont accessibles à l'utilisateur
      const unauthorizedGroups = groups.filter(
        (groupId) => !accessibleGroupIds.includes(groupId)
      );
      
      if (unauthorizedGroups.length > 0) {
        return NextResponse.json(
          { message: "Vous n'avez pas accès à certains des groupes sélectionnés" },
          { status: 403 }
        );
      }
      
      authorizedGroups = accessibleGroupIds;
    }
    
    // Créer le serveur
    const server = await prisma.server.create({
      data: {
        name,
        type,
        description: description || "",
        createdById: session.user.id,
        groups: {
          connect: authorizedGroups.map((groupId) => ({ id: groupId })),
        },
      },
      include: {
        groups: true,
      },
    });
    
    return NextResponse.json(server, { status: 201 });
  } catch (error) {
    console.error("Error creating server:", error);
    return NextResponse.json(
      { message: "Une erreur est survenue lors de la création du serveur" },
      { status: 500 }
    );
  }
}
