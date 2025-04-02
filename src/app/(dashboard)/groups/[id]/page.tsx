import { getServerSession } from "next-auth/next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { FiUsers, FiPlus, FiEdit2, FiShield, FiUser, FiEdit, FiUserMinus } from "react-icons/fi";
import GroupMemberActions from "@/components/groups/GroupMemberActions";

// Fonction pour récupérer les détails d'un groupe avec ses membres
async function getGroupDetails(groupId: string) {
  return await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      groupUsers: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              role: true,
            },
          },
        },
      },
      _count: {
        select: {
          servers: true,
          notificationConfigs: true,
        },
      },
    },
  });
}

// Fonction pour vérifier si l'utilisateur a accès au groupe
async function checkGroupAccess(groupId: string, userId: string) {
  // Super admin a toujours accès
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  
  if (user?.role === "SUPER_ADMIN") return { hasAccess: true, isAdmin: true, isSuperAdmin: true };
  
  // Vérifier l'appartenance au groupe
  const groupUser = await prisma.groupUser.findFirst({
    where: {
      userId,
      groupId,
    },
  });
  
  if (!groupUser) return { hasAccess: false, isAdmin: false, isSuperAdmin: false };
  
  return {
    hasAccess: true,
    isAdmin: groupUser.role === "ADMIN",
    isSuperAdmin: false,
  };
}

export default async function GroupDetailsPage({
  params
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect("/login");
  }
  
  const groupId = params.id;
  
  // Vérifier l'accès de l'utilisateur
  const { hasAccess, isAdmin, isSuperAdmin } = await checkGroupAccess(
    groupId,
    session.user.id
  );
  
  if (!hasAccess) {
    redirect("/groups");
  }
  
  // Récupérer les détails du groupe
  const group = await getGroupDetails(groupId);
  
  if (!group) {
    notFound();
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {group.name}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {group.description || "Aucune description"}
          </p>
        </div>
        
        <div className="flex space-x-3">
          {isAdmin && (
            <Link
              href={`/groups/members/add/${groupId}`}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <FiPlus className="-ml-1 mr-2 h-5 w-5" />
              Ajouter un membre
            </Link>
          )}
          
          {(isAdmin || isSuperAdmin) && (
            <Link
              href={`/groups/edit/${groupId}`}
              className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              <FiEdit2 className="-ml-1 mr-2 h-5 w-5" />
              Modifier le groupe
            </Link>
          )}
        </div>
      </div>
      
      {/* Informations sur le groupe */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="rounded-lg bg-white p-5 shadow dark:bg-gray-800">
          <div className="flex items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-300">
              <FiUsers className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Membres
              </h3>
              <p className="text-xl font-bold">{group.groupUsers.length}</p>
            </div>
          </div>
        </div>
        
        <div className="rounded-lg bg-white p-5 shadow dark:bg-gray-800">
          <div className="flex items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300">
              <FiEdit className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Serveurs
              </h3>
              <p className="text-xl font-bold">{group._count.servers}</p>
            </div>
          </div>
        </div>
        
        <div className="rounded-lg bg-white p-5 shadow dark:bg-gray-800">
          <div className="flex items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300">
              <FiEdit className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Notifications
              </h3>
              <p className="text-xl font-bold">{group._count.notificationConfigs}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Liste des membres */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Membres du groupe
        </h2>
        
        <div className="overflow-hidden rounded-lg shadow ring-1 ring-black ring-opacity-5">
          <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">
                  Utilisateur
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Rôle dans le groupe
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Rôle système
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Ajouté le
                </th>
                {isAdmin && (
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {group.groupUsers.map((groupUser) => (
                <tr key={groupUser.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0">
                        {groupUser.user.image ? (
                          <img
                            className="h-10 w-10 rounded-full"
                            src={groupUser.user.image}
                            alt={groupUser.user.name || ""}
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                            <FiUser className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {groupUser.user.name}
                        </div>
                        <div className="text-gray-500 dark:text-gray-400">
                          {groupUser.user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {groupUser.role === "ADMIN" ? (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                        <FiShield className="mr-1 h-3 w-3" />
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                        Membre
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {groupUser.user.role === "SUPER_ADMIN" ? (
                      <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                        <FiShield className="mr-1 h-3 w-3" />
                        Super Admin
                      </span>
                    ) : groupUser.user.role === "ADMIN" ? (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                        <FiShield className="mr-1 h-3 w-3" />
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                        <FiUser className="mr-1 h-3 w-3" />
                        Utilisateur
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {format(new Date(groupUser.createdAt), "dd/MM/yyyy", { locale: fr })}
                  </td>
                  {isAdmin && (
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <GroupMemberActions 
                        groupId={groupId}
                        userId={groupUser.user.id}
                        currentRole={groupUser.role}
                        isCurrentUserSuperAdmin={isSuperAdmin}
                        isUserSuperAdmin={groupUser.user.role === "SUPER_ADMIN"}
                        isCurrentUser={groupUser.user.id === session.user.id}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
