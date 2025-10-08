import { PinionContext, toFile, renderTemplate } from '@featherscloud/pinion'

// Template for the Branch Management workflow
const branchWorkflowTemplate = (ctx: any) => `name: "Branch Management"

on:
  workflow_call:
    inputs:
      action:
        required: true
        type: string
        description: "Action to perform (fast-forward, create, delete)"
      sourceBranch:
        required: false
        type: string
        description: "Source branch for fast-forward or create"
      targetBranch:
        required: true
        type: string
        description: "Target branch"
      branchName:
        required: false
        type: string
        description: "Name for new branch (for create action)"
    outputs:
      success:
        value: ${{ jobs.branch-management.outputs.success }}
      message:
        value: ${{ jobs.branch-management.outputs.message }}
      
  workflow_dispatch:
    inputs:
      action:
        description: 'Action to perform (fast-forward, create, delete)'
        required: true
        type: choice
        options:
        - fast-forward
        - create
        - delete
      sourceBranch:
        description: 'Source branch for fast-forward or create'
        required: false
      targetBranch:
        description: 'Target branch'
        required: true
      branchName:
        description: 'Name for new branch (for create action)'
        required: false

jobs:
  branch-management:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    outputs:
      success: ${{ steps.branch-action.outputs.success }}
      message: ${{ steps.branch-action.outputs.message }}
    steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
        token: ${{ secrets.GITHUB_TOKEN }}

    - name: Validate Inputs
      id: validate
      run: |
        ACTION="${{ inputs.action }}"
        TARGET="${{ inputs.targetBranch }}"
        SOURCE="${{ inputs.sourceBranch }}"
        BRANCH_NAME="${{ inputs.branchName }}"
        
        case "$ACTION" in
          "fast-forward")
            if [ -z "$SOURCE" ]; then
              echo "❌ sourceBranch is required for fast-forward action"
              exit 1
            fi
            echo "✅ Fast-forward: $SOURCE → $TARGET"
            ;;
          "create")
            if [ -z "$SOURCE" ] || [ -z "$BRANCH_NAME" ]; then
              echo "❌ sourceBranch and branchName are required for create action"
              exit 1
            fi
            echo "✅ Create branch: $BRANCH_NAME from $SOURCE"
            ;;
          "delete")
            echo "✅ Delete branch: $TARGET"
            ;;
          *)
            echo "❌ Invalid action: $ACTION"
            echo "Valid actions: fast-forward, create, delete"
            exit 1
            ;;
        esac

    - name: Perform Branch Action
      id: branch-action
      run: |
        ACTION="${{ inputs.action }}"
        TARGET="${{ inputs.targetBranch }}"
        SOURCE="${{ inputs.sourceBranch }}"
        BRANCH_NAME="${{ inputs.branchName }}"
        
        case "$ACTION" in
          "fast-forward")
            echo "🔄 Fast-forwarding $SOURCE to $TARGET..."
            
            # Check if target branch exists
            if ! git show-ref --verify --quiet refs/heads/$TARGET; then
              echo "❌ Target branch $TARGET does not exist"
              echo "success=false" >> $GITHUB_OUTPUT
              echo "message=Target branch $TARGET does not exist" >> $GITHUB_OUTPUT
              exit 1
            fi
            
            # Check if fast-forward is possible
            if ! git merge-base --is-ancestor $TARGET $SOURCE; then
              echo "❌ Cannot fast-forward: $TARGET is not an ancestor of $SOURCE"
              echo "success=false" >> $GITHUB_OUTPUT
              echo "message=Cannot fast-forward: $TARGET is not an ancestor of $SOURCE" >> $GITHUB_OUTPUT
              exit 1
            fi
            
            # Perform fast-forward
            git checkout $TARGET
            git merge --ff-only $SOURCE
            git push origin $TARGET
            
            echo "✅ Successfully fast-forwarded $TARGET to $SOURCE"
            echo "success=true" >> $GITHUB_OUTPUT
            echo "message=Successfully fast-forwarded $TARGET to $SOURCE" >> $GITHUB_OUTPUT
            ;;
            
          "create")
            echo "🔄 Creating branch $BRANCH_NAME from $SOURCE..."
            
            # Check if source branch exists
            if ! git show-ref --verify --quiet refs/heads/$SOURCE; then
              echo "❌ Source branch $SOURCE does not exist"
              echo "success=false" >> $GITHUB_OUTPUT
              echo "message=Source branch $SOURCE does not exist" >> $GITHUB_OUTPUT
              exit 1
            fi
            
            # Create and push new branch
            git checkout $SOURCE
            git checkout -b $BRANCH_NAME
            git push origin $BRANCH_NAME
            
            echo "✅ Successfully created branch $BRANCH_NAME from $SOURCE"
            echo "success=true" >> $GITHUB_OUTPUT
            echo "message=Successfully created branch $BRANCH_NAME from $SOURCE" >> $GITHUB_OUTPUT
            ;;
            
          "delete")
            echo "🔄 Deleting branch $TARGET..."
            
            # Check if branch exists
            if ! git show-ref --verify --quiet refs/heads/$TARGET; then
              echo "⚠️  Branch $TARGET does not exist locally"
            else
              git branch -D $TARGET
            fi
            
            # Delete remote branch
            if git ls-remote --heads origin $TARGET | grep -q $TARGET; then
              git push origin --delete $TARGET
              echo "✅ Successfully deleted remote branch $TARGET"
            else
              echo "⚠️  Remote branch $TARGET does not exist"
            fi
            
            echo "success=true" >> $GITHUB_OUTPUT
            echo "message=Successfully deleted branch $TARGET" >> $GITHUB_OUTPUT
            ;;
        esac

    - name: Action Summary
      run: |
        if [ "${{ steps.branch-action.outputs.success }}" == "true" ]; then
          echo "✅ ${{ steps.branch-action.outputs.message }}"
        else
          echo "❌ ${{ steps.branch-action.outputs.message }}"
        fi`

export const generate = (ctx: PinionContext) =>
  Promise.resolve(ctx)
    .then(renderTemplate(branchWorkflowTemplate, toFile('.github/workflows/job.branch.yml')))
