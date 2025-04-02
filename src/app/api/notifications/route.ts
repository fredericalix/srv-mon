import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Schéma de base pour les notifications
const baseNotificationSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  groupId: z.string().uuid("L'ID de groupe doit être un UUID valide"),
  type: z.enum(["EMAIL", "WEBHOOK"]),
});

// Schéma pour les notifications email
const emailNotificationSchema = baseNotificationSchema.extend({
  type: z.literal("EMAIL"),
  config: z.object({
    recipients: z.array(z.string().email("Email invalide")).min(1, "Au moins un destinataire est requis"),
  }),
});

// Schéma pour les notifications webhook
const webhookNotificationSchema = baseNotificationSchema.extend({
  type: z.literal("WEBHOOK"),
  config: z.object({
    url: z.string().url("L'URL du webhook doit être valide"),
    headers: z.record(z.string()).optional(),
    payload: z.any().optional(),
  }),
});

// Schéma combiné pour validation selon le type
const notificationSchema = z.discriminatedUnion("type", [
  emailNotificationSchema,
  webhookNotificationSchema,
]);

// Fonction pour vérifier l'accès de l'utilisateur au groupe
async function checkGroupAccess(userId: string, groupId: string, isSuperAdmin: boolean) {
  if (isSuperAdmin) return true;
  
  const groupUser = await prisma.groupUser.findFirst({
    where: {
      userId,
      groupId,
    },
  });
  
  return groupUser !== null;
}

// GET - Récupérer toutes les configurations de notification accessibles à l'utilisateur
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }
    
    const isSuperAdmin = session.user.role === "SUPER_ADMIN";
    let notificationConfigs;
    
    if (isSuperAdmin) {
      // Super admin voit toutes les notifications
      notificationConfigs = await prisma.notificationConfig.findMany({
        include: {
          group: true,
          emailConfig: true,
          webhookConfig: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    } else {
      // Utilisateur normal voit seulement les notifications de ses groupes
      const userGroups = await prisma.groupUser.findMany({
        where: {
          userId: session.user.id,
        },
        select: {
          groupId: true,
        },
      });
      
      const groupIds = userGroups.map((ug) => ug.groupId);
      
      notificationConfigs = await prisma.notificationConfig.findMany({
        where: {
          groupId: {
            in: groupIds,
          },
        },
        include: {
          group: true,
          emailConfig: true,
          webhookConfig: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    }
    
    return NextResponse.json({ notificationConfigs });
  } catch (error) {
    console.error("Error fetching notification configs:", error);
    return NextResponse.json(
      { message: "Une erreur est survenue lors de la récupération des configurations de notification" },
      { status: 500 }
    );
  }
}

// POST - Créer une nouvelle configuration de notification
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
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
    
    // Vérifier que l'utilisateur a accès au groupe
    const hasAccess = await checkGroupAccess(
      session.user.id,
      groupId,
      session.user.role === "SUPER_ADMIN"
    );
    
    if (!hasAccess) {
      return NextResponse.json(
        { message: "Vous n'avez pas accès à ce groupe" },
        { status: 403 }
      );
    }
    
    // Création de la notification de base
    const notificationConfig = await prisma.notificationConfig.create({
      data: {
        name,
        groupId,
        type,
      },
    });
    
    // Création de la configuration spécifique au type
    if (type === "EMAIL") {
      await prisma.emailNotification.create({
        data: {
          notificationConfigId: notificationConfig.id,
          recipients: config.recipients,
        },
      });
    } else if (type === "WEBHOOK") {
      await prisma.webhookNotification.create({
        data: {
          notificationConfigId: notificationConfig.id,
          url: config.url,
          headers: config.headers || {},
          payload: config.payload || {},
        },
      });
    }
    
    // Récupérer la configuration complète avec les détails spécifiques
    const completeConfig = await prisma.notificationConfig.findUnique({
      where: { id: notificationConfig.id },
      include: {
        group: true,
        emailConfig: true,
        webhookConfig: true,
      },
    });
    
    return NextResponse.json(completeConfig, { status: 201 });
  } catch (error) {
    console.error("Error creating notification config:", error);
    return NextResponse.json(
      { message: "Une erreur est survenue lors de la création de la configuration de notification" },
      { status: 500 }
    );
  }
}
