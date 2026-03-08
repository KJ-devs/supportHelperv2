#!/bin/bash
# session-summary.sh — Stop hook: auto-save session state to CLAUDE.local.md
# Tracks: active US, branch, modified files, decisions

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
LOCAL_MD="$PROJECT_DIR/CLAUDE.local.md"

# Get current state
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
DATE=$(date '+%Y-%m-%d %H:%M')

# Get active US from GitHub
IN_PROGRESS=""
DONE_COUNT=""
REMAINING=""
if command -v gh &> /dev/null; then
  IN_PROGRESS=$(gh issue list --label "in-progress" --json number,title --jq '.[] | "#\(.number) \(.title)"' 2>/dev/null | head -1)
  DONE_COUNT=$(gh issue list --state closed --label "done" --json number --jq 'length' 2>/dev/null)
  REMAINING=$(gh issue list --label "task" --json number --jq 'length' 2>/dev/null)
fi

# Get modified files (last 2 hours of commits)
MODIFIED_FILES=$(git log --since="2 hours ago" --name-only --pretty=format: 2>/dev/null | sort -u | grep -v '^$' | head -20)

# Build CLAUDE.local.md
{
  echo "# Session State (gitignored — auto-generated)"
  echo ""
  echo "> Auto-updated by session-summary.sh hook on Stop."
  echo "> Persists between sessions. Reinjected on compaction."
  echo ""
  echo "## Active Sprint"
  echo ""
  if [ -n "$IN_PROGRESS" ]; then
    echo "- **Active US** : $IN_PROGRESS"
  else
    echo "- **Active US** : none"
  fi
  echo "- **Branch** : \`$BRANCH\`"
  echo "- **Last updated** : $DATE"
  if [ -n "$DONE_COUNT" ]; then
    echo "- **US completed** : $DONE_COUNT"
  fi
  if [ -n "$REMAINING" ]; then
    echo "- **US remaining** : $REMAINING"
  fi
  echo ""

  # Preserve decisions section from existing file
  if [ -f "$LOCAL_MD" ] && grep -q "## Decisions" "$LOCAL_MD"; then
    sed -n '/## Decisions/,/^## [^D]/p' "$LOCAL_MD" | head -n -1
  else
    echo "## Decisions"
    echo ""
    echo "<!-- Record architectural decisions here -->"
    echo ""
  fi

  # Preserve known issues section
  if [ -f "$LOCAL_MD" ] && grep -q "## Known Issues" "$LOCAL_MD"; then
    sed -n '/## Known Issues/,/^## [^K]/p' "$LOCAL_MD" | head -n -1
  else
    echo "## Known Issues"
    echo ""
    echo "<!-- Track blockers and workarounds here -->"
    echo ""
  fi

  echo "## Session Log"
  echo ""
  echo "### $DATE"
  echo ""
  if [ -n "$MODIFIED_FILES" ]; then
    echo "**Files modified:**"
    echo "$MODIFIED_FILES" | while read -r f; do
      [ -n "$f" ] && echo "- \`$f\`"
    done
    echo ""
  fi
  if [ -n "$IN_PROGRESS" ]; then
    echo "**Active US:** $IN_PROGRESS"
  fi
  echo ""

} > "${LOCAL_MD}.tmp"

mv "${LOCAL_MD}.tmp" "$LOCAL_MD"

exit 0
