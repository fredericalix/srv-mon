"use client";

import { useState } from "react";
import Link from "next/link";
import { FiDatabase, FiMail, FiServer, FiGrid, FiMoreHorizontal, FiInfo } from "react-icons/fi";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

// Fonction pour déterminer l'icône du serveur en fonction de son type
const getServerIcon = (type: string) => {
  switch (type) {
    case "DATABASE":
      return <FiDatabase className="h-6 w-6" />;
    case "MAIL":
      return <FiMail className="h-6 w-6" />;
    case "APPLICATION":
      return <FiServer className="h-6 w-6" />;
    default:
      return <FiGrid className="h-6 w-6" />;
  }
};

// Fonction pour déterminer le statut global du serveur en fonction de ses sondes
const getServerStatus = (probes: any[]) => {
  if (probes.length === 0) return "UNKNOWN";
  
  if (probes.some(probe => probe.status === "ERROR")) return "ERROR";
  if (probes.some(probe => probe.status === "WARNING")) return "WARNING";
  if (probes.every(probe => probe.status === "OK")) return "OK";
  
  return "UNKNOWN";
};

// Fonction pour obtenir la classe CSS en fonction du statut
const getStatusClass = (status: string) => {
  switch (status) {
    case "OK":
      return "server-status-ok";
    case "WARNING":
      return "server-status-warning";
    case "ERROR":
      return "server-status-error";
    default:
      return "server-status-unknown";
  }
};

// Fonction pour formater la date relative
const formatRelativeTime = (date: Date) => {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr });
  } catch (error) {
    return "Date inconnue";
  }
};

export default function ServerStatusCard({ server }: { server: any }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const serverStatus = getServerStatus(server.probes);
  const statusClass = getStatusClass(serverStatus);
  const serverIcon = getServerIcon(server.type);
  
  // Nombre de sondes par statut
  const probeStats = server.probes.reduce(
    (acc: any, probe: any) => {
      acc[probe.status] = (acc[probe.status] || 0) + 1;
      return acc;
    },
    { OK: 0, WARNING: 0, ERROR: 0, UNKNOWN: 0 }
  );
  
  return (
    <div className="card border border-gray-200 transition-shadow hover:shadow-lg dark:border-gray-700">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${statusClass} bg-opacity-10`}>
            {serverIcon}
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">
              {server.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {server.groups.map((g: any) => g.name).join(", ")}
            </p>
          </div>
        </div>
        
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-700"
          >
            <FiMoreHorizontal className="h-5 w-5" />
          </button>
          
          {isMenuOpen && (
            <div className="absolute right-0 z-10 mt-2 w-48 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-gray-800 dark:ring-gray-700">
              <Link
                href={`/servers/${server.id}`}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                onClick={() => setIsMenuOpen(false)}
              >
                Détails
              </Link>
              <Link
                href={`/servers/${server.id}/edit`}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                onClick={() => setIsMenuOpen(false)}
              >
                Modifier
              </Link>
              <Link
                href={`/servers/${server.id}/probes/new`}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                onClick={() => setIsMenuOpen(false)}
              >
                Ajouter une sonde
              </Link>
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <div className="flex space-x-2">
            {server.probes.length > 0 ? (
              <>
                <div className="flex items-center">
                  <span className="inline-block h-3 w-3 rounded-full bg-success"></span>
                  <span className="ml-1 text-xs">{probeStats.OK}</span>
                </div>
                <div className="flex items-center">
                  <span className="inline-block h-3 w-3 rounded-full bg-warning"></span>
                  <span className="ml-1 text-xs">{probeStats.WARNING}</span>
                </div>
                <div className="flex items-center">
                  <span className="inline-block h-3 w-3 rounded-full bg-danger"></span>
                  <span className="ml-1 text-xs">{probeStats.ERROR}</span>
                </div>
                <div className="flex items-center">
                  <span className="inline-block h-3 w-3 rounded-full bg-gray-400"></span>
                  <span className="ml-1 text-xs">{probeStats.UNKNOWN}</span>
                </div>
              </>
            ) : (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Aucune sonde
              </span>
            )}
          </div>
          
          <Link
            href={`/servers/${server.id}`}
            className="flex items-center text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400"
          >
            <FiInfo className="mr-1 h-4 w-4" />
            Détails
          </Link>
        </div>
        
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Mis à jour {formatRelativeTime(server.updatedAt)}
        </div>
      </div>
    </div>
  );
}
