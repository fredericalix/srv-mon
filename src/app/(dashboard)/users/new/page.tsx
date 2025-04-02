import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
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

export default async function NewUserPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect("/login");
  }
  
  // Vérifier si l'utilisateur est super admin
  if (session.user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }
  
  // Récupérer tous les groupes
  const groups = await getGroups();
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Créer un nouvel utilisateur
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Ajoutez un nouvel utilisateur et définissez ses permissions.
        </p>
      </div>
      
      <div className="card">
        <UserForm groups={groups} />
      </div>
    </div>
  );
}
