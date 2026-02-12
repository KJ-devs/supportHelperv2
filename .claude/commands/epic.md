Cree un Epic decompose en User Stories pour Support Helper Platform.

## Processus

1. Demande a l'utilisateur de decrire la fonctionnalite globale
2. Analyse la demande et decompose en User Stories atomiques
3. Genere un Epic au format :

```markdown
## Epic: [Titre]

### Description

[Description de la fonctionnalite globale et de sa valeur]

### User Stories

| # | User Story | Complexite | Agent(s) Forge | Statut |
|---|-----------|------------|----------------|--------|
| 1 | [US titre] | S/M/L/XL | backend-dev | A faire |
| 2 | [US titre] | S/M/L/XL | frontend-dev | A faire |
| 3 | [US titre] | S/M/L/XL | dba, backend-dev | A faire |

### Ordre d'execution

1. **Phase 1 (prerequis)** : US qui doivent etre faites en premier (DB, API)
2. **Phase 2 (core)** : US principales (parallelisables)
3. **Phase 3 (finition)** : Tests, docs, polish

### Dependances externes

- [Services tiers, APIs, decisions d'architecture en attente]

### Definition of Done

- [ ] Toutes les US terminees
- [ ] Tests passes (`pnpm test`)
- [ ] Build OK (`pnpm build`)
- [ ] Documentation a jour
- [ ] Review securite si necessaire
```

4. Cree une GitHub Issue avec le label `epic` :
   ```bash
   gh issue create --title "Epic: [titre]" --body "[contenu]" --label "epic"
   ```
5. Propose de creer chaque US individuellement via `/us`
6. Si `gh` n'est pas disponible, sauvegarde dans `docs/stories/EPIC-[numero]-[slug].md`

## Regles

- Decomposer en US suffisamment petites (max complexite L chacune)
- Identifier les dependances entre US
- Proposer un ordre d'execution optimal pour Forge
- Chaque US doit etre assignable a un seul agent Forge principal
