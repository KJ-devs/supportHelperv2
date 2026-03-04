## US-AGENT-04 — Priorisation dynamique des jobs BullMQ par sévérité

**Epic**: #249 | **Priorité**: P1 | **Complexité**: M | **Agent**: backend-dev
**Dépend de**: rien (parallélisable avec US-02 et US-03)

### Contexte

Actuellement tous les jobs ont une priorité fixe par type de queue. Un ticket `low` peut bloquer un ticket `critical`.

### Acceptance Criteria

- [ ] Modifier `tickets.service.ts` : calculer priorité BullMQ selon ticket.severity
  - critical=1, high=2, medium=5, low=10 (plus petit = plus prioritaire dans BullMQ)
- [ ] Passer la priorité lors de l'enqueue des jobs `triage` et `video-analysis`
- [ ] Modifier `triage.worker.ts` : enqueue le job suivant (`deep-analysis`) avec la priorité calculée
- [ ] Ajouter rate limiter configurable par tenant dans `queues.module.ts`
  - Pro: 100 jobs/min, Free: 20 jobs/min (basé sur tenant.plan)
- [ ] Tickets critical traités avant tickets low (vérifiable par logs BullMQ)
- [ ] pnpm build 0 erreurs

### Fichiers clés

- `apps/api/src/modules/tickets/tickets.service.ts`
- `apps/worker/src/workers/triage.worker.ts`
- `apps/worker/src/queues/queues.module.ts`
