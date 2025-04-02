import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcrypt";

// Schéma de validation pour la mise à jour d'un utilisateur
const updateUserSchema = z.object({
  name: z.string().min(1, "Le nom est requis").optional(),
  email: z.string().email("L'email doit être valide").optional(),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères").optional(),
  role: z.enum(["USER", "ADMIN", "SUPER_ADMIN"]).optional(),
  groups: z
    .array(
      z.object({
        id: z.string().uuid("L'ID du groupe doit être un UUID valide"),
        role: z.enum(["MEMBER", "ADMIN"]),
      })
    )
    .optional(),
});

// GET - Récupérer un utilisateur spécifique
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }
    
    const userId = params.id;
    
    // Les utilisateurs normaux ne peuvent voir que leur propre profil
    // Les super admins peuvent voir tous les profils
    if (session.user.role !== "SUPER_ADMIN" && session.user.id !== userId) {
      return NextResponse.json(
        { message: "Vous n'avez pas les permissions nécessaires" },
        { status: 403 }
      );
    }
    
    // Récupérer l'utilisateur avec ses groupes
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        createdAt: true,
        lastLogin: true,
        groupUsers: {
          include: {
            group: true,
          },
        },
      },
    });
    
    if (!user) {
      return NextResponse.json(
        { message: "Utilisateur introuvable" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(user);
  } catch (error) {
    console.error("Error getting user:", error);
    return NextResponse.json(
      { message: "Une erreur est survenue lors de la récupération de l'utilisateur" },
      { status: 500 }
    );
  }
}

// PUT - Mettre à jour un utilisateur
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }
    
    const userId = params.id;
    
    // Les utilisateurs normaux ne peuvent modifier que leur propre profil
    // Les super admins peuvent modifier tous les profils
    if (session.user.role !== "SUPER_ADMIN" && session.user.id !== userId) {
      return NextResponse.json(
        { message: "Vous n'avez pas les permissions nécessaires" },
        { status: 403 }
      );
    }
    
    // Règle supplémentaire: seul un super admin peut modifier le rôle d'un utilisateur
    // et gérer les groupes d'un autre utilisateur
    const isSelfEdit = session.user.id === userId;
    
    const body = await request.json();
    
    // Valider les données d'entrée
    const validationResult = updateUserSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { message: "Données d'entrée invalides", errors: validationResult.error.flatten() },
        { status: 400 }
      );
    }
    
    const { name, email, password, role, groups } = validationResult.data;
    
    // Si l'utilisateur tente de modifier son propre rôle, ignorer
    const finalRole = isSelfEdit ? undefined : role;
    
    // Si l'email est modifié, vérifier qu'il n'est pas déjà utilisé
    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          id: { not: userId },
        },
      });
      
      if (existingUser) {
        return NextResponse.json(
          { message: "Cet email est déjà associé à un compte" },
          { status: 400 }
        );
      }
    }
    
    // Préparer les données pour la mise à jour
    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) updateData.password = await bcrypt.hash(password, 10);
    if (finalRole) updateData.role = finalRole;
    
    // Mettre à jour l'utilisateur
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
    
    // Gérer l'association aux groupes (seulement pour les super admins)
    if (groups && session.user.role === "SUPER_ADMIN") {
      // Supprimer les associations existantes
      await prisma.groupUser.deleteMany({
        where: { userId },
      });
      
      // Créer les nouvelles associations
      if (groups.length > 0) {
        await Promise.all(
          groups.map(async (group) => {
            await prisma.groupUser.create({
              data: {
                userId,
                groupId: group.id,
                role: group.role,
              },
            });
          })
        );
      }
    }
    
    // Retourner l'utilisateur mis à jour sans le mot de passe
    const { password: _, ...userWithoutPassword } = updatedUser;
    
    return NextResponse.json(userWithoutPassword);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { message: "Une erreur est survenue lors de la mise à jour de l'utilisateur" },
      { status: 500 }
    );
  }
}

// DELETE - Supprimer un utilisateur (super admin uniquement)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    
    const userId = params.id;
    
    // Empêcher la suppression de soi-même
    if (session.user.id === userId) {
      return NextResponse.json(
        { message: "Vous ne pouvez pas supprimer votre propre compte" },
        { status: 400 }
      );
    }
    
    // Vérifier si l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      return NextResponse.json(
        { message: "Utilisateur introuvable" },
        { status: 404 }
      );
    }
    
    // Supprimer l'utilisateur
    await prisma.user.delete({
      where: { id: userId },
    });
    
    return NextResponse.json({ message: "Utilisateur supprimé avec succès" });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { message: "Une erreur est survenue lors de la suppression de l'utilisateur" },
      { status: 500 }
    );
  }
}
