# 🧪 Guide de Test Complet - Support Helper Platform

## 📊 Statut des Services

### ✅ Services Actifs
- **API Backend:** http://localhost:3001 (PID 40124)
- **Dashboard Frontend:** http://localhost:3003
- **PostgreSQL:** Port 5432 ✓
- **Redis:** Port 6379 ✓
- **MinIO (S3):** Port 9000 ✓
- **Meilisearch:** Port 7700 ✓

### 🔑 Credentials de Test
```
Email: owner@test.local
Password: password123

OU

Email: support@test.local
Password: password123
```

### 📦 Données de Seed
- ✅ 1 Tenant (Test Company)
- ✅ 2 Users (owner + support)
- ✅ 1 Application avec SDK key
- ✅ **50 Tickets** avec statuts/types/sévérités variés

---

## 🎯 Plan de Test par Priorité

### ✅ P0 - Fixes Critiques (6 fixes)

#### 1️⃣ **Pagination 0-based vs 1-based**
**Fichiers:** `apps/dashboard/lib/api/tickets.ts`, `apps/dashboard/app/dashboard/tickets/page.tsx`

**Test:**
1. Ouvrir http://localhost:3003/dashboard/tickets
2. Connectez-vous avec `owner@test.local` / `password123`
3. ✅ Vérifier que les **premiers 20 tickets** s'affichent (pas vides)
4. ✅ Cliquer sur "Page 2"
5. ✅ Vérifier que les tickets 21-40 s'affichent (différents de la page 1)
6. ✅ Le numéro de page affiché doit être "2" (pas "1")

**Attendu:** Les tickets ne doivent jamais être sautés. Page 1 = tickets 1-20, Page 2 = tickets 21-40.

---

#### 2️⃣ **Upload vidéo SDK implémenté**
**Fichiers:** `packages/sdk-web/src/index.ts`

**Test:**
1. Ouvrir `apps/dashboard/public/test-sdk.html` ou créer une page HTML de test
2. Inclure le SDK: `<script src="/sdk/support-helper.js"></script>`
3. Appeler `SupportHelper.report({ title: 'Test', description: 'Test video', includeVideo: true })`
4. ✅ Vérifier que la vidéo est uploadée vers S3/MinIO
5. ✅ Vérifier dans la DB que le ticket a un `Media` associé

**Attendu:** Le blob vidéo doit être uploadé, pas ignoré.

---

#### 3️⃣ **eval() supprimé des wrappers React/Vue**
**Fichiers:** `packages/sdk-web/src/react/index.ts`, `packages/sdk-web/src/vue/index.ts`

**Test:**
1. Ouvrir `packages/sdk-web/src/react/index.ts`
2. ✅ Vérifier qu'il n'y a AUCUN `eval()` dans le code
3. Ligne 58+ doit utiliser `if (typeof globalThis !== 'undefined' && globalThis.SupportHelper)`
4. Idem pour `packages/sdk-web/src/vue/index.ts` ligne 53+

**Attendu:** Aucun `eval()`, compatible CSP strict.

---

#### 4️⃣ **clickHandlerAttached reset au disconnect**
**Fichiers:** `packages/sdk-web/src/widget/support-helper-element.ts`

**Test:**
1. Créer une page HTML avec le widget: `<support-helper sdk-key="test"></support-helper>`
2. Ouvrir DevTools Console
3. Exécuter:
   ```javascript
   const widget = document.querySelector('support-helper');
   widget.remove();
   document.body.appendChild(widget);
   widget.click(); // Doit ouvrir le widget
   ```
4. ✅ Le widget doit répondre au clic après remove/append

**Attendu:** Le widget doit rester fonctionnel après disconnectedCallback.

---

#### 5️⃣ **MediaModule activé**
**Fichiers:** `apps/api/src/app.module.ts`

**Test:**
1. Vérifier que `MediaModule` est **décommenté** ligne ~109
2. API démarre sans erreur ✅ (déjà confirmé)
3. Tester l'upload:
   ```bash
   curl -X POST http://localhost:3001/api/media/presigned-url \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"ticketId":"<id>","type":"video","filename":"test.mp4","size":1000000,"contentType":"video/mp4"}'
   ```
4. ✅ Doit retourner une presigned URL, pas 404

**Attendu:** Endpoint `/api/media/*` accessible.

---

#### 6️⃣ **Exception type corrigé**
**Fichiers:** `apps/api/src/modules/tickets/sdk-tickets.controller.ts`

**Test:**
1. Déclencher une erreur dans le SDK tickets endpoint (ex: SDK key invalide)
2. ✅ Vérifier que l'erreur retourne un **4xx** avec message NestJS
3. ✅ PAS un 500 avec stack trace générique

**Attendu:** `throw new InternalServerErrorException()` au lieu de `throw new Error()`.

---

### ✅ P1 - Fixes Hauts (4 fixes)

#### 7️⃣ **Trends grouping par jour/semaine/mois**
**Fichiers:** `apps/api/src/modules/analytics/analytics.service.ts`

**Test:**
1. Ouvrir http://localhost:3003/dashboard/analytics
2. Connectez-vous
3. Sélectionner "Last 7 days"
4. ✅ Le graphique doit montrer des points **par jour** (pas 1 point par ticket)
5. Sélectionner "Last 30 days"
6. ✅ Le graphique doit montrer des points **par semaine** ou **par jour**

**Attendu:** Bucketing correct (pas de groupBy sur timestamp exact).

---

#### 8️⃣ **Time range filter connecté**
**Fichiers:** `apps/dashboard/app/dashboard/analytics/page.tsx`, `apps/dashboard/lib/api/tickets.ts`

**Test:**
1. Ouvrir http://localhost:3003/dashboard/analytics
2. Changer le sélecteur de période: "Day" → "Week" → "Month"
3. ✅ Les métriques doivent **changer** (pas rester statiques)
4. Ouvrir DevTools Network
5. ✅ L'appel API doit inclure `?period=week` ou `?period=month`

**Attendu:** Le paramètre `period` est passé à l'API et pris en compte.

---

#### 9️⃣ **Timer memory leak fixé**
**Fichiers:** `packages/sdk-web/src/widget/support-helper-element.ts`

**Test:**
1. Créer une page HTML avec le widget
2. Démarrer un enregistrement vidéo
3. Mettre en pause → reprendre → mettre en pause → reprendre (plusieurs fois)
4. Ouvrir DevTools → Performance → Memory Profiler
5. ✅ Le nombre de `setInterval` actifs ne doit PAS croître indéfiniment
6. Code ligne 519-531: `clearInterval(this.recordingTimer)` doit être appelé AVANT chaque nouveau `setInterval`

**Attendu:** Un seul timer actif à la fois, pas de fuite mémoire.

---

#### 🔟 **Validation formulaire affiche erreurs**
**Fichiers:** `packages/sdk-web/src/widget/support-helper-element.ts`

**Test:**
1. Ouvrir le widget SDK
2. Laisser le champ "Title" **vide**
3. Cliquer "Submit"
4. ✅ Un message d'erreur doit s'afficher: "Title and description are required"
5. Idem pour "Description" vide

**Attendu:** Message d'erreur visible (pas de return silencieux).

---

### ✅ P2 - Fixes Modérés (3 fixes)

#### 1️⃣1️⃣ **Index composites ajoutés**
**Fichiers:** `apps/api/prisma/schema.prisma`

**Test:**
1. Ouvrir `apps/api/prisma/schema.prisma`
2. Chercher `@@index` dans le modèle `Ticket`
3. ✅ Doit avoir au moins 4 index:
   - `@@index([tenantId, status])`
   - `@@index([tenantId, createdAt])`
   - `@@index([tenantId, assignedTo])`
   - `@@index([applicationId, createdAt])`
4. Modèle `Media` doit avoir:
   - `@@index([processingStatus])`

**Attendu:** Requêtes filtrées par tenantId + status rapides (< 50ms pour 1000+ tickets).

---

#### 1️⃣2️⃣ **Seed data enrichi (50 tickets)**
**Fichiers:** `apps/api/prisma/seed.ts`

**Test:**
1. ✅ Déjà exécuté: `pnpm db:seed` a créé 50 tickets
2. Vérifier dans le dashboard: http://localhost:3003/dashboard/tickets
3. ✅ Doit afficher plusieurs pages (pagination visible)
4. ✅ Les tickets doivent avoir des:
   - Statuts variés (new, open, in_progress, resolved, closed)
   - Types variés (bug, crash, performance, ui, etc.)
   - Sévérités variées (critical, high, medium, low)
   - Dates étalées sur les 60 derniers jours

**Attendu:** Pagination testable avec données réalistes.

---

#### 1️⃣3️⃣ **Double-stop throw error**
**Fichiers:** `packages/sdk-web/src/recorder/video-recorder.ts`

**Test:**
1. Utiliser le SDK VideoRecorder:
   ```javascript
   const recorder = new VideoRecorder();
   await recorder.start();
   const blob1 = await recorder.stop();
   const blob2 = await recorder.stop(); // ❌ Doit throw
   ```
2. ✅ Le second `stop()` doit **throw une erreur** (pas retourner un Blob vide)
3. Message: "No recording in progress or chunks available"

**Attendu:** Erreur explicite au lieu d'un Blob vide silencieux.

---

## 🆕 Fixes Additionnels (API startup)

#### **ffprobe.service.ts imports ES6/CommonJS**
**Fichiers:** `apps/api/src/modules/media/ffprobe.service.ts`

**Test:**
1. ✅ API démarre sans crash (déjà confirmé)
2. Vérifier imports ligne 2-4:
   ```typescript
   import * as ffmpeg from 'fluent-ffmpeg';
   import * as ffmpegPath from '@ffmpeg-installer/ffmpeg';
   import * as ffprobePath from '@ffprobe-installer/ffprobe';
   ```
3. PAS `import ffmpeg from 'fluent-ffmpeg'`

**Attendu:** API démarre et peut extraire metadata vidéo.

---

#### **tsconfig.json build structure**
**Fichiers:** `apps/api/tsconfig.json`

**Test:**
1. Vérifier `tsconfig.json`:
   ```json
   "include": ["src/**/*"],
   "exclude": ["node_modules", "dist", "prisma"]
   ```
2. Rebuild: `pnpm nest build`
3. ✅ Fichier `dist/main.js` doit exister (pas `dist/src/main.js`)
4. ✅ `nest start --watch` doit démarrer l'API

**Attendu:** Structure de build correcte pour `nest start`.

---

## 🎬 Tests Fonctionnels Complets

### Test 1: Authentification
1. Ouvrir http://localhost:3003
2. Cliquer "Login"
3. Entrer `owner@test.local` / `password123`
4. ✅ Redirection vers `/dashboard/tickets`
5. ✅ Header doit afficher "Owner User"

### Test 2: Liste des Tickets
1. Dans `/dashboard/tickets`
2. ✅ 20 tickets par page
3. ✅ Pagination visible (Page 1, 2, 3)
4. ✅ Filtres: Status, Type, Severity
5. Changer le filtre "Status" → "Open"
6. ✅ Liste mise à jour

### Test 3: Détail Ticket
1. Cliquer sur un ticket
2. ✅ Affiche titre, description, métadonnées
3. ✅ Si vidéo attachée, player vidéo visible
4. ✅ Bouton "Assign to me" fonctionnel

### Test 4: Analytics
1. Ouvrir `/dashboard/analytics`
2. ✅ Overview cards: Total tickets, New, Resolved, Avg resolution time
3. ✅ Graphique trends visible
4. Changer "Period": Day → Week → Month
5. ✅ Métriques recalculées

### Test 5: SDK Integration (Avancé)
1. Créer `test.html`:
   ```html
   <!DOCTYPE html>
   <html>
   <head><title>SDK Test</title></head>
   <body>
     <support-helper sdk-key="sdk_VOTRE_CLE_ICI"></support-helper>
     <script src="http://localhost:3003/sdk/support-helper.js"></script>
   </body>
   </html>
   ```
2. Ouvrir dans le navigateur
3. ✅ Widget visible en bas à droite
4. Cliquer → remplir formulaire → Submit
5. ✅ Ticket créé dans le dashboard

---

## 📈 Rapport de Test Final

### Checklist Globale

#### API Backend
- [x] Démarre sans erreur
- [x] Port 3001 en écoute
- [x] Endpoints répondent (401 si pas authentifié)
- [x] Swagger docs: http://localhost:3001/api/docs
- [x] MediaModule activé et fonctionnel

#### Dashboard Frontend
- [x] Démarre sur port 3003
- [ ] Login fonctionnel (à tester manuellement)
- [ ] Tickets list avec pagination (à tester)
- [ ] Analytics avec filtres (à tester)

#### SDK Web
- [ ] Widget s'affiche (à tester)
- [ ] Capture vidéo fonctionne (à tester)
- [ ] Upload ticket via SDK (à tester)

#### Base de Données
- [x] 50 tickets seedés
- [x] 2 users (owner + support)
- [x] Index composites ajoutés

#### Fixes Appliqués
- [x] 6 fixes P0 (critiques)
- [x] 4 fixes P1 (hauts)
- [x] 3 fixes P2 (modérés)
- [x] 2 fixes additionnels (API startup)

**Total: 15 fixes appliqués sur 15** ✅

---

## 🚀 Prochaines Étapes

1. **Tests manuels à compléter:**
   - Login/logout flow
   - Création ticket via dashboard
   - Upload vidéo via SDK
   - Filtres analytics

2. **Tests automatisés à ajouter:**
   - E2E avec Playwright/Cypress
   - Unit tests pour SDK
   - Integration tests API

3. **Améliorations suggérées:**
   - Pre-signed URLs pour lecture vidéo dashboard (P1 #11)
   - JWT dans httpOnly cookies au lieu de localStorage (P1 #10)
   - Retry logic + offline queue SDK (P1 #13)

---

## 📞 Support

En cas de problème:
1. Vérifier les logs API: Console où `pnpm dev` tourne
2. Vérifier les logs Dashboard: Console navigateur (F12)
3. Vérifier PostgreSQL/Redis/MinIO: `docker ps`
4. Restart services: Tuer les process et relancer `pnpm dev`

**Fin du guide de test** 🎉
