import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-hot-toast";
import { Switch } from "@headlessui/react";
import { FiShield, FiCheck, FiX } from "react-icons/fi";

// Types pour les groupes
interface Group {
  id: string;
  name: string;
}

interface GroupSelection {
  id: string;
  role: "MEMBER" | "ADMIN";
  selected: boolean;
}

// Interface pour les données initiales
interface UserFormData {
  id?: string;
  name?: string;
  email?: string;
  role?: "USER" | "ADMIN" | "SUPER_ADMIN";
  groups?: Array<{
    id: string;
    role: "MEMBER" | "ADMIN";
  }>;
}

// Propriétés du composant
interface UserFormProps {
  groups: Group[];
  initialData?: UserFormData;
}

// Schéma de validation pour le formulaire
const userFormSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  email: z.string().email("L'email doit être valide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères").optional(),
  role: z.enum(["USER", "ADMIN", "SUPER_ADMIN"]),
});

export default function UserForm({ groups, initialData }: UserFormProps) {
  const router = useRouter();
  const isEditing = !!initialData?.id;

  // État pour gérer la sélection des groupes
  const [groupSelections, setGroupSelections] = useState<GroupSelection[]>([]);

  // Configuration du formulaire
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      email: initialData?.email || "",
      password: "",
      role: initialData?.role || "USER",
    },
  });

  // Initialiser les sélections de groupes
  useEffect(() => {
    if (groups) {
      const selections = groups.map((group) => {
        const existingGroup = initialData?.groups?.find((g) => g.id === group.id);
        return {
          id: group.id,
          role: existingGroup?.role || "MEMBER",
          selected: !!existingGroup,
        };
      });
      setGroupSelections(selections);
    }
  }, [groups, initialData]);

  // Fonction pour toggle la sélection d'un groupe
  const toggleGroupSelection = (groupId: string) => {
    setGroupSelections((prev) =>
      prev.map((group) =>
        group.id === groupId ? { ...group, selected: !group.selected } : group
      )
    );
  };

  // Fonction pour changer le rôle d'un groupe
  const toggleGroupRole = (groupId: string) => {
    setGroupSelections((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? { ...group, role: group.role === "MEMBER" ? "ADMIN" : "MEMBER" }
          : group
      )
    );
  };

  // Gérer la soumission du formulaire
  const onSubmit = async (data: z.infer<typeof userFormSchema>) => {
    try {
      // Récupérer les groupes sélectionnés
      const selectedGroups = groupSelections
        .filter((group) => group.selected)
        .map(({ id, role }) => ({ id, role }));

      // Préparer les données
      const userData = {
        ...data,
        // Ne pas inclure le mot de passe si vide ou en mode édition avec champ vide
        ...(data.password ? { password: data.password } : {}),
        groups: selectedGroups,
      };

      // Appeler l'API
      const url = isEditing
        ? `/api/users/${initialData.id}`
        : "/api/users";
      
      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Une erreur est survenue");
      }

      toast.success(
        isEditing
          ? "Utilisateur mis à jour avec succès"
          : "Utilisateur créé avec succès"
      );

      // Rediriger vers la liste des utilisateurs
      router.push("/users");
      router.refresh();
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error(error instanceof Error ? error.message : "Une erreur est survenue");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Informations de base */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Informations de l'utilisateur
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Nom
            </label>
            <div className="mt-1">
              <input
                id="name"
                type="text"
                {...register("name")}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Email
            </label>
            <div className="mt-1">
              <input
                id="email"
                type="email"
                {...register("email")}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {isEditing ? "Nouveau mot de passe (laisser vide pour ne pas changer)" : "Mot de passe"}
            </label>
            <div className="mt-1">
              <input
                id="password"
                type="password"
                {...register("password")}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="role"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Rôle
            </label>
            <div className="mt-1">
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <select
                    id="role"
                    {...field}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="USER">Utilisateur</option>
                    <option value="ADMIN">Admin</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                )}
              />
              {errors.role && (
                <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sélection des groupes */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Appartenance aux groupes
        </h3>

        <div className="mt-4 space-y-2">
          {groupSelections.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Aucun groupe disponible
            </p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {groupSelections.map((group) => {
                const groupData = groups.find((g) => g.id === group.id);
                return (
                  <li
                    key={group.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center">
                      <Switch
                        checked={group.selected}
                        onChange={() => toggleGroupSelection(group.id)}
                        className={`${
                          group.selected
                            ? "bg-primary-600"
                            : "bg-gray-200 dark:bg-gray-700"
                        } relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                      >
                        <span
                          className={`${
                            group.selected ? "translate-x-6" : "translate-x-1"
                          } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                        />
                      </Switch>
                      <span className="ml-3 text-sm font-medium text-gray-900 dark:text-white">
                        {groupData?.name}
                      </span>
                    </div>

                    {group.selected && (
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => toggleGroupRole(group.id)}
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                            group.role === "ADMIN"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {group.role === "ADMIN" ? (
                            <>
                              <FiShield className="mr-1 h-3 w-3" />
                              Admin
                            </>
                          ) : (
                            "Membre"
                          )}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Boutons d'action */}
      <div className="flex justify-end space-x-3 pt-5">
        <button
          type="button"
          onClick={() => router.push("/users")}
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <FiX className="-ml-1 mr-2 h-5 w-5" />
          Annuler
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
        >
          <FiCheck className="-ml-1 mr-2 h-5 w-5" />
          {isSubmitting
            ? "Enregistrement..."
            : isEditing
            ? "Mettre à jour"
            : "Créer"}
        </button>
      </div>
    </form>
  );
}
