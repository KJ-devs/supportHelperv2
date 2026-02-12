#!/bin/bash
# protect-files.sh — Bloque l'edition de fichiers sensibles
# Utilise comme hook PreToolUse sur Edit/Write

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

PROTECTED_PATTERNS=(".env" ".env.local" ".env.production" "pnpm-lock.yaml" ".git/" "credentials" ".secret")

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  if [[ "$FILE_PATH" == *"$pattern"* ]]; then
    echo "Bloque: $FILE_PATH correspond au pattern protege '$pattern'. Modifie ce fichier manuellement." >&2
    exit 2
  fi
done

exit 0
