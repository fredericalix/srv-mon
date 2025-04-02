'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { FiEdit, FiTrash2, FiGlobe, FiWebhook, FiCheckCircle, FiAlertCircle, FiAlertTriangle, FiHelpCircle, FiClock } from 'react-icons/fi';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type ProbeProps = {
  id: string;
  name: string;
  type: string;
  status: string;
  lastCheck: Date | null;
  lastSuccess: Date | null;
  groups: { id: string; name: string }[];
  httpConfig?: {
    url: string;
    method: string;
    checkInterval: number;
  } | null;
  webhookConfig?: {
    webhookToken: string;
  } | null;
};

type ProbesListProps = {
  probes: ProbeProps[];
  serverId: string;
  canEdit: boolean;
};

const ProbeStatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case 'OK':
      return (
        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-300">
          <FiCheckCircle className="mr-1 h-3 w-3" />
          OK
        </span>
      );
    case 'WARNING':
      return (
        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
          <FiAlertTriangle className="mr-1 h-3 w-3" />
          WARNING
        </span>
      );
    case 'ERROR':
      return (
        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-300">
          <FiAlertCircle className="mr-1 h-3 w-3" />
          ERROR
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300">
          <FiHelpCircle className="mr-1 h-3 w-3" />
          UNKNOWN
        </span>
      );
  }
};

const ProbeTypeIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'HTTP':
      return <FiGlobe className="h-5 w-5 text-blue-500" aria-hidden="true" />;
    case 'WEBHOOK':
      return <FiWebhook className="h-5 w-5 text-purple-500" aria-hidden="true" />;
    default:
      return <FiHelpCircle className="h-5 w-5 text-gray-500" aria-hidden="true" />;
  }
};

export default function ProbesList({ probes, serverId, canEdit }: ProbesListProps) {
  // État local pour simuler les mises à jour de statut en temps réel
  const [localProbes, setLocalProbes] = useState(probes);
  
  // Tri des sondes: d'abord par statut (ERROR en premier), puis par nom
  const sortedProbes = [...localProbes].sort((a, b) => {
    // Ordre de priorité des statuts pour le tri
    const statusOrder: Record<string, number> = {
      ERROR: 0,
      WARNING: 1,
      UNKNOWN: 2,
      OK: 3,
    };
    
    // Tri par statut d'abord
    const statusDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
    if (statusDiff !== 0) return statusDiff;
    
    // Puis par nom
    return a.name.localeCompare(b.name);
  });

  // Simuler des mises à jour périodiques (pour la démo seulement)
  useEffect(() => {
    const interval = setInterval(() => {
      // Cette fonction simule des mises à jour aléatoires des statuts
      // Dans une vraie application, vous effectueriez une requête API ici
      if (localProbes.length === 0) return;
      
      const statusOptions = ['OK', 'WARNING', 'ERROR', 'UNKNOWN'];
      const randomProbeIndex = Math.floor(Math.random() * localProbes.length);
      const randomStatusIndex = Math.floor(Math.random() * statusOptions.length);
      
      setLocalProbes(prev => 
        prev.map((probe, index) => 
          index === randomProbeIndex 
            ? { 
                ...probe, 
                status: statusOptions[randomStatusIndex],
                lastCheck: new Date()
              } 
            : probe
        )
      );
    }, 10000); // Mise à jour toutes les 10 secondes

    return () => clearInterval(interval);
  }, [localProbes.length]);

  if (probes.length === 0) {
    return <p className="text-gray-500 mt-4">Aucune sonde configurée.</p>;
  }

  return (
    <div className="mt-4 overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
      <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">
              Nom & Type
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
              Statut
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
              Dernière vérification
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
              Configuration
            </th>
            <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
          {sortedProbes.map((probe) => (
            <tr key={probe.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                <div className="flex items-center">
                  <div className="mr-2">
                    <ProbeTypeIcon type={probe.type} />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{probe.name}</div>
                    <div className="text-gray-500 dark:text-gray-400">{probe.type}</div>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm">
                <ProbeStatusBadge status={probe.status} />
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                {probe.lastCheck ? (
                  <div>
                    <div>{format(new Date(probe.lastCheck), 'dd/MM/yyyy', { locale: fr })}</div>
                    <div>{format(new Date(probe.lastCheck), 'HH:mm:ss', { locale: fr })}</div>
                  </div>
                ) : (
                  <span className="inline-flex items-center text-gray-400">
                    <FiClock className="mr-1 h-4 w-4" />
                    Jamais vérifié
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                {probe.type === 'HTTP' && probe.httpConfig ? (
                  <div>
                    <div className="font-medium">{probe.httpConfig.method} {probe.httpConfig.url}</div>
                    <div>Intervalle: {probe.httpConfig.checkInterval}s</div>
                  </div>
                ) : probe.type === 'WEBHOOK' && probe.webhookConfig ? (
                  <div>
                    <div className="font-medium">Token: {probe.webhookConfig.webhookToken.substring(0, 8)}...</div>
                  </div>
                ) : (
                  <span>Configuration non disponible</span>
                )}
              </td>
              <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                <div className="flex justify-end space-x-2">
                  <Link
                    href={`/servers/${serverId}/probes/${probe.id}`}
                    className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
                  >
                    Détails
                  </Link>
                  
                  {canEdit && (
                    <>
                      <Link
                        href={`/servers/${serverId}/probes/${probe.id}/edit`}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                      >
                        <FiEdit className="h-4 w-4" />
                        <span className="sr-only">Modifier</span>
                      </Link>
                      
                      <button
                        onClick={() => {
                          if (confirm(`Êtes-vous sûr de vouloir supprimer la sonde "${probe.name}" ?`)) {
                            // Appel API pour supprimer la sonde
                            // Pour l'instant, on simule juste la suppression localement
                            setLocalProbes((prev) => prev.filter((p) => p.id !== probe.id));
                          }
                        }}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <FiTrash2 className="h-4 w-4" />
                        <span className="sr-only">Supprimer</span>
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
