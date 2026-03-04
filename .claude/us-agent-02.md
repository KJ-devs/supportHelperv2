## US-AGENT-02 — Définir AgentHandoffContext dans packages/shared

**Epic**: #249 | **Priorité**: P0 | **Complexité**: S | **Agent**: backend-dev
**Dépend de**: rien

### Contexte

Actuellement le contexte inter-agents est un champ `agentState: Json` non typé. Pas de contrat entre Triage, N1 et N2.

### Acceptance Criteria

- [ ] Créer `packages/shared/src/types/agent-context.ts` avec interface `AgentHandoffContext` :
  - `ticketId`, `tenantId`
  - `triageDecision?` : type, severity, confidence, routedTo, reasoning, timestamp
  - `n1Analysis?` : summary, rootCause, affectedComponents[], requiresCodeChange, escalationReason?, timestamp
  - `n2Plan?` : approach, filesToModify[], risks[], estimatedComplexity, timestamp
  - `decisionTrace[]` : agent, action, rationale, timestamp
- [ ] Exporter depuis `packages/shared/src/index.ts`
- [ ] Type importable depuis api, worker, dashboard sans erreur
- [ ] pnpm build 0 erreurs

### Fichiers clés

- `packages/shared/src/types/` (créer agent-context.ts)
- `packages/shared/src/index.ts`
