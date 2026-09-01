#!/usr/bin/env bash
#
# verify-promotion.sh <owner/repo> [domain-file-to-touch]
#
# Repeatable, self-checking end-to-end proof that a PipeCraft repo's promotion flow
# actually moves code from the initial branch through to the final branch.
#
# It:
#   1. clones the repo fresh into a temp dir
#   2. resets every downstream branch to the initial branch's tip (a clean, even base)
#   3. commits a unique `feat:` touching a domain file and pushes it to the initial branch
#   4. polls until that exact commit becomes reachable from the final branch
#      (= the promotion cascade carried it all the way through) — or fails on timeout
#
# Re-running it repeats the cycle from a clean base, so it is idempotent and CI-safe.
set -euo pipefail

REPO="${1:?usage: verify-promotion.sh <owner/repo> [domain-file]}"
TOUCH_FILE="${2:-}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "📦 Cloning $REPO ..."
gh repo clone "$REPO" "$WORK" -- -q
cd "$WORK"
git config user.email "ci@thecraftlab.dev"
git config user.name "pipecraft-ci"

# Read the branch flow from the committed config.
mapfile -t FLOW < <(node -e "const c=require('./.pipecraftrc.json');process.stdout.write(c.branchFlow.join('\n'))")
INITIAL="${FLOW[0]}"
FINAL="${FLOW[${#FLOW[@]}-1]}"
echo "🌿 Branch flow: ${FLOW[*]}   (initial=$INITIAL → final=$FINAL)"

# Pick a domain file to touch so change detection fires (first domain's first path).
if [ -z "$TOUCH_FILE" ]; then
  GLOB="$(node -e "const c=require('./.pipecraftrc.json');const d=Object.values(c.domains)[0];process.stdout.write(d.paths[0])")"
  DIR="${GLOB%%/\*\*}"
  mkdir -p "$DIR"
  TOUCH_FILE="$DIR/.pipecraft-promo-marker"
fi

git fetch origin -q
BASE="$(git rev-parse "origin/$INITIAL")"

echo "↩️  Resetting downstream branches to base ($BASE) ..."
for b in "${FLOW[@]:1}"; do
  git push origin "$BASE:refs/heads/$b" --force >/dev/null 2>&1
  echo "   reset $b → base"
done

echo "✍️  Committing a feat on $INITIAL (touching $TOUCH_FILE) ..."
git checkout "$INITIAL" -q
git reset --hard "origin/$INITIAL" -q
MARKER="promo-$(git rev-parse --short HEAD)-$RANDOM"
echo "// promotion proof marker: $MARKER" >> "$TOUCH_FILE"
git add "$TOUCH_FILE"
git commit -qm "feat: verify promotion cascade ($MARKER)"
git push origin "$INITIAL" -q
FEAT_SHA="$(git rev-parse HEAD)"
echo "🚀 Pushed $FEAT_SHA to $INITIAL — waiting for it to reach $FINAL via promotion ..."

# Poll until the feat commit is an ancestor of the final branch (cascade complete).
for i in $(seq 1 90); do
  sleep 20
  git fetch origin -q "$FINAL" 2>/dev/null || true
  if git merge-base --is-ancestor "$FEAT_SHA" "origin/$FINAL" 2>/dev/null; then
    echo "✅ PROOF: $FEAT_SHA reached $FINAL — promotion cascade $INITIAL → $FINAL succeeded."
    exit 0
  fi
  echo "   ...still promoting (t+$((i*20))s); $FINAL at $(git rev-parse --short origin/$FINAL)"
done

echo "❌ FAIL: feat $FEAT_SHA did not reach $FINAL within the timeout."
exit 1
