import { getServerSession } from "next-auth/next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FiPlus, FiMail, FiGlobe, FiEdit, FiTrash2, FiClock } from "react-icons/fi";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import DeleteNotificationButton from "@/components/notifications/DeleteNotificationButton";

// Fonction pour obtenir l'icône correspondant au type de notification
const getNotificationIcon = (type: string) => {
  switch (type) {
    case "EMAIL":
      return <FiMail className="h-5 w-5 text-blue-500" aria-hidden="true" />;
    case "WEBHOOK":
      return <FiGlobe className="h-5 w-5 text-purple-500" aria-hidden="true" />;
    default:
      return null;
  }
};

// Fonction pour récupérer les configurations de notification
async function getNotificationConfigs(userId: string, isSuperAdmin: boolean) {
  if (isSuperAdmin) {
    // Super admin voit toutes les notifications
    return await prisma.notificationConfig.findMany({
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
        userId,
      },
      select: {
        groupId: true,
      },
    });
    
    const groupIds = userGroups.map((ug) => ug.groupId);
    
    return await prisma.notificationConfig.findMany({
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
}

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return notFound();
  }
  
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const notificationConfigs = await getNotificationConfigs(session.user.id, isSuperAdmin);
  
  // Vérifier si l'utilisateur est admin dans chaque groupe
  const userGroupRoles = await prisma.groupUser.findMany({
    where: {
      userId: session.user.id,
      groupId: {
        in: notificationConfigs.map(config => config.groupId),
      },
    },
    select: {
      groupId: true,
      role: true,
    },
  });
  
  const groupAdminMap = userGroupRoles.reduce((acc, { groupId, role }) => {
    acc[groupId] = role === "ADMIN";
    return acc;
  }, {} as Record<string, boolean>);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Configurations de Notification
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Gérez comment vos équipes sont notifiées des problèmes de serveurs.
          </p>
        </div>
        
        <div className="flex space-x-3">
          <Link
            href="/notifications/history"
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <FiClock className="-ml-1 mr-2 h-5 w-5" />
            Historique
          </Link>
          
          <Link
            href="/notifications/new"
            className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            <FiPlus className="-ml-1 mr-2 h-5 w-5" />
            Nouvelle configuration
          </Link>
        </div>
      </div>

      {notificationConfigs.length === 0 ? (
        <div className="mt-4 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center dark:border-gray-700">
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
            Aucune configuration de notification
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Commencez par créer une configuration pour envoyer des notifications à vos équipes.
          </p>
          <div className="mt-6">
            <Link
              href="/notifications/new"
              className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700"
            >
              <FiPlus className="-ml-1 mr-2 h-5 w-5" />
              Nouvelle configuration
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">
                  Nom & Type
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Groupe
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Configuration
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Créée le
                </th>
                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {notificationConfigs.map((config) => {
                // Déterminer si l'utilisateur peut modifier cette config
                const canEdit = isSuperAdmin || groupAdminMap[config.groupId] || false;
                
                return (
                  <tr key={config.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                      <div className="flex items-center">
                        <div className="mr-2">
                          {getNotificationIcon(config.type)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{config.name}</div>
                          <div className="text-gray-500 dark:text-gray-400">{config.type}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                        {config.group.name}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {config.type === "EMAIL" && config.emailConfig ? (
                        <div>
                          <div className="font-medium">
                            {config.emailConfig.recipients.length} destinataire{config.emailConfig.recipients.length > 1 ? "s" : ""}
                          </div>
                          <div className="truncate max-w-xs">
                            {config.emailConfig.recipients.join(", ")}
                          </div>
                        </div>
                      ) : config.type === "WEBHOOK" && config.webhookConfig ? (
                        <div>
                          <div className="font-medium">URL du webhook</div>
                          <div className="truncate max-w-xs">{config.webhookConfig.url}</div>
                        </div>
                      ) : (
                        <span>Configuration non disponible</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {format(new Date(config.createdAt), "dd/MM/yyyy HH:mm", { locale: fr })}
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <div className="flex justify-end space-x-2">
                        <Link
                          href={`/notifications/${config.id}`}
                          className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
                        >
                          Détails
                        </Link>
                        
                        {canEdit && (
                          <>
                            <Link
                              href={`/notifications/${config.id}/edit`}
                              className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                            >
                              <FiEdit className="h-4 w-4" />
                              <span className="sr-only">Modifier</span>
                            </Link>
                            
                            <DeleteNotificationButton 
                              notificationId={config.id} 
                              notificationName={config.name} 
                            />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Historique des notifications envoyées */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Historique des Notifications
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Les dernières notifications envoyées.
            </p>
          </div>
          <Link
            href="/notifications/history"
            className="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
          >
            Voir tout l'historique
          </Link>
        </div>
        
        {/* Nous ajouterons l'historique des notifications dans un autre composant */}
        <div className="mt-4">
          {/* Ici sera importé le composant NotificationHistory */}
          <p className="text-sm text-gray-500 dark:text-gray-400">Chargement de l'historique...</p>
        </div>
      </div>
    </div>
  );
}
