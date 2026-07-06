#!/bin/bash
# Headless Claude Code loop: one GitHub issue per iteration.
#
# Each iteration the SCRIPT picks the next open issue (oldest first,
# skipping titles containing "HITL" or "PRD" and issues already
# attempted this run) and hands exactly that issue to a headless
# claude run in a docker sandbox.
#
# PRD-titled issues are planning documents that child issues are
# spawned from (children carry a "Parent PRD" back-reference in their
# body), so they are never picked as work items. Instead, once a PRD
# has children and ALL of them are closed, it is handed to claude as a
# REVIEW task (prd-review-prompt.md): verify the codebase against the
# PRD, then COMPLETE closes it with a review comment, INCOMPLETE
# leaves it open with a gap report.
#
# Claude works and commits, then ends its final message with a
# STATUS: COMPLETE|INCOMPLETE verdict and a SUMMARY. The sandbox has
# no GitHub credentials, so this script (on the host) then pushes the
# commits, posts the SUMMARY as an issue comment, and closes the issue
# if the verdict was COMPLETE. Stops when the backlog is empty or the
# iteration cap is reached.
#
# Usage:
#   ralph/issue-loop.sh <max-iterations> [label]
#   DRY_RUN=1 ralph/issue-loop.sh 5        # preview issue selection only
set -uo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <max-iterations> [label]"
  echo "       DRY_RUN=1 $0 <max-iterations>   # preview selection, no claude runs"
  exit 1
fi

max_iterations=$1
label=${2:-}

script_dir=$(cd "$(dirname "$0")" && pwd)
cd "$script_dir/.."

log_dir="$script_dir/logs"
mkdir -p "$log_dir"

# jq filter to extract streaming text from assistant messages
stream_text='select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'

attempted="[]" # JSON array of issue numbers handed out this run
closed=0

next_issue() {
  local issues
  if [ -n "$label" ]; then
    issues=$(gh issue list --state open --limit 100 --label "$label" --json number,title)
  else
    issues=$(gh issue list --state open --limit 100 --json number,title)
  fi
  jq -r --argjson skip "$attempted" '
    [ .[]
      | select(.title | test("HITL") | not)
      | select(.title | test("\\bPRD\\b"; "i") | not)
      | select(.number as $n | $skip | index($n) | not)
    ] | sort_by(.number) | .[0].number // empty' <<<"$issues"
}

# All issues (any state) with the given label filter applied, for PRD
# child lookups.
all_issues() {
  if [ -n "$label" ]; then
    gh issue list --state all --limit 200 --label "$label" --json number,title,body,state
  else
    gh issue list --state all --limit 200 --json number,title,body,state
  fi
}

# Children of a PRD: issues whose body back-references it with
# "Parent PRD" followed shortly by #<number>. Emits [{number,title,state}].
prd_children() {
  local prd_num=$1
  all_issues | jq -c --argjson prd "$prd_num" '
    [ .[]
      | select(.number != $prd)
      | select(.body // "" | test("Parent PRD[\\s\\S]{0,20}#\($prd)\\b"))
      | {number, title, state}
    ]'
}

# Lowest-numbered open PRD that has at least one child and no open
# children — i.e. ready for its review pass.
ready_prd() {
  jq -r --argjson skip "$attempted" '
    . as $all
    | [ .[]
        | select(.state == "OPEN")
        | select(.title | test("\\bPRD\\b"; "i"))
        | select(.title | test("HITL") | not)
        | select(.number as $n | $skip | index($n) | not)
        | .number as $prd
        | [ $all[]
            | select(.number != $prd)
            | select(.body // "" | test("Parent PRD[\\s\\S]{0,20}#\($prd)\\b"))
          ] as $children
        | select(($children | length) > 0)
        | select([ $children[] | select(.state == "OPEN") ] | length == 0)
        | $prd
      ]
    | sort | .[0] // empty' <<<"$(all_issues)"
}

for ((i = 1; i <= max_iterations; i++)); do
  # A PRD whose children are all closed takes priority: review it and
  # close it out before starting new work.
  kind="issue"
  prompt_file="$script_dir/issue-prompt.md"
  issue_num=$(ready_prd)
  if [ -n "$issue_num" ]; then
    kind="PRD review"
    prompt_file="$script_dir/prd-review-prompt.md"
  else
    issue_num=$(next_issue)
  fi

  if [ -z "$issue_num" ]; then
    echo "No more open issues to tackle. Stopping after $((i - 1)) of $max_iterations iteration(s); closed $closed."
    exit 0
  fi

  attempted=$(jq -c ". + [$issue_num]" <<<"$attempted")
  issue=$(gh issue view "$issue_num" --json number,title,body,comments)
  title=$(jq -r '.title' <<<"$issue")

  echo ""
  echo "=== Iteration $i/$max_iterations: $kind #$issue_num — $title ==="

  if [ -n "${DRY_RUN:-}" ]; then
    echo "(dry run: skipping claude)"
    continue
  fi

  child_context=""
  if [ "$kind" = "PRD review" ]; then
    child_context="Child issues spawned from this PRD (should all be CLOSED): $(prd_children "$issue_num")"
  fi

  commits=$(git log -n 5 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No commits found")
  prompt=$(cat "$prompt_file")
  logfile="$log_dir/issue-${issue_num}-$(date +%Y%m%d-%H%M%S).jsonl"

  docker sandbox run claude . -- \
    --verbose \
    --print \
    --output-format stream-json \
    "Your assigned $kind is #$issue_num. Issue JSON: $issue $child_context Previous commits: $commits $prompt" |
    grep --line-buffered '^{' |
    tee "$logfile" |
    jq --unbuffered -rj "$stream_text" ||
    echo "warning: claude exited non-zero on issue #$issue_num; moving on"

  # Pull claude's final message out of the stream-json log and parse
  # the STATUS/SUMMARY verdict block it was instructed to end with.
  result=$(jq -r 'select(.type == "result").result // empty' "$logfile")
  verdict=""
  if grep -qE '^STATUS:[[:space:]]*INCOMPLETE' <<<"$result"; then
    verdict=INCOMPLETE
  elif grep -qE '^STATUS:[[:space:]]*COMPLETE' <<<"$result"; then
    verdict=COMPLETE
  fi
  summary=$(awk '/^SUMMARY:/{f=1; sub(/^SUMMARY:[[:space:]]*/, "")} f' <<<"$result")

  if ! git push; then
    echo "warning: git push failed; leaving issue #$issue_num open, no comment (log: $logfile)"
    continue
  fi

  case "$verdict" in
  COMPLETE)
    if gh issue close "$issue_num" --comment "${summary:-Completed by ralph loop (no summary provided).}"; then
      closed=$((closed + 1))
      echo "--- issue #$issue_num closed (log: $logfile) ---"
    else
      echo "warning: failed to close issue #$issue_num (log: $logfile)"
    fi
    ;;
  INCOMPLETE)
    gh issue comment "$issue_num" --body "${summary:-Iteration made partial progress; no summary provided.}" ||
      echo "warning: failed to comment on issue #$issue_num"
    echo "--- issue #$issue_num still open; won't be retried this run (log: $logfile) ---"
    ;;
  *)
    echo "warning: no STATUS verdict in claude output; leaving issue #$issue_num open, no comment (log: $logfile)"
    ;;
  esac
done

echo ""
echo "Reached max iterations ($max_iterations). Closed $closed issue(s). Attempted issues: $attempted"
