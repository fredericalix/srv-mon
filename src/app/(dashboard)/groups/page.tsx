import { getServerSession } from "next-auth/next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FiPlus, FiUsers, FiServer } from "react-icons/fi";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// Fonction pour récupérer les groupes selon le rôle de l'utilisateur
async function getGroups(userId: string, isSuperAdmin: boolean) {
  if (isSuperAdmin) {
    // Super admin voit tous les groupes
    return await prisma.group.findMany({
      include: {
        _count: {
          select: {
            servers: true,
            groupUsers: true,
            notificationConfigs: true,
          },
        },
      },
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
      include: {
        group: {
          include: {
            _count: {
              select: {
                servers: true,
                groupUsers: true,
                notificationConfigs: true,
              },
            },
          },
        },
      },
    });
    
    return userGroups.map((ug) => ug.group);
  }
}

export default async function GroupsPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user || !session.user.id) {
    redirect("/login");
  }
  
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const groups = await getGroups(session.user.id, isSuperAdmin);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Groupes
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Gérez les groupes et leurs membres pour organiser l'accès aux serveurs.
          </p>
        </div>
        
        {/* Seuls les super admins peuvent créer des groupes */}
        {isSuperAdmin && (
          <div>
            <Link
              href="/groups/new"
              className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              <FiPlus className="-ml-1 mr-2 h-5 w-5" />
              Nouveau groupe
            </Link>
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="mt-4 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center dark:border-gray-700">
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
            Aucun groupe
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {isSuperAdmin
              ? "Commencez par créer un groupe pour organiser vos utilisateurs et serveurs."
              : "Vous n'avez pas encore été ajouté à un groupe."}
          </p>
          {isSuperAdmin && (
            <div className="mt-6">
              <Link
                href="/groups/new"
                className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700"
              >
                <FiPlus className="-ml-1 mr-2 h-5 w-5" />
                Nouveau groupe
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg shadow ring-1 ring-black ring-opacity-5">
          <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">
                  Nom du groupe
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Membres
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Serveurs
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Notifications
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Créé le
                </th>
                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {groups.map((group) => (
                <tr key={group.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0 flex items-center justify-center bg-primary-100 text-primary-700 rounded-full dark:bg-primary-900 dark:text-primary-300">
                        <FiUsers className="h-5 w-5" />
                      </div>
                      <div className="ml-4">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {group.name}
                        </div>
                        <div className="text-gray-500 dark:text-gray-400">
                          {group.description ? group.description.substring(0, 50) + (group.description.length > 50 ? '...' : '') : 'Aucune description'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center">
                      <FiUsers className="mr-2 h-4 w-4" />
                      {group._count.groupUsers}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center">
                      <FiServer className="mr-2 h-4 w-4" />
                      {group._count.servers}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {group._count.notificationConfigs}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {format(new Date(group.createdAt), "dd/MM/yyyy", { locale: fr })}
                  </td>
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <div className="flex justify-end space-x-2">
                      <Link
                        href={`/groups/${group.id}`}
                        className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-gray-700"
                      >
                        Détails
                      </Link>
                      {isSuperAdmin && (
                        <Link
                          href={`/groups/edit/${group.id}`}
                          className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-gray-700"
                        >
                          Modifier
                        </Link>
                      )}
                    </div>
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
