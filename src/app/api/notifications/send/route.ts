import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import nodemailer from "nodemailer";
import fetch from "node-fetch";

// Schéma pour l'envoi de notification
const sendNotificationSchema = z.object({
  notificationConfigId: z.string().uuid("L'ID de configuration doit être un UUID valide"),
  serverId: z.string().uuid("L'ID du serveur doit être un UUID valide"),
  probeId: z.string().uuid("L'ID de la sonde doit être un UUID valide").optional(),
  level: z.enum(["INFO", "WARNING", "ERROR"]),
  title: z.string().min(1, "Le titre est requis"),
  message: z.string().min(1, "Le message est requis"),
  details: z.record(z.any()).optional(),
});

// Fonction pour envoyer un email
async function sendEmail(recipients: string[], title: string, message: string, details: any) {
  // Récupération des variables d'environnement
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || "noreply@servmon.app";
  
  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    throw new Error("Configuration SMTP incomplète");
  }
  
  // Création du transporteur
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(smtpPort),
    secure: parseInt(smtpPort) === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
  
  // Contenu HTML de l'email
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: ${details.level === 'ERROR' ? '#f56565' : details.level === 'WARNING' ? '#ed8936' : '#4299e1'}; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">${title}</h1>
      </div>
      <div style="padding: 20px; border: 1px solid #e2e8f0; border-top: none;">
        <p>${message}</p>
        ${details.serverName ? `<p><strong>Serveur :</strong> ${details.serverName}</p>` : ''}
        ${details.probeName ? `<p><strong>Sonde :</strong> ${details.probeName}</p>` : ''}
        ${details.timestamp ? `<p><strong>Date :</strong> ${new Date(details.timestamp).toLocaleString('fr-FR')}</p>` : ''}
        <p style="margin-top: 20px; font-size: 12px; color: #718096;">
          Cette notification a été envoyée automatiquement par le système de monitoring de serveurs.
        </p>
      </div>
    </div>
  `;
  
  // Envoi de l'email
  const info = await transporter.sendMail({
    from: `"Monitoring de Serveurs" <${smtpFrom}>`,
    to: recipients.join(", "),
    subject: `[${details.level}] ${title}`,
    html: htmlContent,
    text: `${title}\n\n${message}\n\nServeur: ${details.serverName || 'N/A'}\nSonde: ${details.probeName || 'N/A'}\nDate: ${new Date(details.timestamp).toLocaleString('fr-FR')}\n\nCette notification a été envoyée automatiquement par le système de monitoring de serveurs.`,
  });
  
  return info;
}

// Fonction pour envoyer un webhook
async function sendWebhook(url: string, headers: any, payloadTemplate: any, notificationData: any) {
  // Fusion du template avec les données de notification
  const payload = {
    ...payloadTemplate,
    ...notificationData,
  };
  
  // Envoi de la requête HTTP
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    throw new Error(`Erreur lors de l'envoi du webhook: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}

// POST - Envoyer une notification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Valider les données d'entrée
    const validationResult = sendNotificationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { message: "Données d'entrée invalides", errors: validationResult.error.flatten() },
        { status: 400 }
      );
    }
    
    const { notificationConfigId, serverId, probeId, level, title, message, details } = validationResult.data;
    
    // Récupérer la configuration de notification
    const notificationConfig = await prisma.notificationConfig.findUnique({
      where: { id: notificationConfigId },
      include: {
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
    
    // Récupérer les informations du serveur
    const server = await prisma.server.findUnique({
      where: { id: serverId },
    });
    
    if (!server) {
      return NextResponse.json(
        { message: "Serveur introuvable" },
        { status: 404 }
      );
    }
    
    // Récupérer les informations de la sonde (si fournie)
    let probe = null;
    if (probeId) {
      probe = await prisma.probe.findUnique({
        where: { id: probeId },
      });
    }
    
    // Préparer les données pour l'historique et l'envoi
    const notificationData = {
      level,
      title,
      message,
      serverName: server.name,
      serverId: server.id,
      probeName: probe?.name,
      probeId: probe?.id,
      timestamp: new Date(),
      details: details || {},
    };
    
    // Enregistrer la notification dans l'historique
    const notification = await prisma.notification.create({
      data: {
        serverId,
        probeId,
        title,
        message,
        level,
        details: notificationData,
        notificationConfigId,
      },
    });
    
    // Envoyer la notification selon le type de canal
    let sendResult;
    
    try {
      if (notificationConfig.type === "EMAIL" && notificationConfig.emailConfig) {
        sendResult = await sendEmail(
          notificationConfig.emailConfig.recipients,
          title,
          message,
          notificationData
        );
      } else if (notificationConfig.type === "WEBHOOK" && notificationConfig.webhookConfig) {
        sendResult = await sendWebhook(
          notificationConfig.webhookConfig.url,
          notificationConfig.webhookConfig.headers || {},
          notificationConfig.webhookConfig.payload || {},
          notificationData
        );
      } else {
        throw new Error("Type de notification non pris en charge ou configuration incomplète");
      }
      
      // Mettre à jour la notification avec le statut d'envoi
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          sentAt: new Date(),
          status: "SENT",
        },
      });
      
    } catch (error) {
      console.error("Error sending notification:", error);
      
      // Mettre à jour la notification avec le statut d'erreur
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: "FAILED",
          statusDetails: error instanceof Error ? error.message : String(error),
        },
      });
      
      return NextResponse.json(
        { message: "La notification a été enregistrée mais n'a pas pu être envoyée", error: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      message: "Notification envoyée avec succès",
      notification,
      sendResult,
    });
    
  } catch (error) {
    console.error("Error processing notification:", error);
    return NextResponse.json(
      { message: "Une erreur est survenue lors du traitement de la notification", error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
