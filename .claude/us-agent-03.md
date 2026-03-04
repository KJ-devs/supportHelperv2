## US-AGENT-03 — Propager AgentHandoffContext dans le pipeline agentique

**Epic**: #249 | **Priorité**: P1 | **Complexité**: L | **Agent**: backend-dev
**Dépend de**: US-AGENT-02

### Contexte

Une fois le type défini (US-02), il faut le propager dans chaque étape du pipeline : Triage → N1 (DeepAnalysis) → N2 (GenerateActionPlan).

### Acceptance Criteria

- [ ] Modifier `agent.service.ts` : initialiser AgentHandoffContext vide dans AgentSession.agentState à la création de session
- [ ] Modifier TriageService : écrire `triageDecision` dans le contexte après classification, appender à `decisionTrace`
- [ ] Modifier DeepAnalysisService : lire le contexte existant, enrichir avec `n1Analysis`, appender à `decisionTrace`
- [ ] Modifier `agent.worker.ts` : lors du handoff N1→N2 (needsDeepAnalysis=true), inclure le contexte dans le job data
- [ ] Chaque étape log une entrée dans `decisionTrace[]` avec agent, action, rationale, timestamp
- [ ] Après traitement complet : `AgentSession.agentState` contient un objet AgentHandoffContext valide
- [ ] pnpm build 0 erreurs

### Fichiers clés

- `apps/api/src/modules/agent/agent.service.ts`
- `apps/api/src/modules/agent-v2/deep-analysis.service.ts`
- `apps/worker/src/workers/agent.worker.ts`
- `apps/worker/src/workers/triage.worker.ts`
