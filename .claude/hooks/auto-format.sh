#!/bin/bash
# auto-format.sh — Auto-format files after editing
# Event: PostToolUse (matcher: Write|Edit)

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name')

if [[ "$TOOL" != "Write" && "$TOOL" != "Edit" ]]; then
    exit 0
fi

FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ -z "$FILE" || "$FILE" == "null" || ! -f "$FILE" ]]; then
    exit 0
fi

EXT="${FILE##*.}"

case "$EXT" in
    js|jsx|ts|tsx|json|css|scss|md|html)
        if command -v npx &> /dev/null && [[ -f "node_modules/.bin/prettier" ]]; then
            npx prettier --write "$FILE" 2>/dev/null
        fi
        ;;
esac

exit 0
