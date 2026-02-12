Reinitialise la base de donnees de developpement.

## Actions

1. Verifie que Docker PostgreSQL est en cours d'execution (`docker compose ps`)
2. Si non, demande a l'utilisateur de lancer `pnpm docker:up`
3. Execute les etapes suivantes dans l'ordre :
   - `pnpm db:migrate` — applique toutes les migrations Prisma
   - `pnpm db:generate` — regenere le Prisma client (API + Worker)
   - `pnpm db:seed` — insere les donnees de test
4. Verifie que le Prisma client est bien genere
5. Confirme le succes

## Avertissement

Cette commande **reinitialise les donnees** de la base de developpement. Ne l'utilise JAMAIS sur un environnement de production.
