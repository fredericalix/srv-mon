"use client";

import {
  FiServer,
  FiActivity,
  FiCheckCircle,
  FiAlertTriangle,
  FiAlertCircle,
  FiHelpCircle,
} from "react-icons/fi";

interface StatusSummaryProps {
  stats: {
    totalServers: number;
    totalProbes: number;
    statusCounts: {
      OK: number;
      WARNING: number;
      ERROR: number;
      UNKNOWN: number;
    };
  };
}

export default function DashboardStatusSummary({ stats }: StatusSummaryProps) {
  // Calculer le pourcentage d'état OK
  const calculateHealthPercentage = () => {
    const { OK, WARNING, ERROR, UNKNOWN } = stats.statusCounts;
    const total = OK + WARNING + ERROR + UNKNOWN;
    
    if (total === 0) return 0;
    
    // Considérer OK comme sain, WARNING comme partiellement sain
    return Math.round(((OK + WARNING * 0.5) / total) * 100);
  };

  const healthPercentage = calculateHealthPercentage();
  
  // Déterminer la couleur en fonction du pourcentage
  const getHealthColor = () => {
    if (healthPercentage >= 90) return "text-success";
    if (healthPercentage >= 70) return "text-warning";
    return "text-danger";
  };
  
  const healthColor = getHealthColor();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {/* Carte santé globale */}
      <div className="card flex justify-between border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Santé globale
          </span>
          <span className={`text-2xl font-bold ${healthColor}`}>
            {healthPercentage}%
          </span>
        </div>
        <div className="flex h-full items-center">
          <FiActivity className={`h-8 w-8 ${healthColor}`} />
        </div>
      </div>

      {/* Carte nombre de serveurs */}
      <div className="card flex justify-between border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Serveurs
          </span>
          <span className="text-2xl font-bold text-gray-800 dark:text-white">
            {stats.totalServers}
          </span>
        </div>
        <div className="flex h-full items-center">
          <FiServer className="h-8 w-8 text-gray-400" />
        </div>
      </div>

      {/* Cartes pour chaque statut */}
      <div className="card flex justify-between border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col">
          <span className="text-sm text-gray-500 dark:text-gray-400">OK</span>
          <span className="text-2xl font-bold text-success">
            {stats.statusCounts.OK}
          </span>
        </div>
        <div className="flex h-full items-center">
          <FiCheckCircle className="h-8 w-8 text-success" />
        </div>
      </div>

      <div className="card flex justify-between border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Avertissements
          </span>
          <span className="text-2xl font-bold text-warning">
            {stats.statusCounts.WARNING}
          </span>
        </div>
        <div className="flex h-full items-center">
          <FiAlertTriangle className="h-8 w-8 text-warning" />
        </div>
      </div>

      <div className="card flex justify-between border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Erreurs
          </span>
          <span className="text-2xl font-bold text-danger">
            {stats.statusCounts.ERROR}
          </span>
        </div>
        <div className="flex h-full items-center">
          <FiAlertCircle className="h-8 w-8 text-danger" />
        </div>
      </div>
    </div>
  );
}
