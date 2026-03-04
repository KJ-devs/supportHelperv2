## US-AGENT-05 — QueueMonitorService et endpoint métriques

**Epic**: #249 | **Priorité**: P1 | **Complexité**: M | **Agent**: backend-dev
**Dépend de**: US-AGENT-04

### Contexte

Aucune visibilité sur l'état des queues en production. On ne sait pas combien de jobs sont en attente, quel est le taux d'échec, ni le temps de traitement moyen.

### Acceptance Criteria

- [ ] Créer `apps/api/src/modules/agent/queue-monitor.service.ts` injectable NestJS
- [ ] Métriques collectées via BullMQ `getJobCounts()` :
  - Nombre de jobs en attente par queue (waiting, active, delayed, failed)
  - Temps de traitement moyen par type de job
  - Taux d'échec par queue
- [ ] Créer endpoint `GET /api/admin/queue-metrics` sécurisé (JwtAuthGuard + role admin)
- [ ] Réponse JSON structurée avec toutes les métriques
- [ ] pnpm build 0 erreurs

### Fichiers clés

- `apps/api/src/modules/agent/queue-monitor.service.ts` (à créer)
- `apps/api/src/modules/agent/agent.module.ts`
- `apps/worker/src/queues/queues.module.ts`
