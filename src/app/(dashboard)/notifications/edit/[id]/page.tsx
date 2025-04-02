import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NotificationForm from "@/components/notifications/NotificationForm";

// Fonction pour vérifier l'accès de l'utilisateur à cette notification
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
      role: "ADMIN", // L'utilisateur doit être admin pour éditer
    },
  });
  
  return groupUser !== null;
}

// Fonction pour récupérer tous les groupes accessibles à l'utilisateur
async function getAccessibleGroups(userId: string, isSuperAdmin: boolean) {
  if (isSuperAdmin) {
    // Super admin voit tous les groupes
    return await prisma.group.findMany({
      orderBy: {
        name: "asc",
      },
    });
  } else {
    // Utilisateur normal voit seulement ses groupes
    const userGroups = await prisma.groupUser.findMany({
      where: {
        userId,
      },
      select: {
        group: true,
      },
    });
    
    return userGroups.map((ug) => ug.group);
  }
}

export default async function EditNotificationPage({
  params
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user || !session.user.id) {
    redirect("/login");
  }
  
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const notificationId = params.id;
  
  // Vérifier l'accès
  const hasAccess = await checkNotificationAccess(
    notificationId,
    session.user.id,
    isSuperAdmin
  );
  
  if (!hasAccess) {
    notFound();
  }
  
  // Récupérer la notification
  const notificationConfig = await prisma.notificationConfig.findUnique({
    where: { id: notificationId },
    include: {
      group: true,
      emailConfig: true,
      webhookConfig: true,
    },
  });
  
  if (!notificationConfig) {
    notFound();
  }
  
  // Récupérer tous les groupes accessibles
  const groups = await getAccessibleGroups(session.user.id, isSuperAdmin);
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Modifier la Configuration de Notification
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Modifiez les paramètres de notification pour {notificationConfig.name}
        </p>
      </div>
      
      <div className="card">
        <NotificationForm 
          groups={groups} 
          initialData={{
            id: notificationConfig.id,
            name: notificationConfig.name,
            type: notificationConfig.type,
            groupId: notificationConfig.groupId,
            emailConfig: notificationConfig.emailConfig 
              ? {
                  recipients: notificationConfig.emailConfig.recipients,
                }
              : null,
            webhookConfig: notificationConfig.webhookConfig
              ? {
                  url: notificationConfig.webhookConfig.url,
                  headers: notificationConfig.webhookConfig.headers,
                  payload: notificationConfig.webhookConfig.payload,
                }
              : null,
          }}
        />
      </div>
    </div>
  );
}
