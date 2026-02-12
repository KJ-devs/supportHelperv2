Cree un rapport de bug structure pour Support Helper Platform.

## Processus

1. Demande a l'utilisateur de decrire le bug
2. Genere un rapport de bug au format :

```markdown
## Bug: [Titre court et descriptif]

### Description

[Description claire du comportement incorrect]

### Steps to Reproduce

1. [Etape 1]
2. [Etape 2]
3. [Etape 3]

### Comportement attendu

[Ce qui devrait se passer]

### Comportement actuel

[Ce qui se passe reellement]

### Environnement

- **Package(s)** : [apps/api, apps/dashboard, apps/web, packages/sdk-web]
- **Navigateur** : [si applicable]
- **OS** : [si applicable]

### Severite

- [ ] **Critique** — Bloque totalement l'utilisation
- [ ] **Haute** — Fonctionnalite majeure cassee, pas de workaround
- [ ] **Moyenne** — Fonctionnalite impactee mais workaround possible
- [ ] **Basse** — Probleme mineur, cosmetique

### Investigation preliminaire

- **Fichier(s) suspect(s)** : [fichiers probablement concernes]
- **Agent Forge** : [agent a assigner pour le fix]
- **Cause probable** : [hypothese si identifiee]

### Screenshots / Logs

[Ajouter si disponible]
```

3. Cree une GitHub Issue avec les labels `bug` + severite :
   ```bash
   gh issue create --title "Bug: [titre]" --body "[contenu]" --label "bug,severity:[level]"
   ```
4. Si `gh` n'est pas disponible, sauvegarde dans `docs/stories/BUG-[numero]-[slug].md`

## Regles

- Toujours inclure les steps to reproduce
- Identifier la severite
- Proposer une investigation preliminaire si le code source est accessible
- Lier aux US/epics si le bug concerne une feature recente
