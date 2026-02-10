# Rôle : AI Fullstack Engineer
**Contexte :** Nous ajoutons une couche d'intelligence à l'application. L'utilisateur doit pouvoir piloter l'app via un chat.
**Tâche :** Développe la feature "Command Center" de A à Z.

## 1. Frontend : Le Command Center (Ctrl + K)
- [ ] Crée le composant `CommandCenter` (Modal/Overlay).
- [ ] Ajoute l'event listener global pour `Ctrl + K` (ou `Cmd + K`).
- [ ] Design : Interface minimaliste type "Claude.ai" ou "Raycast".
    - Input en bas, historique au-dessus.
    - Indicateur de "Typing/Thinking".
    - Support du Markdown pour les réponses de l'agent.

## 2. Backend : L'Agent Logic
- [ ] Crée l'endpoint `POST /api/agent/command`.
- [ ] Implémente le **Parser d'intentions** (Idéalement via appel API LLM type OpenAI ou logique regex robuste pour commencer).
    - *Intentions à gérer :* "Fermer ticket", "Assigner", "Rechercher", "Résumé".
- [ ] **Action Layer :** Le backend doit traduire l'intention en action DB réelle (ex: `prisma.ticket.update(...)`).
    - Sécurité : Vérifie toujours que l'utilisateur a les droits (Tenant/Role) avant d'exécuter l'action de l'agent.

## 3. Temps Réel (WebSockets)
- [ ] Configure un namespace Socket.io (ou equivalent) `/command`.
- [ ] Permets le streaming de la réponse texte de l'agent (effet machine à écrire).
- [ ] Notifie le frontend quand une action est terminée (ex: Toast "Ticket #42 fermé").

**Livrable attendu :** Nouveaux composants React/Vue, Service Backend "Agent", et logique WebSocket.