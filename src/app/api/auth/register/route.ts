import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { z } from "zod";

// Schéma de validation pour l'enregistrement
const registerSchema = z.object({
  name: z.string().min(3, "Le nom doit contenir au moins 3 caractères"),
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Valider les données d'entrée
    const validationResult = registerSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { message: "Données d'entrée invalides", errors: validationResult.error.flatten() },
        { status: 400 }
      );
    }
    
    const { name, email, password } = validationResult.data;
    
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    
    if (existingUser) {
      return NextResponse.json(
        { message: "Cet email est déjà utilisé par un autre compte" },
        { status: 409 }
      );
    }
    
    // Hash du mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Déterminer si c'est le premier utilisateur (qui sera super admin)
    const userCount = await prisma.user.count();
    const isFirstUser = userCount === 0;
    
    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: isFirstUser ? "SUPER_ADMIN" : "USER",
      },
    });
    
    // Si c'est le premier utilisateur, on pourrait créer un groupe par défaut
    if (isFirstUser) {
      const defaultGroup = await prisma.group.create({
        data: {
          name: "Groupe principal",
          description: "Groupe par défaut créé à l'initialisation du système",
        },
      });
      
      // Ajouter l'utilisateur super admin au groupe par défaut en tant qu'admin
      await prisma.groupUser.create({
        data: {
          userId: user.id,
          groupId: defaultGroup.id,
          role: "ADMIN",
        },
      });
    }
    
    // On ne renvoie pas le mot de passe hashé dans la réponse
    const { password: _, ...userWithoutPassword } = user;
    
    return NextResponse.json(
      { 
        message: "Utilisateur créé avec succès", 
        user: userWithoutPassword,
        isFirstUser
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error during registration:", error);
    return NextResponse.json(
      { message: "Une erreur est survenue lors de l'inscription" },
      { status: 500 }
    );
  }
}
