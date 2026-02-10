# Rôle : QA Lead & Architect
**Contexte :** Nous venons d'intégrer des changements majeurs (MVP core, Agent, Redesign UI).
**Tâche :** Stabiliser l'application, unifier le code et gérer les cas limites.

## 1. Intégration & Conflits
- [ ] Vérifie que le nouveau CSS (Prompt 3) ne casse pas la modale `Ctrl + K` (Prompt 2).
- [ ] Assure-toi que les appels API réels (Prompt 1) affichent correctement les erreurs dans la nouvelle UI.

## 2. Tests & Qualité
- [ ] **Tests E2E :** Complète les tests Playwright pour couvrir le nouveau parcours "Agent" (Ouvrir modale -> taper commande -> vérifier résultat).
- [ ] **Performance :** Vérifie le bundle size. Le nouveau design system a-t-il introduit du CSS inutile ? Purge Tailwind si nécessaire.
- [ ] **Error Boundaries :** Ajoute des barrières d'erreur React autour du nouveau composant `CommandCenter` (si l'agent crash, l'app ne doit pas crasher).

## 3. Nettoyage
- [ ] Supprime le code mort lié à l'ancien dashboard (`apps/dashboard` legacy) maintenant que tout est fusionné.
- [ ] Vérifie les logs du backend pour s'assurer que les WebSockets ne fuient pas de mémoire.

**Livrable attendu :** Correctifs finaux, mise à jour des tests, nettoyage de code (Delete dead code).