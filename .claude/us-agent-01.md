## US-AGENT-01 — Fix temps réel page Agent Tasks

**Epic**: #249 | **Priorité**: P0 | **Complexité**: M | **Agent**: frontend-dev
**Dépend de**: rien

### Problème actuel

La page `apps/dashboard/app/dashboard/agent-tasks/page.tsx` utilise uniquement du polling REST et un bouton refresh manuel. Aucune subscription WebSocket → les tâches affichent 'analyzing' indéfiniment.

### Acceptance Criteria

- [ ] Créer `apps/dashboard/hooks/useAgentTasksRealtime.ts` (pattern identique à useAgentChatV2.ts)
- [ ] Connecter au WebSocket `/tickets` namespace avec JWT auth
- [ ] Écouter les events : `ticket:updated`, `ticket:ai-analysis-completed`, `agent:session-update`
- [ ] Appeler `queryClient.invalidateQueries()` à chaque event reçu
- [ ] Vérifier que `tickets.gateway.ts` émet un event sur les changements de AgentTask (ajouter si manquant)
- [ ] Modifier `agent-tasks/page.tsx` pour utiliser le hook
- [ ] Afficher timestamps de progression (queued → running → done/failed)
- [ ] La page se met à jour automatiquement sans bouton refresh
- [ ] pnpm build 0 erreurs

### Fichiers clés

- `apps/dashboard/app/dashboard/agent-tasks/page.tsx`
- `apps/dashboard/hooks/useAgentChatV2.ts` (pattern à reproduire)
- `apps/api/src/modules/tickets/tickets.gateway.ts`
