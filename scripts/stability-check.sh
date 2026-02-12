#!/bin/bash
# stability-check.sh — Verifie la stabilite de l'application (monorepo pnpm)
# Usage: bash scripts/stability-check.sh

set -uo pipefail

echo "========================================="
echo "  STABILITY CHECK — Support Helper"
echo "========================================="
echo ""

errors=0

# 1. Build
echo "[1/3] Build..."
if pnpm build 2>&1; then
  echo "  ✓ Build OK"
else
  echo "  ✗ Build FAILED"
  errors=$((errors + 1))
fi
echo ""

# 2. Tests
echo "[2/3] Tests..."
if pnpm test 2>&1; then
  echo "  ✓ Tests OK"
else
  echo "  ✗ Tests FAILED"
  errors=$((errors + 1))
fi
echo ""

# 3. Lint
echo "[3/3] Lint..."
if pnpm lint 2>&1; then
  echo "  ✓ Lint OK"
else
  echo "  ✗ Lint FAILED"
  errors=$((errors + 1))
fi
echo ""

echo "========================================="
if [ "$errors" -eq 0 ]; then
  echo "  RESULTAT: STABLE ✓"
  echo "  Tous les checks passent."
  echo "========================================="
  exit 0
else
  echo "  RESULTAT: INSTABLE ✗"
  echo "  $errors check(s) en echec."
  echo "========================================="
  exit 1
fi
