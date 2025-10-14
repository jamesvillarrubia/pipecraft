#!/bin/bash

# Set environment variables for testing
PR_HEAD="temp-test-v0.1.1"       # Example PR head branch
PR_BASE="temp-test-v0.1.0"       # Example PR base branch

# Verify PR Source is a Fake Branch
if [[ ! "$PR_HEAD" =~ ^temp-(test|main)-v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Skipping: PR did not come from an auto-generated fake branch."
  exit 1
fi

# Extract version and base branch from the PR branch name
BASE_BRANCH=$(echo "$PR_BASE" | cut -d'-' -f1)
OLD_VERSION=$(echo "$PR_BASE" | cut -d'-' -f2-)
NEXT_VERSION=$(echo "$PR_HEAD" | cut -d'-' -f2-)

echo "BASE_BRANCH=$BASE_BRANCH"
echo "OLD_VERSION=$OLD_VERSION"
echo "NEXT_VERSION=$NEXT_VERSION"

# Checkout Repository
git fetch origin $PR_HEAD:$PR_HEAD
git checkout $PR_HEAD

# # Set Up Git
# git config user.name "github-actions[bot]"
# git config user.email "github-actions[bot]@users.noreply.github.com"

git rev-parse $PR_HEAD

# Get Latest Commit from Head Branch
COMMIT_HASH=$(git rev-parse $PR_HEAD)

if [[ -z "$COMMIT_HASH" ]]; then
  echo "Failed to find commit for branch $PR_HEAD"
  exit 1
fi

# echo "Found commit: $COMMIT_HASH"

# # Fast Forward Target Branch
# git fetch origin
# git checkout $BASE_BRANCH
# git merge --ff-only $COMMIT_HASH
# git push origin $BASE_BRANCH

# # Delete Temporary Branches
# NEW_BRANCH="temp-${BASE_BRANCH}-${NEXT_VERSION}"
# git push origin --delete $NEW_BRANCH
# echo "Temporary branch $NEW_BRANCH deleted"