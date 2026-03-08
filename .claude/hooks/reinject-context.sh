#!/bin/bash
# reinject-context.sh — SessionStart hook: reinject critical context after compaction
# Matcher: "compact" — runs when context window is compacted

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"

# === US Summaries (shared memory between sessions) ===
if [ -f "$PROJECT_DIR/.claude/us-summaries.md" ]; then
  echo "=== CONTEXT REINJECTED (after compaction) ==="
  echo ""
  # Show last 3 completed US summaries for recent context
  echo "--- Recent US Summaries (last 3) ---"
  grep -A 5 "DONE" "$PROJECT_DIR/.claude/us-summaries.md" | tail -30
  echo ""
fi

# === Session state (CLAUDE.local.md) ===
if [ -f "$PROJECT_DIR/CLAUDE.local.md" ]; then
  echo "--- Session State ---"
  cat "$PROJECT_DIR/CLAUDE.local.md"
  echo ""
fi

# === Current branch ===
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "--- Git ---"
echo "  Branch: $BRANCH"

# === Uncommitted changes ===
CHANGES=$(git status --porcelain 2>/dev/null | head -10)
if [ -n "$CHANGES" ]; then
  echo "  Uncommitted changes:"
  echo "$CHANGES" | sed 's/^/    /'
fi
echo ""

# === Active GitHub issues ===
if command -v gh &> /dev/null; then
  echo "--- GitHub Issues ---"
  IN_PROGRESS=$(gh issue list --label "in-progress" --json number,title --jq '.[] | "#\(.number) \(.title)"' 2>/dev/null)
  if [ -n "$IN_PROGRESS" ]; then
    echo "  In progress: $IN_PROGRESS"
  else
    echo "  No US in progress"
  fi
  REMAINING=$(gh issue list --label "task" --json number --jq 'length' 2>/dev/null)
  if [ -n "$REMAINING" ]; then
    echo "  Remaining: $REMAINING US"
  fi
  echo ""
fi

# === Reminder ===
echo "=== WORKFLOW ==="
echo "  One feature at a time. Stabilize before moving on."
echo "  Skills: /forge, /status, /stabilizer, /test-all"
echo "  Agents: backend-dev, frontend-dev, dba, qa-engineer, ai-engineer, sdk-dev, devops, security-auditor"
echo ""

exit 0
