#!/bin/bash

# Set variables
GITHUB_TOKEN=$GITHUB_PERSONAL_ACCESS_TOKEN  # Replace with your GitHub token
REPO_OWNER="nasa-madi"      # Replace with the repository owner (your GitHub username or org)
REPO_NAME="madi"        # Replace with the repository name
OLDER_THAN_DATE="2025-03-11"      # Specify the date in YYYY-MM-DD format, older workflows will be deleted

DRY_RUN=false

# Convert the date into a timestamp
DATE_TIMESTAMP=$(date -j -f "%Y-%m-%d" "$OLDER_THAN_DATE" "+%s")
echo $DATE_TIMESTAMP

# Loop through pages of workflow runs
PAGE=1
WORKFLOW_RUN_IDS=""
while true; do
  echo "Page: $PAGE"
  # Get a page of workflow runs for the repository
  WORKFLOW_RUNS=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
    "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/actions/runs?per_page=100&page=$PAGE")

  # Clean the JSON response by removing newlines and replacing unescaped \n with \\n
  CLEANED_WORKFLOW_RUNS=$(echo "$WORKFLOW_RUNS" | tr '\n' ' ' | sed 's/\\n/\\\\n/g')

  # Extract the workflow run IDs and their created dates
  PAGE_RUN_IDS=$(echo "$CLEANED_WORKFLOW_RUNS" | jq -r ".workflow_runs[] | select((.created_at | fromdateiso8601) < $DATE_TIMESTAMP ) | .id")

  # Break the loop if no more runs are found
  if [ -z "$PAGE_RUN_IDS" ]; then
    break
  fi

  # Append the current page's run IDs to the list
  WORKFLOW_RUN_IDS="$WORKFLOW_RUN_IDS $PAGE_RUN_IDS"

  # Increment the page number
  PAGE=$((PAGE + 1))
done

# # Get all workflow runs for the repository
# WORKFLOW_RUNS=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
#   "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/actions/runs?per_page=100&page=2")

# # Clean the JSON response by removing newlines and replacing unescaped \n with \\n
# CLEANED_WORKFLOW_RUNS=$(echo "$WORKFLOW_RUNS" | tr '\n' ' ' | sed 's/\\n/\\\\n/g')

# WORKFLOW_RUN_IDS=$(echo "$CLEANED_WORKFLOW_RUNS" | jq -r ".workflow_runs[] | select((.created_at | fromdateiso8601) < $DATE_TIMESTAMP ) | .id")


echo "$WORKFLOW_RUN_IDS"

# Loop through and handle the workflow runs that are older than the specified date
for RUN_ID in $WORKFLOW_RUN_IDS; do
  if [ "$DRY_RUN" = "true" ]; then
    echo "Dry run: Would delete workflow run ID: $RUN_ID"
  else
    echo "Deleting workflow run ID: $RUN_ID"
    DELETE_RESPONSE=$(curl -s -X DELETE -H "Authorization: token $GITHUB_TOKEN" \
      "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/actions/runs/$RUN_ID")
    
    # Check if the deletion was successful
    if [[ $(echo "$DELETE_RESPONSE" | jq -r '.message') == "Not Found" ]]; then
      echo "Error: Failed to delete workflow run ID: $RUN_ID"
    else
      echo "Successfully deleted workflow run ID: $RUN_ID"
    fi
  fi
done