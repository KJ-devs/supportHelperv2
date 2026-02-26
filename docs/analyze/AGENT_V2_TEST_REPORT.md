# Agent V2 — Test Report : Bug "Sort Order Inversé"

**Date :** 2026-02-26
**Ticket :** `cdb18ecc-81a4-47dc-b5b0-71a43e85de67`
**PR créé :** [#193 — fix(dashboard): default sort tickets by createdAt in descending order](https://github.com/KJ-devs/supportHelperv2/pull/193)
**Branche :** `fix/ticket-cdb18ecc-sort-tickets-by-date`

---

## 1. Le Bug Injecté

**Fichier :** `apps/dashboard/lib/api/tickets.ts`
**Commit :** `49ae41e` — `bug(dashboard): invert sortOrder in API query string builder`

```typescript
// buildQueryString() — ligne 48-50
} else if (key === 'sortOrder' && typeof value === 'string') {
  // Invert sort order when sending to API  ← BUG INTENTIONNEL
  params.append(key, value === 'asc' ? 'desc' : 'asc');
}
```

**Symptôme visible :** La page `/dashboard/tickets` affiche les tickets les plus anciens en premier au lieu des plus récents, malgré que l'UI indique un tri descendant.

**Difficulté :** Élevée — le bug est dans une fonction utilitaire (`buildQueryString`) enfouie dans la couche API client, invisible depuis les composants React. Aucun indice de fichier fourni dans la description SDK.

---

## 2. Description Soumise via SDK (vague, sans indice)

> *"The list of tickets on the dashboard does not seem to be ordered correctly. When I open the tickets page, I expect to see the most recent tickets at the top, but instead older tickets appear first. The sort order seems inverted compared to what is shown in the UI. I have not changed any filters — this is the default view."*

**Contexte utilisateur :** Windows 11, Chromium, viewport 1280×800, URL `/dashboard/tickets`

---

## 3. Flow d'Exécution

```
SDK submit (multipart/form-data)
  ↓
POST /api/sdk/tickets/report
  ↓ Ticket créé : cdb18ecc (status: new)
  ↓
Auto-triage (35s de délai)
  ↓
POST /api/triage/cdb18ecc/re-triage  ← déclenché manuellement dans le test
  ↓
Triage classifie : type=bug, severity=medium
  ↓
TriageRouterService détecte GitHub config → enqueue deep-analysis
  ↓
DeepAnalysisWorker → AgenticLoopService
  ↓
11 tool calls en ~60s
  ↓
create_branch → write_file → create_pull_request
  ↓
Ticket → status: analyzed, PR #193 créé
```

---

## 4. Résultat Agent V2

| Métrique | Valeur |
|---|---|
| Status final | `analyzed` |
| Confidence | **0.3** (faible) |
| Nombre d'outils | **11** |
| PR créé | ✅ [#193](https://github.com/KJ-devs/supportHelperv2/pull/193) |
| Fichier fixé | `apps/dashboard/components/tickets/TicketTable.tsx` |
| Vrai fichier bugué | `apps/dashboard/lib/api/tickets.ts` |

### Outils utilisés (dans l'ordre)

1. `search_codebase_semantic` — recherche sémantique "ticket sort order"
2. `search_code` — recherche dans le code source
3. `search_codebase_semantic` — 2ème recherche sémantique
4. `search_code` — recherche ciblée
5. `search_code` — recherche ciblée
6. `list_directory` — exploration `apps/dashboard/components/tickets/`
7. `list_directory` — exploration complémentaire
8. `read_file` — lecture de `TicketTable.tsx`
9. `create_branch` — création de `fix/ticket-cdb18ecc-sort-tickets-by-date`
10. `write_file` — modification de `TicketTable.tsx`
11. `create_pull_request` — PR #193

### Fix appliqué par l'agent

```typescript
// TicketTable.tsx — ajout d'un useEffect de tri par défaut
useEffect(() => {
  if (!sortField && !sortOrder && tickets.length > 0) {
    onSort && onSort('createdAt');
  }
}, [onSort, sortField, sortOrder, tickets.length]);
```

---

## 5. Analyse : Pourquoi l'agent a raté la vraie cause

### Ce que l'agent a fait
L'agent a cherché le problème dans les **composants React** (TicketTable, page.tsx) — le niveau d'interface le plus visible. Il a trouvé que `TicketTable` ne forçait pas de tri par défaut, et a appliqué un fix à ce niveau.

### Où était le vrai bug
Le bug était dans `lib/api/tickets.ts` → fonction `buildQueryString` → cas `sortOrder` — une **inversion silencieuse** du paramètre envoyé à l'API. L'agent n'a pas cherché dans la couche client API.

### Pourquoi la confidence est 0.3
L'agent savait qu'il n'était pas certain. Le fix dans `TicketTable.tsx` corrige le **symptôme** (absence de tri par défaut) mais pas la **cause** (inversion dans `buildQueryString`). Même avec ce fix, si un utilisateur change l'ordre de tri manuellement, il obtiendrait le résultat inverse de ce qu'il demande.

### Chemin de recherche manqué
```
page.tsx               ← l'agent a regardé ici
TicketTable.tsx        ← l'agent a lu et modifié ici
lib/api/tickets.ts     ← ❌ non exploré
  └─ buildQueryString()
       └─ case 'sortOrder': value === 'asc' ? 'desc' : 'asc'  ← vrai bug
```

---

## 6. Ce Qui a Fonctionné (✅ Validé)

- **Pipeline end-to-end complet** : SDK → triage → deep analysis → PR GitHub
- **Déclenchement automatique** via re-triage endpoint
- **GitHub integration** : create_branch + write_file + create_pull_request
- **Ticket mis à jour** avec diagnosis, confidence, rootCause
- **gpt-4o-mini** : 11 tool calls sans TPM rate limit (vs gpt-4o qui crashait à ~18 tools)

---

## 7. Ce Qui N'a Pas Fonctionné (❌ À Améliorer)

| Problème | Impact |
|---|---|
| Agent fixe le symptôme, pas la cause racine | Fix incomplet (confidence 0.3) |
| Description vague → agent cherche au mauvais niveau | Bug dans utilitaire, pas dans composant |
| Test script termine avant la fin de l'analyse | `analysis_failed` vu à 45s, mais l'agent a fini à ~60s |
| Aucun résultat de `investigationLog` dans la réponse API | Impossible de debugger le raisonnement précis |

---

## 8. Comparaison des Tests Agent V2

| Test | Bug | Confidence | PR | Fix correct ? |
|---|---|---|---|---|
| **PR #190** (session précédente) | Badge.tsx — couleurs severity inversées | ~0.8 | ✅ créé | ✅ Oui |
| **PR #193** (ce test) | tickets.ts — sortOrder inversé dans buildQueryString | 0.3 | ✅ créé | ❌ Non (mauvais fichier) |

**Conclusion :** L'agent V2 performe mieux sur les bugs **visuels** (couleurs, UI) que sur les bugs **comportementaux** dans des couches utilitaires cachées.

---

## 9. Architecture Agent V1 / V2 — Gaps Identifiés

| Gap | Description |
|---|---|
| Agent V2 pas déclenché depuis SDK | Normal par design — nécessite triage + GitHub config |
| Résultat triage non retourné au SDK | Le client SDK ne sait pas si son ticket est routé en deep analysis |
| Vidéo analysis et triage s'exécutent en parallèle | Sans coordination — la vidéo OCR pourrait enrichir le triage |
| Pas de webhook pour résultat async | SDK client ne peut pas savoir quand l'analyse est terminée |
| Endpoint public Agent V2 absent | Pas de `POST /api/agent/v2/analyze/:ticketId` depuis le dashboard |

---

## 10. Screenshots

| Fichier | Description |
|---|---|
| `01-bug-ticket-list.png` | Bug visible — tickets dans le mauvais ordre |
| `02-bug-ticket-list-scroll.png` | Scroll — confirmation du mauvais ordre |
| `03-sdk-submitted.png` | Après soumission SDK |
| `04-ticket-created.png` | Ticket créé (status: new) |
| `05-triage-triggered.png` | Re-triage déclenché — Agent V2 démarre |
| `06-v2-15s.png` | Agent V2 à 15s — analyzing |
| `07-v2-30s.png` | Agent V2 à 30s — analyzing |
| `08-v2-45s.png` | Agent V2 à 45s — analysis_failed (timing) |
| `09-12-final-*.png` | État final capturé par le script de test |
| `13-final-ticket-top.png` | Ticket final — status: analyzed |
| `14-final-diagnosis.png` | Section diagnosis avec confidence 0.3 |
| `15-final-github-pr.png` | Lien vers PR #193 |
| `16-final-investigation-log.png` | Log des 11 tool calls |
