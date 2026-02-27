Cree une User Story structuree pour Support Helper Platform.

## Processus

1. Demande a l'utilisateur de decrire le besoin en langage naturel
2. Genere une User Story au format standard :

```markdown
## User Story: [Titre court]

**En tant que** [role utilisateur]
**Je veux** [action/fonctionnalite]
**Afin de** [benefice/valeur]

### Criteres d'acceptation

- [ ] [Critere 1]
- [ ] [Critere 2]
- [ ] [Critere 3]

### Details techniques

- **Package(s) concerne(s)** : [apps/api, apps/dashboard, packages/sdk-web, etc.]
- **Agent(s) Forge** : [backend-dev, frontend-dev, sdk-dev, dba, etc.]
- **Complexite estimee** : [S / M / L / XL]
- **Dependances** : [Autres US/taches requises avant]

### Notes

[Context additionnel, maquettes, references]
```

3. Cree une GitHub Issue avec le label `user-story` :
   ```bash
   gh issue create --title "US: [titre]" --body "[contenu]" --label "user-story"
   ```
4. Si `gh` n'est pas disponible, sauvegarde dans `docs/stories/US-[numero]-[slug].md`

## Regles

- Toujours inclure au moins 3 criteres d'acceptation
- Identifier les packages et agents Forge concernes
- Estimer la complexite (S = quelques heures, M = 1 jour, L = 2-3 jours, XL = 1 semaine+)
- Lier aux US existantes si dependance
