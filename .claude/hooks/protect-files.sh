#!/bin/bash
# protect-files.sh — Unified file protection with pattern matching and bypass detection
# Event: PreToolUse (matcher: Write|Edit|Read)
# Prevents Claude from reading/writing protected files

set -euo pipefail

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')

# Only check file operations
if [[ "$TOOL_NAME" != "Read" && "$TOOL_NAME" != "Write" && "$TOOL_NAME" != "Edit" ]]; then
    exit 0
fi

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')

if [[ -z "$FILE_PATH" ]]; then
    exit 0
fi

FILENAME=$(basename "$FILE_PATH")

# Detect variable expansion / command substitution bypass attempts
if [[ "$FILE_PATH" =~ \$\{?[A-Za-z_][A-Za-z0-9_]*\}? ]] || [[ "$FILE_PATH" =~ \$\( ]] || [[ "$FILE_PATH" =~ \` ]]; then
    echo "BLOCKED: Variable expansion detected in path: $FILE_PATH. Use literal paths only." >&2
    exit 2
fi

# Protected file patterns
PROTECTED_PATTERNS=(
    ".env"
    ".env.local"
    ".env.production"
    ".env.development"
    "pnpm-lock.yaml"
    "credentials.json"
    "serviceAccountKey.json"
    ".secret"
    "id_rsa"
    "id_ed25519"
    "id_ecdsa"
    ".npmrc"
    ".pypirc"
    "secrets.yml"
    "secrets.yaml"
)

# Protected path fragments
PROTECTED_PATHS=(
    ".git/"
    ".ssh/"
    ".aws/"
    ".gnupg/"
)

# Check filename matches
for pattern in "${PROTECTED_PATTERNS[@]}"; do
    if [[ "$FILENAME" == "$pattern" ]]; then
        echo "BLOCKED: '$FILENAME' is a protected file. Edit it manually." >&2
        exit 2
    fi
done

# Check path fragments
for pattern in "${PROTECTED_PATHS[@]}"; do
    if [[ "$FILE_PATH" == *"$pattern"* ]]; then
        echo "BLOCKED: Path contains protected segment '$pattern'. Edit manually." >&2
        exit 2
    fi
done

# Check file extensions (keys, certs)
case "$FILENAME" in
    *.key|*.pem|*.p12|*.pfx|*.keystore)
        echo "BLOCKED: '$FILENAME' looks like a key/certificate file. Edit manually." >&2
        exit 2
        ;;
esac

exit 0
