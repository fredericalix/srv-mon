import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import GroupForm from "@/components/groups/GroupForm";

export default async function NewGroupPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect("/login");
  }
  
  // Vérifier si l'utilisateur est super admin
  if (session.user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Créer un nouveau groupe
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Ajoutez un nouveau groupe pour organiser vos utilisateurs et serveurs.
        </p>
      </div>
      
      <div className="card">
        <GroupForm />
      </div>
    </div>
  );
}
