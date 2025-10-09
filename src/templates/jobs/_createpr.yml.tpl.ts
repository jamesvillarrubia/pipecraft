import { PinionContext, toFile, renderTemplate } from '@featherscloud/pinion'

// Template for the Create Pull Request workflow
const createprWorkflowTemplate = (ctx: any) => `name: "Create Pull Request"

on:
  workflow_call:
    inputs:
      sourceBranch:
        required: true
        type: string
        description: "Source branch for the PR"
      targetBranch:
        required: true
        type: string
        description: "Target branch for the PR"
      title:
        required: true
        type: string
        description: "Title for the PR"
      body:
        required: false
        type: string
        description: "Body/description for the PR"
      labels:
        required: false
        type: string
        description: "Comma-separated list of labels"
    outputs:
      prNumber:
        value: \${{ jobs.create-pr.outputs.prNumber }}
      prUrl:
        value: \${{ jobs.create-pr.outputs.prUrl }}
      
  workflow_dispatch:
    inputs:
      sourceBranch:
        description: 'Source branch for the PR'
        required: true
      targetBranch:
        description: 'Target branch for the PR'
        required: true
      title:
        description: 'Title for the PR'
        required: true
      body:
        description: 'Body/description for the PR'
        required: false
      labels:
        description: 'Comma-separated list of labels'
        required: false

jobs:
  create-pr:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    outputs:
      prNumber: \${{ steps.create-pr.outputs.prNumber }}
      prUrl: \${{ steps.create-pr.outputs.prUrl }}
    steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
        token: \${{ secrets.GITHUB_TOKEN }}

    - name: Check if PR Already Exists
      id: check-existing-pr
      run: |
        SOURCE="\${{ inputs.sourceBranch }}"
        TARGET="\${{ inputs.targetBranch }}"
        
        # Check if PR already exists
        EXISTING_PR=$(gh pr list --head "$SOURCE" --base "$TARGET" --json number --jq '.[0].number' 2>/dev/null || echo "")
        
        if [ -n "$EXISTING_PR" ] && [ "$EXISTING_PR" != "null" ]; then
          echo "exists=true" >> $GITHUB_OUTPUT
          echo "prNumber=$EXISTING_PR" >> $GITHUB_OUTPUT
          echo "⚠️  PR already exists: #$EXISTING_PR"
        else
          echo "exists=false" >> $GITHUB_OUTPUT
          echo "✅ No existing PR found"
        fi

    - name: Create Pull Request
      if: steps.check-existing-pr.outputs.exists == 'false'
      id: create-pr
      run: |
        SOURCE="\${{ inputs.sourceBranch }}"
        TARGET="\${{ inputs.targetBranch }}"
        TITLE="\${{ inputs.title }}"
        BODY="\${{ inputs.body }}"
        LABELS="\${{ inputs.labels }}"
        
        # Prepare labels array
        LABEL_ARGS=""
        if [ -n "$LABELS" ]; then
          IFS=',' read -ra LABEL_ARRAY <<< "$LABELS"
          for label in "\${LABEL_ARRAY[@]}"; do
            LABEL_ARGS="$LABEL_ARGS --label \"\${label// /}\""
          done
        fi
        
        # Create the PR
        PR_OUTPUT=$(gh pr create \\
          --head "$SOURCE" \\
          --base "$TARGET" \\
          --title "$TITLE" \\
          --body "$BODY" \\
          $LABEL_ARGS \\
          --json number,url \\
          --jq '{number: .number, url: .url}')
        
        PR_NUMBER=$(echo "$PR_OUTPUT" | jq -r '.number')
        PR_URL=$(echo "$PR_OUTPUT" | jq -r '.url')
        
        echo "prNumber=$PR_NUMBER" >> $GITHUB_OUTPUT
        echo "prUrl=$PR_URL" >> $GITHUB_OUTPUT
        
        echo "✅ Created PR #$PR_NUMBER"
        echo "🔗 URL: $PR_URL"

    - name: PR Creation Summary
      run: |
        if [ "\${{ steps.check-existing-pr.outputs.exists }}" == "true" ]; then
          echo "⚠️  PR already exists: #\${{ steps.check-existing-pr.outputs.prNumber }}"
        else
          echo "✅ Successfully created PR: #\${{ steps.create-pr.outputs.prNumber }}"
          echo "🔗 URL: \${{ steps.create-pr.outputs.prUrl }}"
        fi`

export const generate = (ctx: PinionContext) =>
  Promise.resolve(ctx)
    .then(renderTemplate(createprWorkflowTemplate, toFile('.github/workflows/job._createpr.yml')))
