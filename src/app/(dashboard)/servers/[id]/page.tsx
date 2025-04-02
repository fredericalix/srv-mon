import { getServerSession } from "next-auth/next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { FiEdit, FiPlus, FiServer, FiDatabase, FiMail, FiGrid, FiEye, FiTrash2 } from "react-icons/fi";
import DeleteServerButton from "@/components/servers/DeleteServerButton";
import ProbesList from "@/components/probes/ProbesList";

// Fonction pour obtenir l'icône correspondant au type de serveur
const getServerIcon = (type: string) => {
  switch (type) {
    case "DATABASE":
      return <FiDatabase className="h-6 w-6" aria-hidden="true" />;
    case "APPLICATION":
      return <FiServer className="h-6 w-6" aria-hidden="true" />;
    case "MAIL":
      return <FiMail className="h-6 w-6" aria-hidden="true" />;
    default:
      return <FiGrid className="h-6 w-6" aria-hidden="true" />;
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

async function getServerData(id: string, userId: string, isSuperAdmin: boolean) {
  // Vérifier si l'utilisateur a accès au serveur
  let server;
  
  if (isSuperAdmin) {
    // Super admin peut voir tous les serveurs
    server = await prisma.server.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        groups: true,
        probes: {
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
        },
      },
    });
  } else {
    // Utilisateur normal doit faire partie d'un groupe lié au serveur
    const userGroups = await prisma.groupUser.findMany({
      where: {
        userId,
      },
      select: {
        groupId: true,
      },
    });
    
    const groupIds = userGroups.map((group) => group.groupId);
    
    server = await prisma.server.findFirst({
      where: {
        id,
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
          select: { id: true, name: true, email: true },
        },
        groups: true,
        probes: {
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
        },
      },
    });
  }
  
  return server;
}

export default async function ServerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return notFound();
  }
  
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const server = await getServerData(params.id, session.user.id, isSuperAdmin);
  
  if (!server) {
    return notFound();
  }
  
  // Déterminer si l'utilisateur est admin d'au moins un des groupes du serveur
  const isGroupAdmin = isSuperAdmin || 
    (await prisma.groupUser.findFirst({
      where: {
        userId: session.user.id,
        groupId: { in: server.groups.map(g => g.id) },
        role: "ADMIN",
      },
    })) !== null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0">
        <div className="flex items-center space-x-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-300">
            {getServerIcon(server.type)}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {server.name}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {getServerTypeName(server.type)}
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/servers/${server.id}/probes/new`}
            className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            <FiPlus className="-ml-1 mr-2 h-5 w-5" />
            Ajouter une sonde
          </Link>
          
          {isGroupAdmin && (
            <Link
              href={`/servers/${server.id}/edit`}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <FiEdit className="-ml-1 mr-2 h-5 w-5" />
              Modifier
            </Link>
          )}
          
          {isGroupAdmin && (
            <DeleteServerButton serverId={server.id} serverName={server.name} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Informations du serveur */}
        <div className="card border border-gray-200 dark:border-gray-700">
          <h2 className="mb-4 text-lg font-medium text-gray-900 dark:text-white">
            Informations
          </h2>
          
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Nom</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white">{server.name}</dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Type</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                {getServerTypeName(server.type)}
              </dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Créé par
              </dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                {server.createdBy.name}
              </dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Date de création
              </dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                {format(new Date(server.createdAt), "dd MMMM yyyy", { locale: fr })}
              </dd>
            </div>
            
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Description
              </dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                {server.description || "Aucune description"}
              </dd>
            </div>
            
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Groupes
              </dt>
              <dd className="mt-1">
                <ul className="flex flex-wrap gap-2">
                  {server.groups.map((group) => (
                    <li
                      key={group.id}
                      className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                    >
                      {group.name}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
        </div>

        {/* Statistiques */}
        <div className="card border border-gray-200 dark:border-gray-700">
          <h2 className="mb-4 text-lg font-medium text-gray-900 dark:text-white">
            Statistiques
          </h2>
          
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Nombre de sondes
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                {server.probes.length}
              </dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Statut
              </dt>
              <dd className="mt-1">
                <div className="flex gap-2">
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-300">
                    {server.probes.filter((p) => p.status === "OK").length} OK
                  </span>
                  <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                    {server.probes.filter((p) => p.status === "WARNING").length} WARNING
                  </span>
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-300">
                    {server.probes.filter((p) => p.status === "ERROR").length} ERROR
                  </span>
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                    {server.probes.filter((p) => p.status === "UNKNOWN").length} UNKNOWN
                  </span>
                </div>
              </dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Sondes HTTP
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                {server.probes.filter((p) => p.type === "HTTP").length}
              </dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Sondes Webhook
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                {server.probes.filter((p) => p.type === "WEBHOOK").length}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Liste des sondes */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            Sondes
          </h2>
          <Link
            href={`/servers/${server.id}/probes/new`}
            className="inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
          >
            <FiPlus className="mr-1 h-4 w-4" />
            Ajouter une sonde
          </Link>
        </div>
        
        {server.probes.length === 0 ? (
          <div className="mt-4 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center dark:border-gray-700">
            <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
              Aucune sonde
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Commencez par ajouter une sonde pour surveiller ce serveur.
            </p>
            <div className="mt-6">
              <Link
                href={`/servers/${server.id}/probes/new`}
                className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700"
              >
                <FiPlus className="-ml-1 mr-2 h-5 w-5" />
                Ajouter une sonde
              </Link>
            </div>
          </div>
        ) : (
          <ProbesList probes={server.probes} serverId={server.id} canEdit={isGroupAdmin} />
        )}
      </div>
    </div>
  );
}
