import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Schéma pour l'ajout de membres
const addMembersSchema = z.object({
  users: z.array(
    z.object({
      id: z.string().uuid("L'ID de l'utilisateur doit être un UUID valide"),
      role: z.enum(["MEMBER", "ADMIN"]),
    })
  ),
});

// Vérifier si l'utilisateur est admin du groupe
async function checkGroupAdmin(groupId: string, userId: string) {
  // Super admin a toujours accès
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  
  if (user?.role === "SUPER_ADMIN") return true;
  
  // Vérifier si l'utilisateur est admin du groupe
  const groupUser = await prisma.groupUser.findFirst({
    where: {
      userId,
      groupId,
      role: "ADMIN",
    },
  });
  
  return !!groupUser;
}

// GET - Récupérer tous les membres d'un groupe
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }
    
    const groupId = params.id;
    
    // Vérifier si l'utilisateur a accès à ce groupe
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    
    // Vérifier si l'utilisateur est membre du groupe ou super admin
    const isSuperAdmin = user?.role === "SUPER_ADMIN";
    
    if (!isSuperAdmin) {
      const groupUser = await prisma.groupUser.findFirst({
        where: {
          userId: session.user.id,
          groupId,
        },
      });
      
      if (!groupUser) {
        return NextResponse.json(
          { message: "Vous n'avez pas accès à ce groupe" },
          { status: 403 }
        );
      }
    }
    
    // Récupérer tous les membres du groupe
    const members = await prisma.groupUser.findMany({
      where: { groupId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
          },
        },
      },
    });
    
    return NextResponse.json(members);
  } catch (error) {
    console.error("Error getting group members:", error);
    return NextResponse.json(
      { message: "Une erreur est survenue lors de la récupération des membres du groupe" },
      { status: 500 }
    );
  }
}

// POST - Ajouter des membres à un groupe
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }
    
    const groupId = params.id;
    
    // Vérifier si l'utilisateur est admin du groupe
    const isAdmin = await checkGroupAdmin(groupId, session.user.id);
    
    if (!isAdmin) {
      return NextResponse.json(
        { message: "Vous devez être administrateur du groupe pour ajouter des membres" },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    
    // Valider les données d'entrée
    const validationResult = addMembersSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { message: "Données d'entrée invalides", errors: validationResult.error.flatten() },
        { status: 400 }
      );
    }
    
    const { users } = validationResult.data;
    
    // Vérifier si le groupe existe
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });
    
    if (!group) {
      return NextResponse.json(
        { message: "Groupe introuvable" },
        { status: 404 }
      );
    }
    
    // Récupérer les membres existants pour ne pas les ajouter à nouveau
    const existingMembers = await prisma.groupUser.findMany({
      where: { groupId },
      select: { userId: true },
    });
    
    const existingUserIds = existingMembers.map((member) => member.userId);
    
    // Filtrer les utilisateurs qui ne sont pas déjà membres
    const newUsers = users.filter((user) => !existingUserIds.includes(user.id));
    
    if (newUsers.length === 0) {
      return NextResponse.json(
        { message: "Tous les utilisateurs sélectionnés sont déjà membres du groupe" },
        { status: 400 }
      );
    }
    
    // Ajouter les nouveaux membres
    const createdMembers = await Promise.all(
      newUsers.map(async (user) => {
        return prisma.groupUser.create({
          data: {
            userId: user.id,
            groupId,
            role: user.role,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });
      })
    );
    
    return NextResponse.json(
      {
        message: `${createdMembers.length} membre(s) ajouté(s) au groupe`,
        members: createdMembers,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error adding group members:", error);
    return NextResponse.json(
      { message: "Une erreur est survenue lors de l'ajout des membres au groupe" },
      { status: 500 }
    );
  }
}
