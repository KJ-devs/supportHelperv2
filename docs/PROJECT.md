# PROJECT.MD - Support Helper Platform

> Document de suivi technique - Analyse complète, roadmap et changelog prévisionnel.
> Dernière mise a jour : 2026-02-10

---

## 1. Etat des lieux (Ce qui est fait)

### 1.1 Architecture Globale

**Monorepo TypeScript** gere par **pnpm workspaces** + **Turborepo**, compose de :

| Package | Framework | Port | Etat |
|---------|-----------|------|------|
| `apps/api` | NestJS 10 + Prisma | 3001 | Fonctionnel |
| `apps/dashboard` | Next.js 14 (App Router) | 3000 | Fonctionnel (legacy) |
| `apps/web` | Next.js 15 (App Router + Turbopack) | 3002 | Fonctionnel (principal) |
| `apps/worker` | NestJS + BullMQ | - | Fonctionnel |
| `packages/sdk-web` | Vite + Web Component | - | Fonctionnel |
| `packages/shared` | TypeScript pur | - | Fonctionnel |
| `packages/database` | Prisma utilities | - | Fonctionnel |

**Infrastructure Docker** (`docker-compose.yml`) :
- PostgreSQL 16 + pgvector
- Redis 7.4 (queues BullMQ + cache)
- MeiliSearch 1.11 (recherche full-text)
- MinIO (stockage S3-compatible : videos, screenshots, exports)
- MailHog (testing email SMTP)

---

### 1.2 Backend API (NestJS) - Fonctionnalites implementees

#### Modules Core
- **Auth** : Login/Register JWT, refresh tokens, guards (`JwtAuthGuard`, `SdkKeyGuard`, `TenantGuard`, `RolesGuard`)
- **Users** : CRUD utilisateurs, roles (admin/member)
- **Tenants** : Isolation multi-tenant complete, middleware `TenantContext`
- **Applications** : Gestion des apps clientes avec SDK keys uniques
- **Health** : Endpoint de health check

#### Modules Metier (`src/modules/`)
- **Tickets** : CRUD complet (create, findAll, findOne, update, delete, assign, stats, search, findSimilar)
  - Validation Zod (DTOs)
  - Filtres avances + pagination
  - Recherche MeiliSearch
  - Recherche vectorielle de tickets similaires (pgvector)
  - Auto-indexation MeiliSearch a la creation
  - Lancement automatique analyse IA a la creation
  - Sync automatique vers integrations tierces
- **Media** : Upload presigne S3/MinIO, confirmation, gestion du cycle de vie (`pending` -> `processing` -> `completed` -> `failed`)
- **Agent AI** : Sessions conversationnelles IA par ticket
  - Machine a etats : `analyzing` -> `needs_info` / `proposing` / `waiting` / `escalated`
  - WebSocket Gateway (Socket.io, namespace `/agent`)
  - Events : `join-session`, `send-message`, `typing`, `leave-session`
  - Emits : `new-message`, `agent-typing`, `session-update`
  - Escalade automatique vers humain si confiance < 50%
- **Analytics** : Statistiques et metriques (tickets par jour, par type, par severite, temps de resolution, confiance IA)
- **Feedback** : Corrections humaines sur les classifications IA (pour boucle d'apprentissage)
- **GitHub** : OAuth, repos, webhooks, liaison tickets <-> GitHub Issues
- **Integrations** : Architecture provider extensible
  - Providers implementes : **Slack**, **Discord**, **Notion**, **HubSpot**, **Jira**
  - Chiffrement des credentials (AES + IV)
  - Sync queue asynchrone (BullMQ, 3 retries, backoff exponentiel)
  - Logs de synchronisation

#### Infrastructure
- **Rate Limiting** : Throttler global (short/medium/long)
- **Monitoring** : Sentry, PostHog, BetterStack, Correlation ID middleware
- **Config** : Validation d'env via Zod, configs typees (app, db, jwt, s3, github, openai, meilisearch, monitoring)
- **Swagger** : Documentation API auto-generee a `/api/docs`

---

### 1.3 Worker (BullMQ) - Pipeline implemente

| Worker | Queue | Description |
|--------|-------|-------------|
| `VideoAnalysisWorker` | `video-analysis` | Pipeline complet : S3 download -> FFmpeg keyframes -> Tesseract OCR (batch) -> YOLO v11 UI detection -> GPT-4o Vision -> Embeddings (text-embedding-3-large) -> Update DB -> Index MeiliSearch |
| `GithubSyncWorker` | `github-sync` | Synchronisation tickets <-> GitHub Issues |
| `IntegrationSyncWorker` | `integration-sync` | Sync vers Slack/Discord/Notion/HubSpot/Jira |
| `AgentWorker` | `agent` | Traitement asynchrone des taches agent IA |

Services worker :
- `FFmpegService` : Extraction keyframes (1 frame/sec)
- `OCRService` : Tesseract OCR parallelise
- `YoloService` : Detection UI YOLO v11
- `OpenAIService` : GPT-4o Vision + Embeddings
- `S3Service` : Download/upload S3
- `MeilisearchService` : Indexation full-text
- `EmailService` : Notifications via Resend/MailHog

---

### 1.4 Frontend Web (Next.js 15) - `apps/web`

**UI Stack** : TailwindCSS, Radix UI, Lucide Icons, Recharts, TipTap, next-themes (dark mode)

#### Pages implementees
| Route | Composant | Etat |
|-------|-----------|------|
| `/` | Landing page | OK |
| `/login` | Formulaire login | OK |
| `/register` | Formulaire inscription | OK |
| `/(dashboard)` | Overview (cards, trends, quick actions, recent tickets) | OK |
| `/(dashboard)/tickets` | Liste + DataTable + filtres avances + recherche MeiliSearch | OK |
| `/(dashboard)/tickets/new` | Formulaire creation ticket (simple + avance) | OK |
| `/(dashboard)/tickets/[id]` | Detail ticket (header, tabs, timeline, video, sidebar, actions) | OK |
| `/(dashboard)/analytics` | Dashboard analytique complet (7 charts) | OK (mock data) |
| `/(dashboard)/github` | GitHub repos, issues, sync status | OK |
| `/(dashboard)/settings` | General, integrations, notifications, team | OK |

#### Composants cles
- **Layout** : Sidebar collapsible (Zustand store) + Header avec theme toggle, notifications, user menu
- **Tickets** : DataTable TanStack, filtres a facettes, actions bulk, recherche, video player
- **Analytics** : 7 charts Recharts (tickets/jour, par type, par severite, resolution trend, top apps, confiance IA)
- **Settings** : 4 onglets (general, integrations, notifications, equipe)
- **UI** : Design system complet (button, card, badge, input, select, tabs, toast, dialog, dropdown, sheet, skeleton, separator, checkbox, avatar, tooltip, popover, calendar, file-upload, rich-text-editor)

#### Etat management
- **Zustand** : `sidebar-store`, `ticket-store`, `ticket-table-store`
- **TanStack Query** : Hooks (`use-auth`, `use-analytics`, `use-meilisearch`)
- **API Client** : Wrapper fetch avec JWT auto-injection, error handling

---

### 1.5 Frontend Dashboard (Next.js 14) - `apps/dashboard`

> Note : Ce dashboard est la version **legacy**. `apps/web` est la version principale plus complete.

#### Pages : login, signup, dashboard, tickets, tickets/[id], tickets/[id]/chat, applications, integrations, github, analytics, settings
#### Composants : Chat agent (ChatInput, ChatMessage, AgentStatus, EscalationBanner, SessionInfo), VideoPlayer, GlobalSearch, TicketTable, ApplicationCard/Modal, IntegrationCard/Modal, Analytics (PieChart, BarChart, StatsCard), ExportButton
#### API Layer : Axios client avec interceptors (auth, agent, analytics, applications, github, integrations, tickets)
#### Auth : Context custom avec JWT (pas next-auth)

---

### 1.6 SDK Web (`packages/sdk-web`)

- **Classe principale** : `SupportHelper`
- **Web Component** : `<support-helper>` avec Shadow DOM
- **State Machine** : `idle` -> `open` -> `recording` -> `preview` -> `editing` -> `submitting` -> `success`/`error`
- **Video Recording** : MediaRecorder API, detection codec automatique
- **Context Capture** : OS, navigateur, viewport, metadata
- **API Client** : POST `/api/sdk/tickets/report` (multipart FormData, header `x-sdk-key`)
- **Offline Queue** : IndexedDB
- **Builds** : ESM/CJS (Vite) + CDN IIFE (`vite.config.cdn.ts`)
- **Framework bindings** : React + Vue wrappers

---

### 1.7 Packages partages

- **`packages/shared`** : Types TypeScript (User, Ticket, Media, Tenant), constantes (severity, ticket-status), utils (validation)
- **`packages/database`** : Client Prisma, schemas Zod, tests de schema validation

---

### 1.8 Tests existants

| Package | Framework | Fichiers |
|---------|-----------|----------|
| `apps/api` | Jest | `agent.service.spec.ts`, `analytics.service.spec.ts`, `integrations-crypto.service.spec.ts`, `integrations.service.spec.ts`, `openai.service.spec.ts` (worker) |
| `apps/dashboard` | Vitest | `VideoPlayer.test.tsx` |
| `apps/web` | Vitest + Playwright | `button.spec.tsx`, `use-auth.spec.tsx`, E2E |
| `packages/shared` | Vitest | `severity.spec.ts`, `ticket-status.spec.ts`, `validation.spec.ts` |
| `packages/database` | Vitest | `migrations.test.ts`, `schema.test.ts` |
| `packages/sdk-web` | Vitest | `recorder.test.ts`, `uploader.test.ts` |

---

## 2. Roadmap (Ce qu'il reste a faire)

### 2.1 MVP - Taches restantes pour finaliser

- [ ] **Analytics : Connecter aux vraies API** - `apps/web/src/hooks/use-analytics.ts` utilise des mock data (generateurs aleatoires). Connecter aux endpoints `GET /api/analytics/*`.
- [ ] **Auth Web : Renouvellement token** - Le hook `use-auth.ts` stocke les tokens en `localStorage` sans refresh automatique. Implementer le refresh token flow.
- [ ] **Notifications : Backend** - Le bouton notifications dans le Header est present mais n'a pas de backend (pas de modele Notification en Prisma, pas d'endpoint).
- [ ] **Recherche Header Web** - La barre de recherche dans le Header (`apps/web`) est un `<Input>` non fonctionnel. La connecter a MeiliSearch (comme `GlobalSearch` dans le dashboard legacy).
- [ ] **Profil utilisateur** - Le menu utilisateur a un lien "Profile" mais pas de page dediee.
- [ ] **Tests E2E** - Completer les tests Playwright pour les parcours critiques (login, creation ticket, analyse video).
- [ ] **SDK : Tests d'integration** - Tester le SDK dans un vrai navigateur (upload video, offline queue).
- [ ] **Worker : Gestion d'erreur avancee** - Dead letter queue, alerting Sentry sur echecs pipeline.
- [ ] **Consolidation des 2 dashboards** - `apps/dashboard` (legacy) et `apps/web` ont des fonctionnalites qui se chevauchent. Fusionner vers `apps/web`.

### 2.2 Nouvelles features demandees

#### Feature : Command Center (`Ctrl + K`) - Chat Agent

- [ ] **Frontend : Composant `CommandCenter`** - Modal/overlay qui s'ouvre avec `Ctrl + K` (ou `Cmd + K` sur Mac)
  - Interface chat minimaliste style Claude.ai
  - Champ de saisie avec parsing de commandes naturelles
  - Historique de conversation dans le contexte de la session
  - Indicateur de typing agent (streaming)
  - Auto-complete des commandes disponibles
  - Affichage des resultats d'actions (confirmation, erreurs)

- [ ] **Backend : Logique de traitement des commandes tickets par l'agent**
  - Nouveau endpoint `POST /api/agent/command` pour recevoir des commandes en langage naturel
  - Parser de commandes : detection d'intentions (fermer ticket, assigner, changer statut, chercher, resumer...)
  - Exemples de commandes :
    - `"Ferme le ticket #12"` -> PATCH `/api/tickets/:id` status=closed
    - `"Assigne le ticket #42 a John"` -> POST `/api/tickets/:id/assign`
    - `"Resume les tickets ouverts"` -> GET + AI summary
    - `"Cherche les bugs critiques"` -> Search + Filter
    - `"Quel est le statut du ticket #7 ?"` -> GET + format response
  - Integration OpenAI pour NLU (Natural Language Understanding)
  - Execution securisee des actions (verification tenant, roles, permissions)
  - Reponse structuree avec action executee + resultat

- [ ] **WebSocket : Integration temps reel du Command Center**
  - Etendre le gateway Agent ou creer un namespace `/command`
  - Streaming de la reponse agent (token par token)
  - Notifications push des resultats d'actions

#### Feature : Refonte UI/UX (Style "Claude" / "Linear")

- [ ] **Design System : Refonte tokens visuels**
  - Palette de couleurs epuree (gris neutres, accent subtil, mode sombre soigne)
  - Typographie : Inter/Geist Mono, hierarchie stricte
  - Espacements et border-radius consistent
  - Transitions et animations microinteractions fluides

- [ ] **Sidebar : Redesign style Linear**
  - Navigation compacte avec icones Lucide uniquement (collapse = icones seules)
  - Section "Favorites" / "Recents" epingles
  - Indicateur de raccourci `Ctrl+K` visible
  - Avatar + tenant switcher en bas

- [ ] **Header : Simplification**
  - Retirer la barre de recherche (remplacee par `Ctrl+K`)
  - Breadcrumbs contextuels
  - Actions contextuelles a droite

- [ ] **Tickets : Redesign vue liste et detail**
  - Liste style Linear (compact, hover states, actions inline)
  - Detail : layout 2 colonnes (contenu + sidebar metadata)
  - Timeline redesignee avec icones d'actions
  - Video player integre avec timeline synchronisee

- [ ] **Dashboard Overview : Redesign**
  - Cards metriques epurees avec micro-sparklines
  - Graphiques avec style sobre (pas de grilles saturees)
  - Quick actions redesignees comme une toolbar

---

## 3. Journal des modifications techniques (Changelog previsionnel)

### Phase 1 : Command Center (`Ctrl + K`)

#### Backend (`apps/api`)

| Fichier | Modification |
|---------|-------------|
| `src/modules/agent/agent.controller.ts` | Ajouter endpoint `POST /api/agent/command` |
| `src/modules/agent/agent.service.ts` | Ajouter methodes `parseCommand()`, `executeCommand()`, `buildCommandPrompt()` |
| `src/modules/agent/dto/` | Nouveau DTO `command.dto.ts` (content: string, context?: object) |
| `src/modules/agent/agent.gateway.ts` | Ajouter event `command` avec streaming de reponse |
| `src/ai/ai.service.ts` | Ajouter methode `generateCommandResponse()` avec function calling OpenAI |
| `src/modules/tickets/tickets.service.ts` | Exposer methodes pour actions programmatiques (close, reopen, assign par reference) |

#### Frontend (`apps/web`)

| Fichier | Modification |
|---------|-------------|
| `src/components/command/` | **Nouveau dossier** : `command-center.tsx`, `command-input.tsx`, `command-results.tsx`, `command-history.tsx` |
| `src/hooks/use-command-center.ts` | **Nouveau** : Hook pour la logique du command center (ouverture, historique, envoi) |
| `src/stores/command-store.ts` | **Nouveau** : Store Zustand pour l'etat du command center (isOpen, history, loading) |
| `src/app/(dashboard)/layout.tsx` | Ajouter `<CommandCenter />` dans le layout + event listener `Ctrl+K` |
| `src/lib/api.ts` | Ajouter methode pour appel endpoint command |
| `src/components/layout/header.tsx` | Ajouter indication raccourci `Ctrl+K` dans la barre de recherche |

### Phase 2 : Refonte UI/UX

#### Frontend (`apps/web`)

| Fichier | Modification |
|---------|-------------|
| `src/app/globals.css` | Refonte des CSS variables (couleurs, rayons, ombres) pour le theme Claude/Linear |
| `tailwind.config.ts` | Mise a jour des tokens Tailwind (couleurs, fonts, animations) |
| `src/components/layout/sidebar.tsx` | Redesign complet : navigation compacte, favoris, raccourci Ctrl+K, tenant switcher |
| `src/components/layout/header.tsx` | Simplification : breadcrumbs, suppression barre recherche, actions contextuelles |
| `src/components/ui/*.tsx` | Raffinement des composants de base (Button, Card, Badge, Input) - border-radius, couleurs, transitions |
| `src/components/tickets/tickets-data-table.tsx` | Redesign style Linear : hover states, actions inline, spacing compact |
| `src/components/tickets/ticket-detail.tsx` | Layout 2 colonnes, timeline redesignee |
| `src/components/dashboard/overview-cards.tsx` | Cards epurees avec micro-sparklines |
| `src/components/analytics/*.tsx` | Style sobre pour les charts Recharts |

### Phase 3 : Consolidation MVP

| Fichier | Modification |
|---------|-------------|
| `apps/web/src/hooks/use-analytics.ts` | Remplacer mock data par vrais appels API (`api.get('/api/analytics/...')`) |
| `apps/web/src/hooks/use-auth.ts` | Ajouter refresh token interceptor + gestion expiration |
| `apps/api/prisma/schema.prisma` | Ajouter modele `Notification` (si notifications backend) |
| `apps/web/src/app/(dashboard)/profile/page.tsx` | **Nouveau** : Page profil utilisateur |
| `apps/web/src/components/layout/header.tsx` | Connecter bouton notifications au backend |

---

## 4. Stack technique detectee

### Langages et runtimes
- **TypeScript** (strict mode) partout
- **Node.js** runtime

### Backend
- **NestJS 10** (modules, DI, guards, pipes, interceptors, gateways)
- **Prisma ORM** (PostgreSQL 16 + pgvector)
- **BullMQ** (queues Redis)
- **Socket.io** (WebSocket gateway)
- **Swagger/OpenAPI** (documentation auto)
- **class-validator** + **Zod** (validation)
- **bcrypt/argon2** (hashing mots de passe)
- **crypto** (chiffrement AES pour integrations)

### Frontend
- **Next.js 14** (dashboard legacy) + **Next.js 15** (web principal, Turbopack)
- **TailwindCSS** + **Radix UI** primitives
- **TanStack Query** (server state) + **Zustand** (client state)
- **Recharts** (charts analytics)
- **TipTap** (editeur rich text)
- **Lucide** (icones)
- **next-themes** (dark mode)

### SDK
- **Vite** (build ESM/CJS + CDN IIFE)
- **Web Components** + Shadow DOM
- **MediaRecorder API** (capture video)
- **IndexedDB** (offline queue)

### Worker / AI
- **FFmpeg** (extraction keyframes)
- **Tesseract.js** (OCR)
- **YOLO v11** (detection UI elements)
- **OpenAI GPT-4o Vision** (analyse video)
- **OpenAI text-embedding-3-large** (embeddings vectoriels)
- **MeiliSearch** (recherche full-text)
- **Resend** (emails transactionnels)

### Infrastructure
- **Docker Compose** (PostgreSQL, Redis, MeiliSearch, MinIO, MailHog)
- **Turborepo** (orchestration monorepo)
- **pnpm** (package manager)
- **Sentry** (error tracking)
- **PostHog** (product analytics)
- **BetterStack** (logs)

### Tests
- **Jest** (API + Worker)
- **Vitest** (Dashboard + Web + packages)
- **Playwright** (E2E Web)

---

## 5. Metriques du projet

| Metrique | Valeur |
|----------|--------|
| Modeles Prisma | 11 (Tenant, User, Application, Ticket, Media, VideoEvent, GithubConnection, GithubIssue, Integration, IntegrationSyncLog, AgentSession, AgentMessage, ClassificationFeedback) |
| Endpoints API REST | ~25+ (auth, users, tenants, applications, tickets, media, agent, analytics, feedback, github, integrations) |
| WebSocket Events | 8 (join/leave/send-message/typing + new-message/agent-typing/session-update/user-typing) |
| Pages Frontend (web) | 10 routes |
| Composants UI (web) | 30+ composants de base + 40+ composants metier |
| Workers BullMQ | 4 (video-analysis, github-sync, integration-sync, agent) |
| Integration Providers | 5 (Slack, Discord, Notion, HubSpot, Jira) + GitHub natif |
| Fichiers de tests | ~15 |
