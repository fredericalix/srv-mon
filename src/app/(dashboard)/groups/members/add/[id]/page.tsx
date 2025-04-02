import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AddGroupMembersForm from "@/components/groups/AddGroupMembersForm";

// Fonction pour récupérer un groupe
async function getGroup(groupId: string) {
  return await prisma.group.findUnique({
    where: { id: groupId },
  });
}

// Fonction pour récupérer les utilisateurs qui ne sont pas déjà dans le groupe
async function getNonGroupUsers(groupId: string) {
  // D'abord, récupérer les utilisateurs qui sont déjà dans le groupe
  const groupUsers = await prisma.groupUser.findMany({
    where: { groupId },
    select: { userId: true },
  });
  
  const existingUserIds = groupUsers.map((gu) => gu.userId);
  
  // Récupérer tous les utilisateurs qui ne sont pas dans le groupe
  const users = await prisma.user.findMany({
    where: {
      id: { notIn: existingUserIds },
    },
    orderBy: {
      name: "asc",
    },
  });
  
  return users;
}

// Fonction pour vérifier si l'utilisateur est admin du groupe
async function checkGroupAdmin(groupId: string, userId: string) {
  // Super admin a toujours accès
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  
  if (user?.role === "SUPER_ADMIN") return true;
  
  // Vérifier si l'utilisateur est admin du groupe
  const groupUser = await prisma.groupUser.findFirst({
    where: {
      userId,
      groupId,
      role: "ADMIN",
    },
  });
  
  return !!groupUser;
}

export default async function AddGroupMembersPage({
  params
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect("/login");
  }
  
  const groupId = params.id;
  
  // Vérifier si l'utilisateur est admin du groupe
  const isAdmin = await checkGroupAdmin(groupId, session.user.id);
  
  if (!isAdmin) {
    redirect("/groups");
  }
  
  // Récupérer le groupe
  const group = await getGroup(groupId);
  
  if (!group) {
    notFound();
  }
  
  // Récupérer les utilisateurs qui ne sont pas dans le groupe
  const availableUsers = await getNonGroupUsers(groupId);
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Ajouter des membres à {group.name}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Sélectionnez les utilisateurs à ajouter au groupe.
        </p>
      </div>
      
      <div className="card">
        {availableUsers.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              Tous les utilisateurs sont déjà membres de ce groupe.
            </p>
          </div>
        ) : (
          <AddGroupMembersForm groupId={groupId} availableUsers={availableUsers} />
        )}
      </div>
    </div>
  );
}
