import { getServerSession } from "next-auth/next";
import Link from "next/link";
import { FiPlus, FiServer, FiDatabase, FiMail, FiGrid } from "react-icons/fi";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// Fonction pour obtenir l'icône correspondant au type de serveur
const getServerIcon = (type: string) => {
  switch (type) {
    case "DATABASE":
      return <FiDatabase className="h-5 w-5" aria-hidden="true" />;
    case "APPLICATION":
      return <FiServer className="h-5 w-5" aria-hidden="true" />;
    case "MAIL":
      return <FiMail className="h-5 w-5" aria-hidden="true" />;
    default:
      return <FiGrid className="h-5 w-5" aria-hidden="true" />;
  }
};

// Fonction pour déterminer le statut global du serveur en fonction de ses sondes
const getServerStatus = (probes: any[]) => {
  if (probes.length === 0) return "UNKNOWN";
  
  if (probes.some(probe => probe.status === "ERROR")) return "ERROR";
  if (probes.some(probe => probe.status === "WARNING")) return "WARNING";
  if (probes.every(probe => probe.status === "OK")) return "OK";
  
  return "UNKNOWN";
};

// Fonction pour obtenir la classe CSS correspondant au statut
const getStatusClass = (status: string) => {
  switch (status) {
    case "OK":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "WARNING":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    case "ERROR":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
  }
};

// Fonction pour localiser le type de serveur
const getServerTypeName = (type: string) => {
  switch (type) {
    case "DATABASE":
      return "Base de données";
    case "APPLICATION":
      return "Application";
    case "MAIL":
      return "Email";
    default:
      return "Autre";
  }
};

async function getServers(userId: string) {
  try {
    // Obtenir les groupes auxquels l'utilisateur appartient
    const userGroups = await prisma.groupUser.findMany({
      where: {
        userId: userId,
      },
      select: {
        groupId: true,
      },
    });

    const groupIds = userGroups.map((group) => group.groupId);

    // Obtenir les serveurs associés à ces groupes
    // Super Admin peut voir tous les serveurs
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    let servers;
    if (user?.role === "SUPER_ADMIN") {
      servers = await prisma.server.findMany({
        include: {
          createdBy: {
            select: { name: true },
          },
          probes: true,
          groups: {
            select: { id: true, name: true },
          },
        },
        orderBy: {
          name: "asc",
        },
      });
    } else {
      servers = await prisma.server.findMany({
        where: {
          groups: {
            some: {
              id: {
                in: groupIds,
              },
            },
          },
        },
        include: {
          createdBy: {
            select: { name: true },
          },
          probes: true,
          groups: {
            select: { id: true, name: true },
          },
        },
        orderBy: {
          name: "asc",
        },
      });
    }

    return servers;
  } catch (error) {
    console.error("Error fetching servers:", error);
    return [];
  }
}

export default async function ServersPage() {
  const session = await getServerSession(authOptions);
  const servers = await getServers(session?.user?.id as string);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between sm:flex-row sm:items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Serveurs
        </h1>
        <Link
          href="/servers/new"
          className="mt-4 inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:mt-0"
        >
          <FiPlus className="-ml-1 mr-2 h-5 w-5" />
          Ajouter un serveur
        </Link>
      </div>

      {servers.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
            Aucun serveur
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Commencez par ajouter un serveur à surveiller.
          </p>
          <div className="mt-6">
            <Link
              href="/servers/new"
              className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700"
            >
              <FiPlus className="-ml-1 mr-2 h-5 w-5" />
              Ajouter un serveur
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 shadow dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  Serveur
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  Type
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  Groupe(s)
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  Sondes
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  Statut
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  Dernière mise à jour
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {servers.map((server) => {
                const serverStatus = getServerStatus(server.probes);
                const statusClass = getStatusClass(serverStatus);
                
                return (
                  <tr key={server.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-300">
                            {getServerIcon(server.type)}
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {server.name}
                          </div>
                          {server.description && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {server.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {getServerTypeName(server.type)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {server.groups.map((group: any) => (
                          <span
                            key={group.id}
                            className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                          >
                            {group.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {server.probes.length}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${statusClass}`}
                      >
                        {serverStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {format(new Date(server.updatedAt), "dd MMM yyyy HH:mm", { locale: fr })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/servers/${server.id}`}
                        className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
                      >
                        Détails
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
