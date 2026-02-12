# Role : Senior Backend Engineer - Integration Sync Specialist
**Contexte :** La synchronisation des tickets vers les integrations tierces (Jira, HubSpot, Slack, Discord, Notion) est incomplete et cassee a plusieurs niveaux. Les tickets se creent dans les systemes externes mais ne se mettent jamais a jour, les suppressions sont ignorees, et des doublons sont crees au lieu de mettre a jour les enregistrements existants.
**Tache :** Analyse, corrige et complete le systeme de synchronisation des tickets.

**IMPORTANT :** Avant de commencer, lis `docs/PROJECT.md` pour comprendre l'etat actuel du projet. A la fin, mets a jour `docs/PROJECT.md` section "2. Roadmap" avec les taches restantes liees aux integrations.

---

## Diagnostic : Pourquoi la synchronisation ne fonctionne pas

### Probleme 1 : Aucune synchronisation au update d'un ticket (CRITIQUE)
**Fichier :** `apps/api/src/modules/tickets/tickets.controller.ts` (~ligne 131-153)

Quand un ticket est mis a jour via `PATCH /tickets/:id`, la methode `update()` ne declenche **jamais** de sync vers les integrations. Seul le `create()` appelle `integrationsSyncService.syncTicketToAllEnabledIntegrations()`.

**Consequence :** Un ticket cree et synchronise vers Jira/Slack/etc. ne sera jamais mis a jour dans ces systemes. Les changements de statut, severite, description restent invisibles aux integrations.

### Probleme 2 : Pas de lookup automatique de l'externalId (CRITIQUE)
**Fichiers :**
- `apps/api/src/modules/integrations/integrations-sync.service.ts` (~lignes 15-70, 104-128)
- `apps/worker/src/workers/integration-sync.worker.ts` (~lignes 77-80)

Le worker a besoin de l'`externalId` (l'ID du ticket dans le systeme externe) pour faire un UPDATE au lieu d'un CREATE. Mais :
- `syncTicketToAllEnabledIntegrations()` envoie toujours `action: 'create'`
- Il n'y a **aucune requete** vers `IntegrationSyncLog` pour retrouver un `externalId` existant
- Si on relance un sync sur un ticket deja synchronise, un **doublon** est cree dans le systeme externe

### Probleme 3 : `deleteTicket()` manquant sur 3 providers (MOYEN)
**Fichiers :**
- `apps/api/src/modules/integrations/providers/slack.provider.ts` - Methode absente
- `apps/api/src/modules/integrations/providers/discord.provider.ts` - Methode absente
- `apps/api/src/modules/integrations/providers/notion.provider.ts` - Methode absente

Le worker verifie `'deleteTicket' in provider` avant d'appeler la methode. Si elle n'existe pas, la suppression est **silencieusement ignoree**. Seul HubSpot supprime reellement, Jira fait un no-op avec log.

### Probleme 4 : Slack et Discord `updateTicket()` creent un nouveau message au lieu de modifier l'existant (MOYEN)
**Fichiers :**
- `apps/api/src/modules/integrations/providers/slack.provider.ts` (~ligne 131) - `updateTicket()` appelle simplement `syncTicket()` (nouveau message)
- `apps/api/src/modules/integrations/providers/discord.provider.ts` (~ligne 130) - Idem

### Probleme 5 : Echec de dechiffrement silencieux (BAS)
**Fichier :** `apps/api/src/modules/integrations/integrations.service.ts` (~lignes 228-245)

Quand le dechiffrement AES des credentials echoue, le service retourne un `config: {}` vide au lieu de lancer une erreur. La sync echoue ensuite avec un message cryptique "Missing required field: apiToken" au lieu de "Decryption failed".

### Probleme 6 : Code crypto duplique entre API et Worker (BAS)
**Fichiers :**
- `apps/api/src/modules/integrations/integrations-crypto.service.ts` (lignes 8-23)
- `apps/worker/src/workers/integration-sync.worker.ts` (lignes 19-33, 135-147)

La meme logique AES-256-GCM est implementee deux fois. Si l'une est modifiee sans l'autre, le worker ne pourra plus dechiffrer les configs.

---

## Taches de correction

### Task 1 : Ajouter le sync automatique au update de ticket (CRITIQUE)
**Fichiers a modifier :**
- `apps/api/src/modules/tickets/tickets.controller.ts`
- `apps/api/src/modules/integrations/integrations-sync.service.ts`

**Instructions :**
1. Dans `tickets.controller.ts`, methode `update()`, apres la mise a jour du ticket, appeler `integrationsSyncService.syncTicketToAllEnabledIntegrations(id, tenantId)` avec l'action `'update'` au lieu de `'create'`.
2. Dans `integrations-sync.service.ts`, modifier `syncTicketToAllEnabledIntegrations()` pour accepter un parametre `action` optionnel (`'create' | 'update'`, defaut `'create'`).
3. Quand `action === 'update'`, chercher l'`externalId` existant dans `IntegrationSyncLog` avant de queuer le job :
```typescript
const existingLog = await this.prisma.integrationSyncLog.findFirst({
  where: {
    ticketId,
    integrationId: integration.id,
    status: 'success',
    externalId: { not: null }
  },
  orderBy: { syncedAt: 'desc' }
});
// Si existingLog.externalId existe -> action 'update' avec metadata.externalId
// Sinon -> action 'create'
```

### Task 2 : Ajouter le sync automatique a la suppression de ticket (MOYEN)
**Fichiers a modifier :**
- `apps/api/src/modules/tickets/tickets.controller.ts`
- `apps/api/src/modules/integrations/integrations-sync.service.ts`

**Instructions :**
1. Dans `tickets.controller.ts`, methode `remove()`, avant la suppression du ticket, recuperer les `IntegrationSyncLog` existants pour connaitre les `externalId`.
2. Queuer un job `'delete'` pour chaque integration avec l'`externalId` correspondant.
3. Ajouter une methode `deleteTicketFromAllIntegrations(ticketId, tenantId)` dans `integrations-sync.service.ts`.

### Task 3 : Implementer `deleteTicket()` pour Slack, Discord et Notion (MOYEN)
**Fichiers a modifier :**
- `apps/api/src/modules/integrations/providers/slack.provider.ts`
- `apps/api/src/modules/integrations/providers/discord.provider.ts`
- `apps/api/src/modules/integrations/providers/notion.provider.ts`

**Instructions :**
- **Slack** : Utiliser `chat.delete` API pour supprimer le message (necessite `externalId` = timestamp du message + channel).
- **Discord** : Utiliser `DELETE /channels/{channel_id}/messages/{message_id}` pour supprimer le message.
- **Notion** : Utiliser `PATCH /pages/{page_id}` avec `{ archived: true }` pour archiver la page.

### Task 4 : Corriger `updateTicket()` pour Slack et Discord (MOYEN)
**Fichiers a modifier :**
- `apps/api/src/modules/integrations/providers/slack.provider.ts`
- `apps/api/src/modules/integrations/providers/discord.provider.ts`

**Instructions :**
- **Slack** : Remplacer l'appel a `syncTicket()` par `chat.update` API avec le `externalId` (message timestamp).
- **Discord** : Remplacer l'appel a `syncTicket()` par `PATCH /channels/{channel_id}/messages/{message_id}` avec le contenu mis a jour.

### Task 5 : Corriger l'echec silencieux du dechiffrement (BAS)
**Fichier a modifier :**
- `apps/api/src/modules/integrations/integrations.service.ts`

**Instructions :**
1. Dans `decryptIntegration()`, au lieu de retourner `config: {}` en cas d'erreur, lever une exception claire :
```typescript
catch (error) {
  this.logger.error(`Failed to decrypt integration ${integration.id}: ${error.message}`);
  throw new InternalServerErrorException(
    `Integration ${integration.name} has corrupted credentials. Please reconfigure.`
  );
}
```
2. Pour les endpoints de listing (ou on ne veut pas bloquer toute la liste), ajouter un flag `decryptionFailed: true` au lieu de `config: {}` et filtrer cote frontend.

### Task 6 : Extraire le crypto service dans `packages/shared` (BAS)
**Fichiers a modifier :**
- `packages/shared/src/` - Creer `crypto.service.ts` ou `encryption.ts`
- `apps/api/src/modules/integrations/integrations-crypto.service.ts` - Importer depuis shared
- `apps/worker/src/workers/integration-sync.worker.ts` - Supprimer la methode `decrypt()` inline, importer depuis shared

**Instructions :**
1. Extraire la logique `encrypt()`/`decrypt()` dans un module shared reutilisable.
2. Les deux packages (api et worker) importent depuis `@support-helper/shared`.
3. Supprimer le code duplique.

### Task 7 : Ajouter des tests pour le flux de synchronisation (BAS)
**Fichiers a creer :**
- `apps/api/src/modules/integrations/__tests__/integrations-sync.service.spec.ts`
- `apps/worker/src/workers/__tests__/integration-sync.worker.spec.ts`

**Instructions :**
1. Tester le flow complet : create -> update (avec externalId lookup) -> delete.
2. Tester les cas d'erreur : dechiffrement echoue, provider echoue, externalId manquant.
3. Tester que les doublons ne sont pas crees lors d'un re-sync.
4. Mocker les providers et BullMQ.

---

## Ordre d'execution recommande

```
Task 1 (sync update)   ──> Task 4 (fix Slack/Discord update)
     │
     └──> Task 2 (sync delete) ──> Task 3 (implement deleteTicket)
                                        │
Task 5 (fix decryption) ────────────────┘
Task 6 (extract crypto) ──> Task 7 (tests)
```

**Priorite absolue :** Tasks 1 et 4 ensemble (sans sync update, le systeme est fondamentalement casse).

---

## Mise a jour PROJECT.md

**A la fin du travail**, lis `docs/PROJECT.md` et mets a jour la section **"2. Roadmap"** :
1. Ajoute une sous-section **"2.3 Fix Integrations - Synchronisation tickets"** avec les taches ci-dessus.
2. Coche les taches completees.
3. Laisse non-cochees les taches restantes avec une note sur ce qui bloque.
4. Si d'autres problemes ont ete decouverts pendant l'implementation, ajoute-les a la roadmap.

**Livrable attendu :** Code corrige, tests ajoutes, et `docs/PROJECT.md` mis a jour avec l'etat actuel du systeme d'integrations.
