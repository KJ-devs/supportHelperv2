# Changelog

All notable changes to Support Helper Platform will be documented in this file.

## [0.2.0] - 2026-02-16

### Added
- Setup wizard for first-time configuration (US-7.3)
- License verification system with plan-based features (US-9.1)
- Auto-response to clients after ticket resolution (US-5.3)
- Validation mode for agent tasks (auto vs review) (US-3.4)
- Agent tasks dashboard with metrics and filters (US-6.1)
- GitHub settings page with merge configuration (US-6.2)
- Simplified update process with backup and health checks (US-7.5)

### Improved
- CI feedback loop for re-generation on failure (US-4.3)
- Real-time ticket timeline in dashboard (US-5.1)
- Client notifications with auto-merge support (US-5.2, US-4.4)

## [0.1.0] - 2026-02-13

### Added
- Initial release
- GitHub App integration (US-1.1 through US-1.4)
- Automatic issue creation and bidirectional sync (US-2.1, US-2.2, US-2.3)
- AI code agent with analysis and code generation (US-3.1, US-3.2, US-3.3)
- Git automation: branch, commit, PR (US-4.1, US-4.2)
- Docker Compose production-ready setup (US-7.1)
- Automatic database migrations (US-7.2)
- Health check and status page (US-7.4)
- BYOK AI key configuration (US-8.1)
- Data encryption at rest (US-10.1)

## [Unreleased] - 2026-02-08

### 🐛 Fixed
- **Recording functionality**: Fixed SDK recording by building the CDN bundle
  - The `test-sdk.html` file was referencing `dist/cdn/sdk.iife.js` which wasn't being built
  - Added `build:cdn` script and now both builds are generated with `build:all`
  - Recording now works correctly in all browsers

### 🧹 Cleanup
- Removed unnecessary files from project root:
  - `nul` - empty file artifact
  - `cliff.toml` - changelog generator config (not essential)
  - `DEMARRAGE_DASHBOARD.md` - French duplicate documentation

- Reorganized project structure:
  - Moved test files to `examples/` directory:
    - `test-sdk.html` - Full SDK integration test
    - `codec-test.html` - Browser codec compatibility tester
    - `test-api.js` - API testing script
    - `get-sdk-key.js` - SDK key retrieval utility
  - Moved `TESTING_GUIDE.md` to `docs/` directory
  - Created `examples/README.md` with comprehensive documentation

### ✨ Improvements
- Enhanced `.gitignore` to properly ignore `.turbo/` cache directory
- Updated SDK build process to generate both ESM/CJS and CDN (IIFE) bundles
- Cleaned up project root for better organization and maintainability

### 📚 Documentation
- Added detailed examples documentation
- Improved project structure clarity
- Better separation of concerns (examples vs docs vs source)

## Project Structure

```
support-helper/
├── apps/                    # Application packages
│   ├── api/                # NestJS backend API
│   ├── dashboard/          # Next.js dashboard frontend
│   ├── web/                # Marketing website (optional)
│   └── worker/             # Background job worker
├── packages/               # Shared packages
│   ├── sdk-web/           # Web SDK (builds to dist/ and dist/cdn/)
│   ├── shared/            # Shared types and utilities
│   └── database/          # Database utilities
├── examples/              # Test and example files
│   ├── test-sdk.html      # SDK integration test
│   ├── codec-test.html    # Codec compatibility test
│   ├── test-api.js        # API testing script
│   ├── get-sdk-key.js     # Utility script
│   └── README.md          # Examples documentation
├── docs/                  # Documentation
│   ├── API.md            # API reference
│   ├── SDK.md            # SDK usage guide
│   ├── ARCHITECTURE.md   # System architecture
│   ├── TESTING.md        # Testing guide
│   └── ...
└── docker/               # Docker configurations
```

## Building and Running

### Development
```bash
# Install dependencies
pnpm install

# Start infrastructure (PostgreSQL, Redis, MinIO)
pnpm docker:up

# Run migrations and seed
pnpm db:migrate
pnpm db:seed

# Build all packages
pnpm build

# Build SDK with CDN bundle
pnpm --filter @support-helper/sdk-web build:all

# Start development servers
pnpm dev
```

### Testing
```bash
# Run all tests
pnpm test

# Test API
pnpm --filter @support-helper/api test

# Test SDK
pnpm --filter @support-helper/sdk-web test

# Open test examples
# 1. Build SDK: pnpm --filter @support-helper/sdk-web build:all
# 2. Start API: pnpm --filter @support-helper/api dev
# 3. Open examples/test-sdk.html in browser
```

## Known Issues

### Fixed
- ✅ Recording not working - Fixed by building CDN bundle
- ✅ Project organization - Cleaned up and reorganized

### In Progress
None currently

## Notes

- The CDN build (`dist/cdn/sdk.iife.js`) is required for direct browser usage via `<script>` tags
- The regular build (`dist/index.es.js`, `dist/index.cjs.js`) is for npm package consumption
- Always run `build:all` when working on SDK examples to ensure both builds are up to date
