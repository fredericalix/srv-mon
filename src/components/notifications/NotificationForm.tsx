'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiMail, FiGlobe } from 'react-icons/fi';

// Types des groupes
type Group = {
  id: string;
  name: string;
};

// Schéma de validation pour les deux types de notifications
const emailSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  type: z.literal("EMAIL"),
  groupId: z.string().min(1, "Le groupe est requis"),
  recipients: z.array(z.string().email("Email invalide")).min(1, "Au moins un destinataire est requis"),
});

const webhookSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  type: z.literal("WEBHOOK"),
  groupId: z.string().min(1, "Le groupe est requis"),
  url: z.string().url("L'URL du webhook doit être valide"),
  headers: z.string().optional(),
  payload: z.string().optional(),
});

// Union des deux schémas
const notificationSchema = z.discriminatedUnion("type", [
  emailSchema,
  webhookSchema,
]);

// Types pour le formulaire
type NotificationFormValues = z.infer<typeof emailSchema> | z.infer<typeof webhookSchema>;

type NotificationFormProps = {
  groups: Group[];
  initialData?: {
    id: string;
    name: string;
    type: string;
    groupId: string;
    emailConfig?: {
      recipients: string[];
    } | null;
    webhookConfig?: {
      url: string;
      headers: Record<string, string> | null;
      payload: any | null;
    } | null;
  };
};

export default function NotificationForm({ groups, initialData }: NotificationFormProps) {
  const router = useRouter();
  
  // État pour le type de notification
  const [notificationType, setNotificationType] = useState<'EMAIL' | 'WEBHOOK'>(
    initialData?.type === 'WEBHOOK' ? 'WEBHOOK' : 'EMAIL'
  );
  
  // État pour les en-têtes et le payload du webhook (format JSON)
  const [headersJson, setHeadersJson] = useState<string>(
    initialData?.webhookConfig?.headers
      ? JSON.stringify(initialData.webhookConfig.headers, null, 2)
      : '{}'
  );
  
  const [payloadJson, setPayloadJson] = useState<string>(
    initialData?.webhookConfig?.payload
      ? JSON.stringify(initialData.webhookConfig.payload, null, 2)
      : '{}'
  );
  
  // États pour les erreurs de validation JSON
  const [headersError, setHeadersError] = useState<string | null>(null);
  const [payloadError, setPayloadError] = useState<string | null>(null);
  
  // État pour le chargement
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  // Valeurs par défaut pour le formulaire
  const defaultValues = initialData
    ? {
        name: initialData.name,
        type: initialData.type === 'WEBHOOK' ? 'WEBHOOK' : 'EMAIL',
        groupId: initialData.groupId,
        recipients: initialData.emailConfig?.recipients || [],
        url: initialData.webhookConfig?.url || '',
      }
    : {
        name: '',
        type: 'EMAIL',
        groupId: '',
        recipients: [''],
        url: '',
      };
  
  // Configuration du formulaire avec react-hook-form
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<NotificationFormValues>({
    resolver: zodResolver(
      notificationType === 'EMAIL' ? emailSchema : webhookSchema
    ),
    defaultValues,
  });
  
  // Pour manipuler les destinataires email
  const recipients = watch('recipients') || [''];
  
  const addRecipient = () => {
    setValue('recipients', [...recipients, '']);
  };
  
  const removeRecipient = (index: number) => {
    if (recipients.length > 1) {
      setValue(
        'recipients',
        recipients.filter((_, i) => i !== index)
      );
    }
  };
  
  // Validation du JSON pour les webhooks
  const validateJson = (json: string): boolean => {
    try {
      JSON.parse(json);
      return true;
    } catch (e) {
      return false;
    }
  };
  
  // Soumission du formulaire
  const onSubmit = async (data: NotificationFormValues) => {
    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      // Pour les webhooks, valider et ajouter les en-têtes et le payload
      if (data.type === 'WEBHOOK') {
        // Valider les en-têtes JSON
        if (!validateJson(headersJson)) {
          setHeadersError('Format JSON invalide pour les en-têtes');
          setIsSubmitting(false);
          return;
        }
        
        // Valider le payload JSON
        if (!validateJson(payloadJson)) {
          setPayloadError('Format JSON invalide pour le payload');
          setIsSubmitting(false);
          return;
        }
      }
      
      // Préparer les données pour l'API
      const apiData = {
        name: data.name,
        type: data.type,
        groupId: data.groupId,
        config:
          data.type === 'EMAIL'
            ? {
                recipients: data.recipients.filter(r => r.trim() !== ''),
              }
            : {
                url: data.url,
                headers: JSON.parse(headersJson),
                payload: JSON.parse(payloadJson),
              },
      };
      
      // Appel à l'API pour créer ou mettre à jour
      const url = initialData
        ? `/api/notifications/${initialData.id}`
        : '/api/notifications';
      
      const response = await fetch(url, {
        method: initialData ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Une erreur est survenue');
      }
      
      router.push('/notifications');
      router.refresh();
    } catch (error) {
      console.error('Error submitting notification:', error);
      setSubmitError(error instanceof Error ? error.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Type de notification */}
      <div>
        <label className="text-base font-medium text-gray-900 dark:text-white">
          Type de notification
        </label>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Choisissez comment vous souhaitez être notifié
        </p>
        <div className="mt-4 grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-4">
          <div 
            onClick={() => setNotificationType('EMAIL')} 
            className={`relative flex cursor-pointer rounded-lg border p-4 shadow-sm focus:outline-none ${
              notificationType === 'EMAIL'
                ? 'border-primary-500 ring-2 ring-primary-500 dark:border-primary-400 dark:ring-primary-400'
                : 'border-gray-300 dark:border-gray-700'
            }`}
          >
            <input
              type="radio"
              value="EMAIL"
              className="sr-only"
              {...register('type')}
              onChange={() => setNotificationType('EMAIL')}
              checked={notificationType === 'EMAIL'}
            />
            <div className="flex items-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                <FiMail className="h-6 w-6 text-blue-600 dark:text-blue-300" />
              </div>
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  Email
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Envoyer des notifications par email
                </div>
              </div>
            </div>
          </div>
          
          <div 
            onClick={() => setNotificationType('WEBHOOK')} 
            className={`relative flex cursor-pointer rounded-lg border p-4 shadow-sm focus:outline-none ${
              notificationType === 'WEBHOOK'
                ? 'border-primary-500 ring-2 ring-primary-500 dark:border-primary-400 dark:ring-primary-400'
                : 'border-gray-300 dark:border-gray-700'
            }`}
          >
            <input
              type="radio"
              value="WEBHOOK"
              className="sr-only"
              {...register('type')}
              onChange={() => setNotificationType('WEBHOOK')}
              checked={notificationType === 'WEBHOOK'}
            />
            <div className="flex items-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900">
                <FiGlobe className="h-6 w-6 text-purple-600 dark:text-purple-300" />
              </div>
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  Webhook
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Intégrer avec d'autres services (Slack, Discord, etc.)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Nom de la configuration */}
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Nom de la configuration
        </label>
        <div className="mt-1">
          <input
            id="name"
            type="text"
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white sm:text-sm"
            placeholder="Ex: Alertes équipe technique"
            {...register('name')}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.name.message}
            </p>
          )}
        </div>
      </div>

      {/* Groupe */}
      <div>
        <label
          htmlFor="groupId"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Groupe
        </label>
        <div className="mt-1">
          <select
            id="groupId"
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white sm:text-sm"
            {...register('groupId')}
          >
            <option value="">Sélectionnez un groupe</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          {errors.groupId && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.groupId.message}
            </p>
          )}
        </div>
      </div>

      {/* Configuration spécifique au type */}
      {notificationType === 'EMAIL' ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Destinataires
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Ajoutez les adresses email qui recevront les notifications
          </p>
          
          <div className="space-y-2">
            {recipients.map((_, index) => (
              <div key={index} className="flex items-center space-x-2">
                <input
                  type="email"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white sm:text-sm"
                  placeholder="email@exemple.com"
                  {...register(`recipients.${index}` as const)}
                />
                <button
                  type="button"
                  onClick={() => removeRecipient(index)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-400 hover:bg-gray-50 hover:text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  disabled={recipients.length <= 1}
                >
                  &times;
                </button>
              </div>
            ))}
            
            {errors.recipients && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.recipients.message}
              </p>
            )}
            
            <button
              type="button"
              onClick={addRecipient}
              className="mt-2 inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              + Ajouter un destinataire
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label
              htmlFor="url"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              URL du webhook
            </label>
            <div className="mt-1">
              <input
                id="url"
                type="url"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white sm:text-sm"
                placeholder="https://hooks.slack.com/services/..."
                {...register('url')}
              />
              {errors.url && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.url.message}
                </p>
              )}
            </div>
          </div>
          
          <div>
            <label
              htmlFor="headers"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              En-têtes HTTP (format JSON, optionnel)
            </label>
            <div className="mt-1">
              <textarea
                id="headers"
                rows={3}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white sm:text-sm"
                placeholder='{ "Content-Type": "application/json" }'
                value={headersJson}
                onChange={(e) => {
                  setHeadersJson(e.target.value);
                  setHeadersError(null);
                }}
              />
              {headersError && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {headersError}
                </p>
              )}
            </div>
          </div>
          
          <div>
            <label
              htmlFor="payload"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Payload (format JSON, optionnel)
            </label>
            <div className="mt-1">
              <textarea
                id="payload"
                rows={5}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white sm:text-sm"
                placeholder='{ "text": "Alert: ${title}" }'
                value={payloadJson}
                onChange={(e) => {
                  setPayloadJson(e.target.value);
                  setPayloadError(null);
                }}
              />
              {payloadError && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {payloadError}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Variables disponibles: ${'{title}'}, ${'{message}'}, ${'{level}'}, ${'{serverName}'}, ${'{timestamp}'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Message d'erreur global */}
      {submitError && (
        <div className="rounded-md bg-red-50 p-4 dark:bg-red-900">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Erreur lors de la soumission
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                <p>{submitError}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Boutons d'action */}
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={() => router.push('/notifications')}
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {isSubmitting
            ? 'En cours...'
            : initialData
            ? 'Mettre à jour'
            : 'Créer'}
        </button>
      </div>
    </form>
  );
}
