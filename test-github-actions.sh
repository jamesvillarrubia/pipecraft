#!/bin/bash

set -e

echo "🔧 Setting up GitHub Actions test environment..."

# Mock GitHub environment variables
export GITHUB_ACTIONS=true
export GITHUB_WORKFLOW=test-workflow
export GITHUB_RUN_ID=123456789
export GITHUB_RUN_NUMBER=1
export GITHUB_ACTOR=test-user
export GITHUB_REPOSITORY=test-org/test-repo
export GITHUB_EVENT_NAME=push
export GITHUB_SHA=abc123def456
export GITHUB_REF=refs/heads/main
export GITHUB_HEAD_REF=""
export GITHUB_BASE_REF=""
export GITHUB_WORKSPACE=$(pwd)
export GITHUB_TOKEN=fake-token-for-testing

# Mock secrets
export NPM_TOKEN=fake-npm-token
export DOCKER_USERNAME=fake-docker-user
export DOCKER_PASSWORD=fake-docker-password

echo "✅ GitHub environment mocked"

# Create test configuration
cat > .trunkflowrc.json << 'EOF'
{
  "ciProvider": "github",
  "mergeStrategy": "fast-forward",
  "requireConventionalCommits": true,
  "initialBranch": "develop",
  "finalBranch": "main",
  "branchFlow": ["develop", "staging", "main"],
  "semver": {
    "bumpRules": {
      "feat": "minor",
      "fix": "patch",
      "breaking": "major"
    }
  },
  "actions": {
    "onDevelopMerge": [],
    "onStagingMerge": []
  },
  "domains": {
    "api": {
      "paths": ["src/api/**", "apps/api/**"],
      "description": "API service changes",
      "testable": true,
      "deployable": true
    },
    "web": {
      "paths": ["src/web/**", "apps/web/**"],
      "description": "Web application changes",
      "testable": true,
      "deployable": true
    },
    "mobile": {
      "paths": ["src/mobile/**", "apps/mobile/**"],
      "description": "Mobile app changes",
      "testable": false,
      "deployable": true
    },
    "cicd": {
      "paths": [".github/workflows/**"],
      "description": "CI/CD configuration changes",
      "testable": true,
      "deployable": false
    }
  }
}
EOF

echo "✅ Test configuration created"

# Generate workflows
echo "🚀 Generating workflows with flowcraft..."
./flowcraft generate --force --verbose

echo "✅ Workflows generated"

# Test with Nectos Act
echo "🧪 Testing workflows with Nectos Act..."

# List available workflows
echo "📋 Available workflows:"
act --list

# Test individual workflows
echo "🔍 Testing individual workflows..."

# Test changes workflow
if [ -f ".github/workflows/job.changes.yml" ]; then
    echo "Testing changes workflow..."
    act -W .github/workflows/job.changes.yml --dry-run
fi

# Test version workflow
if [ -f ".github/workflows/job.version.yml" ]; then
    echo "Testing version workflow..."
    act -W .github/workflows/job.version.yml --dry-run
fi

# Test tag workflow
if [ -f ".github/workflows/job.tag.yml" ]; then
    echo "Testing tag workflow..."
    act -W .github/workflows/job.tag.yml --dry-run
fi

# Test create PR workflow
if [ -f ".github/workflows/job.createpr.yml" ]; then
    echo "Testing create PR workflow..."
    act -W .github/workflows/job.createpr.yml --dry-run
fi

# Test main pipeline workflow
if [ -f ".github/workflows/pipeline.yml" ]; then
    echo "Testing main pipeline workflow..."
    act -W .github/workflows/pipeline.yml --dry-run
fi

echo "🎉 All GitHub Actions tests completed successfully!"
