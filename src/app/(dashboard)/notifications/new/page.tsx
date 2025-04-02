import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NotificationForm from "@/components/notifications/NotificationForm";

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

export default async function NewNotificationPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect("/login");
  }
  
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const groups = await getAccessibleGroups(session.user.id, isSuperAdmin);
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Nouvelle Configuration de Notification
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Créez une nouvelle configuration pour notifier votre équipe des problèmes de serveurs.
        </p>
      </div>
      
      <div className="card">
        <NotificationForm groups={groups} />
      </div>
    </div>
  );
}
