# Rôle : Senior UI/UX Designer & Frontend Developer
**Contexte :** L'application fonctionne mais manque de cohérence visuelle. Nous visons une esthétique "Premium SaaS" (Style Linear, Vercel, Claude).
**Tâche :** Refactoriser le CSS, Tailwind et la structure des pages principales.

## 1. Design System & Tokens
- [ ] **Palette :** Passe sur des gris neutres, accentuation subtile (violet/bleu). Mode sombre profond.
- [ ] **Typo :** Force l'usage de Inter ou Geist Mono. Hiérarchie stricte (H1 vs H2 vs Body).
- [ ] **Composants :** Revisite les Boutons, Inputs et Cards (Bordures fines, ombres douces, micro-interactions au hover).

## 2. Structure Globale
- [ ] **Sidebar :** Redesign style "Linear". Navigation compacte. Mode "Icons only" si collapsed. Section "Favoris" épinglée.
- [ ] **Header :** Simplifie-le. Supprime la barre de recherche visuelle (puisque `Ctrl+K` arrive). Ajoute des Breadcrumbs contextuels.

## 3. Vues Tickets & Dashboard
- [ ] **Liste Tickets :** Tableau compact, haute densité d'information mais lisible. Hover states sur les lignes.
- [ ] **Détail Ticket :** Layout 2 colonnes (Contenu principal à gauche, Metadata sidebar à droite). Timeline verticale propre.
- [ ] **Dashboard Overview :** Refais les graphiques (style minimaliste, pas de grilles lourdes). Ajoute des "Sparklines" dans les cartes métriques.

**Livrable attendu :** Refonte des fichiers CSS/Tailwind config, mise à jour des composants Layout, Sidebar, et TicketList.