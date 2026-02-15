#!/usr/bin/env bash
# ============================================================
# generate-secrets.sh
# Generate all required secrets for Support Helper Platform
#
# Usage:
#   ./scripts/generate-secrets.sh              # Print to stdout
#   ./scripts/generate-secrets.sh --write      # Append to .env.local
#   ./scripts/generate-secrets.sh --write .env  # Append to custom file
# ============================================================

set -euo pipefail

# ── Color helpers (disabled when piped) ─────────────────────
if [ -t 1 ]; then
  BOLD='\033[1m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  RESET='\033[0m'
else
  BOLD=''
  GREEN=''
  YELLOW=''
  RESET=''
fi

# ── Secret generation ──────────────────────────────────────
generate_hex() {
  # Prefer openssl, fall back to Node.js
  if command -v openssl &>/dev/null; then
    openssl rand -hex 32
  elif command -v node &>/dev/null; then
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  else
    echo "ERROR: Neither openssl nor node found. Install one to generate secrets." >&2
    exit 1
  fi
}

# ── Generate all secrets ───────────────────────────────────
JWT_SECRET=$(generate_hex)
JWT_REFRESH_SECRET=$(generate_hex)
ENCRYPTION_KEY=$(generate_hex)
INTEGRATION_ENCRYPTION_KEY=$(generate_hex)
GITHUB_WEBHOOK_SECRET=$(generate_hex)
REDIS_PASSWORD=$(generate_hex)
POSTGRES_PASSWORD=$(generate_hex)

# ── Output block ───────────────────────────────────────────
SECRETS_BLOCK="# ============================================
# Generated secrets - $(date -u '+%Y-%m-%d %H:%M:%S UTC')
# ============================================

# Auth / JWT
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}

# Encryption (Data at Rest)
ENCRYPTION_KEY=${ENCRYPTION_KEY}
INTEGRATION_ENCRYPTION_KEY=${INTEGRATION_ENCRYPTION_KEY}

# GitHub Webhook
GITHUB_WEBHOOK_SECRET=${GITHUB_WEBHOOK_SECRET}

# Production Infrastructure
REDIS_PASSWORD=${REDIS_PASSWORD}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"

# ── Write mode or stdout ──────────────────────────────────
if [ "${1:-}" = "--write" ]; then
  ENV_FILE="${2:-.env.local}"

  if [ -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}Appending secrets to ${ENV_FILE}${RESET}"
  else
    echo -e "${GREEN}Creating ${ENV_FILE}${RESET}"
  fi

  echo "" >> "$ENV_FILE"
  echo "$SECRETS_BLOCK" >> "$ENV_FILE"
  echo -e "${GREEN}Secrets written to ${ENV_FILE}${RESET}"
  echo ""
  echo -e "${YELLOW}IMPORTANT: Do not commit ${ENV_FILE} to version control.${RESET}"
else
  echo -e "${BOLD}Support Helper - Generated Secrets${RESET}"
  echo ""
  echo "$SECRETS_BLOCK"
  echo ""
  echo -e "${YELLOW}Copy the values above into your .env.local file.${RESET}"
  echo -e "Or run: ${GREEN}./scripts/generate-secrets.sh --write${RESET}"
fi
