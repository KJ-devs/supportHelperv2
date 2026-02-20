# Support Helper Platform - Workflow Complet

> **Guide de test end-to-end** : Du SDK widget jusqu'a la resolution de bug par l'agent IA.
> Date : 2026-02-19

---

## Table des matieres

1. [Vue d'ensemble du flux](#1-vue-densemble-du-flux)
2. [Pre-requis & Demarrage](#2-pre-requis--demarrage)
3. [Donnees de test (Seed)](#3-donnees-de-test-seed)
4. [Etape 1 : Configuration du SDK](#4-etape-1--configuration-du-sdk)
5. [Etape 2 : Capture d'un bug via le Widget](#5-etape-2--capture-dun-bug-via-le-widget)
6. [Etape 3 : Reception et traitement API](#6-etape-3--reception-et-traitement-api)
7. [Etape 4 : Pipeline IA du Worker](#7-etape-4--pipeline-ia-du-worker)
8. [Etape 5 : Dashboard - Visualisation des tickets](#8-etape-5--dashboard---visualisation-des-tickets)
9. [Etape 6 : Lancer l'Agent IA](#9-etape-6--lancer-lagent-ia)
10. [Etape 7 : Conversation avec l'Agent](#10-etape-7--conversation-avec-lagent)
11. [Etape 8 : Escalade et Resolution](#11-etape-8--escalade-et-resolution)
12. [Diagramme de sequence complet](#12-diagramme-de-sequence-complet)
13. [SDK Demo (page de test integree)](#13-sdk-demo-page-de-test-integree)
14. [Troubleshooting](#14-troubleshooting)
15. [Architecture technique detaillee](#15-architecture-technique-detaillee)

---

## 1. Vue d'ensemble du flux

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         WORKFLOW COMPLET - SUPPORT HELPER                        │
│                                                                                 │
│  UTILISATEUR           API              WORKER            DASHBOARD             │
│  (Site web)         (NestJS)           (BullMQ)          (Next.js)              │
│                                                                                 │
│  ┌──────────┐     ┌──────────┐     ┌───────────┐     ┌──────────────┐          │
│  │ SDK      │────>│ Recevoir │────>│ Analyser  │────>│ Afficher     │          │
│  │ Widget   │     │ Ticket   │     │ Video/IA  │     │ Ticket       │          │
│  │          │     │          │     │           │     │              │          │
│  │ 1.Record │     │ 2.Store  │     │ 3.Process │     │ 4.View       │          │
│  │ 2.Submit │     │ 3.Queue  │     │ 4.Enrich  │     │ 5.Agent Chat │          │
│  └──────────┘     └──────────┘     └───────────┘     │ 6.Resolve    │          │
│                                                       └──────────────┘          │
│                                                                                 │
│  Flux : SDK → POST /api/sdk/tickets/report → BullMQ → Worker → WebSocket →     │
│         Dashboard (temps reel) → Agent IA → Resolution                          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Flux simplifie :**

1. **L'utilisateur** ouvre le widget SDK sur un site web
2. **Il enregistre** son ecran (video) et decrit le bug
3. **Le SDK** envoie le rapport a l'API (multipart FormData)
4. **L'API** cree un ticket, upload la video, lance l'analyse IA
5. **Le Worker** analyse la video (FFmpeg → OCR → GPT-4 Vision)
6. **Le Dashboard** recoit le ticket en temps reel (WebSocket)
7. **L'equipe support** lance un Agent IA pour analyser le bug
8. **L'Agent IA** propose une solution ou escalade a un humain
9. **Le ticket** est resolu et ferme

---

## 2. Pre-requis & Demarrage

### Infrastructure requise

```bash
# 1. Demarrer les services Docker (PostgreSQL, Redis, MinIO, MeiliSearch, MailHog)
pnpm docker:up

# 2. Appliquer les migrations
pnpm db:migrate

# 3. Seeder la base de donnees avec les donnees de test
pnpm db:seed

# 4. Generer le client Prisma (API + Worker)
pnpm db:generate

# 5. Builder le SDK CDN (necessaire pour le widget)
pnpm --filter @support-helper/sdk-web build:cdn

# 6. Demarrer tous les services en dev
pnpm dev
```

### Services disponibles

| Service | URL | Description |
|---------|-----|-------------|
| **API** | http://localhost:3001 | Backend NestJS |
| **Dashboard** | http://localhost:3000 | Dashboard support |
| **Web App** | http://localhost:3002 | App publique |
| **Swagger** | http://localhost:3001/api/docs | Documentation API |
| **MinIO** | http://localhost:9001 | Console stockage S3 |
| **MeiliSearch** | http://localhost:7700 | Recherche full-text |
| **MailHog** | http://localhost:8025 | Emails de test |
| **Prisma Studio** | `pnpm db:studio` | GUI base de donnees |

### Variables d'environnement cles

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/supporthelper
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=sk-...          # Requis pour l'analyse IA
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=support-helper
JWT_SECRET=<votre-secret>
```

---

## 3. Donnees de test (Seed)

Apres `pnpm db:seed`, voici les donnees disponibles :

### Comptes utilisateurs

| Email | Mot de passe | Role | Utilisation |
|-------|-------------|------|-------------|
| `owner@test.local` | `password123` | Owner | Admin complet |
| `support@test.local` | `password123` | Support | Agent support |

### Tenant & Application

| Element | Valeur |
|---------|--------|
| **Tenant** | "Test Company" (plan: pro) |
| **Application** | "My Awesome App" |
| **SDK Key** | `sdk_test_default_key_12345` |

### Tickets de test

- **50 tickets** pre-crees avec distribution variee :
  - Statuts : new, open, in_progress, resolved, closed
  - Types : bug, crash, performance, ui, feature_request, other
  - Severites : critical, high, medium, low
  - 25% assignes au support, 75% non assignes
  - Donnees IA (aiSummary, keywords) pour ~50% des tickets

### Session Agent de test

- **1 session agent** active sur le ticket #2
- **1 message agent** : "I analyzed the issue. It seems like a rendering performance problem..."

---

## 4. Etape 1 : Configuration du SDK

Le SDK est un **Web Component** `<support-helper>` qui s'integre a n'importe quel site web.

### Integration HTML (methode la plus simple)

```html
<!-- Charger le SDK -->
<script src="http://localhost:3001/sdk.iife.js"></script>

<!-- Ajouter le widget -->
<support-helper
  sdk-key="sdk_test_default_key_12345"
  api-url="http://localhost:3001"
  position="bottom-right"
  primary-color="#6366f1"
  theme="auto"
></support-helper>
```

### Attributs de configuration

| Attribut | Requis | Default | Description |
|----------|--------|---------|-------------|
| `sdk-key` | Oui | - | Cle SDK de l'application |
| `api-url` | Oui | - | URL de l'API backend |
| `position` | Non | `bottom-right` | Position du bouton (bottom-right, bottom-left, top-right, top-left) |
| `primary-color` | Non | `#6366f1` | Couleur du theme |
| `z-index` | Non | `99999` | Ordre d'empilement CSS |
| `theme` | Non | `auto` | Theme : light, dark, auto (detecte automatiquement) |

### Integration JavaScript programmatique

```javascript
import { SupportHelper } from '@support-helper/sdk-web';

const sdk = new SupportHelper({
  sdkKey: 'sdk_test_default_key_12345',
  apiUrl: 'http://localhost:3001'
});

// Ecouter les evenements
document.querySelector('support-helper')
  .addEventListener('sh:submit', (e) => {
    console.log('Ticket cree:', e.detail.ticketId);
  });
```

### Evenements emis par le widget

| Evenement | Payload | Declencheur |
|-----------|---------|-------------|
| `sh:open` | - | Widget ouvert |
| `sh:close` | - | Widget ferme |
| `sh:recording-start` | - | Enregistrement demarre |
| `sh:recording-stop` | `{ duration, size }` | Enregistrement arrete |
| `sh:submit` | `{ ticketId, aiAnalysis? }` | Rapport envoye |
| `sh:error` | `{ message }` | Erreur survenue |

---

## 5. Etape 2 : Capture d'un bug via le Widget

### Machine a etats du widget

```
idle ──OPEN──> open ──START──> recording ──STOP──> preview ──ACCEPT──> editing ──SUBMIT──> submitting
  ^                                                    |                  |                    |
  |                                                    |                  |               SUCCESS/ERROR
  └────────────────── CLOSE (depuis n'importe quel etat) ─────────────────┘                    |
                                                                                               v
                                                                                         success/error
```

### Parcours utilisateur detaille

#### 1. Etat initial (`idle`)
- Un **bouton flottant** (FAB) apparait dans le coin configure
- Cercle de 56px avec icone d'aide
- Pulsation d'attention apres 5 secondes d'inactivite

#### 2. Ouverture du widget (`open`)
- Clic sur le FAB → modal avec backdrop
- Message : "Record your issue"
- Bouton "Start Recording"
- L'ancien focus est sauvegarde (accessibilite)

#### 3. Enregistrement video (`recording`)
- Clic "Start Recording" → `navigator.mediaDevices.getDisplayMedia()`
- **Le navigateur demande** quel ecran/fenetre/onglet partager
- Le modal disparait pour ne pas masquer l'ecran
- Barre flottante minimale avec :
  - Timer (mise a jour chaque seconde)
  - Boutons pause/resume et stop
  - Point rouge pulsant
- **Detection automatique du meilleur codec** : VP9 > VP8 > H.264 > WebM > MP4

#### 4. Apercu video (`preview`)
- Clic "Stop" → video assemblee depuis les chunks
- Modal avec lecteur video integre
- Affichage : duree, taille du fichier
- Boutons : "Record again" | "Use this video"

#### 5. Edition du rapport (`editing`)
- Clic "Use this video" → formulaire
- Champs :
  - **Titre** (obligatoire, max 200 caracteres)
  - **Description** (obligatoire, max 2000 caracteres)
- Miniature video avec icone film et duree
- Bouton "Send Report"

#### 6. Envoi (`submitting`)
- Validation du formulaire (titre et description non vides)
- Spinner : "Sending your report..."
- **Collecte automatique du contexte** :

```json
{
  "url": "https://monsite.com/page",
  "userAgent": "Mozilla/5.0 ...",
  "timestamp": "2026-02-19T10:30:00Z",
  "screenResolution": { "width": 1920, "height": 1080 },
  "viewport": { "width": 1440, "height": 900 },
  "timezone": "Europe/Paris",
  "language": "fr-FR",
  "cookies": true,
  "localStorage": true,
  "sessionStorage": true
}
```

- **Requete HTTP** :

```
POST {apiUrl}/api/sdk/tickets/report
Headers: { "x-sdk-key": "sdk_test_default_key_12345" }
Body (FormData):
  - title: "Bouton de login ne fonctionne pas"
  - description: "Quand je clique sur le bouton..."
  - userContext: '{"url":"...","userAgent":"...",...}'
  - video: Blob (fichier WebM/MP4)
```

- **Timeout** : 60 secondes

#### 7. Resultat (`success` ou `error`)

**En cas de succes :**
- Icone de validation verte
- "Report Sent!"
- Identifiant du ticket (cliquable)
- Resultats de l'analyse IA (si disponibles) :
  - Resume, severite, type, mots-cles
- Bouton "Close"

**En cas d'erreur :**
- Message d'erreur
- Bouton "Retry" pour renvoyer
- Bouton "Close"

---

## 6. Etape 3 : Reception et traitement API

### Flux de traitement du endpoint SDK

```
POST /api/sdk/tickets/report
         │
         ▼
┌─────────────────────┐
│ 1. SdkKeyGuard      │  Valide x-sdk-key → recupere tenantId + applicationId
│    (Authentification)│  Rejette si cle invalide (401)
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 2. Rate Limiter      │  Max 50 requetes/minute par SDK key
│                      │  Rejette avec 429 si depasse
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 3. FileInterceptor   │  Parse multipart FormData
│    (max 100MB)       │  Extrait fichier video si present
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 4. Parse UserContext │  JSON.parse() du champ userContext
│                      │  Fallback: { raw: "..." } si invalide
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 5. Analyse IA        │  AIService.processUserDescription()
│    (synchrone)       │  → summary, severity, type, keywords
│                      │  → enrichedDescription, reproductionSteps
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 6. Creer Ticket      │  Prisma create avec toutes les donnees
│    (base de donnees) │  publicId genere (nanoid 12 chars)
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 7. Enrichir avec IA  │  Update ticket avec aiSummary, aiAnalysis
│                      │  keywords, type/severity avec confiance
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 8. Index MeiliSearch │  Indexation full-text (si active)
└─────────┬───────────┘
          ▼
┌──── Video presente ? ────┐
│ OUI                  NON │
▼                          ▼
┌──────────────────┐   ┌──────────────────┐
│ 9a. Upload S3     │   │ 9b. Reponse JSON │
│ 9b. Media record  │   │     directe      │
│ 9c. Queue analyse │   └──────────────────┘
│     video (prio 2)│
└─────────┬────────┘
          ▼
┌─────────────────────┐
│ 10. Sync integrations│  Queue job vers Jira/GitHub/Slack (prio 2)
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 11. WebSocket notify │  ticket:created → tous les dashboards
│     (temps reel)     │  du tenant
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 12. Reponse HTTP     │  { success, ticket, aiAnalysis, video }
│     200 OK           │
└─────────────────────┘
```

### Analyse IA immediate (step 5)

L'API appelle `AIService.processUserDescription()` de maniere synchrone :

| Champ retourne | Description |
|----------------|-------------|
| `summary` | Resume en 1-2 phrases |
| `enrichedDescription` | Description reformulee pour les devs |
| `severity` | low / medium / high / critical |
| `severityConfidence` | Score de confiance 0-1 |
| `type` | bug / crash / performance / ui / feature_request / other |
| `typeConfidence` | Score de confiance 0-1 |
| `keywords` | 5-10 mots-cles pour la recherche |
| `reproductionSteps` | Etapes de reproduction inferees |

### Mapping des types IA → Schema

```
bug, crash, ui, data-loss  →  bug
performance                →  performance
security                   →  security
feature_request            →  feature_request
question                   →  question
documentation              →  documentation
other (default)            →  bug
```

### Structure de la reponse au SDK

```json
{
  "success": true,
  "ticket": {
    "id": "uuid-...",
    "title": "Bouton de login ne fonctionne pas",
    "status": "new",
    "createdAt": "2026-02-19T10:30:00Z"
  },
  "aiAnalysis": {
    "summary": "Login button click handler not firing...",
    "enrichedDescription": "...",
    "severity": "medium",
    "severityConfidence": 0.85,
    "type": "bug",
    "typeConfidence": 0.92,
    "keywords": ["login", "button", "click", "handler"]
  },
  "video": {
    "received": true,
    "filename": "recording_1708337200000.webm",
    "size": 2456789,
    "mimeType": "video/webm",
    "mediaId": "uuid-...",
    "storageKey": "tenant-id/ticket-id/video-1708337200000.webm"
  }
}
```

---

## 7. Etape 4 : Pipeline IA du Worker

### Vue d'ensemble des queues BullMQ

| Queue | Workers | Retries | Usage |
|-------|---------|---------|-------|
| `video-analysis` | VideoAnalysisWorker | 4 | Analyse video complete |
| `agent-orchestration` | AgentWorker | 5 | Conversations IA |
| `github-sync` | GithubSyncWorker | 4 | Sync GitHub bidirectionnelle |
| `integration-sync` | IntegrationSyncWorker | 4 | Jira, HubSpot, Slack, Notion |
| `dead-letter` | DeadLetterWorker | - | Jobs echoues (retention 90j) |

### Pipeline d'analyse video

```
┌──────────────────────────────────────────────────────────────────┐
│                  VIDEO ANALYSIS PIPELINE                          │
│                                                                   │
│  S3 Download (15%)                                                │
│       │                                                           │
│       ▼                                                           │
│  FFmpeg Keyframes (30%)     1 frame/seconde → PNG                │
│       │                                                           │
│       ▼                                                           │
│  Tesseract OCR (50%)        4 workers paralleles                 │
│       │                     Extraction texte de chaque frame      │
│       ▼                                                           │
│  YOLO v11 Detection (65%)   Detection UI (boutons, formulaires)  │
│       │                                                           │
│       ▼                                                           │
│  GPT-4o Vision (80%)        10 frames par appel API              │
│       │                     Analyse semantique complete           │
│       ▼                                                           │
│  Embeddings (90%)           text-embedding-3-large               │
│       │                     Stockage pgvector                    │
│       ▼                                                           │
│  Update DB (95%)            aiSummary, keywords, aiAnalysis      │
│       │                                                           │
│       ▼                                                           │
│  Index MeiliSearch (100%)   Recherche full-text + vectorielle    │
└──────────────────────────────────────────────────────────────────┘
```

### Donnees produites par l'analyse

Le worker met a jour le ticket avec :

```typescript
Ticket.aiSummary    // Resume genere par GPT-4o Vision
Ticket.aiAnalysis   // {
                    //   ocr: { totalText, averageConfidence },
                    //   vision: { summary, uiElements[], actions[], errorMessages[], recommendations[] },
                    //   uiDetections: [{ class, confidence, bbox }],
                    //   metadata: { duration, fps, codec }
                    // }
Ticket.keywords     // Elements UI detectes
VideoEvent[]        // Evenements horodates (timestampMs, eventType, ocrText, screenshotKey)
```

### Notification temps reel

A la fin de l'analyse, le worker emet via WebSocket :
- `ticket:ai-analysis-completed` → le dashboard met a jour le ticket en temps reel

---

## 8. Etape 5 : Dashboard - Visualisation des tickets

### Connexion au Dashboard

1. Ouvrir http://localhost:3000
2. Se connecter avec `owner@test.local` / `password123`
3. Naviguer vers **Tickets** dans la sidebar

### Liste des tickets

La page `/dashboard/tickets` affiche :

- **Modes de vue** : Tableau (par defaut) ou Grille (cartes)
- **Filtres avances** :
  - Statut : new, open, in_progress, resolved, closed
  - Severite : critical, high, medium, low
  - Type : bug, crash, performance, ui, feature_request, other
  - Application
  - Recherche textuelle
  - Tri : date creation, mise a jour, severite, statut
- **Pagination** : 20 elements par page
- **Actions en masse** : Changer statut, assigner, supprimer
- **Export** : Via bouton Export

### Mises a jour temps reel

Le dashboard se connecte via WebSocket au namespace `/tickets` :

| Evenement | Effet dans l'UI |
|-----------|----------------|
| `ticket:created` | Nouveau ticket ajoute en haut de la liste |
| `ticket:updated` | Ticket mis a jour sur place |
| `ticket:assigned` | Badge d'assignation mis a jour |
| `ticket:ai-analysis-completed` | Analyse IA affichee |
| `ticket:deleted` | Ticket retire de la liste |
| `ticket:escalated` | Banniere d'escalade affichee |

Un **indicateur vert "Live"** en haut a droite confirme la connexion WebSocket.

### Detail d'un ticket

Cliquer sur un ticket ouvre `/dashboard/tickets/{id}` avec :

1. **En-tete** : Titre, badges (statut/type/severite), dates, boutons d'action
2. **Timeline** : Historique des evenements du ticket
3. **Description** : Texte rapporte par l'utilisateur
4. **Analyse IA** (si disponible) :
   - Resume IA dans un encadre bleu
   - Mots-cles sous forme de pills grises
   - JSON brut de l'analyse (expandable)
5. **Contexte utilisateur** : OS, navigateur, viewport, URL
6. **Medias** : Lecteur video avec controles, infos fichier

### Gestion du statut

Menu deroulant pour changer le statut :
```
new → open → in_progress → resolved → closed
```

Bouton **"Agent IA"** pour lancer l'analyse par un agent IA (desactive si ticket resolved/closed).

---

## 9. Etape 6 : Lancer l'Agent IA

### Comment demarrer une session Agent

1. Sur la page de detail d'un ticket, cliquer sur **"Agent IA"**
2. Si aucune session n'existe → l'API en cree une nouvelle
3. Si une session existe deja → redirection directe vers le chat

### Ce qui se passe en coulisse

```
Clic "Agent IA"
     │
     ▼
POST /api/agent/sessions/{ticketId}
     │
     ▼
AgentService.startSession()
  1. Verifie que le ticket existe et appartient au tenant
  2. Cree AgentSession (status: 'analyzing')
  3. Enqueue job 'analyze-ticket' dans BullMQ
  4. Retourne la session immediatement
     │
     ▼
Redirection vers /dashboard/tickets/{id}/chat
     │
     ▼
Frontend se connecte au WebSocket /agent
  → emit 'join-session' { sessionId }
  → rejoint la room Socket.IO 'session:{sessionId}'
```

### Machine a etats de l'Agent

```
                    ┌──────────────┐
                    │  ANALYZING   │ ← Etat initial
                    │              │
                    │ • Analyse IA │
                    │ • Recherche  │
                    │   similaire  │
                    │ • Confiance  │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
     confiance ≥ 0.7    < 0.7    securite/critique
              │            │            │
              ▼            ▼            ▼
     ┌─────────────┐ ┌──────────┐ ┌───────────┐
     │  PROPOSING  │ │NEEDS_INFO│ │ ESCALATED │ (terminal)
     │             │ │          │ │           │
     │ • Solution  │ │ • Pose   │ │ • Assigne │
     │   generee   │ │   des    │ │   a un    │
     │ • Envoi au  │ │   quest. │ │   humain  │
     │   client    │ │ • Attend │ │ • Email   │
     └──────┬──────┘ └────┬─────┘ └───────────┘
            │              │
            ▼              ▼
     ┌─────────────────────────┐
     │        WAITING          │
     │                         │
     │ • Attend reponse user   │
     │ • Timeout 24h →escalade │
     └──────────┬──────────────┘
                │
    ┌───────────┼───────────┐
    │           │           │
 confirme   plus d'info  demande
 resolution  donnee      humain
    │           │           │
    ▼           ▼           ▼
┌──────────┐  retour    ┌───────────┐
│ RESOLVED │  ANALYZING │ ESCALATED │
│(terminal)│            │(terminal) │
└──────────┘            └───────────┘
```

### Regles d'escalade automatique

L'agent escalade **immediatement** si :
- Severite = `critical`
- Mots-cles de securite detectes (vulnerability, XSS, injection, CSRF...)
- L'utilisateur demande explicitement un humain ("speak to agent", "manager"...)
- Confiance < 0.7 apres tentative de clarification
- 3 tentatives echouees

---

## 10. Etape 7 : Conversation avec l'Agent

### Interface de chat

La page `/dashboard/tickets/{id}/chat` affiche :

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Ticket #abc123    Agent IA: Analyzing... 🔵    🟢 Live       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────┐                                │
│  │ 🤖 Agent                     │                                │
│  │ J'ai analyse le ticket.      │    ┌───────────────────────┐  │
│  │ Il semble s'agir d'un        │    │  INFO SESSION         │  │
│  │ probleme de rendering...     │    │                       │  │
│  │                    10:30     │    │  Titre: Bug login     │  │
│  └──────────────────────────────┘    │  Severite: medium     │  │
│                                       │  Type: bug            │  │
│     ┌──────────────────────────────┐  │  Status: open         │  │
│     │                   👤 Vous   │  │  Messages: 3          │  │
│     │  Oui, ca arrive quand je    │  │  Cree: il y a 5min    │  │
│     │  clique sur le bouton de    │  └───────────────────────┘  │
│     │  connexion avec Chrome      │                              │
│     │  10:31                      │                              │
│     └──────────────────────────────┘                              │
│                                                                  │
│  ┌──────────────────────────────┐                                │
│  │ 🤖 Agent                     │                                │
│  │ Voici les etapes pour        │                                │
│  │ resoudre ce probleme:        │                                │
│  │ 1. Verifier le handler...    │                                │
│  │                    10:32     │                                │
│  └──────────────────────────────┘                                │
│                                                                  │
│  🤖 Agent is typing...                                           │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  [Decrivez votre probleme...                    ] [📤 Envoyer]  │
│  Ctrl+Enter pour envoyer              1234/2000                  │
└─────────────────────────────────────────────────────────────────┘
```

### Fonctionnalites du chat

| Fonctionnalite | Detail |
|----------------|--------|
| **Messages en temps reel** | WebSocket bidirectionnel |
| **Indicateur de frappe** | "Agent is typing..." avec points animes |
| **Historique** | Tous les messages charges a l'ouverture |
| **Statut de l'agent** | Badge colore (Analyzing, Needs Info, Proposing, Waiting, Resolved, Escalated) |
| **Auto-scroll** | Descend automatiquement aux nouveaux messages |
| **Limite** | 2000 caracteres par message |
| **Raccourci** | Ctrl+Enter pour envoyer |
| **Fallback REST** | Si WebSocket deconnecte, bascule sur POST /api/agent/sessions/{id}/messages |

### Indicateurs d'etat de l'agent

| Etat | Badge | Pulsation | Signification |
|------|-------|-----------|---------------|
| `analyzing` | 🔵 Bleu | Oui | L'agent analyse le ticket |
| `needs_info` | 🟡 Ambre | Non | L'agent a besoin d'infos |
| `proposing` | 🟣 Indigo | Oui | L'agent prepare une solution |
| `waiting` | ⚪ Gris | Non | L'agent attend une reponse |
| `resolved` | 🟢 Vert | Non | Ticket resolu |
| `escalated` | 🔴 Rouge | Non | Escalade vers un humain |

### Flux WebSocket du chat

```
Frontend (Dashboard)              Backend (API)              Worker
       │                              │                        │
       │ emit: 'join-session'         │                        │
       │─────────────────────────────>│                        │
       │                              │ join room              │
       │                              │ 'session:{id}'         │
       │                              │                        │
       │ emit: 'send-message'        │                        │
       │─────────────────────────────>│                        │
       │                              │ save user msg          │
       │    on: 'new-message' (user)  │                        │
       │<─────────────────────────────│                        │
       │                              │                        │
       │    on: 'agent-typing' true   │                        │
       │<─────────────────────────────│ AI generating...       │
       │                              │                        │
       │    on: 'agent-typing' false  │                        │
       │<─────────────────────────────│                        │
       │    on: 'new-message' (agent) │                        │
       │<─────────────────────────────│                        │
       │                              │                        │
       │    on: 'session-update'      │                        │
       │<─────────────────────────────│ state changed          │
       │                              │                        │
```

---

## 11. Etape 8 : Escalade et Resolution

### Scenario d'escalade

Quand l'agent decide d'escalader :

1. **L'agent met a jour** la session : `status: 'escalated'`, `escalatedTo: userId`
2. **WebSocket** emet `session-update` au dashboard
3. **Le chat se desactive** : la zone de saisie est grisee
4. **Banniere d'escalade** rouge apparait en haut du chat :
   ```
   ⚠️ This session has been escalated to a human agent
   Reason: Critical security vulnerability detected
   [Assign to: ▾ Select team member]
   ```
5. **Email de notification** envoye au support avec :
   - Raison de l'escalade
   - Resume de la conversation (5 derniers messages)
   - Titre et details du ticket
   - Lien direct vers le dashboard
6. Le support **assigne le ticket** a un membre de l'equipe

### Scenario de resolution

Quand l'agent resout le probleme :

1. L'agent propose une solution → l'utilisateur confirme
2. Session passe a `status: 'resolved'`
3. Le ticket peut etre ferme manuellement via le dropdown de statut

### Cycle de vie complet d'un ticket

```
┌──────┐    ┌──────┐    ┌─────────────┐    ┌──────────┐    ┌────────┐
│ NEW  │───>│ OPEN │───>│ IN_PROGRESS │───>│ RESOLVED │───>│ CLOSED │
└──────┘    └──────┘    └─────────────┘    └──────────┘    └────────┘
  SDK         Support      Agent IA          Solution       Archive
  cree        commence     travaille         trouvee        finale
  le          a examiner   dessus            ou escalade
  ticket
```

---

## 12. Diagramme de sequence complet

```
┌────────┐     ┌──────┐     ┌─────┐     ┌────────┐     ┌───────────┐     ┌────────┐
│ User   │     │ SDK  │     │ API │     │ Worker │     │ Dashboard │     │ Agent  │
│(site)  │     │Widget│     │     │     │        │     │  (support)│     │  (IA)  │
└───┬────┘     └──┬───┘     └──┬──┘     └───┬────┘     └─────┬─────┘     └───┬────┘
    │             │            │             │                │               │
    │ Clic FAB    │            │             │                │               │
    │────────────>│            │             │                │               │
    │             │            │             │                │               │
    │ Record ecran│            │             │                │               │
    │────────────>│            │             │                │               │
    │             │            │             │                │               │
    │ Stop + desc.│            │             │                │               │
    │────────────>│            │             │                │               │
    │             │            │             │                │               │
    │             │ POST /sdk/ │             │                │               │
    │             │ tickets/   │             │                │               │
    │             │ report     │             │                │               │
    │             │───────────>│             │                │               │
    │             │            │             │                │               │
    │             │            │ Analyse IA  │                │               │
    │             │            │ (synchrone) │                │               │
    │             │            │             │                │               │
    │             │            │ Cree ticket │                │               │
    │             │            │ Upload S3   │                │               │
    │             │            │             │                │               │
    │             │            │ Queue job ─────────────────>│                │
    │             │            │ video-      │               │                │
    │             │            │ analysis    │               │                │
    │             │            │             │                │               │
    │             │            │ WebSocket ──────────────────>│               │
    │             │            │ ticket:     │               │                │
    │             │            │ created     │               │                │
    │             │            │             │                │               │
    │             │  200 OK    │             │                │               │
    │             │<───────────│             │                │               │
    │ Succes!     │            │             │                │               │
    │<────────────│            │             │                │               │
    │             │            │             │                │               │
    │             │            │             │ FFmpeg→OCR→    │               │
    │             │            │             │ GPT-4 Vision   │               │
    │             │            │             │                │               │
    │             │            │             │ Update ticket  │               │
    │             │            │             │───────────────>│               │
    │             │            │             │ ai-analysis-   │               │
    │             │            │             │ completed      │               │
    │             │            │             │                │               │
    │             │            │             │                │ Voit ticket   │
    │             │            │             │                │ avec analyse  │
    │             │            │             │                │               │
    │             │            │             │                │ Clic "Agent"  │
    │             │            │             │                │──────────────>│
    │             │            │             │                │               │
    │             │            │             │                │  Session      │
    │             │            │             │                │  creee        │
    │             │            │             │                │<──────────────│
    │             │            │             │                │               │
    │             │            │             │                │ Chat en temps │
    │             │            │             │                │ reel via WS   │
    │             │            │             │                │<─────────────>│
    │             │            │             │                │               │
    │             │            │             │                │ Resolution ou │
    │             │            │             │                │ Escalade      │
    │             │            │             │                │<──────────────│
    │             │            │             │                │               │
```

---

## 13. SDK Demo (page de test integree)

Le dashboard inclut une **page de demo SDK** a `/dashboard/sdk-demo` pour tester le widget sans site externe.

### Acceder a la demo

1. Dashboard → Menu lateral → **SDK Demo**
2. La page propose un panneau de configuration :

| Option | Description |
|--------|-------------|
| SDK Key | Pre-rempli avec la cle de test |
| API URL | `http://localhost:3001` |
| Position | bottom-right, bottom-left, top-right, top-left |
| Couleur primaire | Color picker + champ hex |
| Theme | auto, light, dark |

3. Cliquer **"Launch Widget"** pour activer le widget sur la page
4. Le widget apparait et peut etre teste directement
5. Un **journal d'evenements** affiche tous les events SDK en temps reel

### Evenements logges

| Evenement | Couleur | Description |
|-----------|---------|-------------|
| `sh:open` | 🟢 Vert | Widget ouvert |
| `sh:close` | ⚪ Gris | Widget ferme |
| `sh:recording-start` | 🔵 Bleu | Enregistrement demarre |
| `sh:recording-stop` | 🔵 Bleu | Enregistrement arrete (+ duree/taille) |
| `sh:submit` | 🟣 Indigo | Rapport soumis (+ ticketId) |
| `sh:error` | 🔴 Rouge | Erreur (+ message) |

---

## 14. Troubleshooting

### Problemes courants

| Probleme | Cause probable | Solution |
|----------|---------------|----------|
| Widget ne s'affiche pas | SDK CDN pas builde | `pnpm --filter @support-helper/sdk-web build:cdn` |
| "Invalid SDK key" (401) | Mauvaise cle SDK | Utiliser `sdk_test_default_key_12345` |
| Video n'upload pas | MinIO pas demarre | `pnpm docker:up` |
| Analyse IA vide | `OPENAI_API_KEY` manquant | Configurer dans `.env.local` |
| Dashboard pas de temps reel | WebSocket deconnecte | Verifier Redis + API tourne |
| Agent ne repond pas | Worker pas demarre | Verifier que `pnpm dev` lance le worker |
| "Prisma client not generated" | Schema change | `pnpm db:generate` |
| Tickets pas visibles | Base pas seedee | `pnpm db:seed` |
| CORS error | URL mal configuree | Verifier `DASHBOARD_URL` dans `.env.local` |
| Port en conflit | Autre service sur le port | API=3001, Dashboard=3000, Web=3002 |

### Verifier que tout fonctionne

```bash
# 1. Docker est lance ?
docker ps  # Doit montrer postgres, redis, minio, meilisearch, mailhog

# 2. Les services repondent ?
curl http://localhost:3001/api/health     # API
curl http://localhost:3000                 # Dashboard
curl http://localhost:9001                 # MinIO

# 3. La base est seedee ?
pnpm db:studio  # Ouvrir et verifier les tables

# 4. Le SDK CDN existe ?
ls packages/sdk-web/dist/cdn/sdk.iife.js  # Doit exister

# 5. Les queues fonctionnent ?
# Verifier dans les logs du worker (terminal pnpm dev)
```

---

## 15. Architecture technique detaillee

### Stack technologique

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SUPPORT HELPER PLATFORM                       │
│                                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │  SDK Web    │  │  Dashboard   │  │   Web App    │  FRONTEND     │
│  │  Component  │  │  Next.js 14  │  │  Next.js 15  │               │
│  │  Shadow DOM │  │  :3000       │  │  :3002       │               │
│  └──────┬──────┘  └──────┬───────┘  └──────────────┘               │
│         │                │                                           │
│         │    x-sdk-key   │    JWT Bearer                            │
│         │                │    + WebSocket                           │
│         ▼                ▼                                           │
│  ┌─────────────────────────────────────────┐                        │
│  │              API (NestJS)               │  BACKEND               │
│  │              :3001                      │                        │
│  │  REST + WebSocket (Socket.IO)           │                        │
│  │  Swagger: /api/docs                     │                        │
│  └───────────────────┬─────────────────────┘                        │
│                      │                                               │
│         ┌────────────┼────────────┐                                  │
│         ▼            ▼            ▼                                  │
│  ┌───────────┐ ┌──────────┐ ┌──────────┐                           │
│  │PostgreSQL │ │  Redis   │ │  MinIO   │  INFRASTRUCTURE           │
│  │ + pgvector│ │ (BullMQ) │ │  (S3)    │                           │
│  │ :5432     │ │ :6379    │ │ :9000    │                           │
│  └───────────┘ └────┬─────┘ └──────────┘                           │
│                      │                                               │
│                      ▼                                               │
│  ┌─────────────────────────────────────────┐                        │
│  │            Worker (NestJS)              │  BACKGROUND            │
│  │            BullMQ Consumer              │                        │
│  │                                         │                        │
│  │  • Video Analysis (FFmpeg+OCR+Vision)   │                        │
│  │  • Agent Orchestration (Claude/GPT)     │                        │
│  │  • GitHub Sync (Octokit)                │                        │
│  │  • Integration Sync (Jira/Slack/...)    │                        │
│  │  • MeiliSearch Indexing                 │                        │
│  └─────────────────────────────────────────┘                        │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐                                 │
│  │ MeiliSearch  │  │   MailHog    │  SERVICES                      │
│  │ :7700        │  │   :8025 (UI) │                                │
│  └──────────────┘  └──────────────┘                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### Modele de donnees simplifie

```
Tenant (1)
  ├── Users (N)              Comptes dashboard
  ├── Applications (N)       Apps avec SDK key
  │     ├── Tickets (N)      Rapports de bugs
  │     │     ├── Media (N)          Videos/screenshots
  │     │     │     └── VideoEvents   Evenements extraits
  │     │     ├── AgentSessions (N)  Sessions IA
  │     │     │     └── AgentMessages  Messages chat
  │     │     ├── AgentTasks (N)     Taches auto-fix
  │     │     ├── TicketEvents (N)   Timeline audit
  │     │     ├── TicketMessages (N) Commentaires
  │     │     └── GithubIssues (N)   Liens GitHub
  │     ├── CodebaseEmbeddings       Vecteurs RAG
  │     └── NotificationPrefs        Config notifications
  ├── Integrations (N)       Jira, HubSpot, Slack, Notion
  ├── GithubInstallations    GitHub App configs
  ├── AiConfig               Config IA (BYOK)
  └── SsoConfig              Config SSO (SAML/OIDC)
```

### Authentification

| Contexte | Methode | Header | Guard NestJS |
|----------|---------|--------|-------------|
| SDK (widget) | SDK Key | `x-sdk-key: sdk_test_...` | `SdkKeyGuard` |
| Dashboard (humain) | JWT | `Authorization: Bearer eyJ...` | `JwtAuthGuard` |
| WebSocket (dashboard) | JWT | Handshake auth.token | `WsJwtGuard` |

### Providers IA supportes

| Provider | Modele | Usage |
|----------|--------|-------|
| **Anthropic** (prefere) | Claude Sonnet 4.5 | Agent conversations, analyse |
| **OpenAI** (fallback) | GPT-4o | Vision, function calling, embeddings |
| **Ollama** (local) | Configurable | Option self-hosted |

Chaque tenant peut fournir sa propre cle API (BYOK - Bring Your Own Key) via la table `AiConfig`.

---

## Checklist de test rapide

Pour tester le workflow complet demain :

- [ ] `pnpm docker:up` — Services infra demarres
- [ ] `pnpm db:migrate && pnpm db:seed` — Base prete avec donnees de test
- [ ] `pnpm --filter @support-helper/sdk-web build:cdn` — SDK builde
- [ ] `pnpm dev` — Tous les services lances
- [ ] Ouvrir http://localhost:3000 — Dashboard accessible
- [ ] Login avec `owner@test.local` / `password123`
- [ ] Verifier les 50 tickets dans la liste
- [ ] Aller dans SDK Demo → Lancer le widget → Enregistrer un bug
- [ ] Verifier que le nouveau ticket apparait en temps reel
- [ ] Ouvrir le ticket → Cliquer "Agent IA"
- [ ] Envoyer un message dans le chat → Verifier la reponse de l'agent
- [ ] Tester l'escalade (envoyer "I want to speak to a human")
- [ ] Verifier l'email d'escalade sur http://localhost:8025 (MailHog)
- [ ] Changer le statut du ticket → resolved → closed

---

*Document genere par Forge le 2026-02-19 — Support Helper Platform v2*
