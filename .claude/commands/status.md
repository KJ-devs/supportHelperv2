Affiche un rapport de statut complet du projet Support Helper Platform.

## Actions a effectuer

1. **Git status** : branche courante, fichiers modifies, commits en avance/retard
2. **Build** : lance `pnpm build` et rapporte les succes/echecs par package
3. **Lint** : lance `pnpm lint` et rapporte le nombre d'erreurs/warnings
4. **Tests** : lance `pnpm test` et rapporte les resultats par package
5. **Docker** : verifie si les containers sont en cours d'execution

## Format de sortie

```
📊 STATUT PROJET — Support Helper Platform
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔀 Git: branche [nom] | [N] fichiers modifies | [ahead/behind]

🏗️ Build:
  ✅ @support-helper/api
  ✅ @support-helper/dashboard
  ❌ @support-helper/worker (13 erreurs TS)
  ...

🧹 Lint: [N] erreurs, [M] warnings

🧪 Tests:
  ✅ sdk-web: 24/24 pass
  ✅ dashboard: 21/21 pass
  ...

🐳 Docker: [running/stopped]
```
