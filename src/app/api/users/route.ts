import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcrypt";

// Schéma de validation pour la création d'un utilisateur
const createUserSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  email: z.string().email("L'email doit être valide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  role: z.enum(["USER", "ADMIN", "SUPER_ADMIN"]),
  groups: z
    .array(
      z.object({
        id: z.string().uuid("L'ID du groupe doit être un UUID valide"),
        role: z.enum(["MEMBER", "ADMIN"]),
      })
    )
    .optional(),
});

// GET - Récupérer tous les utilisateurs (accessible aux super admins seulement)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }
    
    // Vérifier si l'utilisateur est super admin
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { message: "Vous n'avez pas les permissions nécessaires" },
        { status: 403 }
      );
    }
    
    // Récupérer tous les utilisateurs avec le nombre de groupes
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        createdAt: true,
        lastLogin: true,
        _count: {
          select: {
            groupUsers: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });
    
    return NextResponse.json(users);
  } catch (error) {
    console.error("Error getting users:", error);
    return NextResponse.json(
      { message: "Une erreur est survenue lors de la récupération des utilisateurs" },
      { status: 500 }
    );
  }
}

// POST - Créer un nouvel utilisateur (accessible aux super admins seulement)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }
    
    // Vérifier si l'utilisateur est super admin
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { message: "Vous n'avez pas les permissions nécessaires" },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    
    // Valider les données d'entrée
    const validationResult = createUserSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { message: "Données d'entrée invalides", errors: validationResult.error.flatten() },
        { status: 400 }
      );
    }
    
    const { name, email, password, role, groups } = validationResult.data;
    
    // Vérifier si l'email est déjà utilisé
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    
    if (existingUser) {
      return NextResponse.json(
        { message: "Cet email est déjà associé à un compte" },
        { status: 400 }
      );
    }
    
    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
      },
    });
    
    // Si des groupes sont fournis, ajouter l'utilisateur à ces groupes
    if (groups && groups.length > 0) {
      await Promise.all(
        groups.map(async (group) => {
          await prisma.groupUser.create({
            data: {
              userId: user.id,
              groupId: group.id,
              role: group.role,
            },
          });
        })
      );
    }
    
    // Retourner l'utilisateur créé sans le mot de passe
    const { password: _, ...userWithoutPassword } = user;
    
    return NextResponse.json(userWithoutPassword, { status: 201 });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { message: "Une erreur est survenue lors de la création de l'utilisateur" },
      { status: 500 }
    );
  }
}
