import { PinionContext, toFile, renderTemplate } from '@featherscloud/pinion'

// Template for the Tag workflow
const tagWorkflowTemplate = (ctx: any) => `name: "Tag"

on:
  workflow_call:
    inputs:
      version: 
        description: 'The version to deploy'
        required: true
        type: string
  workflow_dispatch:

jobs:
  tag: 
    if: github.ref_name == '${ctx.initialBranch || 'develop'}'
    runs-on: ubuntu-latest
    steps:

    - name: Checkout Code
      uses: actions/checkout@v4
      with:
        fetch-depth: 0  # Full history needed for tagging

    - name: Configure Git
      run: |
        git config --global user.name "github-actions[bot]"
        git config --global user.email "github-actions[bot]@users.noreply.github.com"
    
    - name: Create Version Tag
      run: |
        NEWEST_VERSION=\${{ inputs.version }}
        
        # Check if version is empty
        if [ -z "$NEWEST_VERSION" ]; then
          echo "No version provided, skipping tag creation"
          exit 0
        fi
        
        # Check if tag already exists
        if git tag -l | grep -q "^\${NEWEST_VERSION}$"; then
          echo "Tag $NEWEST_VERSION already exists, skipping"
          exit 0
        fi
        
        # Create and push the tag
        echo "Creating tag: $NEWEST_VERSION"
        git tag $NEWEST_VERSION
        git push origin $NEWEST_VERSION
        
        echo "✅ Successfully created and pushed tag: $NEWEST_VERSION"`

export const generate = (ctx: PinionContext) =>
  Promise.resolve(ctx)
    .then(renderTemplate(tagWorkflowTemplate, toFile('.github/workflows/job.tag.yml')))
