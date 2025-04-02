import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Schéma pour la création et la mise à jour d'un groupe
const groupSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  description: z.string().optional(),
});

// GET - Récupérer tous les groupes accessibles pour l'utilisateur connecté
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }
    
    let groups;
    
    // Super admin voit tous les groupes
    if (session.user.role === "SUPER_ADMIN") {
      groups = await prisma.group.findMany({
        orderBy: {
          name: "asc",
        },
      });
    } else {
      // Utilisateur normal voit seulement ses groupes
      const userGroups = await prisma.groupUser.findMany({
        where: {
          userId: session.user.id,
        },
        select: {
          group: true,
        },
      });
      
      groups = userGroups.map((ug) => ug.group);
    }
    
    return NextResponse.json({ groups });
  } catch (error) {
    console.error("Error fetching groups:", error);
    return NextResponse.json(
      { message: "Une erreur est survenue lors de la récupération des groupes" },
      { status: 500 }
    );
  }
}

// POST - Créer un nouveau groupe
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }
    
    // Seuls les super admin et les admin peuvent créer des groupes
    if (session.user.role !== "SUPER_ADMIN" && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { message: "Vous n'avez pas les droits nécessaires pour créer un groupe" },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    
    // Valider les données d'entrée
    const validationResult = groupSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { message: "Données d'entrée invalides", errors: validationResult.error.flatten() },
        { status: 400 }
      );
    }
    
    const { name, description } = validationResult.data;
    
    // Créer le groupe
    const group = await prisma.group.create({
      data: {
        name,
        description: description || "",
      },
    });
    
    // Ajouter l'utilisateur créateur comme admin du groupe
    await prisma.groupUser.create({
      data: {
        userId: session.user.id,
        groupId: group.id,
        role: "ADMIN",
      },
    });
    
    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    console.error("Error creating group:", error);
    return NextResponse.json(
      { message: "Une erreur est survenue lors de la création du groupe" },
      { status: 500 }
    );
  }
}
