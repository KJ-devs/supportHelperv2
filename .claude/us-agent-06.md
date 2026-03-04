## US-AGENT-06 — Escalade N1→N2 avec contexte riche et event WebSocket

**Epic**: #249 | **Priorité**: P2 | **Complexité**: L | **Agent**: backend-dev, frontend-dev
**Dépend de**: US-AGENT-02, US-AGENT-03

### Contexte

Actuellement N2 re-analyse ce que N1 a déjà fait car le contexte N1 n'est pas transmis. De plus, le dashboard n'est pas notifié de l'escalade N1→N2.

### Acceptance Criteria

- [ ] Dans `agent.worker.ts` (job `analyze-ticket`) : quand needsDeepAnalysis=true, construire AgentHandoffContext complet avec l'analyse N1
- [ ] Stocker le contexte dans `AgentSession.agentState` avant d'enqueue `generate-action-plan`
- [ ] N2 (`generate-action-plan`) lit le contexte N1 et skip la re-analyse des éléments déjà couverts
- [ ] Émettre WebSocket event `agent:escalated-to-n2` depuis `tickets.gateway.ts` avec :
  - ticketId, sessionId, n1Summary, timestamp
- [ ] Dashboard reçoit l'event et affiche une notification dans la timeline du ticket
- [ ] N2 ne duplique pas le travail déjà fait par N1 (vérifiable dans les logs)
- [ ] pnpm build 0 erreurs

### Fichiers clés

- `apps/worker/src/workers/agent.worker.ts`
- `apps/api/src/modules/tickets/tickets.gateway.ts`
- `apps/api/src/modules/agent-v2/deep-analysis.service.ts`
- `apps/dashboard/app/dashboard/tickets/[id]/` (affichage timeline)
