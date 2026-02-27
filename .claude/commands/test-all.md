Lance tous les tests du monorepo et presente un rapport detaille.

## Actions

1. Lance les tests package par package dans l'ordre :
   - `pnpm --filter @support-helper/shared test`
   - `pnpm --filter @support-helper/database test`
   - `pnpm --filter @support-helper/sdk-web test`
   - `pnpm --filter @support-helper/api test`
   - `pnpm --filter @support-helper/dashboard test`

2. Pour chaque package, rapporte :
   - Nombre de tests pass/fail/skip
   - Duree d'execution
   - Erreurs detaillees si echec

3. Resume final avec le total global

## Format

```
🧪 TESTS — Support Helper Platform
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 @support-helper/shared     ✅ 45/45 pass (2.1s)
📦 @support-helper/database   ✅ 20/20 pass, 8 skip (2.6s)
📦 @support-helper/sdk-web    ✅ 24/24 pass (6.5s)
📦 @support-helper/api        ⚠️ 51 pass, 6 suites fail (12s)
📦 @support-helper/dashboard  ✅ 21/21 pass (4s)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: [N] pass | [M] fail | [K] skip
```
