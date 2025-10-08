#!/bin/bash

set -e

echo "🔧 Setting up test environment for flowcraft + Nectos Act..."

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

# List available workflows with Nectos Act
echo "📋 Available workflows:"
act --list

# Test the main pipeline workflow
echo "🧪 Testing main pipeline workflow..."
act -W .github/workflows/pipeline.yml --dry-run

echo "🎉 Test completed successfully!"
