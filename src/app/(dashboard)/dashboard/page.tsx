import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ServerStatusCard from "@/components/dashboard/ServerStatusCard";
import DashboardStatusSummary from "@/components/dashboard/DashboardStatusSummary";
import { FiPlus } from "react-icons/fi";
import Link from "next/link";

async function getServerData(userId: string) {
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
          probes: {
            include: {
              httpConfig: true,
              webhookConfig: true,
            },
          },
          groups: {
            select: { id: true, name: true },
          },
        },
        orderBy: {
          updatedAt: "desc",
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
          probes: {
            include: {
              httpConfig: true,
              webhookConfig: true,
            },
          },
          groups: {
            select: { id: true, name: true },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      });
    }

    // Calculer les statistiques
    const totalServers = servers.length;
    const totalProbes = servers.reduce((acc, server) => acc + server.probes.length, 0);
    
    const statusCounts = {
      OK: 0,
      WARNING: 0,
      ERROR: 0,
      UNKNOWN: 0,
    };
    
    // Compter les sondes par statut
    servers.forEach((server) => {
      server.probes.forEach((probe) => {
        statusCounts[probe.status] += 1;
      });
    });

    return {
      servers,
      stats: {
        totalServers,
        totalProbes,
        statusCounts,
      },
    };
  } catch (error) {
    console.error("Error fetching server data:", error);
    return {
      servers: [],
      stats: {
        totalServers: 0,
        totalProbes: 0,
        statusCounts: {
          OK: 0,
          WARNING: 0,
          ERROR: 0,
          UNKNOWN: 0,
        },
      },
    };
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const { servers, stats } = await getServerData(session?.user?.id as string);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between sm:flex-row sm:items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tableau de bord</h1>
        <Link
          href="/servers/new"
          className="mt-4 inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 sm:mt-0"
        >
          <FiPlus className="-ml-1 mr-2 h-5 w-5" />
          Ajouter un serveur
        </Link>
      </div>

      <DashboardStatusSummary stats={stats} />

      <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
        Statut des serveurs
      </h2>

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {servers.map((server) => (
            <ServerStatusCard key={server.id} server={server} />
          ))}
        </div>
      )}
    </div>
  );
}
