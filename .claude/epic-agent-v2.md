## Epic: Architecture Agentique v2

### Description

Le système agentique actuel (Triage → N1 → N2) souffre de plusieurs problèmes structurels :
- La page "Agent Tasks" reste bloquée en état "analyse permanente" (absence de WebSocket)
- Pas de mémoire structurée entre agents (agentState JSON libre, non typé)
- Priorisation des jobs fixe, non liée à la sévérité du ticket
- Handoff N1→N2 sans contexte riche — N2 re-analyse ce que N1 a déjà fait

Cet epic améliore l'architecture globale : robustesse du real-time, mémoire inter-agents typée, scalabilité par priorisation dynamique, et handoff structuré.

### User Stories

| # | User Story | Complexité | Agent(s) | Statut |
|---|-----------|------------|----------|--------|
| US-AGENT-01 | Fix temps réel page Agent Tasks (WebSocket) | M | frontend-dev | À faire |
| US-AGENT-02 | Définir AgentHandoffContext dans packages/shared | S | backend-dev | À faire |
| US-AGENT-03 | Propager AgentHandoffContext dans le pipeline | L | backend-dev | À faire |
| US-AGENT-04 | Priorisation dynamique des jobs par sévérité | M | backend-dev | À faire |
| US-AGENT-05 | QueueMonitorService et endpoint métriques | M | backend-dev | À faire |
| US-AGENT-06 | Escalade N1→N2 avec contexte riche et event WebSocket | L | backend-dev, frontend-dev | À faire |

### Ordre d'exécution

1. **Phase 1 — Fix immédiat (P0)**
   - US-AGENT-01 : Fix real-time page Agent Tasks (aucune dépendance)
   - US-AGENT-02 : Définir AgentHandoffContext (aucune dépendance, parallélisable avec US-01)

2. **Phase 2 — Mémoire partagée (P1)**
   - US-AGENT-03 : Propager le contexte dans le pipeline (dépend de US-AGENT-02)
   - US-AGENT-04 : Priorisation dynamique (aucune dépendance, parallélisable)

3. **Phase 3 — Scalabilité (P1)**
   - US-AGENT-05 : QueueMonitorService (dépend de US-AGENT-04)

4. **Phase 4 — Handoff structuré (P2)**
   - US-AGENT-06 : Escalade N1→N2 enrichie (dépend de US-AGENT-02 et US-AGENT-03)

### Definition of Done

- [ ] US-AGENT-01 : Page Agent Tasks se met à jour en temps réel sans refresh
- [ ] US-AGENT-02 : Interface AgentHandoffContext exportée et typée dans shared
- [ ] US-AGENT-03 : decisionTrace[] rempli après chaque étape du pipeline
- [ ] US-AGENT-04 : Tickets critiques traités avant tickets low priority
- [ ] US-AGENT-05 : GET /api/admin/queue-metrics retourne métriques valides
- [ ] US-AGENT-06 : Event agent:escalated-to-n2 visible dans timeline dashboard
- [ ] Tous les tests passent (pnpm test)
- [ ] Build OK (pnpm build 0 erreurs)
