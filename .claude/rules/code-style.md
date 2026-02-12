---
paths:
  - "apps/**/*.{ts,tsx}"
  - "packages/**/*.{ts,tsx}"
---

# Regles de code style

- Pas de `any` en TypeScript — utilise des types stricts
- Pas de `console.log` en production — utilise le LoggerService (NestJS) ou un logger
- Pas de code commente — supprime-le ou cree une issue
- Fonctions courtes et focalisees (< 50 lignes)
- Nommage explicite : pas d'abreviations cryptiques
- Imports organises : dependances externes d'abord, puis internes
