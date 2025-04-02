"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Select from "react-select";
import { toast } from "react-hot-toast";
import { FiUserPlus, FiLoader } from "react-icons/fi";

// Types pour les utilisateurs disponibles
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

// Type pour les options du select
interface SelectOption {
  value: string;
  label: string;
  email: string;
  role: string;
}

// Schéma de validation pour le formulaire
const formSchema = z.object({
  selectedUsers: z
    .array(
      z.object({
        value: z.string().uuid("ID utilisateur invalide"),
        label: z.string(),
        email: z.string(),
        role: z.string(),
      })
    )
    .min(1, "Veuillez sélectionner au moins un utilisateur"),
  role: z.enum(["MEMBER", "ADMIN"], {
    invalid_type_error: "Veuillez sélectionner un rôle valide",
  }),
});

type FormValues = z.infer<typeof formSchema>;

interface AddGroupMembersFormProps {
  groupId: string;
  availableUsers: User[];
}

export default function AddGroupMembersForm({
  groupId,
  availableUsers,
}: AddGroupMembersFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Options pour le select des utilisateurs
  const userOptions: SelectOption[] = availableUsers.map((user) => ({
    value: user.id,
    label: user.name,
    email: user.email,
    role: user.role,
  }));
  
  // Format personnalisé pour afficher l'email en plus du nom
  const formatOptionLabel = ({ label, email, role }: SelectOption) => (
    <div className="flex flex-col">
      <div>{label}</div>
      <div className="text-xs text-gray-500">{email}</div>
      <div className="text-xs text-gray-400">
        {role === "SUPER_ADMIN"
          ? "Super Admin"
          : role === "ADMIN"
          ? "Admin"
          : "Utilisateur"}
      </div>
    </div>
  );
  
  // Initialiser le formulaire
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      selectedUsers: [],
      role: "MEMBER",
    },
  });
  
  // Fonction pour soumettre le formulaire
  const onSubmit = async (data: FormValues) => {
    if (isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      
      // Transformation des données pour l'API
      const users = data.selectedUsers.map((user) => ({
        id: user.value,
        role: data.role,
      }));
      
      const response = await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ users }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Une erreur est survenue");
      }
      
      const result = await response.json();
      
      toast.success(result.message || "Membres ajoutés avec succès");
      
      // Rediriger vers la page du groupe
      router.push(`/groups/${groupId}`);
      router.refresh();
    } catch (error) {
      console.error("Error adding members:", error);
      toast.error(error instanceof Error ? error.message : "Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 p-6">
      <div className="space-y-4">
        <div>
          <label
            htmlFor="selectedUsers"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Sélectionner des utilisateurs
          </label>
          <div className="mt-1">
            <Controller
              name="selectedUsers"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  isMulti
                  options={userOptions}
                  formatOptionLabel={formatOptionLabel}
                  className="react-select-container"
                  classNamePrefix="react-select"
                  placeholder="Rechercher des utilisateurs..."
                  noOptionsMessage={() => "Aucun utilisateur trouvé"}
                />
              )}
            />
            {errors.selectedUsers && (
              <p className="mt-1 text-sm text-red-600">
                {errors.selectedUsers.message}
              </p>
            )}
          </div>
        </div>
        
        <div>
          <label
            htmlFor="role"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Rôle dans le groupe
          </label>
          <div className="mt-1">
            <select
              id="role"
              {...register("role")}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white sm:text-sm"
            >
              <option value="MEMBER">Membre</option>
              <option value="ADMIN">Administrateur</option>
            </select>
            {errors.role && (
              <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Les administrateurs peuvent gérer le groupe, ses membres et ses serveurs.
          </p>
        </div>
      </div>
      
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <FiLoader className="-ml-1 mr-2 h-5 w-5 animate-spin" />
              Ajout en cours...
            </>
          ) : (
            <>
              <FiUserPlus className="-ml-1 mr-2 h-5 w-5" />
              Ajouter les membres
            </>
          )}
        </button>
      </div>
    </form>
  );
}
