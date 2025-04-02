import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import UserForm from "@/components/users/UserForm";

// Fonction pour récupérer tous les groupes
async function getGroups() {
  return await prisma.group.findMany({
    orderBy: {
      name: "asc",
    },
  });
}

// Fonction pour récupérer un utilisateur avec ses groupes
async function getUser(userId: string) {
  return await prisma.user.findUnique({
    where: { id: userId },
    include: {
      groupUsers: {
        select: {
          groupId: true,
          role: true,
        },
      },
    },
  });
}

export default async function EditUserPage({
  params
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect("/login");
  }
  
  // Vérifier si l'utilisateur est super admin
  if (session.user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }
  
  const userId = params.id;
  
  // Récupérer l'utilisateur
  const user = await getUser(userId);
  
  if (!user) {
    notFound();
  }
  
  // Récupérer tous les groupes
  const groups = await getGroups();
  
  // Préparer les données initiales pour le formulaire
  const initialData = {
    id: user.id,
    name: user.name || "",
    email: user.email || "",
    role: user.role as "USER" | "ADMIN" | "SUPER_ADMIN",
    groups: user.groupUsers.map((gu) => ({
      id: gu.groupId,
      role: gu.role as "MEMBER" | "ADMIN",
    })),
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Modifier l'utilisateur
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Modifiez les informations et les permissions de l'utilisateur.
        </p>
      </div>
      
      <div className="card">
        <UserForm groups={groups} initialData={initialData} />
      </div>
    </div>
  );
}
