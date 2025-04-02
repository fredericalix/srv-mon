import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Schéma pour la mise à jour du rôle d'un membre
const updateMemberSchema = z.object({
  role: z.enum(["MEMBER", "ADMIN"]),
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

// GET - Récupérer les informations d'un membre spécifique
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }
    
    const { id: groupId, userId: memberId } = params;
    
    // Vérifier si l'utilisateur a accès à ce groupe
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    
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
    
    // Récupérer les informations du membre
    const member = await prisma.groupUser.findFirst({
      where: {
        groupId,
        userId: memberId,
      },
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
    
    if (!member) {
      return NextResponse.json(
        { message: "Membre introuvable dans ce groupe" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(member);
  } catch (error) {
    console.error("Error getting group member:", error);
    return NextResponse.json(
      { message: "Une erreur est survenue lors de la récupération du membre" },
      { status: 500 }
    );
  }
}

// PUT - Mettre à jour le rôle d'un membre
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }
    
    const { id: groupId, userId: memberId } = params;
    
    // Vérifier si l'utilisateur est admin du groupe
    const isAdmin = await checkGroupAdmin(groupId, session.user.id);
    
    if (!isAdmin) {
      return NextResponse.json(
        { message: "Vous devez être administrateur du groupe pour modifier les rôles" },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    
    // Valider les données d'entrée
    const validationResult = updateMemberSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { message: "Données d'entrée invalides", errors: validationResult.error.flatten() },
        { status: 400 }
      );
    }
    
    const { role } = validationResult.data;
    
    // Vérifier si le membre existe dans ce groupe
    const member = await prisma.groupUser.findFirst({
      where: {
        groupId,
        userId: memberId,
      },
      include: {
        user: {
          select: {
            role: true,
          },
        },
      },
    });
    
    if (!member) {
      return NextResponse.json(
        { message: "Membre introuvable dans ce groupe" },
        { status: 404 }
      );
    }
    
    // Ne pas autoriser la modification des Super Admins sauf par un autre Super Admin
    if (member.user.role === "SUPER_ADMIN") {
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });
      
      if (currentUser?.role !== "SUPER_ADMIN") {
        return NextResponse.json(
          { message: "Vous ne pouvez pas modifier le rôle d'un Super Admin" },
          { status: 403 }
        );
      }
    }
    
    // Empêcher de rétrograder le dernier admin du groupe
    if (member.role === "ADMIN" && role === "MEMBER") {
      const admins = await prisma.groupUser.findMany({
        where: {
          groupId,
          role: "ADMIN",
        },
      });
      
      if (admins.length === 1) {
        return NextResponse.json(
          { message: "Impossible de rétrograder le dernier administrateur du groupe" },
          { status: 400 }
        );
      }
    }
    
    // Mettre à jour le rôle du membre
    const updatedMember = await prisma.groupUser.update({
      where: {
        id: member.id,
      },
      data: {
        role,
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
    
    return NextResponse.json(updatedMember);
  } catch (error) {
    console.error("Error updating group member:", error);
    return NextResponse.json(
      { message: "Une erreur est survenue lors de la mise à jour du membre" },
      { status: 500 }
    );
  }
}

// DELETE - Retirer un membre du groupe
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }
    
    const { id: groupId, userId: memberId } = params;
    
    // Vérifier si l'utilisateur est admin du groupe
    const isAdmin = await checkGroupAdmin(groupId, session.user.id);
    
    if (!isAdmin) {
      return NextResponse.json(
        { message: "Vous devez être administrateur du groupe pour retirer des membres" },
        { status: 403 }
      );
    }
    
    // Vérifier si le membre existe dans ce groupe
    const member = await prisma.groupUser.findFirst({
      where: {
        groupId,
        userId: memberId,
      },
      include: {
        user: {
          select: {
            role: true,
          },
        },
      },
    });
    
    if (!member) {
      return NextResponse.json(
        { message: "Membre introuvable dans ce groupe" },
        { status: 404 }
      );
    }
    
    // Ne pas autoriser la suppression des Super Admins sauf par un autre Super Admin
    if (member.user.role === "SUPER_ADMIN") {
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });
      
      if (currentUser?.role !== "SUPER_ADMIN") {
        return NextResponse.json(
          { message: "Vous ne pouvez pas retirer un Super Admin du groupe" },
          { status: 403 }
        );
      }
    }
    
    // Empêcher de retirer le dernier admin du groupe
    if (member.role === "ADMIN") {
      const admins = await prisma.groupUser.findMany({
        where: {
          groupId,
          role: "ADMIN",
        },
      });
      
      if (admins.length === 1) {
        return NextResponse.json(
          { message: "Impossible de retirer le dernier administrateur du groupe" },
          { status: 400 }
        );
      }
    }
    
    // Retirer le membre du groupe
    await prisma.groupUser.delete({
      where: {
        id: member.id,
      },
    });
    
    return NextResponse.json({ message: "Membre retiré du groupe avec succès" });
  } catch (error) {
    console.error("Error removing group member:", error);
    return NextResponse.json(
      { message: "Une erreur est survenue lors du retrait du membre" },
      { status: 500 }
    );
  }
}
