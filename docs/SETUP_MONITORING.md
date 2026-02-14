# Guide de mise en place du Monitoring (US-010)

Ce guide te permet de configurer la stack de monitoring de production pour Support Helper : error tracking, logs, analytics, uptime et alerting.

---

## Architecture Monitoring actuelle

```
                     ┌─────────────┐
                     │   Support    │
                     │   Helper     │
                     └──────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
        ┌─────▼─────┐ ┌────▼────┐ ┌──────▼──────┐
        │  Sentry    │ │ Better  │ │  PostHog    │
        │  (Errors)  │ │ Stack   │ │ (Analytics) │
        │            │ │ (Logs)  │ │             │
        └────────────┘ └─────────┘ └─────────────┘

        + UptimeRobot (uptime) + Slack (alerting)
```

**Deja integre dans le code :**
- `SentryService` — error tracking + performance
- `LoggerService` — structured logging (Winston + BetterStack)
- `PostHogService` — product analytics + feature flags
- Health endpoints — `/health/*` (10 endpoints)
- Cache metrics — `/health/cache`

**A configurer :** les comptes externes + variables d'env.

---

## 1. Sentry (Error Tracking + Performance)

### Creer un compte

1. **S'inscrire** : https://sentry.io/signup/
   - Plan Developer (gratuit, 5K events/mois)

2. **Creer un projet** :
   - Platform : **Node.js / NestJS**
   - Nom : `support-helper-api`
   - Copier le **DSN** (format : `https://xxx@oyyy.ingest.sentry.io/zzz`)

3. **Creer un 2eme projet** pour le Dashboard :
   - Platform : **Next.js**
   - Nom : `support-helper-dashboard`
   - Copier le DSN

### Variables d'environnement

```bash
# .env.local

# API (backend)
SENTRY_DSN=https://xxx@oyyy.ingest.sentry.io/zzz
SENTRY_RELEASE=1.0.0
SENTRY_TRACES_SAMPLE_RATE=0.1      # 10% des requetes tracees (monter a 1.0 pour debug)
SENTRY_PROFILES_SAMPLE_RATE=0.1    # 10% des transactions profilees

# Dashboard (frontend)
NEXT_PUBLIC_SENTRY_DSN=https://aaa@obbb.ingest.sentry.io/ccc
NEXT_PUBLIC_SENTRY_RELEASE=1.0.0
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1
```

### Configurer les alertes Sentry

1. **Alerts** > "Create Alert Rule"
2. **Erreurs** :
   - Condition : "A new issue is created"
   - Action : "Send a Slack notification" (ou email)
3. **Performance** :
   - Condition : "Transaction duration > 500ms" pour p95
   - Action : Notifier Slack
4. **Error rate** :
   - Condition : "Percent of sessions with errors > 1%"
   - Action : Notifier Slack

### Verifier

```bash
# Demarrer l'API
pnpm dev

# Provoquer une erreur test
curl http://localhost:3001/api/non-existent-route

# Verifier dans Sentry > Issues
```

---

## 2. Better Stack (Logs structures)

### Creer un compte

1. **S'inscrire** : https://betterstack.com/
   - Plan gratuit : 1 GB/mois de logs

2. **Creer une Source** :
   - "Logs" > "Sources" > "Connect source"
   - Platform : **HTTP / JSON**
   - Nom : `support-helper-api`
   - Copier le **Source Token**

### Variables d'environnement

```bash
# .env.local
BETTERSTACK_SOURCE_TOKEN=tok_xxxxxxxxxxxx
BETTERSTACK_ENDPOINT=https://in.logs.betterstack.com  # defaut, pas besoin de changer
```

### Creer des alertes sur les logs

1. **Alerts** > "Create Alert"
2. Regles recommandees :
   | Nom | Query | Seuil | Action |
   |-----|-------|-------|--------|
   | API Errors | `level:error` | > 10 en 5 min | Slack |
   | Slow Queries | `duration_ms:>5000` | > 5 en 10 min | Email |
   | Auth Failures | `message:"authentication failed"` | > 20 en 5 min | Slack |
   | Worker Failures | `message:"job failed"` | > 5 en 15 min | Slack |

### Verifier

```bash
# L'API logge automatiquement les requetes
curl http://localhost:3001/health

# Verifier dans Better Stack > Logs > Live tail
```

---

## 3. PostHog (Product Analytics)

### Creer un compte

1. **S'inscrire** : https://app.posthog.com/signup
   - Plan gratuit : 1M events/mois
   - Choisir **Cloud US** ou **Cloud EU**

2. **Copier les credentials** :
   - Project Settings > "Project API Key"
   - Host : `https://app.posthog.com` (US) ou `https://eu.posthog.com` (EU)

### Variables d'environnement

```bash
# .env.local

# API (backend)
POSTHOG_API_KEY=phc_xxxxxxxxxxxx
POSTHOG_HOST=https://app.posthog.com

# Dashboard (frontend)
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxxxxxx
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
NEXT_PUBLIC_POSTHOG_DEV=true    # Activer en dev pour voir les events
```

### Dashboards recommandes

Creer ces dashboards dans PostHog :

1. **Tickets Overview** :
   - Events : `ticket_created`, `ticket_resolved` par jour
   - Funnel : created > classified > resolved

2. **AI Performance** :
   - Events : `ai_analysis_started` > `ai_analysis_completed` vs `ai_analysis_failed`
   - Duration between started et completed

3. **SDK Usage** :
   - Events : `sdk_initialized`, `sdk_report_submitted`
   - Breakdown par browser/OS

### Verifier

```bash
# Creer un ticket via l'API — l'event sera tracke automatiquement
curl -X POST http://localhost:3001/api/tickets \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test ticket","description":"Testing PostHog tracking"}'

# Verifier dans PostHog > Events
```

---

## 4. Uptime Monitoring

### Option A : UptimeRobot (gratuit, simple)

1. **S'inscrire** : https://uptimerobot.com/
   - Plan gratuit : 50 monitors, check toutes les 5 min

2. **Creer les monitors** :
   | Nom | URL | Type | Intervalle |
   |-----|-----|------|------------|
   | API Health | `https://YOUR_DOMAIN/health` | HTTP(s) | 5 min |
   | API Readiness | `https://YOUR_DOMAIN/health/ready` | HTTP(s) | 5 min |
   | Dashboard | `https://YOUR_DASHBOARD_URL` | HTTP(s) | 5 min |
   | Web App | `https://YOUR_WEB_URL` | HTTP(s) | 5 min |

3. **Configurer les alertes** :
   - Alert contacts > Ajouter email + Slack webhook
   - Alerter apres 2 echecs consecutifs

### Option B : Better Stack Uptime (integre avec les logs)

1. Deja dans Better Stack > "Uptime" > "Create Monitor"
2. Memes URLs que ci-dessus
3. Avantage : correle avec les logs automatiquement

### Variable d'environnement (optionnel)

```bash
UPTIME_MONITORING_ENABLED=true
UPTIME_WEBHOOK_URL=https://hooks.slack.com/services/...  # Pour status page
```

---

## 5. Slack Alerting (centraliser toutes les alertes)

### Creer un channel d'alertes

1. Creer `#support-helper-alerts` dans ton workspace Slack

2. **Creer un Incoming Webhook** :
   - https://api.slack.com/apps > Ton app > "Incoming Webhooks"
   - "Add New Webhook to Workspace"
   - Channel : `#support-helper-alerts`
   - Copier l'URL du webhook

3. **Connecter les services** :

| Service | Config |
|---------|--------|
| **Sentry** | Settings > Integrations > Slack > Connect workspace > Choisir `#support-helper-alerts` |
| **Better Stack** | Alerts > Notification channels > Add Slack > Webhook URL |
| **UptimeRobot** | Alert contacts > Add > Slack webhook URL |
| **PostHog** | Actions > Slack destination (optionnel) |

---

## 6. Health Endpoints disponibles

L'API expose deja 10 endpoints de health check :

```bash
# Basique (liveness)
curl http://localhost:3001/health
# {"status":"healthy","timestamp":"...","uptime":123}

# Readiness (dependencies)
curl http://localhost:3001/health/ready
# {"status":"healthy","database":"connected","redis":"connected","meilisearch":"connected"}

# Database
curl http://localhost:3001/health/db

# Redis / Cache
curl http://localhost:3001/health/redis
curl http://localhost:3001/health/cache   # Necessite auth

# Queues (worker jobs)
curl http://localhost:3001/health/queues

# Metriques systeme
curl http://localhost:3001/health/metrics
# {"memory":{"rss":...},"cpu":...,"uptime":...}

# Complet (auth requise)
curl http://localhost:3001/health/full \
  -H "Authorization: Bearer YOUR_JWT"
```

---

## Recapitulatif des comptes a creer

| Service | Temps | Cout | URL |
|---------|-------|------|-----|
| Sentry | 5 min | Gratuit (5K events/mois) | https://sentry.io/signup/ |
| Better Stack | 5 min | Gratuit (1 GB logs/mois) | https://betterstack.com/ |
| PostHog | 5 min | Gratuit (1M events/mois) | https://app.posthog.com/signup |
| UptimeRobot | 5 min | Gratuit (50 monitors) | https://uptimerobot.com/ |
| Slack (webhooks) | 5 min | Deja fait si Slack integration | Settings de ton app Slack |

**Temps total estime : ~25 minutes**

---

## Checklist de mise en place

```
[ ] Sentry
    [ ] Creer le compte et le projet API
    [ ] Creer le projet Dashboard
    [ ] Ajouter les DSN dans .env.local
    [ ] Configurer les alert rules
    [ ] Connecter Slack

[ ] Better Stack
    [ ] Creer le compte et la source
    [ ] Ajouter le token dans .env.local
    [ ] Creer les alert rules sur les logs
    [ ] Connecter Slack

[ ] PostHog
    [ ] Creer le compte
    [ ] Ajouter les API keys dans .env.local
    [ ] Creer les dashboards

[ ] Uptime
    [ ] Creer les monitors (API, Dashboard, Web)
    [ ] Configurer les alertes (2 echecs consecutifs)
    [ ] Connecter Slack

[ ] Slack
    [ ] Creer #support-helper-alerts
    [ ] Connecter Sentry, Better Stack, UptimeRobot
    [ ] Tester une alerte
```

---

## Variables d'environnement completes

```bash
# Copier dans .env.local (ou GitHub Secrets pour la CI)

# --- Sentry ---
SENTRY_DSN=
SENTRY_RELEASE=1.0.0
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_RELEASE=1.0.0
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1

# --- Better Stack ---
BETTERSTACK_SOURCE_TOKEN=
BETTERSTACK_ENDPOINT=https://in.logs.betterstack.com

# --- PostHog ---
POSTHOG_API_KEY=
POSTHOG_HOST=https://app.posthog.com
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
NEXT_PUBLIC_POSTHOG_DEV=false

# --- Uptime ---
UPTIME_MONITORING_ENABLED=true
UPTIME_WEBHOOK_URL=
```
