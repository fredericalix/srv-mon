import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Schémas pour update - identiques à ceux de la création
const baseNotificationSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  groupId: z.string().uuid("L'ID de groupe doit être un UUID valide"),
  type: z.enum(["EMAIL", "WEBHOOK"]),
});

const emailNotificationSchema = baseNotificationSchema.extend({
  type: z.literal("EMAIL"),
  config: z.object({
    recipients: z.array(z.string().email("Email invalide")).min(1, "Au moins un destinataire est requis"),
  }),
});

const webhookNotificationSchema = baseNotificationSchema.extend({
  type: z.literal("WEBHOOK"),
  config: z.object({
    url: z.string().url("L'URL du webhook doit être valide"),
    headers: z.record(z.string()).optional(),
    payload: z.any().optional(),
  }),
});

const notificationSchema = z.discriminatedUnion("type", [
  emailNotificationSchema,
  webhookNotificationSchema,
]);

// Vérifier si l'utilisateur a accès à cette notification
async function checkNotificationAccess(notificationId: string, userId: string, isSuperAdmin: boolean) {
  if (isSuperAdmin) return true;
  
  // Trouver la notification et son groupe
  const notificationConfig = await prisma.notificationConfig.findUnique({
    where: { id: notificationId },
    select: { groupId: true },
  });
  
  if (!notificationConfig) return false;
  
  // Vérifier si l'utilisateur appartient à ce groupe
  const groupUser = await prisma.groupUser.findFirst({
    where: {
      userId,
      groupId: notificationConfig.groupId,
    },
  });
  
  return groupUser !== null;
}

// Vérifier si l'utilisateur est admin du groupe de cette notification
async function checkGroupAdminAccess(notificationId: string, userId: string, isSuperAdmin: boolean) {
  if (isSuperAdmin) return true;
  
  // Trouver la notification et son groupe
  const notificationConfig = await prisma.notificationConfig.findUnique({
    where: { id: notificationId },
    select: { groupId: true },
  });
  
  if (!notificationConfig) return false;
  
  // Vérifier si l'utilisateur est admin de ce groupe
  const groupUser = await prisma.groupUser.findFirst({
    where: {
      userId,
      groupId: notificationConfig.groupId,
      role: "ADMIN",
    },
  });
  
  return groupUser !== null;
}

// GET - Récupérer une configuration spécifique
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const notificationId = params.id;
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }
    
    // Vérifier l'accès
    const hasAccess = await checkNotificationAccess(
      notificationId,
      session.user.id,
      session.user.role === "SUPER_ADMIN"
    );
    
    if (!hasAccess) {
      return NextResponse.json(
        { message: "Vous n'avez pas accès à cette configuration de notification" },
        { status: 403 }
      );
    }
    
    // Récupérer la notification avec toutes ses configurations
    const notificationConfig = await prisma.notificationConfig.findUnique({
      where: { id: notificationId },
      include: {
        group: true,
        emailConfig: true,
        webhookConfig: true,
      },
    });
    
    if (!notificationConfig) {
      return NextResponse.json(
        { message: "Configuration de notification introuvable" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(notificationConfig);
  } catch (error) {
    console.error("Error fetching notification config:", error);
    return NextResponse.json(
      { message: "Une erreur est survenue lors de la récupération de la configuration de notification" },
      { status: 500 }
    );
  }
}

// PUT - Mettre à jour une configuration de notification
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const notificationId = params.id;
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }
    
    // Vérifier si l'utilisateur est admin du groupe
    const isGroupAdmin = await checkGroupAdminAccess(
      notificationId,
      session.user.id,
      session.user.role === "SUPER_ADMIN"
    );
    
    if (!isGroupAdmin) {
      return NextResponse.json(
        { message: "Vous n'êtes pas autorisé à modifier cette configuration de notification" },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    
    // Valider les données d'entrée
    const validationResult = notificationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { message: "Données d'entrée invalides", errors: validationResult.error.flatten() },
        { status: 400 }
      );
    }
    
    const { name, groupId, type, config } = validationResult.data;
    
    // Récupérer la notification existante
    const existingConfig = await prisma.notificationConfig.findUnique({
      where: { id: notificationId },
      include: {
        emailConfig: true,
        webhookConfig: true,
      },
    });
    
    if (!existingConfig) {
      return NextResponse.json(
        { message: "Configuration de notification introuvable" },
        { status: 404 }
      );
    }
    
    // Mettre à jour la configuration de base
    await prisma.notificationConfig.update({
      where: { id: notificationId },
      data: {
        name,
        groupId,
        type,
      },
    });
    
    // Mise à jour de la configuration spécifique selon le type
    if (type === "EMAIL") {
      // Supprimer une config webhook existante si on change de type
      if (existingConfig.type === "WEBHOOK" && existingConfig.webhookConfig) {
        await prisma.webhookNotification.delete({
          where: { notificationConfigId: notificationId },
        });
      }
      
      // Créer ou mettre à jour la config email
      if (existingConfig.emailConfig) {
        await prisma.emailNotification.update({
          where: { notificationConfigId: notificationId },
          data: {
            recipients: config.recipients,
          },
        });
      } else {
        await prisma.emailNotification.create({
          data: {
            notificationConfigId: notificationId,
            recipients: config.recipients,
          },
        });
      }
    } else if (type === "WEBHOOK") {
      // Supprimer une config email existante si on change de type
      if (existingConfig.type === "EMAIL" && existingConfig.emailConfig) {
        await prisma.emailNotification.delete({
          where: { notificationConfigId: notificationId },
        });
      }
      
      // Créer ou mettre à jour la config webhook
      if (existingConfig.webhookConfig) {
        await prisma.webhookNotification.update({
          where: { notificationConfigId: notificationId },
          data: {
            url: config.url,
            headers: config.headers || {},
            payload: config.payload || {},
          },
        });
      } else {
        await prisma.webhookNotification.create({
          data: {
            notificationConfigId: notificationId,
            url: config.url,
            headers: config.headers || {},
            payload: config.payload || {},
          },
        });
      }
    }
    
    // Récupérer la configuration mise à jour
    const updatedConfig = await prisma.notificationConfig.findUnique({
      where: { id: notificationId },
      include: {
        group: true,
        emailConfig: true,
        webhookConfig: true,
      },
    });
    
    return NextResponse.json(updatedConfig);
  } catch (error) {
    console.error("Error updating notification config:", error);
    return NextResponse.json(
      { message: "Une erreur est survenue lors de la mise à jour de la configuration de notification" },
      { status: 500 }
    );
  }
}

// DELETE - Supprimer une configuration de notification
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const notificationId = params.id;
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }
    
    // Vérifier si l'utilisateur est admin du groupe
    const isGroupAdmin = await checkGroupAdminAccess(
      notificationId,
      session.user.id,
      session.user.role === "SUPER_ADMIN"
    );
    
    if (!isGroupAdmin) {
      return NextResponse.json(
        { message: "Vous n'êtes pas autorisé à supprimer cette configuration de notification" },
        { status: 403 }
      );
    }
    
    // Supprimer la configuration de notification
    // Grâce aux relations onDelete: Cascade définies dans le schéma Prisma,
    // les configurations associées (email, webhook) seront également supprimées
    await prisma.notificationConfig.delete({
      where: { id: notificationId },
    });
    
    return NextResponse.json({ message: "Configuration de notification supprimée avec succès" });
  } catch (error) {
    console.error("Error deleting notification config:", error);
    return NextResponse.json(
      { message: "Une erreur est survenue lors de la suppression de la configuration de notification" },
      { status: 500 }
    );
  }
}
