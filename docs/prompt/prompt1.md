# Rôle : Senior Backend & DevOps Engineer
**Contexte :** Nous devons finaliser le MVP technique. Actuellement, plusieurs fonctionnalités critiques sont simulées (mock) ou absentes.
**Tâche :** Implémente et corrige les points suivants dans le code existant.
**TEAM :** create a team
## 1. Analytics & Auth
- [ ] **Analytics :** Dans `apps/web/src/hooks/use-analytics.ts`, supprime les générateurs aléatoires. Connecte les appels aux endpoints réels `GET /api/analytics/*`.
- [ ] **Auth Web :** Modifie `use-auth.ts`. Implémente le flow de **Refresh Token** (ne pas se contenter du localStorage statique). Gère l'expiration silencieuse.

## 2. Notifications & Recherche
- [ ] **Notifications Backend :** Crée le modèle `Notification` dans Prisma. Crée les endpoints API pour lister et marquer comme lu. Connecte le bouton du Header.
- [ ] **Global Search :** Connecte l'<Input> du Header (apps/web) à **MeiliSearch**. Inspire-toi de la logique `GlobalSearch` du dashboard legacy.

## 3. Profil & SDK
- [ ] **Page Profil :** Crée la route et la page dédiée pour l'utilisateur (édition info basique).
- [ ] **SDK Testing :** Écris un script de test d'intégration pour valider l'upload vidéo et la queue offline dans un environnement navigateur réel.

## 4. Consolidation & Worker
- [ ] **Worker :** Ajoute une gestion d'erreur avancée (Dead Letter Queue) et un hook pour le monitoring (log ou prévision Sentry) sur échec pipeline.
- [ ] **Merge Dashboard :** Identifie les fonctions utilitaires de `apps/dashboard` (legacy) qui manquent à `apps/web` et migre-les.

**Livrable attendu :** Code modifié pour les hooks, nouveaux endpoints API (NestJS/Node), et mise à jour du schéma Prisma si nécessaire.