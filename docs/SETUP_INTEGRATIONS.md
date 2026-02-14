# Guide de mise en place des Integrations (US-009)

Ce guide te permet de configurer les sandbox accounts pour chaque provider d'integration afin de lancer les tests E2E.

---

## Prerequis

```bash
# 1. Generer la cle de chiffrement des credentials
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copier le resultat dans .env.local :
INTEGRATION_ENCRYPTION_KEY=<valeur_generee>

# 2. Services locaux demarre
pnpm docker:up
```

---

## 1. Slack

### Creer un Sandbox

1. **Creer un workspace de test** : https://slack.com/get-started#/createnew
   - Nom : `support-helper-test`
   - C'est gratuit

2. **Creer une Slack App** : https://api.slack.com/apps
   - "Create New App" > "From scratch"
   - Nom : `Support Helper Test`
   - Workspace : `support-helper-test`

3. **Configurer les permissions** (OAuth & Permissions) :
   - Bot Token Scopes :
     - `chat:write` (envoyer des messages)
     - `chat:write.public` (poster dans des channels publics)
     - `channels:read` (lister les channels)

4. **Installer l'app dans le workspace** :
   - "Install to Workspace" > "Allow"
   - Copier le **Bot User OAuth Token** (commence par `xoxb-...`)

5. **Creer un channel de test** :
   - Creer `#support-helper-test` dans le workspace

### Configuration dans Support Helper

| Champ | Valeur |
|-------|--------|
| `botToken` | `xoxb-...` (le token copie) |
| `channel` | `#support-helper-test` |

### Tester

```bash
# Verifier que le bot peut poster
curl -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer xoxb-YOUR-TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel":"#support-helper-test","text":"Hello from Support Helper!"}'
```

---

## 2. Jira (Atlassian Cloud)

### Creer un Sandbox

1. **Creer un compte Atlassian gratuit** : https://www.atlassian.com/try/cloud/signup
   - Choisir le plan Free (jusqu'a 10 utilisateurs)
   - Nom du site : `support-helper-test.atlassian.net`

2. **Creer un projet de test** :
   - Type : "Scrum" ou "Kanban"
   - Nom : `Support Helper Test`
   - Key : `SHT`

3. **Generer un API Token** : https://id.atlassian.net/manage-profile/security/api-tokens
   - "Create API token"
   - Label : `support-helper-dev`
   - Copier le token immediatement (il ne sera plus visible)

### Configuration dans Support Helper

| Champ | Valeur |
|-------|--------|
| `host` | `https://support-helper-test.atlassian.net` |
| `email` | Ton email Atlassian |
| `apiToken` | Le token genere |
| `projectKey` | `SHT` |
| `issueType` | `Bug` (optionnel, defaut) |

### Tester

```bash
# Verifier la connexion
curl -u "ton-email@example.com:API_TOKEN" \
  "https://support-helper-test.atlassian.net/rest/api/3/myself"
```

---

## 3. HubSpot

### Creer un Sandbox

1. **Creer un compte developpeur** : https://developers.hubspot.com/
   - "Create a developer account" (gratuit)

2. **Creer un sandbox account** :
   - Dashboard developpeur > "Testing" > "Create account"
   - Choisir "Developer test account"
   - Cela cree un environnement HubSpot complet isole

3. **Creer une Private App** :
   - Dans le sandbox > Settings > Integrations > Private Apps
   - Nom : `Support Helper Test`
   - Scopes necessaires :
     - `tickets` (read/write)
     - `crm.objects.contacts.read`

4. **Recuperer les IDs de pipeline** :
   ```bash
   # Lister les pipelines
   curl "https://api.hubapi.com/crm/v3/pipelines/tickets" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```
   - Copier le `pipelineId` et un `pipelineStageId`

### Configuration dans Support Helper

| Champ | Valeur |
|-------|--------|
| `accessToken` | `pat-na1-...` (Private App token) |
| `pipelineId` | ID du pipeline de tickets |
| `pipelineStageId` | ID du stage initial |
| `ownerId` | (optionnel) ID du proprietaire |

### Tester

```bash
# Verifier le token
curl "https://api.hubapi.com/crm/v3/objects/tickets?limit=1" \
  -H "Authorization: Bearer pat-na1-YOUR-TOKEN"
```

---

## 4. Notion

### Creer un Sandbox

1. **Creer un workspace Notion** : https://www.notion.so/signup
   - Plan Personnel (gratuit)
   - Nom : `Support Helper Test`

2. **Creer une Integration** : https://www.notion.so/my-integrations
   - "New integration"
   - Nom : `Support Helper`
   - Workspace : `Support Helper Test`
   - Capabilities : Read content, Update content, Insert content
   - Copier le **Internal Integration Secret** (`secret_...`)

3. **Creer une Database de test** :
   - Creer une page "Bug Tracker" dans Notion
   - Ajouter un tableau (database) avec ces proprietes :
     - `Name` (title) - deja present
     - `Status` (select) : `new`, `open`, `in_progress`, `resolved`, `closed`
     - `Severity` (select) : `critical`, `high`, `medium`, `low`
     - `Type` (select) : `bug`, `feature`, `enhancement`, `documentation`
     - `Description` (rich text)

4. **Connecter l'integration a la database** :
   - Sur la page de la database > `...` > "Connections" > Ajouter `Support Helper`
   - **Important : sans ca, l'API retournera 404**

5. **Recuperer le Database ID** :
   - Ouvrir la database en "full page"
   - URL : `https://notion.so/WORKSPACE/DATABASE_ID?v=...`
   - Le Database ID est la partie de 32 caracteres dans l'URL

### Configuration dans Support Helper

| Champ | Valeur |
|-------|--------|
| `apiToken` | `secret_...` (Integration Secret) |
| `databaseId` | ID de 32 caracteres |

### Tester

```bash
# Verifier l'acces a la database
curl "https://api.notion.com/v1/databases/YOUR_DB_ID" \
  -H "Authorization: Bearer secret_YOUR_TOKEN" \
  -H "Notion-Version: 2022-06-28"
```

---

## 5. Discord

### Creer un Sandbox

1. **Creer un serveur Discord de test** :
   - Ouvrir Discord > `+` > "Creer un serveur"
   - Nom : `Support Helper Test`

2. **Creer un Webhook** :
   - Channel settings > "Integrations" > "Webhooks"
   - "New Webhook"
   - Nom : `Support Helper`
   - Copier l'URL du webhook

### Configuration dans Support Helper

| Champ | Valeur |
|-------|--------|
| `webhookUrl` | `https://discord.com/api/webhooks/...` |
| `username` | `Support Helper` (optionnel) |
| `avatarUrl` | (optionnel) |

### Tester

```bash
# Envoyer un message test
curl -X POST "YOUR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"content":"Hello from Support Helper!"}'
```

---

## 6. GitHub (OAuth + Webhooks)

### Creer un OAuth App

1. **GitHub Settings** > Developer settings > OAuth Apps : https://github.com/settings/developers
2. "New OAuth App" :
   - Application name : `Support Helper Dev`
   - Homepage URL : `http://localhost:3000`
   - Authorization callback URL : `http://localhost:3001/api/github/oauth/callback`
3. Copier le **Client ID**
4. "Generate a new client secret" > copier le **Client Secret**

### Variables d'environnement

```bash
# .env.local
GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx
GITHUB_WEBHOOK_SECRET=$(openssl rand -hex 32)
```

---

## Recapitulatif des comptes a creer

| Provider | Temps | Cout | URL de creation |
|----------|-------|------|-----------------|
| Slack | 5 min | Gratuit | https://slack.com/get-started#/createnew |
| Jira | 5 min | Gratuit (Free plan) | https://www.atlassian.com/try/cloud/signup |
| HubSpot | 10 min | Gratuit (Developer) | https://developers.hubspot.com/ |
| Notion | 5 min | Gratuit (Personal) | https://www.notion.so/my-integrations |
| Discord | 2 min | Gratuit | Discord app |
| GitHub | 5 min | Gratuit | https://github.com/settings/developers |

**Temps total estime : ~30 minutes**

---

## Stocker les credentials pour les tests

Creer un fichier `.env.test` (deja dans `.gitignore`) :

```bash
# .env.test — NE PAS COMMITTER

# Slack
TEST_SLACK_BOT_TOKEN=xoxb-...
TEST_SLACK_CHANNEL=#support-helper-test

# Jira
TEST_JIRA_HOST=https://support-helper-test.atlassian.net
TEST_JIRA_EMAIL=ton-email@example.com
TEST_JIRA_API_TOKEN=...
TEST_JIRA_PROJECT_KEY=SHT

# HubSpot
TEST_HUBSPOT_TOKEN=pat-na1-...
TEST_HUBSPOT_PIPELINE_ID=...
TEST_HUBSPOT_STAGE_ID=...

# Notion
TEST_NOTION_TOKEN=secret_...
TEST_NOTION_DATABASE_ID=...

# Discord
TEST_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# GitHub
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_WEBHOOK_SECRET=...
```

Pour les tests en CI (GitHub Actions), ajouter ces valeurs dans **Settings > Secrets and variables > Actions**.

---

## Verification rapide

```bash
# Demarrer l'API
pnpm dev

# Depuis Swagger UI (http://localhost:3001/api/docs)
# 1. S'authentifier (POST /api/auth/login)
# 2. Creer une integration (POST /api/integrations)
# 3. Tester la connexion (POST /api/integrations/:id/test)
```
