'use client';

import { useState } from 'react';
import { FiSend, FiAlertTriangle, FiCheckCircle, FiXCircle } from 'react-icons/fi';

type TestNotificationButtonProps = {
  notificationId: string;
  notificationName: string;
  serverId?: string;
  serverName?: string;
};

export default function TestNotificationButton({
  notificationId,
  notificationName,
  serverId,
  serverName,
}: TestNotificationButtonProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [testSuccess, setTestSuccess] = useState<boolean | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const handleTest = async () => {
    if (!serverId) {
      setTestSuccess(false);
      setTestMessage("Vous devez sélectionner un serveur pour tester la notification");
      return;
    }

    setIsTesting(true);
    setTestSuccess(null);
    setTestMessage(null);
    
    try {
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notificationConfigId: notificationId,
          serverId,
          level: "INFO",
          title: "Test de notification",
          message: `Ceci est un test de la configuration "${notificationName}"`,
          details: {
            test: true,
            serverName,
            timestamp: new Date().toISOString(),
            level: "INFO",
          },
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Une erreur est survenue lors du test de la notification');
      }

      setTestSuccess(true);
      setTestMessage("Notification de test envoyée avec succès !");
    } catch (error) {
      console.error('Error testing notification:', error);
      setTestSuccess(false);
      setTestMessage(error instanceof Error ? error.message : 'Une erreur est survenue lors du test de la notification');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
      >
        <FiSend className="-ml-1 mr-2 h-5 w-5" />
        Tester
      </button>

      {showModal && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => !isTesting && setShowModal(false)}
            ></div>

            <span className="hidden sm:inline-block sm:h-screen sm:align-middle">
              &#8203;
            </span>

            <div className="inline-block transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle dark:bg-gray-800">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10 dark:bg-blue-900">
                  <FiSend className="h-6 w-6 text-blue-600 dark:text-blue-300" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                    Tester la notification
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Envoyer une notification de test pour vérifier la configuration <span className="font-semibold">{notificationName}</span>.
                    </p>
                    
                    {!serverId && (
                      <div className="mt-4 flex items-center rounded-md bg-yellow-50 p-3 dark:bg-yellow-900/30">
                        <FiAlertTriangle className="h-5 w-5 text-yellow-500" />
                        <p className="ml-2 text-sm text-yellow-700 dark:text-yellow-400">
                          Vous devez afficher cette notification depuis une page de serveur spécifique pour pouvoir la tester.
                        </p>
                      </div>
                    )}
                    
                    {testSuccess !== null && (
                      <div className={`mt-4 flex items-center rounded-md p-3 ${
                        testSuccess 
                          ? 'bg-green-50 dark:bg-green-900/30' 
                          : 'bg-red-50 dark:bg-red-900/30'
                      }`}>
                        {testSuccess 
                          ? <FiCheckCircle className="h-5 w-5 text-green-500" /> 
                          : <FiXCircle className="h-5 w-5 text-red-500" />}
                        <p className={`ml-2 text-sm ${
                          testSuccess 
                            ? 'text-green-700 dark:text-green-400' 
                            : 'text-red-700 dark:text-red-400'
                        }`}>
                          {testMessage}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  disabled={isTesting || !serverId}
                  onClick={handleTest}
                  className="inline-flex w-full justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {isTesting ? 'Envoi en cours...' : 'Envoyer le test'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={isTesting}
                  className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
