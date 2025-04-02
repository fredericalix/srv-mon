# SrvMon - Application de Surveillance de Serveurs

SrvMon est une application web moderne et intuitive de surveillance de serveurs, conçue pour offrir une visibilité en temps réel sur l'état de vos serveurs et services. Développée avec Next.js, Prisma et TailwindCSS, elle permet de gérer facilement vos serveurs, configurer des alertes et collaborer en équipe.

## 🌟 Fonctionnalités principales

- **Surveillance en temps réel** : Suivi de la disponibilité, des temps de réponse et des performances de vos serveurs
- **Tableaux de bord personnalisables** : Visualisez les métriques importantes selon vos besoins
- **Gestion d'utilisateurs et de groupes** : Contrôle d'accès basé sur les rôles (RBAC)
- **Système de notifications** : Alertes par email, SMS ou webhook lors d'incidents
- **Historique et rapports** : Analyse des performances et des incidents passés
- **Gestion des groupes de serveurs** : Organisation des serveurs par équipes ou projets
- **Interface responsive** : Accès depuis n'importe quel appareil

## 🛠️ Technologies utilisées

- **Frontend** : Next.js, React, TailwindCSS, HeadlessUI, React-Hook-Form
- **Backend** : API Routes Next.js, Prisma ORM
- **Base de données** : PostgreSQL
- **Authentification** : NextAuth.js
- **Déploiement** : Docker, Docker Compose

## 📋 Prérequis

- Node.js (v18 ou supérieur) ou Docker
- PostgreSQL (optionnel si vous utilisez Docker)
- npm ou yarn

## 🚀 Installation

```bash
# Cloner le dépôt
git clone https://github.com/fredericalix/srv-mon.git
cd srv-mon

# Installer les dépendances
npm install
# ou
yarn install

# Copier le fichier d'environnement d'exemple
cp .env-example .env

# Configurer les variables d'environnement dans .env
# Voir la section Configuration ci-dessous

# Migrer la base de données
npx prisma migrate dev

# Générer le client Prisma
npx prisma generate

# Lancer l'application en mode développement
npm run dev
# ou
yarn dev
```

## ⚙️ Configuration

1. Créez un fichier `.env` à partir du modèle `.env-example` fourni
2. Configurez les variables suivantes :
   - `DATABASE_URL` : URL de connexion à votre base de données PostgreSQL
   - `NEXTAUTH_URL` : URL de votre application
   - `NEXTAUTH_SECRET` : Clé secrète pour NextAuth.js
   - Variables pour les notifications (email, SMS, webhooks)

## 📊 Structure du projet

```
srv-mon/
├── prisma/                # Schéma et migrations Prisma
├── public/                # Fichiers statiques
├── src/
│   ├── app/               # Routes et API Next.js
│   │   ├── (dashboard)/   # Pages du dashboard
│   │   ├── api/           # Endpoints API
│   │   ├── auth/          # Routes d'authentification
│   ├── components/        # Composants React
│   │   ├── dashboard/     # Composants du tableau de bord
│   │   ├── groups/        # Composants de gestion des groupes
│   │   ├── servers/       # Composants de gestion des serveurs
│   │   ├── ui/            # Composants UI réutilisables
│   │   ├── users/         # Composants de gestion des utilisateurs
│   ├── lib/               # Bibliothèques et utilitaires
│   ├── services/          # Services (monitoring, notifications, etc.)
│   ├── styles/            # Styles globaux
│   ├── types/             # Types TypeScript
│   └── utils/             # Fonctions utilitaires
├── .env                   # Variables d'environnement
├── .env-example           # Exemple de fichier .env
├── Dockerfile             # Configuration Docker
├── docker-compose.yml     # Configuration Docker Compose
└── ...                    # Autres fichiers de configuration
```

## 🚦 Utilisation

1. Créez un compte administrateur avec `npx prisma db seed` ou via l'interface d'inscription
2. Connectez-vous à l'application
3. Créez des groupes pour organiser vos serveurs
4. Ajoutez des utilisateurs et assignez-les à des groupes
5. Ajoutez vos serveurs à surveiller
6. Configurez les notifications pour être alerté en cas de problème
7. Consultez votre tableau de bord pour voir l'état de vos serveurs

## 🌐 Déploiement

### Avec Docker

```bash
# Construire l'image Docker
docker build -t srv-mon .

# Exécuter le conteneur
docker run -p 3000:3000 --env-file .env srv-mon
```

### Avec Docker Compose (recommandé)

Pour un déploiement complet incluant l'application, la base de données PostgreSQL et pgAdmin :

```bash
# Démarrer tous les services
docker-compose up -d

# Voir les logs
docker-compose logs -f

# Arrêter tous les services
docker-compose down
```

#### Services inclus dans le Docker Compose :

- **SrvMon Application** : Accessible sur http://localhost:3000
- **PostgreSQL** : Base de données accessible sur le port 5432
- **pgAdmin** : Interface d'administration de la base de données accessible sur http://localhost:5050
  - Email par défaut : admin@example.com
  - Mot de passe par défaut : admin

> ⚠️ **Sécurité** : Avant tout déploiement en production, modifiez les identifiants par défaut dans le fichier `docker-compose.yml`

### Sur un serveur

Vous pouvez déployer l'application sur Vercel, Netlify, ou tout autre hébergeur compatible avec Next.js.

N'oubliez pas de configurer les variables d'environnement sur votre plateforme d'hébergement.

## 🔒 Sécurité

- Toutes les routes sont protégées par authentification
- Gestion fine des permissions basée sur les rôles
- Journalisation des actions importantes
- Chiffrement des mots de passe et des données sensibles

## 📜 Licence

[GPL-3.0](LICENSE)

## 👥 Contribution

Les contributions sont les bienvenues ! Veuillez consulter le fichier [CONTRIBUTING.md](CONTRIBUTING.md) pour plus d'informations.

## 📧 Contact

Pour toute question ou suggestion, n'hésitez pas à ouvrir une issue sur GitHub ou à nous contacter directement.

---

Développé avec ❤️ pour faciliter la surveillance de vos infrastructures.
