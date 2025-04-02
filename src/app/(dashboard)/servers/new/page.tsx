"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FiArrowLeft, FiSave } from "react-icons/fi";
import Link from "next/link";
import { z } from "zod";
import { useSession } from "next-auth/react";

// Schéma de validation pour le formulaire de serveur
const serverSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  type: z.enum(["DATABASE", "APPLICATION", "MAIL", "OTHER"]),
  description: z.string().optional(),
  groups: z.array(z.string()).min(1, "Au moins un groupe est requis"),
});

type ServerFormData = z.infer<typeof serverSchema>;

export default function NewServerPage() {
  const router = useRouter();
  const { data: session } = useSession();
  
  const [formData, setFormData] = useState<ServerFormData>({
    name: "",
    type: "APPLICATION",
    description: "",
    groups: [],
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<Array<{ id: string; name: string }>>([]);
  
  // Chargement initial des groupes disponibles
  useEffect(() => {
    async function fetchGroups() {
      try {
        const response = await fetch("/api/groups");
        if (!response.ok) {
          throw new Error("Erreur lors du chargement des groupes");
        }
        
        const data = await response.json();
        setAvailableGroups(data.groups);
        
        // Si l'utilisateur n'est pas dans un groupe et n'est pas super admin, on redirige
        if (data.groups.length === 0 && session?.user?.role !== "SUPER_ADMIN") {
          router.push("/dashboard?error=no-groups");
        }
      } catch (error) {
        console.error("Error fetching groups:", error);
        setApiError("Impossible de charger les groupes. Veuillez réessayer.");
      }
    }
    
    if (session) {
      fetchGroups();
    }
  }, [router, session]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    
    // Supprimer l'erreur pour le champ modifié
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleGroupChange = (groupId: string) => {
    setFormData((prev) => {
      const updatedGroups = prev.groups.includes(groupId)
        ? prev.groups.filter((id) => id !== groupId)
        : [...prev.groups, groupId];
        
      return {
        ...prev,
        groups: updatedGroups,
      };
    });
    
    // Supprimer l'erreur pour les groupes si on en sélectionne au moins un
    if (errors.groups) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.groups;
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setApiError(null);
    setErrors({});
    
    try {
      // Valider les données du formulaire
      const validationResult = serverSchema.safeParse(formData);
      
      if (!validationResult.success) {
        // Transformer les erreurs Zod en format utilisable
        const formattedErrors: Record<string, string> = {};
        validationResult.error.errors.forEach((error) => {
          const path = error.path[0] as string;
          formattedErrors[path] = error.message;
        });
        setErrors(formattedErrors);
        setLoading(false);
        return;
      }
      
      // Tout est valide, envoyer la requête de création de serveur
      const response = await fetch("/api/servers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || "Une erreur est survenue lors de la création du serveur");
      }
      
      // Rediriger vers la page de détails du serveur après création réussie
      router.push(`/servers/${data.id}`);
    } catch (error) {
      console.error("Server creation error:", error);
      setApiError(error instanceof Error ? error.message : "Une erreur est survenue. Veuillez réessayer.");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Ajouter un serveur
        </h1>
        <Link
          href="/servers"
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <FiArrowLeft className="-ml-1 mr-2 h-5 w-5" />
          Retour
        </Link>
      </div>

      {apiError && (
        <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/30">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                {apiError}
              </h3>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white shadow dark:bg-gray-800 sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="col-span-1 sm:col-span-2">
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Nom du serveur
                </label>
                <input
                  type="text"
                  name="name"
                  id="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`input mt-1 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                    errors.name ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""
                  }`}
                  placeholder="ex: Serveur de production"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.name}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="type"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Type de serveur
                </label>
                <select
                  id="type"
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-primary-500 focus:outline-none focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
                >
                  <option value="APPLICATION">Application</option>
                  <option value="DATABASE">Base de données</option>
                  <option value="MAIL">Serveur mail</option>
                  <option value="OTHER">Autre</option>
                </select>
              </div>

              <div className="col-span-1 sm:col-span-2">
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Description (facultatif)
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  value={formData.description}
                  onChange={handleChange}
                  className="input mt-1 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Description ou informations supplémentaires sur le serveur"
                />
              </div>

              <div className="col-span-1 sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Groupes
                </label>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Sélectionnez les groupes qui auront accès à ce serveur
                </p>
                {errors.groups && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.groups}
                  </p>
                )}
                
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {availableGroups.map((group) => (
                    <div key={group.id} className="relative flex items-start">
                      <div className="flex h-5 items-center">
                        <input
                          id={`group-${group.id}`}
                          name={`group-${group.id}`}
                          type="checkbox"
                          checked={formData.groups.includes(group.id)}
                          onChange={() => handleGroupChange(group.id)}
                          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label
                          htmlFor={`group-${group.id}`}
                          className="font-medium text-gray-700 dark:text-gray-300"
                        >
                          {group.name}
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
                
                {availableGroups.length === 0 && (
                  <div className="mt-2 rounded-md bg-yellow-50 p-4 dark:bg-yellow-900/30">
                    <p className="text-sm text-yellow-700 dark:text-yellow-200">
                      Aucun groupe disponible. Veuillez créer un groupe avant d'ajouter un serveur.
                    </p>
                    <Link
                      href="/groups/new"
                      className="mt-2 inline-flex items-center text-sm font-medium text-yellow-700 hover:text-yellow-600 dark:text-yellow-200"
                    >
                      Créer un groupe
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => router.push("/servers")}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading || availableGroups.length === 0}
            className="ml-3 inline-flex items-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:bg-primary-400 disabled:hover:bg-primary-400 dark:disabled:bg-primary-800"
          >
            <FiSave className="-ml-1 mr-2 h-5 w-5" />
            {loading ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}
