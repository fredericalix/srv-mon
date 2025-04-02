import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Schéma pour la mise à jour d'un groupe
const updateGroupSchema = z.object({
  name: z.string().min(1, "Le nom est requis").optional(),
  description: z.string().optional(),
});

// Vérifier si l'utilisateur a accès au groupe
async function checkGroupAccess(groupId: string, userId: string, requireAdmin: boolean = false) {
  // Super admin a toujours accès
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  
  if (user?.role === "SUPER_ADMIN") return true;
  
  // Vérifier l'appartenance au groupe
  const groupUser = await prisma.groupUser.findFirst({
    where: {
      userId,
      groupId,
      ...(requireAdmin ? { role: "ADMIN" } : {}),
    },
  });
  
  return !!groupUser;
}

// GET - Récupérer les détails d'un groupe
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
    const hasAccess = await checkGroupAccess(groupId, session.user.id);
    
    if (!hasAccess) {
      return NextResponse.json(
        { message: "Vous n'avez pas accès à ce groupe" },
        { status: 403 }
      );
    }
    
    // Récupérer le groupe avec les membres et les serveurs
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        groupUsers: {
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
        },
        servers: true,
        notificationConfigs: true,
      },
    });
    
    if (!group) {
      return NextResponse.json(
        { message: "Groupe introuvable" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(group);
  } catch (error) {
    console.error("Error getting group:", error);
    return NextResponse.json(
      { message: "Une erreur est survenue lors de la récupération du groupe" },
      { status: 500 }
    );
  }
}

// PUT - Mettre à jour un groupe
export async function PUT(
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
    const isAdmin = await checkGroupAccess(groupId, session.user.id, true);
    
    if (!isAdmin) {
      return NextResponse.json(
        { message: "Vous devez être administrateur du groupe pour le modifier" },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    
    // Valider les données d'entrée
    const validationResult = updateGroupSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { message: "Données d'entrée invalides", errors: validationResult.error.flatten() },
        { status: 400 }
      );
    }
    
    const { name, description } = validationResult.data;
    
    // Préparer les données à mettre à jour
    const updateData: any = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    
    // Mettre à jour le groupe
    const updatedGroup = await prisma.group.update({
      where: { id: groupId },
      data: updateData,
    });
    
    return NextResponse.json(updatedGroup);
  } catch (error) {
    console.error("Error updating group:", error);
    return NextResponse.json(
      { message: "Une erreur est survenue lors de la mise à jour du groupe" },
      { status: 500 }
    );
  }
}

// DELETE - Supprimer un groupe
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }
    
    const groupId = params.id;
    
    // Seul un super admin peut supprimer un groupe
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { message: "Seul un super administrateur peut supprimer un groupe" },
        { status: 403 }
      );
    }
    
    // Vérifier si le groupe existe
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        servers: {
          select: { id: true },
        },
      },
    });
    
    if (!group) {
      return NextResponse.json(
        { message: "Groupe introuvable" },
        { status: 404 }
      );
    }
    
    // Empêcher la suppression si le groupe a des serveurs
    if (group.servers.length > 0) {
      return NextResponse.json(
        { message: "Impossible de supprimer un groupe qui contient des serveurs. Veuillez d'abord retirer tous les serveurs du groupe." },
        { status: 400 }
      );
    }
    
    // Supprimer le groupe (les relations seront automatiquement supprimées grâce aux contraintes onDelete)
    await prisma.group.delete({
      where: { id: groupId },
    });
    
    return NextResponse.json({ message: "Groupe supprimé avec succès" });
  } catch (error) {
    console.error("Error deleting group:", error);
    return NextResponse.json(
      { message: "Une erreur est survenue lors de la suppression du groupe" },
      { status: 500 }
    );
  }
}
