# Changelog

All notable changes to the Support Helper Platform will be documented in this file.

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
