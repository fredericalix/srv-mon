import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

// Schéma commun pour toutes les sondes
const baseProbeSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  type: z.enum(["HTTP", "WEBHOOK"]),
  groups: z.array(z.string()).optional(),
});

// Schéma spécifique pour les sondes HTTP
const httpProbeConfigSchema = z.object({
  url: z.string().url("L'URL doit être valide"),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET"),
  headers: z.record(z.string()).optional(),
  body: z.string().optional(),
  expectedStatus: z.number().int().positive().optional(),
  expectedKeyword: z.string().optional(),
  timeout: z.number().int().positive().default(30000), // ms
  checkInterval: z.number().int().positive().default(300), // seconds
});

// Schéma spécifique pour les sondes Webhook
const webhookProbeConfigSchema = z.object({
  expectedPayload: z.any().optional(),
});

// Schéma combiné pour validation selon le type
const probeSchema = z.discriminatedUnion("type", [
  baseProbeSchema.extend({
    type: z.literal("HTTP"),
    config: httpProbeConfigSchema,
  }),
  baseProbeSchema.extend({
    type: z.literal("WEBHOOK"),
    config: webhookProbeConfigSchema,
  }),
]);

// Vérifier l'accès de l'utilisateur au serveur
async function checkServerAccess(userId: string, serverId: string, superAdmin: boolean) {
  if (superAdmin) return true;
  
  const server = await prisma.server.findUnique({
    where: { id: serverId },
    include: {
      groups: {
        select: { id: true },
      },
    },
  });
  
  if (!server) return false;
  
  const serverGroupIds = server.groups.map((g) => g.id);
  
  const userGroupsCount = await prisma.groupUser.count({
    where: {
      userId,
      groupId: {
        in: serverGroupIds,
      },
    },
  });
  
  return userGroupsCount > 0;
}

// GET - Récupérer toutes les sondes d'un serveur
export async function GET(
  request: NextRequest,
  { params }: { params: { serverId: string } }
) {
  try {
    const serverId = params.serverId;
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }
    
    // Vérifier que l'utilisateur a accès au serveur
    const hasAccess = await checkServerAccess(
      session.user.id,
      serverId,
      session.user.role === "SUPER_ADMIN"
    );
    
    if (!hasAccess) {
      return NextResponse.json(
        { message: "Vous n'avez pas accès à ce serveur" },
        { status: 403 }
      );
    }
    
    // Récupérer les sondes du serveur
    const probes = await prisma.probe.findMany({
      where: {
        serverId,
      },
      include: {
        httpConfig: true,
        webhookConfig: true,
        groups: {
          select: { id: true, name: true },
        },
      },
      orderBy: {
        name: "asc",
      },
    });
    
    return NextResponse.json({ probes });
  } catch (error) {
    console.error("Error fetching probes:", error);
    return NextResponse.json(
      { message: "Une erreur est survenue lors de la récupération des sondes" },
      { status: 500 }
    );
  }
}

// POST - Créer une nouvelle sonde pour un serveur
export async function POST(
  request: NextRequest,
  { params }: { params: { serverId: string } }
) {
  try {
    const serverId = params.serverId;
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }
    
    // Vérifier que l'utilisateur a accès au serveur
    const hasAccess = await checkServerAccess(
      session.user.id,
      serverId,
      session.user.role === "SUPER_ADMIN"
    );
    
    if (!hasAccess) {
      return NextResponse.json(
        { message: "Vous n'avez pas accès à ce serveur" },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    
    // Valider les données d'entrée
    const validationResult = probeSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { message: "Données d'entrée invalides", errors: validationResult.error.flatten() },
        { status: 400 }
      );
    }
    
    const { name, type, groups, config } = validationResult.data;
    
    // Si des groupes sont spécifiés, vérifier que l'utilisateur y a accès
    let probeGroups: string[] = [];
    
    if (groups && groups.length > 0) {
      // Pour super admin, accepter tous les groupes
      if (session.user.role === "SUPER_ADMIN") {
        probeGroups = groups;
      } else {
        // Sinon vérifier les droits
        const userGroups = await prisma.groupUser.findMany({
          where: {
            userId: session.user.id,
            groupId: {
              in: groups,
            },
          },
        });
        
        probeGroups = userGroups.map((ug) => ug.groupId);
        
        if (probeGroups.length !== groups.length) {
          return NextResponse.json(
            { message: "Vous n'avez pas accès à certains des groupes sélectionnés" },
            { status: 403 }
          );
        }
      }
    } else {
      // Si aucun groupe spécifié, utiliser les groupes du serveur
      const server = await prisma.server.findUnique({
        where: { id: serverId },
        include: {
          groups: {
            select: { id: true },
          },
        },
      });
      
      if (server) {
        probeGroups = server.groups.map((g) => g.id);
      }
    }
    
    // Créer la sonde de base
    const probe = await prisma.probe.create({
      data: {
        name,
        type,
        serverId,
        groups: {
          connect: probeGroups.map((groupId) => ({ id: groupId })),
        },
      },
    });
    
    // Créer la configuration spécifique au type de sonde
    if (type === "HTTP") {
      await prisma.httpProbe.create({
        data: {
          probeId: probe.id,
          url: config.url,
          method: config.method,
          headers: config.headers || {},
          body: config.body,
          expectedStatus: config.expectedStatus,
          expectedKeyword: config.expectedKeyword,
          timeout: config.timeout,
          checkInterval: config.checkInterval,
        },
      });
    } else if (type === "WEBHOOK") {
      // Générer un token unique pour cette sonde webhook
      const webhookToken = uuidv4();
      
      await prisma.webhookProbe.create({
        data: {
          probeId: probe.id,
          webhookToken,
          expectedPayload: config.expectedPayload || null,
        },
      });
    }
    
    // Récupérer la sonde complète avec sa configuration
    const completeProbe = await prisma.probe.findUnique({
      where: { id: probe.id },
      include: {
        httpConfig: true,
        webhookConfig: true,
        groups: {
          select: { id: true, name: true },
        },
      },
    });
    
    return NextResponse.json(completeProbe, { status: 201 });
  } catch (error) {
    console.error("Error creating probe:", error);
    return NextResponse.json(
      { message: "Une erreur est survenue lors de la création de la sonde" },
      { status: 500 }
    );
  }
}
