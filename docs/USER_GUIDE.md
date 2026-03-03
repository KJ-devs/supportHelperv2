# Support Helper — Guide Utilisateur Complet

Table des matières
- [1. Introduction](#1-introduction)
- [2. Démarrage rapide](#2-démarrage-rapide)
- [3. Architecture générale](#3-architecture-générale)
- [4. Dashboard — Guide complet](#4-dashboard--guide-complet)
- [5. Paramètres](#5-paramètres)
- [6. SDK Web — Intégration client](#6-sdk-web--intégration-client)
- [7. Référence API](#7-référence-api)
- [8. Worker et tâches en arrière-plan](#8-worker-et-tâches-en-arrière-plan)
- [9. Configuration avancée](#9-configuration-avancée)
- [10. Sécurité](#10-sécurité)
- [11. Dépannage](#11-dépannage)
- [12. Commandes utiles](#12-commandes-utiles)

---

## 1. Introduction

### Qu'est-ce que Support Helper ?

Support Helper est une **plateforme complète de gestion du support technique** basée sur l'IA. Elle permet à vos utilisateurs de signaler des bogues en capturant des vidéos d'écran, tandis que l'IA analyse automatiquement les enregistrements, génère des résumés, classifie les problèmes et propose des corrections.

### Proposition de valeur

- **Capture vidéo en un clic** — Vos utilisateurs enregistrent leur écran et signalent le bogue
- **Analyse IA automatique** — Vision par l'IA (GPT-4 Vision) extrait les étapes, classifie le type et la sévérité
- **Génération de correctifs** — Le worker crée automatiquement des branches Git, des PRs, avec analyse du code
- **Intégration GitHub** — Liaison bidirectionnelle : tickets ↔ issues GitHub, sync de statut
- **Tableau de bord moderne** — Interface Next.js 14 pour gérer les tickets, voir les analyses, affecter les développeurs
- **Multi-tenant SaaS** — Isolation complète des données par tenant, facturation par plan

### Composants de la plateforme

| Composant | Description | Tech |
|-----------|-------------|------|
| **Dashboard** | Interface interne (pour votre équipe) | Next.js 14, TailwindCSS, TanStack Query |
| **SDK Widget** | Widget de signalement (pour vos utilisateurs) | Web Component, Shadow DOM, MediaRecorder |
| **API Backend** | Services REST + WebSocket | NestJS, Prisma, PostgreSQL |
| **Worker** | Traitement asynchrone (analyse vidéo, sync GitHub) | BullMQ, FFmpeg, Tesseract OCR, OpenAI |
| **Base de données** | PostgreSQL 16 + pgvector pour recherche sémantique | PostgreSQL, Prisma ORM |
| **Stockage** | Vidéos et médias | MinIO (S3-compatible) |
| **Recherche** | Full-text et sémantique | MeiliSearch |

---

## 2. Démarrage rapide

### 2.1 Prérequis

- **Node.js** >= 20.0.0
- **pnpm** >= 8.0.0 (gestionnaire de paquets)
- **Docker** & **Docker Compose** (services d'infrastructure)
- **Git**

### 2.2 Installation (5 minutes)

```bash
# 1. Cloner le dépôt
git clone https://github.com/votre-org/support-helper.git
cd support-helper

# 2. Installer les dépendances
pnpm install

# 3. Configurer l'environnement
cp .env.example .env.local
# Éditer .env.local et ajouter vos clés API (voir section 9)

# 4. Démarrer l'infrastructure (PostgreSQL, Redis, MinIO, MeiliSearch)
pnpm docker:up

# 5. Initialiser la base de données
pnpm db:migrate       # Appliquer les migrations
pnpm db:seed          # Injecter les données de test

# 6. Lancer tous les services
pnpm dev
```

Après l'étape 6, vous avez :
- **Dashboard** → http://localhost:3000
- **API** → http://localhost:3001
- **Docs API** → http://localhost:3001/api/docs
- **MinIO Console** → http://localhost:9001

### 2.3 Premiers pas

1. Ouvrez http://localhost:3000 et connectez-vous
   - Email : `owner@test.local`
   - Mot de passe : `password123`

2. **Créez votre première application** (Settings → Applications)
   - Notez la **SDK key** générée (format : `sk_...`)

3. **Installez le widget SDK** sur votre site client
   ```html
   <support-helper sdk-key="sk_..." api-url="https://api.example.com" position="bottom-right"></support-helper>
   ```

4. **Testez le widget** — Cliquez sur le bouton, enregistrez un bogue, soumettez

5. **Vérifiez le ticket** — Retournez au Dashboard, allez à Tickets, vous devez voir votre rapport

---

## 3. Architecture générale

### Diagramme de flux

```
┌─────────────────────────────────────────────────────────────────────┐
│  CLIENTS (VOS UTILISATEURS)                                         │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Votre site web avec SDK Widget intégré                    │    │
│  │  <support-helper sdk-key="..." position="bottom-right">    │    │
│  └────────────────┬─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                    │
                    │ POST /api/sdk/tickets/report
                    │ (multipart FormData : title, description, video)
                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│  BACKEND (VOTRE INFRASTRUCTURE)                                     │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  API (NestJS)                                                │   │
│  │  • POST /api/sdk/tickets/report                             │   │
│  │  • POST /api/media/upload-url (pré-signed S3)              │   │
│  │  • GET /api/tickets, PUT /api/tickets/:id                  │   │
│  │  • WebSocket: /tickets, /agent, /agent-tasks               │   │
│  └─────┬──────────────────────────────────────────┬───────────┘   │
│        │                                            │                │
│        ↓                                            ↓                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐   │
│  │ PostgreSQL 16   │  │ Redis 7         │  │ MinIO / S3       │   │
│  │ • Tenants       │  │ • Queues (BullMQ)  │ • Vidéos         │   │
│  │ • Users         │  │ • Cache         │  │ • Images         │   │
│  │ • Tickets       │  │ • Sessions      │  │ • Médias         │   │
│  │ • Integrations  │  │                 │  │                  │   │
│  └─────────────────┘  └─────────────────┘  └──────────────────┘   │
│        ↑                                                              │
│        │                                                              │
│  ┌─────┴───────────────────────────────────────────────────────┐   │
│  │  Worker (BullMQ)                                             │   │
│  │  • analyze-video: FFmpeg → Tesseract OCR → GPT-4 Vision     │   │
│  │  • github-sync: Lecture/écriture issues GitHub              │   │
│  │  • index-codebase: Embedding du code (OpenAI Embeddings)    │   │
│  │  • deep-analysis: Agent autonome avec accès au code         │   │
│  │  • send-notifications: Email via Resend                     │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Meilisearch (Recherche full-text)                           │   │
│  │  • Index de tous les tickets                                │   │
│  │  • Recherche rapide par titre, description, keywords        │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
         ↑                                              ↑
         │                                              │
         │   Naveguer / Gérer                          │
         │   les tickets                                │
         │                                              │
┌────────┴──────────────────────────────────────────────┴───────────┐
│  DASHBOARD (Next.js 14 App Router)                                 │
│  • Connexion utilisateur (JWT)                                    │
│  • Voir les tickets, affecter, changer le statut                  │
│  • Configurer les intégrations (GitHub, Slack, Jira, etc.)       │
│  • Analyser les tendances (Analytics)                             │
│  • Paramètres : profil, équipe, facturation, SSO                  │
│  • Aperçu du widget (Demo SDK)                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Tableau des ports

| Service | Port | URL | Description |
|---------|------|-----|-------------|
| **Dashboard** | 3000 | http://localhost:3000 | Interface Next.js |
| **API** | 3001 | http://localhost:3001 | Backend NestJS |
| **Docs API** | 3001 | http://localhost:3001/api/docs | Swagger UI |
| **Worker** | 3003 | (interne) | Jobs BullMQ |
| **PostgreSQL** | 5432 | PostgreSQL | Base de données |
| **Redis** | 6379 | Redis | Cache + Queues |
| **MinIO API** | 9000 | MinIO S3 | Stockage objets |
| **MinIO Console** | 9001 | http://localhost:9001 | Web MinIO |
| **MeiliSearch** | 7700 | http://localhost:7700 | Recherche |
| **MailHog UI** | 8025 | http://localhost:8025 | Emails (dev) |
| **MailHog SMTP** | 1025 | SMTP | Interception emails |

### Stack technologique

| Couche | Technologies |
|--------|--------------|
| **Frontend** | Next.js 14, React 19, TailwindCSS, TypeScript 5.7 |
| **État client** | TanStack Query, Zustand, Socket.io Client |
| **Backend** | NestJS 10, TypeScript strict, Prisma ORM |
| **Base de données** | PostgreSQL 16 + pgvector (embeddings) |
| **Queues** | BullMQ, Redis 7 |
| **Stockage** | MinIO / AWS S3 (compatible) |
| **Recherche** | MeiliSearch v1.11 |
| **IA/ML** | OpenAI GPT-4 Vision, Anthropic Claude, Google Gemini |
| **Intégrations** | GitHub, Jira, Slack, HubSpot, Notion |
| **Monitoring** | Sentry, PostHog, Better Stack |
| **Testing** | Jest (API/Worker), Vitest (Dashboard) |

---

## 4. Dashboard — Guide complet

### 4.1 Connexion et inscription

#### Inscription (premier utilisateur)

Si c'est votre première utilisation, allez à http://localhost:3000/auth/register et créez un compte :

- **Email** : votre adresse email
- **Nom** : votre nom complet
- **Mot de passe** : au moins 8 caractères
- **Nom du tenant** : le nom de votre organisation

Vous recevrez deux tokens JWT :
- **Access token** : valide 30 minutes
- **Refresh token** : valide 30 jours

#### Connexion

POST /api/auth/login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

Réponse :
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "User Name",
    "role": "owner"
  }
}
```

#### Réinitialisation de mot de passe

Allez à http://localhost:3000/auth/forgot-password :
1. Entrez votre email
2. Vous recevrez un lien par email (via MailHog en dev)
3. Cliquez le lien et définissez un nouveau mot de passe

#### SSO (Enterprise)

Si votre tenant supporte SSO, des boutons **Connexion SAML** ou **OpenID Connect** apparaissent sur la page de connexion. Voir section 5.8.

### 4.2 Assistant de configuration (Setup Wizard)

À la première connexion, un assistant guidé se lance :

1. **Compte admin** — Confirmez votre profil utilisateur
2. **Clé IA** — Configurez OpenAI ou Anthropic Claude
3. **GitHub** — Connectez votre compte GitHub (optionnel)
4. **Email** — Configurer les notifications (SMTP/Resend)
5. **Résumé** — Aperçu de la configuration

Vous pouvez ignorer et configurer manuellement plus tard dans Settings.

### 4.3 Tableau de bord (Overview)

Le dashboard principal affiche :

- **Cartes KPI** — Nombre de tickets (nouveaux, ouverts, résolus), tendance du mois
- **Tickets récents** — Liste des 10 derniers tickets avec statut et sévérité
- **Utilisation de l'IA** — Coût et tokens utilisés ce mois-ci
- **Liens rapides** — Accès rapide aux sections principales

Navigation via menu latéral gauche (sticky) :
- Tableau de bord (Overview)
- Tickets
- Agent IA
- Tâches IA
- Applications
- Intégrations
- GitHub
- Analytics
- Settings

### 4.4 Gestion des tickets

#### Vue liste des tickets

Allez à **Tickets** pour voir tous les tickets de votre application.

**Filtres disponibles :**
- **Statut** — new, open, in_progress, analyzing, analyzed, triaged, resolved, closed, etc.
- **Sévérité** — critical, high, medium, low
- **Type** — bug, feature_request, question, documentation, performance, security
- **Période** — Aujourd'hui, Cette semaine, Ce mois, Tous
- **Recherche** — Full-text sur titre et description

**Actions en masse :**
- Sélectionner plusieurs tickets (checkbox)
- Affecter à un développeur
- Changer le statut
- Changer la sévérité

#### Vue détail d'un ticket

Cliquez sur un ticket pour voir ses détails complets.

**Layout (écran large) :**
- **Gauche** — Informations du ticket
  - Titre, description
  - Statut (dropdown pour changer)
  - Sévérité, type, priorité
  - Date de création, reporter
  - Affectation à un développeur
  - Actions : Assigner, Mettre à jour le statut, Ajouter un commentaire

- **Droite** — Analyse IA
  - **Résumé IA** (aiSummary) — Résumé automatique généré par GPT-4 Vision
  - **Analyse détaillée** (aiAnalysis) — JSON structuré avec étapes, type détecté, sévérité
  - **Mots-clés** — Tags automatiques extraits de la vidéo
  - **Confiabilité** — Scores de confiance pour le type et la sévérité (0.00-1.00)
  - **Vidéo** — Lecteur vidéo intégré

**Statuts de ticket :**
```
new → open → in_progress → analyzing → analyzed → triaged → fix_proposed → resolved → merged → closed

ou

escalated → waiting_response → pending
```

| Statut | Description |
|--------|-------------|
| **new** | Ticket reçu, pas encore examiné |
| **open** | Examiné, confirmé comme bogue |
| **in_progress** | En cours de correction |
| **analyzing** | Worker analyse la vidéo |
| **analyzed** | Analyse IA complète |
| **triaged** | Classé (type + sévérité confirmés) |
| **fix_proposed** | Une PR de correction a été créée |
| **resolved** | Bogue corrigé |
| **merged** | PR fusionnée |
| **closed** | Ticket clôturé |
| **escalated** | Remontée à l'équipe |
| **waiting** | En attente (infos supplémentaires, etc.) |

**Sévérités :**
- **critical** — Perte de données, app crash, sécurité critique
- **high** — Fonctionnalité majeure cassée, impact utilisateur fort
- **medium** — Fonctionnalité partielle cassée, workaround possible
- **low** — Bogue mineur, impact utilisateur faible

**Types :**
- **bug** — Défaut de fonctionnement
- **feature_request** — Demande de feature
- **question** — Question utilisateur
- **documentation** — Erreur documentaire
- **performance** — Problème de performance
- **security** — Problème de sécurité

#### Contexte utilisateur

Chaque ticket capture le contexte utilisateur :

```json
{
  "url": "https://app.example.com/dashboard",
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0",
  "screenResolution": "1920x1080",
  "viewport": "1920x1080",
  "timezone": "Europe/Paris",
  "language": "fr",
  "timestamp": "2025-03-02T14:30:00Z",
  "storageAvailable": true
}
```

### 4.5 Agent IA (Conversation)

Allez à **Agent IA** pour démarrer une conversation avec l'assistant IA sur un ticket.

**V1 (Diagnostic basique) :**
- Comprendre le problème en posant des questions
- Extraire plus d'infos de la vidéo
- Suggérer des causes possibles

**V2 (Analyse approfondie avec codebase) :**
- Accès au code (via embeddings)
- Analyse des dépendances et architecture
- Propositions de fixes détaillées
- Génération de snippets de code

**Utilisation :**

1. Ouvrez un ticket
2. Allez à l'onglet "Agent IA"
3. Posez une question (ex: "Pourquoi l'app crash au login ?")
4. L'IA répond en analysant la vidéo et le code
5. Continuez la conversation (5 messages par défaut)

Les messages passent par WebSocket et sont temps réel.

### 4.6 Tâches IA autonomes (Agent Tasks)

Allez à **Tâches IA** pour voir les processus autonomes lancés par l'IA.

**Pipeline complet :**

```
1. ANALYZE (worker:analyze-video)
   ↓
2. PLAN (agent propose un plan de correction)
   ↓
3. CODE (agent génère le code)
   ↓
4. REVIEW (agent review sa propre génération)
   ↓
5. PR (agent crée une PR GitHub)
```

**Workflow :**

1. Un ticket à sévérité critique ou haute → tâche créée automatiquement
2. **Status** : `pending` → `analyzing` → `plan_ready` → `code_ready` → `review_ready` → `pr_created`
3. Un humain **approuve ou rejette** la PR suggérée
4. Si approuvée → PR fusionnée à `main`
5. Si rejetée → tâche fermée, feedback enregistré

**Columns affichées :**
- Ticket ID
- Status
- Plan (résumé du plan proposé)
- Code (résumé des changements)
- Actions (Approuver, Rejeter, Voir PR)

### 4.7 Applications

Allez à **Settings → Applications** pour gérer vos applications SDK.

**Créer une application :**

1. Cliquez "+ Nouvelle application"
2. Entrez :
   - **Nom** : ex "Mon App Web"
   - **Plateforme** (optionnel) : web, mobile, electron
3. Cliquez "Créer"
4. Une **SDK key** est générée automatiquement (format `sk_live_...`)

**Pour chaque application :**
- Voir la SDK key (cliquez "Copier")
- Régénérer la SDK key (invalide l'ancienne)
- Stats : nombre de tickets reçus, dernière activité
- Supprimer l'application

**Intégration à votre site :**

```html
<!-- Insérez ce widget dans votre HTML -->
<script src="https://cdn.support-helper.com/v1/sdk.iife.js"></script>
<support-helper
  sdk-key="sk_live_xxxxx"
  api-url="https://api.support-helper.com"
  position="bottom-right"
  primary-color="#6366f1"
  theme="auto"
></support-helper>
```

Voir section 6 pour détails SDK.

### 4.8 Intégrations tierces

Allez à **Intégrations** pour connecter des services externes.

**Services supportés :**
- **GitHub** — Créer/lire issues, sync bidirectionnelle
- **Jira** — Sync tickets ↔ tâches Jira
- **Slack** — Notifications de nouveaux tickets
- **HubSpot** — Intégration CRM
- **Notion** — Archivage des tickets

**Configuration générale :**

1. Cliquez sur le service
2. **Connecter** — Autoriser via OAuth ou API key
3. **Configurer** — Paramètres spécifiques (ex: canal Slack)
4. **Tester** — Un bouton pour envoyer un test
5. **Logs de sync** — Historique des synchronisations

**Chiffrement :** Les credentials (tokens API) sont chiffrés en base de données avec `INTEGRATION_ENCRYPTION_KEY`.

### 4.9 GitHub

Allez à **GitHub** pour configurer l'intégration GitHub avancée.

**Deux méthodes :**

#### A. OAuth (Legacy)
- Connectez votre compte GitHub personnel
- Lisez/écrivez issues dans vos repos
- Plus simple mais moins de permissions

#### B. GitHub App (Recommandé)
- Installez une GitHub App personnalisée sur votre org
- Permissions granulaires (issues, pulls, contents)
- Webhooks pour événements (push, PR, etc.)

**Configuration OAuth :**

1. Allez à https://github.com/settings/developers
2. Créez une nouvelle OAuth App
3. URL de callback : `https://api.support-helper.com/api/github/oauth/callback`
4. Copiez Client ID et Secret
5. Dans Settings → GitHub, collez les valeurs

**Configuration GitHub App :**

1. Allez à https://github.com/settings/apps/new
2. Créez une app avec :
   - Webhook URL : `https://api.support-helper.com/api/github/webhooks`
   - Permissions : Issues (read/write), Pull requests (read/write), Contents (read)
3. Générez une clé privée (fichier .pem)
4. Dans Settings → GitHub, collez App ID et clé privée

**Linking de repos :**

Pour chaque application Support Helper, vous pouvez lier un repo GitHub :

1. Applications → Sélectionnez l'app
2. Settings → GitHub repo : `owner/repo`
3. Sauvegardez

**Sync bidirectionnelle :**
- Ticket créé → Issue GitHub créée automatiquement (si config)
- Issue GitHub fermée → Ticket mis à jour
- PR créée automatiquement par l'Agent pour les bogues critiques

**Événements webhook :**
- `push` — Nouveau commit
- `pull_request` — PR ouverte/fermée
- `issues` — Issue créée/fermée
- Chaque événement met à jour les tickets liés

### 4.10 Analytiques

Allez à **Analytics** pour voir les tendances.

**Dashboards :**

1. **Overview**
   - Nombre total de tickets (ce mois, 7j, 30j)
   - Moyenne de temps de résolution
   - Répartition par statut
   - Répartition par sévérité

2. **Tendances**
   - Graphique temporel (7j/30j/90j/all)
   - Tickets par jour
   - Temps moyen de résolution

3. **Performance IA**
   - % de tickets analyzés avec succès
   - Temps moyen d'analyse
   - Coût des appels IA

4. **Équipe**
   - Tickets assignés par développeur
   - Charge de travail

**Export :**
Télécharger les données en CSV pour analyse externe.

### 4.11 Démo SDK

Allez à **Settings → Démo SDK** pour tester le widget directement dans le dashboard.

**Panneau de configuration :**
- SDK key (dropdown, sélectionnez l'app)
- URL de l'API
- Position du widget (bottom-right, bottom-left, top-right, top-left)
- Couleur primaire (hex picker)
- Thème (auto, light, dark)
- z-index (stacking order)

**Test :**
1. Cliquez le widget (coin bas-droit)
2. Cliquez "Enregistrer"
3. Interagissez avec la page, parlez, bougez la souris
4. Cliquez "Arrêter"
5. Visualisez la vidéo et soumettez

Le ticket est créé dans l'app sélectionnée.

---

## 5. Paramètres

### 5.1 Profil et sécurité

Allez à **Settings → Profil**.

**Éditer le profil :**
- Nom complet
- Adresse email
- Photo de profil (optionnel)

**Sécurité :**
- **Changer le mot de passe** — Tapez l'ancien, puis le nouveau (2x)
- **Sessions actives** — Liste de tous les appareils connectés, déconnectez à distance
- **Authentification multi-facteurs (2FA)** — Optionnel, TOTP (Google Authenticator, etc.)

### 5.2 Équipe

Allez à **Settings → Équipe**.

**Rôles (hiérarchie) :**

| Rôle | Permissions |
|------|-------------|
| **owner** | Tous les droits, gestion facturation, SSO, audit |
| **admin** | Gérer utilisateurs, applications, intégrations |
| **member** | Voir tickets, assigner, commenter |
| **viewer** | Voir tickets en lecture seule |

**Inviter des utilisateurs :**

1. Cliquez "+ Inviter"
2. Entrez email et sélectionnez le rôle
3. Un lien d'invitation est envoyé par email
4. L'utilisateur clique et crée son compte

**Gérer les utilisateurs :**
- Voir la liste
- Changer le rôle
- Révoquer l'accès (supprimer)

### 5.3 Notifications

Allez à **Settings → Notifications**.

**Préférences :**
- [ ] Nouveau ticket
- [ ] Changement de statut
- [ ] Commentaire sur un ticket assigné
- [ ] Rapport hebdomadaire
- [ ] Alertes sévérité critique

**Canaux :**
- Email (adresse de votre profil)
- Slack (si intégration configurée)

**Fréquence :**
- Temps réel, Digest quotidien, Digest hebdo

### 5.4 Facturation

Allez à **Settings → Facturation**.

**Plans disponibles :**

| Plan | Coût | Analyses IA/mois | Utilisateurs | Intégrations |
|------|------|------------------|--------------|--------------|
| **Free** | 0€ | 10 | 1 | Base |
| **Pro** | 49€ | 100 | 5 | Tous sauf SSO |
| **Enterprise** | 199€ | 1000+ | Illimité | SSO, audit logs |

**Upgrade :**

1. Cliquez "Upgrade to Pro/Enterprise"
2. Vous êtes redirigé vers Stripe Checkout
3. Entrez vos infos de paiement
4. Accès immédiat aux features

**Gestion :**

- **Stripe Portal** — Gérer la facturation (reçus, changement de carte, désinscription)
- **Utilisation actuelle** — Analyses consommées ce mois (bar) et tendance

**Webhooks :**
- Upgrade : `customer.subscription.created`
- Renouvellement : `invoice.payment_succeeded`
- Annulation : `customer.subscription.deleted`

Chaque webhook met à jour votre `Tenant.plan` et `Tenant.stripeCustomerId`.

### 5.5 Configuration IA (BYOK)

Allez à **Settings → Configuration IA**.

Par défaut, Support Helper utilise vos clés API configurées dans `.env.local`. Vous pouvez aussi **apporter vos propres clés** (BYOK) par tenant.

**Fournisseurs supportés :**

| Fournisseur | Modèles | Cas d'usage |
|-------------|---------|-----------|
| **Anthropic (Claude)** | Claude 3.5 Sonnet, Opus, Haiku | Analyse vidéo (Vision), conversations |
| **OpenAI** | GPT-4 Turbo, GPT-4o, 4o mini | Analyse vidéo (Vision), embeddings |
| **Google Gemini** | Gemini 1.5 Pro, Flash | Vision, multimodal |
| **AWS Bedrock** | Claude via Bedrock | Entreprise, audit compliance |
| **Ollama** | Modèles locaux | Self-hosted, pas d'API key |

**Configuration :**

1. Sélectionnez le fournisseur
2. Entrez la clé API (chiffrée en base)
3. Sélectionnez le modèle (ex: `claude-3-5-sonnet-20241022`)
4. Définissez :
   - **Quota mensuel** (ex: 100 000 tokens)
   - **Budget maximal** (€, ex: 50€)
5. Cliquez "Tester"

**Validation :**
Le système valide :
- Format de la clé
- Accès à l'API
- Disponibilité du modèle

**Consommation :**
- Usage tracker en temps réel
- Coût estimé
- Circuit-breaker : si budget atteint → plus d'analyse jusqu'au reset

### 5.6 Utilisation IA

Allez à **Settings → Utilisation IA**.

**Dashboard de coûts :**

```
Anthropic Claude    : 1,234 tokens (0.42€)
OpenAI GPT-4o       : 5,678 tokens (2.15€)
Google Gemini       : 234 tokens (0.05€)
─────────────────────────────────
TOTAL CE MOIS       : 7,146 tokens (2.62€)
BUDGET MENSUEL      : 50.00€
UTILISATION         : 5.24%
```

**Breakdown quotidien :**
- Graphique linéaire des tokens/jour
- Moyenne par ticket

**Exportation :**
- CSV des appels IA (timestamp, model, tokens, cost)

### 5.7 GitHub App Settings

Allez à **Settings → GitHub App**.

**Installation :**
- Bouton "Installer l'app GitHub"
- Redirige vers github.com
- Sélectionnez l'org et repos
- Confirmez

**Configuration Agent :**

```json
{
  "mode": "autonomous",  // ou "approval_required"
  "maxRetries": 3,
  "timeoutSeconds": 300,
  "autoMerge": false,
  "mergeStrategy": "squash"
}
```

**Merge settings :**
- [ ] Auto-merge les PRs créées par l'Agent (après approval)
- Stratégie de merge : squash, rebase, ou merge commit
- Require code review : [ ] Exiger des reviews
- Nombre de reviews requises

**Issue template :**
Personnalisez le template des issues créées par l'Agent :

```markdown
## Bug Report from Support Helper
**Ticket**: {{ ticketId }}
**Reporter**: {{ reporterName }}
**Severity**: {{ severity }}

### Description
{{ description }}

### Steps to Reproduce
{{ reproductionSteps }}

### Environment
{{ userContext.userAgent }}
{{ userContext.screenResolution }}

### Video Analysis
{{ aiSummary }}
```

### 5.8 SSO (Enterprise)

Allez à **Settings → SSO** (visible si plan = Enterprise).

#### SAML 2.0

1. **Télécharger les métadonnées**
   - URL : `https://api.support-helper.com/api/saml/metadata`
   - Fichier XML pour votre IdP (Okta, Azure AD, etc.)

2. **Configurer l'IdP**
   - Assertion Consumer Service (ACS) URL : `https://api.support-helper.com/api/saml/acs`
   - Nameformat : `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress`
   - Attributes requis : email, displayName

3. **Dans Support Helper**
   - Entrypoint (Login URL de l'IdP)
   - Issuer (Entity ID de l'IdP)
   - Certificate (certificat publique X.509)
   - Tester

#### OpenID Connect

1. **Configurer le provider**
   - OIDC Authority : `https://votre-provider.com`
   - Client ID et Secret
   - Scopes : `openid profile email`
   - Redirect URI : `https://api.support-helper.com/api/oidc/callback`

2. **Mapping des rôles** (optionnel)
   ```json
   {
     "admin_group": "admin",
     "viewer_group": "viewer"
   }
   ```

3. **Auto-provisioning**
   - [ ] Créer automatiquement les utilisateurs de l'IdP
   - [ ] Auto-assigner un rôle par défaut (member)

### 5.9 Plan et utilisation

Allez à **Settings → Plan & Utilisation**.

**Comparaison de plans :**

| Feature | Free | Pro | Enterprise |
|---------|------|-----|-----------|
| Analyses/mois | 10 | 100 | 1000+ |
| Users | 1 | 5 | Illimité |
| GitHub Integration | ✓ | ✓ | ✓ |
| Slack Integration | - | ✓ | ✓ |
| Jira Integration | - | ✓ | ✓ |
| SSO | - | - | ✓ |
| Audit Logs | - | - | ✓ |
| Support | Email | Email | Phone |

**Barres d'utilisation :**
- Analyses IA (X/Y utilisées ce mois)
- Stockage vidéos (X GB/Y GB)
- Requêtes API (X k/jour)

**Alertes :**
- [ ] Notifier si 80% du quota atteint
- [ ] Notifier si 100% (blocage)

### 5.10 Licence

Allez à **Settings → Licence**.

Affiche la comparaison des plans et les limites actuelles.

### 5.11 Statut système

Allez à **Settings → Statut système** (admin+ uniquement).

**Health checks (auto-refresh 30s) :**

```
PostgreSQL         : ✓ OK (Latency: 12ms)
Redis              : ✓ OK (Latency: 2ms)
MinIO              : ✓ OK (Latency: 45ms)
Meilisearch        : ✓ OK (Latency: 8ms)
OpenAI API         : ✓ OK
Anthropic API      : ✓ OK
```

**Actions :**
- Re-lancer un test immédiatement
- Voir les logs (si problème)

### 5.12 Logs d'audit (Enterprise)

Allez à **Settings → Audit Logs** (visible si plan = Enterprise).

**Filtres :**
- Acteur (utilisateur qui a fait l'action)
- Action (create, update, delete, etc.)
- Ressource (ticket, application, integration)
- Plage de dates

**Colonnes :**
- Timestamp
- Acteur (email)
- Action
- Ressource (type + ID)
- Détails (avant/après JSON)
- Adresse IP

**Export :**
- CSV de tous les logs

Exemple log :
```json
{
  "timestamp": "2025-03-02T14:30:00Z",
  "actor": "john@example.com",
  "action": "ticket_status_updated",
  "resource": "ticket:abc-123",
  "details": {
    "before": { "status": "new" },
    "after": { "status": "open" }
  },
  "ipAddress": "192.168.1.100"
}
```

### 5.13 Backup et restauration

Allez à **Settings → Backup & Restore**.

**Backup manuel :**
1. Cliquez "Créer un backup"
2. Sélectionnez :
   - [ ] Inclure les vidéos (attention : lourd)
   - [ ] Inclure l'index Meilisearch
3. Cliquez "Lancer"
4. Téléchargez (format tar.gz)

**Historique des backups :**
- Date, taille, inclusions
- Bouton "Restaurer" pour chaque backup

**Configuration automatique :**
- Fréquence : Aucune, Quotidienne, Hebdo
- Rétention : 7, 30, 90 jours
- S3 bucket (pour stockage cloud)

---

## 6. SDK Web — Intégration client

### 6.1 Installation

#### Option 1 : npm / yarn / pnpm

```bash
# npm
npm install @support-helper/sdk-web

# yarn
yarn add @support-helper/sdk-web

# pnpm
pnpm add @support-helper/sdk-web
```

#### Option 2 : CDN (Script tag)

```html
<!-- Mettez à jour v1 avec la dernière version -->
<script src="https://cdn.support-helper.com/v1/sdk.iife.js"></script>
```

Le script expose automatiquement une classe `SupportHelper` globale.

### 6.2 Web Component (HTML)

La façon la plus simple : utiliser le Web Component `<support-helper>`.

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.support-helper.com/v1/sdk.iife.js"></script>
</head>
<body>
  <!-- Widget intégré -->
  <support-helper
    sdk-key="sk_live_xxxxxxxxxxxxx"
    api-url="https://api.support-helper.com"
    position="bottom-right"
    primary-color="#6366f1"
    theme="auto"
  ></support-helper>

  <h1>Mon app</h1>
  <p>Le widget est visible dans le coin bas-droit !</p>
</body>
</html>
```

**Attributs :**

| Attribut | Type | Défaut | Description |
|----------|------|--------|-------------|
| `sdk-key` | string | (requis) | Clé SDK de votre application |
| `api-url` | string | (requis) | URL de l'API backend |
| `position` | enum | `bottom-right` | `bottom-right`, `bottom-left`, `top-right`, `top-left` |
| `primary-color` | hex | `#6366f1` | Couleur primaire du widget |
| `theme` | enum | `auto` | `auto`, `light`, `dark` |
| `z-index` | number | `9999` | Stacking order |
| `disabled` | boolean | `false` | Masquer le widget |

### 6.3 Utilisation programmatique (JS/TS)

Pour plus de contrôle, instanciez `SupportHelper` directement.

```javascript
import { SupportHelper } from '@support-helper/sdk-web';

// Créer une instance
const sh = new SupportHelper({
  sdkKey: 'sk_live_xxxxxxxxxxxxx',
  apiUrl: 'https://api.support-helper.com',
  position: 'bottom-right',
  primaryColor: '#6366f1',
  theme: 'auto',
});

// Attacher au DOM
sh.attach(document.body);

// Démarrer l'enregistrement
document.getElementById('start-btn').addEventListener('click', async () => {
  try {
    await sh.startRecording();
    console.log('Recording started');
  } catch (error) {
    console.error('Failed to start recording:', error);
  }
});

// Arrêter et obtenir la vidéo
document.getElementById('stop-btn').addEventListener('click', async () => {
  const videoBlob = await sh.stopRecording();
  console.log('Video blob:', videoBlob);
});

// Soumettre le rapport
document.getElementById('submit-btn').addEventListener('click', async () => {
  try {
    const ticketId = await sh.reportWithVideo({
      title: 'Bug Report',
      description: 'Something went wrong...',
      video: videoBlob, // optionnel
    });
    console.log('Ticket created:', ticketId);
  } catch (error) {
    console.error('Failed to submit report:', error);
  }
});

// Nettoyer
sh.destroy();
```

### 6.4 React Integration

```javascript
import React from 'react';
import { SupportHelperWidget, useSupportHelper } from '@support-helper/sdk-web/react';

function MyApp() {
  const sh = useSupportHelper({
    sdkKey: 'sk_live_xxxxx',
    apiUrl: 'https://api.support-helper.com',
  });

  return (
    <div>
      <SupportHelperWidget {...sh.config} />
      <h1>Mon app React</h1>

      <button onClick={() => sh.startRecording()}>
        Start Recording
      </button>
      <button onClick={() => sh.stopRecording()}>
        Stop Recording
      </button>
      <button
        onClick={() => sh.report({
          title: 'Bug',
          description: 'Help me!',
        })}
      >
        Report Issue
      </button>
    </div>
  );
}
```

### 6.5 Vue Integration

```vue
<script setup>
import { SupportHelperWidget, useSupportHelper } from '@support-helper/sdk-web/vue';

const sh = useSupportHelper({
  sdkKey: 'sk_live_xxxxx',
  apiUrl: 'https://api.support-helper.com',
});
</script>

<template>
  <div>
    <SupportHelperWidget v-bind="sh.config" />

    <h1>Mon app Vue</h1>

    <button @click="sh.startRecording">Start</button>
    <button @click="sh.stopRecording">Stop</button>
    <button @click="sh.report({ title: 'Bug', description: 'Help!' })">
      Report
    </button>
  </div>
</template>
```

### 6.6 Machine d'état du widget

Le widget suit une machine d'état stricte :

```
┌─────────────────────────────────────────────────────────────┐
│                       IDLE (initial)                         │
│  Widget fermé, bouton visible                               │
└────────────────┬──────────────────────────────────────────┘
                 │ user clicks widget
                 ↓
        ┌────────────────┐
        │     OPEN       │
        │ Form visible   │
        └────┬───────────┘
             │ user clicks "Enregistrer"
             ↓
        ┌────────────────────────┐
        │   RECORDING            │
        │ Vidéo en cours         │
        │ Timer visible          │
        └────┬───────────────────┘
             │ user clicks "Arrêter"
             ↓
        ┌────────────────────────┐
        │   PREVIEW              │
        │ Vidéo montrée          │
        │ Edit/Retake options    │
        └────┬───────────────────┘
             ├─ user clicks "Refaire"
             │  ↓ (retour à OPEN)
             │
             └─ user clicks "Continuer"
                ↓
        ┌────────────────────────┐
        │   EDITING              │
        │ Form + vidéo           │
        │ Title, description     │
        └────┬───────────────────┘
             │ user clicks "Soumettre"
             ↓
        ┌────────────────────────┐
        │   SUBMITTING           │
        │ Upload en cours        │
        │ Progress bar           │
        └────┬───────────────────┘
             ├─ upload réussi
             │  ↓
             │  ┌─────────────────────┐
             │  │   ANALYZING         │
             │  │ Worker traite vidéo │
             │  └────┬────────────────┘
             │       ↓
             │  ┌──────────────────┐
             │  │   SUCCESS        │
             │  │ Message succès   │
             │  └──────┬───────────┘
             │         │ auto-close
             │         ↓ (IDLE)
             │
             └─ upload échoué
                ↓
        ┌────────────────────────┐
        │   ERROR                │
        │ Message d'erreur       │
        │ Bouton "Réessayer"     │
        └────┬───────────────────┘
             │ user clicks "Réessayer"
             ↓
             (retour à EDITING)
```

**Événements DOM :**

Écoutez les événements du widget :

```javascript
const widget = document.querySelector('support-helper');

widget.addEventListener('sh:open', () => console.log('Widget opened'));
widget.addEventListener('sh:close', () => console.log('Widget closed'));
widget.addEventListener('sh:recording-start', () => console.log('Recording started'));
widget.addEventListener('sh:recording-stop', () => console.log('Recording stopped'));
widget.addEventListener('sh:submit', (e) => {
  console.log('Submitted:', e.detail.ticketId);
});
widget.addEventListener('sh:error', (e) => {
  console.error('Error:', e.detail.message);
});
widget.addEventListener('sh:queued', () => {
  console.log('Report queued (offline mode)');
});
widget.addEventListener('sh:queue-flushed', () => {
  console.log('Offline queue synced');
});
```

### 6.7 Personnalisation visuelle

**Couleurs et styles :**

```html
<support-helper
  sdk-key="sk_live_xxxxx"
  api-url="https://api.support-helper.com"
  position="bottom-right"
  primary-color="#3b82f6"
  theme="dark"
  z-index="9999"
></support-helper>
```

Le widget utilise une Shadow DOM pour l'isolation des styles. Les variables CSS supportées :

```css
--sh-primary-color: #6366f1;
--sh-background: #ffffff;
--sh-text-color: #000000;
--sh-border-radius: 8px;
--sh-shadow: 0 10px 25px rgba(0,0,0,0.1);
```

### 6.8 Contexte utilisateur capturé

Le SDK capture automatiquement le contexte pour chaque ticket :

```json
{
  "url": "https://app.example.com/dashboard",
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "screenResolution": { "width": 1920, "height": 1080 },
  "viewport": { "width": 1920, "height": 1080 },
  "timezone": "Europe/Paris",
  "language": "fr-FR",
  "timestamp": "2025-03-02T14:30:00Z",
  "storageAvailable": true,
  "cookiesEnabled": true,
  "localStorage": true,
  "sessionStorage": true
}
```

### 6.9 Mode hors-ligne

Si l'utilisateur perd connexion, le widget met en file d'attente les rapports dans IndexedDB.

**Comportement :**

1. Utilisateur soumet un rapport (connexion perdue)
2. Widget affiche "En attente de connexion"
3. Rapport stocké localement (IndexedDB)
4. Quand connexion revient → auto-sync
5. Utilisateur reçoit confirmation

**Limites :**
- Max 50 rapports en file d'attente
- Max 500 MB au total
- Expirent après 30 jours

**Retry logic :**
- 1ère tentative : immédiat
- 2e tentative : après 5 secondes
- 3e+ : backoff exponentiel, max 10 tentatives
- Après 10 tentatives : notification d'erreur

### 6.10 Enregistrement vidéo

**Codecs supportés (priorité) :**

1. VP9 + Opus (WebM, meilleure compression)
2. VP8 + Vorbis (WebM)
3. H.264 + AAC (MP4)
4. Fallback générique

Le navigateur choisit automatiquement le codec disponible.

**Options d'enregistrement :**

```javascript
await sh.startRecording({
  videoBitsPerSecond: 2500000, // 2.5 Mbps
  audioBitsPerSecond: 128000,   // 128 kbps
  frameRate: 30,                // 30 FPS
});
```

**Pause/Reprise :**

```javascript
// Pause l'enregistrement (sans arrêter)
sh.pauseRecording();

// Reprendre
sh.resumeRecording();

// Arrêter et obtenir le blob
const blob = await sh.stopRecording();
```

**Taille et durée :**
- Résolution : up to 4K (limité par navigateur)
- Durée max : pas de limite technique, mais ~30 min recommend
- Taille typique : 30 secondes ≈ 5-10 MB

---

## 7. Référence API

### 7.1 Authentification

#### POST /api/auth/register

Créer un compte et tenant.

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "name": "John Doe",
    "tenantName": "My Organization"
  }'
```

Réponse `201` :
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "owner"
  }
}
```

#### POST /api/auth/login

Connexion avec email/mot de passe.

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

#### POST /api/auth/refresh

Obtenir un nouveau access token.

```bash
curl -X POST http://localhost:3001/api/auth/refresh \
  -H "Authorization: Bearer $REFRESH_TOKEN"
```

#### GET /api/auth/me

Obtenir l'utilisateur courant.

```bash
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### 7.2 Tickets

#### GET /api/tickets

Lister les tickets du tenant.

```bash
curl "http://localhost:3001/api/tickets?status=new&severity=critical&page=1&limit=20" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Query params :**
- `status` — Filter par statut
- `severity` — Filter par sévérité
- `type` — Filter par type
- `search` — Full-text search
- `page` — Numéro de page (défaut : 1)
- `limit` — Résultats par page (défaut : 20)
- `sortBy` — createdAt, severity, priority (défaut : createdAt)
- `order` — asc ou desc

#### GET /api/tickets/:id

Obtenir un ticket spécifique.

```bash
curl http://localhost:3001/api/tickets/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

#### PUT /api/tickets/:id

Mettre à jour un ticket.

```bash
curl -X PUT http://localhost:3001/api/tickets/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress",
    "severity": "high",
    "assignedTo": "user-uuid"
  }'
```

#### POST /api/tickets/:id/timeline

Obtenir l'historique (comments, status changes).

```bash
curl http://localhost:3001/api/tickets/550e8400-e29b-41d4-a716-446655440000/timeline \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### 7.3 Médias

#### POST /api/media/upload-url

Obtenir une URL pré-signée pour uploader une vidéo.

```bash
curl -X POST http://localhost:3001/api/media/upload-url \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "video.webm",
    "contentType": "video/webm",
    "size": 5242880
  }'
```

Réponse :
```json
{
  "id": "media-uuid",
  "uploadUrl": "http://localhost:9000/videos/media-uuid?X-Amz-Algorithm=...",
  "expiresIn": 3600
}
```

#### POST /api/media/:id/confirm

Confirmer qu'une vidéo a été uploadée.

```bash
curl -X POST http://localhost:3001/api/media/media-uuid/confirm \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Le worker commence alors l'analyse.

### 7.4 Endpoints SDK

#### POST /api/sdk/tickets/report

Créer un ticket via le widget SDK.

```bash
curl -X POST http://localhost:3001/api/sdk/tickets/report \
  -H "x-sdk-key: sk_live_xxxxx" \
  -F "title=App crashes on login" \
  -F "description=Happens every time" \
  -F "video=@video.webm" \
  -F "userContext={...}"
```

La vidéo est encodée en multipart FormData.

#### GET /api/sdk/tickets/:id

Lire un ticket avec SDK key.

```bash
curl http://localhost:3001/api/sdk/tickets/ticket-uuid \
  -H "x-sdk-key: sk_live_xxxxx"
```

### 7.5 WebSocket

Connectez-vous via Socket.io pour les mises à jour en temps réel.

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001', {
  auth: {
    token: accessToken,
  },
});

// Écouter les mises à jour de tickets
socket.on('ticket:created', (ticket) => {
  console.log('New ticket:', ticket);
});

socket.on('ticket:updated', (ticket) => {
  console.log('Ticket updated:', ticket);
});

// Messages de l'Agent
socket.on('agent:message', (msg) => {
  console.log('Agent:', msg.content);
});

// Status des tâches Agent
socket.on('agent-task:status-changed', (task) => {
  console.log('Task status:', task.status);
});
```

---

## 8. Worker et tâches en arrière-plan

Le Worker est un service BullMQ qui traite les jobs asynchrones.

### 8.1 Queues principales

| Queue | Description | Exemple |
|-------|-------------|---------|
| `analyze-video` | Analyse vidéo → OCR → IA Vision | Extrait étapes, classifie |
| `github-sync` | Sync tickets ↔ issues GitHub | Read/write issues |
| `index-codebase` | Index code pour embeddings | Copie, chunking, embedding |
| `deep-analysis` | Agent autonome | Code review, fix generation |
| `send-notifications` | Email, Slack | Alert utilisateurs |
| `sync-integrations` | Sync Jira, HubSpot, etc. | Bi-sync |

### 8.2 Pipeline d'analyse vidéo

```
1. Video téléchargée
   ↓
2. Job: extract-frames
   ├─ FFmpeg extrait keyframes
   ├─ Résolution : 1280x720
   └─ Interval : 1 frame / 2 secondes
   ↓
3. Job: ocr-frames
   ├─ Tesseract OCR sur chaque frame
   ├─ Détecte texte (UI labels, errors)
   └─ Compile résumé OCR
   ↓
4. Job: vision-analysis
   ├─ Envoie frames + OCR à GPT-4 Vision
   ├─ Passe système : "Analyser ce bug report. Donner étapes de repro, type, sévérité"
   └─ Reçoit : summary, type, severity, confidence scores, keywords
   ↓
5. Update Ticket
   ├─ aiSummary ← Résumé généré
   ├─ aiAnalysis ← JSON struct (étapes, infos)
   ├─ type ← Détecté (bug, feature_request, etc.)
   ├─ severity ← Détecté (critical, high, etc.)
   ├─ typeConfidence ← Score (0.0-1.0)
   ├─ severityConfidence ← Score
   ├─ keywords ← Array de tags
   └─ status ← analyzed
   ↓
6. Index Meilisearch
   └─ Ticket devient searchable
```

**Temps typique :** 30-60 secondes pour une vidéo de 30 secondes

### 8.3 Pipeline d'Agent autonome

Si un ticket a sévérité critical/high ET GitHub App est connecté :

```
1. Ticket created with aiAnalysis
   ↓
2. Agent Task created (status: pending)
   ↓
3. Plan Generation
   ├─ Agent lit la vidéo + analysis
   ├─ Accède au code (embeddings)
   ├─ Propose un plan de correction
   └─ Status → plan_ready
   ↓
4. Code Generation
   ├─ Agent génère le code
   ├─ Crée une branche Git
   └─ Status → code_ready
   ↓
5. Code Review
   ├─ Agent review sa propre génération
   ├─ Cherche les bugs, anti-patterns
   └─ Status → review_ready
   ↓
6. PR Creation
   ├─ Agent crée une PR GitHub
   ├─ Ajoute description, links à ticket
   └─ Status → pr_created
   ↓
7. Attendre approbation humaine
   ├─ Utilisateur revoit la PR
   ├─ Approuve ou rejette
   └─ Status → approved ou rejected
   ↓
8. Merge (si auto-merge activé)
   ├─ Merge PR (strategy: squash/rebase)
   └─ Ticket statut → merged
```

**Timeouts :** Chaque étape a un timeout (défaut 300s). Pas de retry automatique si timeout.

### 8.4 Dead Letter Queue (DLQ)

Si un job échoue 3 fois, il va à la Dead Letter Queue.

```
Failed Job
  ↓
Retry 1 (fail) → Retry 2 (fail) → Retry 3 (fail)
  ↓
Dead Letter Queue
```

**Actions :**
- Admin peut voir les DLQ jobs
- Bouton "Rejeu" (retry) manuellement
- Email d'alerte si `DLQ_ALERT_EMAIL` configuré

**Exemple job en erreur :**
```json
{
  "id": "analyze-video-uuid",
  "queue": "analyze-video",
  "error": "FFmpeg: codec not found",
  "timestamp": "2025-03-02T14:30:00Z",
  "attempts": 3,
  "ticket": "ticket-uuid"
}
```

---

## 9. Configuration avancée

### 9.1 Variables d'environnement

Créez un fichier `.env.local` à la racine du projet. Voir `.env.example` pour la liste complète.

**Catégories principales :**

#### Base de données
```
DATABASE_URL=postgresql://user:pass@localhost:5432/support_helper
POSTGRES_USER=support
POSTGRES_PASSWORD=support123
POSTGRES_DB=support_helper
```

#### Redis
```
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=           # Optionnel en dev
```

#### JWT (Auth)
```
JWT_SECRET=<32 hex chars>           # openssl rand -hex 32
JWT_REFRESH_SECRET=<32 hex chars>
JWT_EXPIRES_IN=30m
JWT_REFRESH_EXPIRES_IN=30d
```

#### IA / Modèles
```
# Anthropic Claude (recommandé)
ANTHROPIC_API_KEY=sk-ant-xxxxx

# OpenAI (fallback)
OPENAI_API_KEY=sk-xxxxx
EMBEDDING_MODEL=text-embedding-3-small

# Google Gemini (optionnel)
GOOGLE_GENERATIVE_AI_KEY=xxxxx

# AWS Bedrock (optionnel)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxxxx
AWS_SECRET_ACCESS_KEY=xxxxx
```

#### Stockage (S3 / MinIO)
```
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=videos
S3_REGION=us-east-1
```

#### Recherche (MeiliSearch)
```
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_MASTER_KEY=masterkey_dev_only
```

#### Email
```
# Dev: MailHog (capture tout)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@support-helper.local

# Prod: Resend API
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=support@yourdomain.com
```

#### GitHub
```
# OAuth (legacy)
GITHUB_CLIENT_ID=xxxxx
GITHUB_CLIENT_SECRET=xxxxx
GITHUB_WEBHOOK_SECRET=<32 hex chars>

# GitHub App (recommandé)
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_APP_NAME=my-app-slug
```

#### Chiffrement
```
ENCRYPTION_KEY=<64 hex chars>              # Données sensibles
INTEGRATION_ENCRYPTION_KEY=<64 hex chars>  # Credentials intégrations
```

#### App Config
```
NODE_ENV=development
API_PORT=3001
DASHBOARD_PORT=3000
DASHBOARD_URL=http://localhost:3000
API_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001
```

#### Monitoring
```
# Sentry
SENTRY_DSN=https://xxxxx@sentry.io/xxxxxx
SENTRY_RELEASE=1.0.0
SENTRY_TRACES_SAMPLE_RATE=0.1
NEXT_PUBLIC_SENTRY_DSN=...

# Better Stack (logs)
BETTERSTACK_SOURCE_TOKEN=xxxxx

# PostHog (analytics)
POSTHOG_API_KEY=xxxxx
POSTHOG_HOST=https://app.posthog.com
NEXT_PUBLIC_POSTHOG_KEY=...
```

#### Billing (Stripe)
```
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

#### Backup
```
BACKUP_PATH=./backups
BACKUP_RETENTION_DAYS=7
BACKUP_SKIP_MEDIA=false
BACKUP_BUCKET=my-backups-s3
NOTIFICATION_WEBHOOK=https://hooks.slack.com/...
```

### 9.2 Services Docker

Démarrez l'infrastructure avec :

```bash
pnpm docker:up
```

**Services lancés :**

| Service | Image | Port | Notes |
|---------|-------|------|-------|
| PostgreSQL 16 | postgres:16-alpine | 5432 | + pgvector, uuid-ossp extensions |
| Redis 7 | redis:7.4-alpine | 6379 | Cache + job queue |
| MinIO | minio/minio | 9000/9001 | S3-compatible storage |
| MeiliSearch | getmeili/meilisearch | 7700 | Full-text search |
| MailHog | mailhog/mailhog | 8025/1025 | Email interception (dev) |

**Arrêter tout :**
```bash
pnpm docker:down
```

**Nettoyer les volumes (perte de données) :**
```bash
pnpm docker:down -v
```

### 9.3 Multi-tenant

Chaque **tenant** est une organisation isolée :

- **Isolation des données** — Requêtes filtrées par `tenantId`
- **SDK keys par tenant** — Chaque app a une clé unique
- **Rate limiting par tenant** — 50 tickets/min par tenant (configurable)
- **Facturation par tenant** — Plan, stripe customer ID

**En tant que développeur :**
- Toute requête API déduit le `tenantId` du JWT (claims)
- Toute requête SDK déduit le `tenantId` via la SDK key
- Jamais de requête cross-tenant

**Exemple requête :**
```sql
SELECT * FROM tickets
WHERE tenant_id = $1  -- Always!
AND id = $2
```

### 9.4 Rate Limiting

Trois tiers de limites :

| Tier | Limite | Endpoints |
|------|--------|-----------|
| **Public** | 10 req/min | `/api/auth/register`, `/api/auth/login` |
| **Authenticated** | 100 req/min | Tout endpoint JWT |
| **SDK** | 50 req/min | `/api/sdk/*` endpoints |

Basé sur IP (public) ou User ID (auth/SDK).

Configuration via `.env.local` :
```
RATE_LIMIT_WHITELIST=127.0.0.1,::1,192.168.1.100
```

---

## 10. Sécurité

### 10.1 Authentification

**JWT (Dashboard users) :**
- Algorithme : HS256
- Access token lifetime : 30 minutes (par défaut)
- Refresh token lifetime : 30 jours
- Stocké en httpOnly cookie (frontend)

**SDK Keys :**
- Format : `sk_live_` ou `sk_test_`
- Unique par application
- Passées dans header `x-sdk-key`
- Jamais stockées côté client en plain text

### 10.2 Chiffrement

**At Rest :**
- Credentials d'intégrations (GitHub token, Jira key) → AES-256-GCM avec `INTEGRATION_ENCRYPTION_KEY`
- Données sensibles → AES-256-GCM avec `ENCRYPTION_KEY`

**In Transit :**
- HTTPS en production (TLS 1.3+)
- CORS configuré pour origins approuvées

### 10.3 SSO / SAML / OIDC

Voir section 5.8 pour détails complets.

### 10.4 RBAC (Role-Based Access Control)

Rôles :
- **owner** — Tous les droits
- **admin** — Gérer utilisateurs + apps
- **member** — Voir/commenter tickets
- **viewer** — Lecture seule

Implémenté via decorateurs NestJS :
```typescript
@UseGuards(JwtAuthGuard)
@RequireRole('admin') // Guard custom
getTickets() { ... }
```

### 10.5 Audit Logs (Enterprise)

Voir section 5.12 pour activation.

### 10.6 CORS

Configuré dans `apps/api/src/main.ts` :

```typescript
app.enableCors({
  origin: process.env.DASHBOARD_URL,
  credentials: true,
});
```

En production, mettez à jour `DASHBOARD_URL` avec votre domaine.

---

## 11. Dépannage

### Problème : "Prisma client not generated"

```bash
# Solution : Générer Prisma client
pnpm db:generate
```

C'est nécessaire quand vous changez `schema.prisma`.

### Problème : "Port already in use"

Un service utilise déjà le port (3000, 3001, etc.).

```bash
# Trouver le processus
lsof -i :3001

# Tuer le processus
kill -9 <PID>

# Ou utiliser des ports différents
API_PORT=3010 pnpm dev
```

### Problème : "CORS error"

Le frontend et backend ont des domaines différents.

**Vérifier :**
```bash
# Dans .env.local
DASHBOARD_URL=http://localhost:3000
API_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Problème : "SDK widget not showing"

Le widget n'apparaît pas sur la page.

**Checklist :**
1. [ ] SDK script est chargé → Inspecteur console
2. [ ] SDK key est valide → Copiez depuis dashboard
3. [ ] API URL est correcte → `http://localhost:3001` ou votre domaine
4. [ ] Web Component est dans le HTML → `<support-helper ...>`
5. [ ] z-index assez haut → défaut 9999

**Debug :**
```javascript
// Console du navigateur
const widget = document.querySelector('support-helper');
console.log(widget); // Doit afficher l'élément

if (window.SupportHelper) {
  console.log('SDK loaded');
} else {
  console.error('SDK not loaded');
}
```

### Problème : "Video analysis failing"

Le worker ne peut pas analyser la vidéo.

**Cause probable :** Clé IA manquante

**Vérifier :**
```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-xxxxx    # OU
OPENAI_API_KEY=sk-xxxxx

# Logs du worker
docker logs support-helper-worker
```

**Solution :**
- Ajouter clé API dans `.env.local`
- Redémarrer l'app `pnpm dev`
- Relancer le job DLQ

### Problème : "Integration encryption error"

Les credentials d'intégration ne peuvent pas être chiffrés.

**Cause :** `INTEGRATION_ENCRYPTION_KEY` manquante ou invalide

**Solution :**
```bash
# Générer une clé
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Ajouter à .env.local
INTEGRATION_ENCRYPTION_KEY=<la_sortie_ci-dessus>

# Redémarrer
pnpm dev
```

### Problème : "GitHub App JWT fails"

L'authentification GitHub App échoue.

**Cause :** Format de clé privée incorrect

**Solution :**
```bash
# Clé privée depuis GitHub
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA...
...
-----END RSA PRIVATE KEY-----

# Dans .env.local, remplacer newlines par \n
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----"
```

### Problème : "Stripe billing disabled"

Le plan est toujours "free", pas d'upgrade possible.

**Solution :**
```bash
# .env.local
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Redémarrer
pnpm dev
```

### Problème : "Build fails"

La compilation échoue.

```bash
# Solution 1 : Nettoyer le cache Turbo
pnpm clean

# Solution 2 : Réinstaller
pnpm install

# Solution 3 : Build spécifique
pnpm --filter @support-helper/api build
pnpm --filter @support-helper/dashboard build
pnpm --filter @support-helper/sdk-web build

# Vérifier les erreurs
pnpm lint
```

---

## 12. Commandes utiles

### Démarrage et arrêt

| Commande | Description |
|----------|-------------|
| `pnpm dev` | Lancer tous les services (API, Dashboard, Worker) |
| `pnpm build` | Compiler tous les packages |
| `pnpm docker:up` | Démarrer l'infrastructure (DB, Redis, etc.) |
| `pnpm docker:down` | Arrêter l'infrastructure |

### Base de données

| Commande | Description |
|----------|-------------|
| `pnpm db:migrate` | Appliquer les migrations Prisma |
| `pnpm db:generate` | Générer Prisma Client |
| `pnpm db:studio` | Ouvrir Prisma Studio (GUI) |
| `pnpm db:seed` | Injecter les données de test |
| `pnpm db:reset` | Reset DB (perte de données !) |

### Linting et formatting

| Commande | Description |
|----------|-------------|
| `pnpm lint` | Linter tout (ESLint) |
| `pnpm format` | Formatter tout (Prettier) |
| `pnpm type-check` | TypeScript type checking |

### Testing

| Commande | Description |
|----------|-------------|
| `pnpm test` | Lancer tous les tests |
| `pnpm --filter @support-helper/api test` | Tests API (Jest) |
| `pnpm --filter @support-helper/api test:e2e` | E2E tests API |
| `pnpm --filter @support-helper/dashboard test` | Tests Dashboard (Vitest) |

### Package spécifique

| Commande | Description |
|----------|-------------|
| `pnpm --filter @support-helper/api dev` | Lancer juste l'API |
| `pnpm --filter @support-helper/dashboard dev` | Lancer juste le Dashboard |
| `pnpm --filter @support-helper/sdk-web build:cdn` | Compiler le SDK pour CDN |

### Nettoyage

| Commande | Description |
|----------|-------------|
| `pnpm clean` | Supprimer tous les node_modules et builds |
| `pnpm docker:down -v` | Arrêter et supprimer les volumes Docker |

---

## Ressources supplémentaires

- **API Interactive** → http://localhost:3001/api/docs (Swagger)
- **Prisma Studio** → `pnpm db:studio`
- **MinIO Console** → http://localhost:9001 (minioadmin/minioadmin)
- **MailHog** → http://localhost:8025
- **GitHub** → https://github.com/votre-org/support-helper

---

## Support

Pour les questions ou problèmes :
1. Consultez la section [Dépannage](#11-dépannage)
2. Vérifiez les logs : `docker logs support-helper-api`, `docker logs support-helper-worker`
3. Ouvrez une issue sur GitHub avec les logs et reproduction steps
