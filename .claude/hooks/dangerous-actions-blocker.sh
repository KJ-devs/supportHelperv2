#!/bin/bash
# dangerous-actions-blocker.sh — Block destructive commands and secrets in commands
# Event: PreToolUse (matcher: Bash)
# Exit 0 = allow, Exit 2 = block

set -euo pipefail

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

if [[ "$TOOL_NAME" != "Bash" ]]; then
    exit 0
fi

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# === Destructive commands ===
DANGEROUS_PATTERNS=(
    "rm -rf /"
    "rm -rf ~"
    "rm -rf \$HOME"
    "dd if="
    "mkfs"
    ":(){:|:&};:"
    "> /dev/sda"
    "chmod -R 777 /"
    "chown -R"
    "sudo rm"
    "DROP DATABASE"
    "DROP TABLE"
    "--no-preserve-root"
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
    if [[ "$COMMAND" == *"$pattern"* ]]; then
        echo "BLOCKED: Dangerous command detected: '$pattern'" >&2
        exit 2
    fi
done

# === Force push to main/master ===
if echo "$COMMAND" | grep -qE "git push.*(-f|--force).*(main|master)"; then
    echo "BLOCKED: Force push to main/master is forbidden" >&2
    exit 2
fi

# === npm/pnpm publish without intent ===
if echo "$COMMAND" | grep -qE "npm publish|pnpm publish|yarn publish"; then
    echo "BLOCKED: Package publication requires manual confirmation" >&2
    exit 2
fi

# === Secrets in commands ===
SECRET_PATTERNS=(
    "password="
    "PASSWORD="
    "secret="
    "SECRET="
    "api_key="
    "API_KEY="
    "apikey="
    "aws_access_key"
    "AWS_ACCESS_KEY"
    "aws_secret"
    "AWS_SECRET"
    "private_key"
    "PRIVATE_KEY"
)

for pattern in "${SECRET_PATTERNS[@]}"; do
    if echo "$COMMAND" | grep -qi "$pattern"; then
        echo "BLOCKED: Potential secret detected in command: '$pattern'" >&2
        exit 2
    fi
done

# === Hardcoded API keys ===
if echo "$COMMAND" | grep -qE "(sk-[a-zA-Z0-9]{20,}|pk_[a-zA-Z0-9]{20,})"; then
    echo "BLOCKED: Potential API key detected in command" >&2
    exit 2
fi

# === Deletion warning (non-blocking) ===
if echo "$COMMAND" | grep -qE "rm -r|rmdir"; then
    echo '{"systemMessage": "Warning: File deletion detected. Verify this is intentional."}'
fi

exit 0
