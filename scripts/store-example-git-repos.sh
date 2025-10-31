#!/bin/bash
# Script to store .git directories as .git.stored so they can be tracked
# Run this after making changes to example repos before committing to parent repo

set -e

EXAMPLES_DIR="examples"
REPOS=("pipecraft-example-basic" "pipecraft-example-gated" "pipecraft-example-minimal")

for repo in "${REPOS[@]}"; do
  repo_path="${EXAMPLES_DIR}/${repo}"
  git_path="${repo_path}/.git"
  stored_path="${repo_path}/.git.stored"

  if [ -d "$git_path" ]; then
    echo "Storing .git for ${repo}..."
    # Remove old stored version if it exists
    [ -d "$stored_path" ] && rm -rf "$stored_path"
    # Rename .git to .git.stored
    mv "$git_path" "$stored_path"
    echo "✓ Stored .git directory for ${repo}"
  elif [ -d "$stored_path" ]; then
    echo "ℹ ${repo} already has .git.stored (skipping)"
  else
    echo "⚠ No .git or .git.stored found for ${repo}"
  fi
done

echo ""
echo "✓ All example repos stored. You can now commit them to the parent repo."
echo "  When tests run, they will automatically activate these repos."

