#!/bin/bash

# Quick job order verification script
# Usage: ./scripts/verify-job-order.sh <original-file> <generated-file>

set -e

ORIGINAL_FILE=${1:-".github/workflows/pipeline-user-modified.yml"}
GENERATED_FILE=${2:-".github/workflows/pipeline-test-order-restored.yml"}

echo "🔍 Verifying job order preservation..."
echo "📋 Original:  $ORIGINAL_FILE"
echo "📋 Generated: $GENERATED_FILE"

# Extract job names from both files (only from jobs section)
ORIGINAL_JOBS=$(sed -n '/^jobs:/,/^[^ ]/p' "$ORIGINAL_FILE" | grep "^  [a-zA-Z]" | sed 's/://' | tr '\n' ' ')
GENERATED_JOBS=$(sed -n '/^jobs:/,/^[^ ]/p' "$GENERATED_FILE" | grep "^  [a-zA-Z]" | sed 's/://' | tr '\n' ' ')

echo "📋 Original jobs:  $ORIGINAL_JOBS"
echo "📋 Generated jobs: $GENERATED_JOBS"

# Compare the job orders
if [ "$ORIGINAL_JOBS" = "$GENERATED_JOBS" ]; then
    echo "✅ Job order preserved correctly!"
    exit 0
else
    echo "❌ Job order differs!"
    echo "🔧 Flowcraft jobs may have moved to incorrect positions"
    exit 1
fi
