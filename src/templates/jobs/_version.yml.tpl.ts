import { PinionContext, toFile, renderTemplate } from '@featherscloud/pinion'

// Template for the Version Calculation GitHub Action
const versionActionTemplate = (ctx: any) => `name: 'Calculate Version'
description: 'Calculate semantic version from commit messages since last tag'
author: 'Flowcraft'

inputs:
  baseRef:
    description: 'Base reference for version calculation'
    required: true
  currentVersion:
    description: 'Current version to calculate from (optional)'
    required: false

outputs:
  version:
    description: 'The current version'
    value: \${{ steps.version.outputs.version }}
  versionType:
    description: 'The version bump type (major, minor, patch)'
    value: \${{ steps.version.outputs.versionType }}
  nextVersion:
    description: 'The next calculated version'
    value: \${{ steps.version.outputs.nextVersion }}

runs:
  using: 'composite'
  steps:
    - name: Get Latest Tag
      id: get-latest-tag
      shell: bash
      run: |
        # Get the latest tag
        LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
        echo "latest_tag=\$LATEST_TAG" >> \$GITHUB_OUTPUT
        echo "Latest tag: \$LATEST_TAG"

    - name: Calculate Version Bump
      id: version
      shell: bash
      run: |
        # Get commits since last tag
        COMMITS=$(git log --oneline \${{ steps.get-latest-tag.outputs.latest_tag }}..HEAD --pretty=format:"%s")
        
        # Initialize version bump type
        VERSION_TYPE="patch"
        
        # Check for breaking changes
        if echo "\$COMMITS" | grep -q "BREAKING CHANGE\\|!:"; then
          VERSION_TYPE="major"
        # Check for features
        elif echo "\$COMMITS" | grep -q "^feat"; then
          VERSION_TYPE="minor"
        # Check for fixes
        elif echo "\$COMMITS" | grep -q "^fix"; then
          VERSION_TYPE="patch"
        fi
        
        # Extract current version from tag
        CURRENT_VERSION=$(echo "\${{ steps.get-latest-tag.outputs.latest_tag }}" | sed 's/v//')
        
        # Calculate next version using semver logic
        IFS='.' read -r MAJOR MINOR PATCH <<< "\$CURRENT_VERSION"
        
        case "\$VERSION_TYPE" in
          "major")
            MAJOR=\$((MAJOR + 1))
            MINOR=0
            PATCH=0
            ;;
          "minor")
            MINOR=\$((MINOR + 1))
            PATCH=0
            ;;
          "patch")
            PATCH=\$((PATCH + 1))
            ;;
        esac
        
        NEXT_VERSION="v\$MAJOR.\$MINOR.\$PATCH"
        
        echo "version=\$CURRENT_VERSION" >> \$GITHUB_OUTPUT
        echo "versionType=\$VERSION_TYPE" >> \$GITHUB_OUTPUT
        echo "nextVersion=\$NEXT_VERSION" >> \$GITHUB_OUTPUT
        
        echo "Current version: \$CURRENT_VERSION"
        echo "Version type: \$VERSION_TYPE"
        echo "Next version: \$NEXT_VERSION"

    - name: Debug Version Information
      shell: bash
      run: |
        echo "Current version: \${{ steps.version.outputs.version }}"
        echo "Version type: \${{ steps.version.outputs.versionType }}"
        echo "Next version: \${{ steps.version.outputs.nextVersion }}"`

export const generate = (ctx: PinionContext) =>
  Promise.resolve(ctx)
    .then(renderTemplate(versionActionTemplate, toFile('.github/actions/job._version/action.yml')))