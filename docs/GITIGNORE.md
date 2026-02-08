# .gitignore Configuration

Ce fichier liste tous les patterns ignorés par Git pour éviter de pousser des fichiers indésirables.

## Fichiers ignorés

### 📦 Dépendances
- `node_modules/` - Dépendances npm/pnpm (toujours réinstallables)
- `.pnpm-store/` - Cache pnpm

### 🏗️ Sorties de build
- `dist/` - Builds compilés (régénérables)
- `.next/` - Cache Next.js
- `out/` - Exports Next.js
- `build/` - Builds généraux

### 🔐 Variables d'environnement
- `.env` - Variables locales
- `.env.local` - Variables locales spécifiques
- `.env.*.local` - Variables d'environnement par mode (dev, prod, test)
- ✅ `.env.example` - Gardé (template)

### 💻 IDE & Éditeurs
- `.idea/` - IntelliJ IDEA
- `.vscode/` - VS Code settings locaux
- `*.swp`, `*.swo` - Fichiers temporaires Vim

### 🖥️ OS
- `.DS_Store` - Métadonnées macOS
- `Thumbs.db` - Cache Windows

### 📝 Logs
- `*.log` - Tous les logs
- `npm-debug.log*` - Logs npm
- `pnpm-debug.log*` - Logs pnpm
- `debug.log` - Logs de debug généraux

### 🧪 Tests
- `coverage/` - Rapports de couverture de code
- `.nyc_output/` - Cache Istanbul/NYC
- `test-results/` - Résultats Playwright
- `playwright-report/` - Rapports Playwright

### ⚡ Build Cache
- `.turbo/` - Cache Turborepo

### 🐳 Docker
- `data/` - Volumes Docker locaux (PostgreSQL, Redis, MinIO)

### 🤖 Claude Code
- `.claude/` - Données locales Claude Code

### 🔧 Divers
- `*.tsbuildinfo` - Cache TypeScript incrémental
- `.eslintcache` - Cache ESLint

## ✅ Fichiers suivis (à pousser)

### Configuration
- ✅ `.env.example` - Template des variables d'environnement
- ✅ `.gitignore` - Ce fichier
- ✅ `.prettierrc` - Configuration Prettier
- ✅ `package.json` - Manifeste du projet
- ✅ `pnpm-workspace.yaml` - Configuration monorepo
- ✅ `turbo.json` - Configuration Turborepo
- ✅ `tsconfig.base.json` - Configuration TypeScript de base

### Code source
- ✅ `apps/` - Toutes les applications
- ✅ `packages/` - Tous les packages partagés

### Documentation
- ✅ `README.md` - Documentation principale
- ✅ `QUICKSTART.md` - Guide de démarrage rapide
- ✅ `CHANGELOG.md` - Historique des changements
- ✅ `docs/` - Toute la documentation
- ✅ `examples/` - Exemples et tests

### Infrastructure
- ✅ `docker/` - Configuration Docker
- ✅ `docker-compose.yml` - Composition Docker
- ✅ `.github/` - Workflows CI/CD

### Scripts
- ✅ `setup.bat` - Script de setup Windows
- ✅ `setup.sh` - Script de setup Unix/Linux

## 🚨 Attention

### Ne JAMAIS commiter:
- ❌ Fichiers `.env` avec des secrets réels
- ❌ Clés API ou tokens
- ❌ Mots de passe
- ❌ Certificats SSL privés
- ❌ `node_modules/`
- ❌ Fichiers de build (`dist/`, `.next/`)
- ❌ Données de base de données (`data/`)
- ❌ Logs avec des données sensibles

### Toujours vérifier avant de commiter:
```bash
# Voir ce qui sera committé
git status

# Voir le contenu des changements
git diff

# Vérifier qu'aucun secret n'est inclus
git diff | grep -i "password\|api_key\|secret\|token"
```

## 📊 Vérification

Pour vérifier que le .gitignore fonctionne correctement:

```bash
# Voir les fichiers non suivis
git status --short

# Lister tous les fichiers suivis
git ls-files

# Tester si un fichier est ignoré
git check-ignore -v <fichier>

# Exemple:
git check-ignore -v .env.local
# Output: .gitignore:13:.env.local    .env.local
```

## 🔄 Après modification du .gitignore

Si vous modifiez `.gitignore` pour ignorer des fichiers déjà trackés:

```bash
# Retirer du cache Git (sans supprimer localement)
git rm --cached <fichier>

# Ou pour un dossier
git rm --cached -r <dossier>/

# Puis commiter le changement
git add .gitignore
git commit -m "chore: update .gitignore"
```

## 📝 Notes

- Le `.gitignore` est hiérarchique - vous pouvez avoir des `.gitignore` dans les sous-dossiers
- Utilisez `!` pour forcer l'inclusion d'un fichier normalement ignoré (ex: `!.env.example`)
- Les patterns utilisent la syntaxe glob de Git
- Les lignes vides et celles commençant par `#` sont ignorées

---

**Dernière mise à jour:** 8 février 2026
