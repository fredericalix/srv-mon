import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import GroupForm from "@/components/groups/GroupForm";

// Fonction pour récupérer un groupe
async function getGroup(groupId: string) {
  return await prisma.group.findUnique({
    where: { id: groupId },
  });
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

export default async function EditGroupPage({
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
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Modifier le groupe
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Modifiez les informations du groupe {group.name}.
        </p>
      </div>
      
      <div className="card">
        <GroupForm initialData={group} />
      </div>
    </div>
  );
}
