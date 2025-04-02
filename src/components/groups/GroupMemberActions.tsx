"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FiMoreVertical,
  FiUserCheck,
  FiUserMinus,
  FiShield,
  FiUser,
} from "react-icons/fi";
import { Menu, Transition } from "@headlessui/react";
import { toast } from "react-hot-toast";

interface GroupMemberActionsProps {
  groupId: string;
  userId: string;
  currentRole: string;
  isCurrentUserSuperAdmin: boolean;
  isUserSuperAdmin: boolean;
  isCurrentUser: boolean;
}

export default function GroupMemberActions({
  groupId,
  userId,
  currentRole,
  isCurrentUserSuperAdmin,
  isUserSuperAdmin,
  isCurrentUser,
}: GroupMemberActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // Fonction pour changer le rôle d'un membre
  const changeRole = async (newRole: "MEMBER" | "ADMIN") => {
    if (loading) return;
    
    try {
      setLoading(true);
      
      const response = await fetch(`/api/groups/${groupId}/members/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: newRole }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Une erreur est survenue");
      }
      
      toast.success(`Rôle mis à jour avec succès`);
      router.refresh();
    } catch (error) {
      console.error("Error changing role:", error);
      toast.error(error instanceof Error ? error.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };
  
  // Fonction pour retirer un membre du groupe
  const removeMember = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      
      const response = await fetch(`/api/groups/${groupId}/members/${userId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Une erreur est survenue");
      }
      
      toast.success(`Membre retiré du groupe avec succès`);
      router.refresh();
    } catch (error) {
      console.error("Error removing member:", error);
      toast.error(error instanceof Error ? error.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };
  
  // Si c'est un Super Admin, on ne peut pas le modifier
  if (isUserSuperAdmin && !isCurrentUserSuperAdmin) {
    return null;
  }
  
  return (
    <Menu as="div" className="relative inline-block text-left">
      <div>
        <Menu.Button className="inline-flex w-full justify-center rounded-md bg-white p-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
          <FiMoreVertical className="h-5 w-5" aria-hidden="true" />
        </Menu.Button>
      </div>
      
      <Transition
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-gray-800 dark:ring-gray-700">
          <div className="py-1">
            {/* Option pour promouvoir un membre en admin */}
            {currentRole === "MEMBER" && (
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() => changeRole("ADMIN")}
                    disabled={loading}
                    className={`${
                      active
                        ? "bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white"
                        : "text-gray-700 dark:text-gray-200"
                    } group flex w-full items-center px-4 py-2 text-sm`}
                  >
                    <FiShield
                      className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-400"
                      aria-hidden="true"
                    />
                    Promouvoir en admin
                  </button>
                )}
              </Menu.Item>
            )}
            
            {/* Option pour rétrograder un admin en membre */}
            {currentRole === "ADMIN" && !isCurrentUser && (
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() => changeRole("MEMBER")}
                    disabled={loading}
                    className={`${
                      active
                        ? "bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white"
                        : "text-gray-700 dark:text-gray-200"
                    } group flex w-full items-center px-4 py-2 text-sm`}
                  >
                    <FiUser
                      className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-400"
                      aria-hidden="true"
                    />
                    Rétrograder en membre
                  </button>
                )}
              </Menu.Item>
            )}
            
            {/* Option pour retirer un membre */}
            {!isCurrentUser && (
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={removeMember}
                    disabled={loading}
                    className={`${
                      active
                        ? "bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-100"
                        : "text-red-700 dark:text-red-400"
                    } group flex w-full items-center px-4 py-2 text-sm`}
                  >
                    <FiUserMinus
                      className="mr-3 h-5 w-5 text-red-400 group-hover:text-red-500 dark:text-red-300 dark:group-hover:text-red-200"
                      aria-hidden="true"
                    />
                    Retirer du groupe
                  </button>
                )}
              </Menu.Item>
            )}
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}
