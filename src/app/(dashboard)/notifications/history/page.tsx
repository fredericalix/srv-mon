import { getServerSession } from "next-auth/next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FiMail, FiGlobe, FiAlertCircle, FiAlertTriangle, FiInfo, FiCheckCircle, FiXCircle } from "react-icons/fi";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// Types pour les niveaux de notification
type NotificationLevel = "INFO" | "WARNING" | "ERROR";
type NotificationStatus = "PENDING" | "SENT" | "FAILED";

// Fonction pour obtenir l'icône correspondant au niveau de notification
const getLevelIcon = (level: NotificationLevel) => {
  switch (level) {
    case "ERROR":
      return <FiAlertCircle className="h-5 w-5 text-red-500" aria-hidden="true" />;
    case "WARNING":
      return <FiAlertTriangle className="h-5 w-5 text-yellow-500" aria-hidden="true" />;
    case "INFO":
      return <FiInfo className="h-5 w-5 text-blue-500" aria-hidden="true" />;
    default:
      return <FiInfo className="h-5 w-5 text-gray-500" aria-hidden="true" />;
  }
};

// Fonction pour obtenir l'icône correspondant au statut de la notification
const getStatusIcon = (status: NotificationStatus) => {
  switch (status) {
    case "SENT":
      return <FiCheckCircle className="h-5 w-5 text-green-500" aria-hidden="true" />;
    case "FAILED":
      return <FiXCircle className="h-5 w-5 text-red-500" aria-hidden="true" />;
    case "PENDING":
    default:
      return <div className="h-5 w-5 animate-pulse rounded-full bg-gray-300 dark:bg-gray-600"></div>;
  }
};

// Fonction pour récupérer les notifications accessibles à l'utilisateur
async function getNotificationHistory(userId: string, isSuperAdmin: boolean) {
  if (isSuperAdmin) {
    // Super admin voit toutes les notifications
    return await prisma.notification.findMany({
      include: {
        server: {
          select: { id: true, name: true },
        },
        probe: {
          select: { id: true, name: true },
        },
        notificationConfig: {
          select: { id: true, name: true, type: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100, // Limiter à 100 notifications pour des raisons de performance
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
    
    // Trouver les serveurs accessibles pour l'utilisateur
    const accessibleServers = await prisma.server.findMany({
      where: {
        groups: {
          some: {
            id: {
              in: groupIds,
            },
          },
        },
      },
      select: {
        id: true,
      },
    });
    
    const serverIds = accessibleServers.map((server) => server.id);
    
    // Récupérer les notifications liées à ces serveurs
    return await prisma.notification.findMany({
      where: {
        serverId: {
          in: serverIds,
        },
      },
      include: {
        server: {
          select: { id: true, name: true },
        },
        probe: {
          select: { id: true, name: true },
        },
        notificationConfig: {
          select: { id: true, name: true, type: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100, // Limiter à 100 notifications pour des raisons de performance
    });
  }
}

export default async function NotificationHistoryPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return notFound();
  }
  
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const notifications = await getNotificationHistory(session.user.id, isSuperAdmin);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Historique des Notifications
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Consultez les dernières notifications envoyées à vos équipes.
          </p>
        </div>
        
        <div>
          <Link
            href="/notifications"
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Retour aux configurations
          </Link>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="mt-4 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center dark:border-gray-700">
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
            Aucune notification
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Aucune notification n'a encore été envoyée.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">
                  Événement
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Serveur / Sonde
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Date
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Statut
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Notification
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {notifications.map((notification) => (
                <tr key={notification.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                    <div className="flex items-center">
                      <div className="mr-2">
                        {getLevelIcon(notification.level as NotificationLevel)}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{notification.title}</div>
                        <div className="text-gray-500 dark:text-gray-400 line-clamp-2">{notification.message}</div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {notification.server?.name || "Serveur inconnu"}
                      </div>
                      {notification.probe && (
                        <div className="text-xs">
                          Sonde: {notification.probe.name}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    <div>
                      <div>{format(new Date(notification.createdAt), "dd/MM/yyyy", { locale: fr })}</div>
                      <div>{format(new Date(notification.createdAt), "HH:mm:ss", { locale: fr })}</div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    <div className="flex items-center">
                      <div className="mr-2">
                        {getStatusIcon(notification.status as NotificationStatus)}
                      </div>
                      <div>
                        {notification.status === "SENT" ? (
                          <span className="text-green-600 dark:text-green-400">Envoyée</span>
                        ) : notification.status === "FAILED" ? (
                          <span className="text-red-600 dark:text-red-400">Échec</span>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400">En attente</span>
                        )}
                        {notification.sentAt && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {format(new Date(notification.sentAt), "HH:mm:ss", { locale: fr })}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {notification.notificationConfig ? (
                      <div className="flex items-center">
                        <div className="mr-1">
                          {notification.notificationConfig.type === "EMAIL" ? (
                            <FiMail className="h-4 w-4 text-blue-500" />
                          ) : (
                            <FiGlobe className="h-4 w-4 text-purple-500" />
                          )}
                        </div>
                        <div>
                          {notification.notificationConfig.name}
                        </div>
                      </div>
                    ) : (
                      <span>Configuration inconnue</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
