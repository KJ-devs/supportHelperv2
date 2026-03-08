---
paths:
  - 'apps/**/*.{ts,tsx}'
  - 'packages/**/*.{ts,tsx}'
---

# Regles de stabilite

- IMPORTANT : Apres toute modification de code, verifie build + tests + lint
- Ne desactive jamais un test existant pour "faire passer" une feature
- Ne supprime jamais une regle ESLint sans justification documentee
- Chaque feature doit etre stable AVANT de passer a la suivante
- Utilise `bash scripts/stability-check.sh` pour un check complet
- En cas de regression, stop tout et corrige la regression d'abord
- Pre-commit: `pnpm build` doit passer avec 0 erreurs avant tout push
- Push directly to `main` (remote: `supportHelperv2`) — no feature branches
- NEVER run `pnpm test` globally — test one package at a time with `--maxWorkers=2`
