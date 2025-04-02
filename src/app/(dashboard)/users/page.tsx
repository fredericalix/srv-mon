import { getServerSession } from "next-auth/next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FiPlus, FiUser, FiMail, FiShield } from "react-icons/fi";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// Fonction pour obtenir le badge correspondant au rôle
const getRoleBadge = (role: string) => {
  switch (role) {
    case "SUPER_ADMIN":
      return (
        <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-300">
          <FiShield className="mr-1 h-3 w-3" />
          Super Admin
        </span>
      );
    case "ADMIN":
      return (
        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-300">
          <FiShield className="mr-1 h-3 w-3" />
          Admin
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300">
          <FiUser className="mr-1 h-3 w-3" />
          Utilisateur
        </span>
      );
  }
};

// Fonction pour récupérer tous les utilisateurs (accessible aux super admins seulement)
async function getUsers() {
  const users = await prisma.user.findMany({
    orderBy: {
      name: 'asc',
    },
    include: {
      _count: {
        select: {
          groupUsers: true,
        },
      },
    },
  });

  return users;
}

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect("/login");
  }
  
  // Vérifier si l'utilisateur est super admin
  if (session.user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }
  
  const users = await getUsers();

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Gestion des Utilisateurs
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Gérez les utilisateurs et leurs accès à l'application.
          </p>
        </div>
        
        <div>
          <Link
            href="/users/new"
            className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            <FiPlus className="-ml-1 mr-2 h-5 w-5" />
            Nouvel utilisateur
          </Link>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="mt-4 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center dark:border-gray-700">
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
            Aucun utilisateur
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Commencez par créer un utilisateur pour lui donner accès à l'application.
          </p>
          <div className="mt-6">
            <Link
              href="/users/new"
              className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700"
            >
              <FiPlus className="-ml-1 mr-2 h-5 w-5" />
              Nouvel utilisateur
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg shadow ring-1 ring-black ring-opacity-5">
          <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">
                  Utilisateur
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Rôle
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Groupes
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Dernière connexion
                </th>
                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0">
                        {user.image ? (
                          <img
                            className="h-10 w-10 rounded-full"
                            src={user.image}
                            alt={user.name || ""}
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                            <FiUser className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {user.name}
                        </div>
                        <div className="text-gray-500 dark:text-gray-400 flex items-center">
                          <FiMail className="mr-1 h-3 w-3" />
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {getRoleBadge(user.role)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                      {user._count.groupUsers} groupe(s)
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {user.lastLogin ? (
                      format(new Date(user.lastLogin), "dd/MM/yyyy HH:mm", { locale: fr })
                    ) : (
                      "Jamais connecté"
                    )}
                  </td>
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <div className="flex justify-end space-x-2">
                      <Link
                        href={`/users/${user.id}`}
                        className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-gray-700"
                      >
                        Détails
                      </Link>
                      <Link
                        href={`/users/edit/${user.id}`}
                        className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-gray-700"
                      >
                        Modifier
                      </Link>
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
