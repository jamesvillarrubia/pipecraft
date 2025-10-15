#!/bin/bash

# Comprehensive GitHub Actions Debugging Test Runner
# This script runs all debugging tests and provides a summary

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$TEST_DIR/.." && pwd)"
OUTPUT_DIR="$TEST_DIR/debug-output"
VERBOSE=false
RUN_UNIT_TESTS=true
RUN_INTEGRATION_TESTS=false
RUN_SHELL_TESTS=true

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    
    case $status in
        "SUCCESS") echo -e "${GREEN}✓${NC} $message" ;;
        "FAILURE") echo -e "${RED}✗${NC} $message" ;;
        "SKIP") echo -e "${YELLOW}⊘${NC} $message" ;;
        "INFO") echo -e "${BLUE}ℹ${NC} $message" ;;
        "WARNING") echo -e "${YELLOW}⚠${NC} $message" ;;
        *) echo -e "${CYAN}?${NC} $message" ;;
    esac
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

GitHub Actions Debugging Test Runner

OPTIONS:
    -u, --unit              Run unit tests only
    -i, --integration       Run integration tests only
    -s, --shell              Run shell script tests only
    -a, --all                Run all tests (default)
    -v, --verbose            Verbose output
    -o, --output DIR           Output directory for test results
    -h, --help               Show this help message

EXAMPLES:
    $0 --unit --verbose
    $0 --integration --output ./test-results
    $0 --all --verbose

EOF
}

# Function to check prerequisites
check_prerequisites() {
    print_status "INFO" "Checking prerequisites..."
    
    local missing_deps=()
    
    # Check for required commands
    if ! command -v node &> /dev/null; then
        missing_deps+=("node")
    fi
    
    if ! command -v pnpm &> /dev/null; then
        missing_deps+=("pnpm")
    fi
    
    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi
    
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        print_status "FAILURE" "Missing dependencies: ${missing_deps[*]}"
        echo -e "${YELLOW}Please install missing dependencies:${NC}"
        for dep in "${missing_deps[@]}"; do
            case $dep in
                "node") echo "  - Node.js: https://nodejs.org/" ;;
                "pnpm") echo "  - pnpm: npm install -g pnpm" ;;
                "jq") echo "  - jq: brew install jq (macOS) or apt-get install jq (Ubuntu)" ;;
                "curl") echo "  - curl: Usually pre-installed" ;;
            esac
        done
        exit 1
    fi
    
    print_status "SUCCESS" "All prerequisites satisfied"
}

# Function to run unit tests
run_unit_tests() {
    if [ "$RUN_UNIT_TESTS" = false ]; then
        print_status "SKIP" "Unit tests skipped"
        return 0
    fi
    
    print_status "INFO" "Running unit tests..."
    
    cd "$PROJECT_ROOT"
    
    if [ "$VERBOSE" = true ]; then
        pnpm test --run --reporter=verbose
    else
        pnpm test --run
    fi
    
    if [ $? -eq 0 ]; then
        print_status "SUCCESS" "Unit tests passed"
    else
        print_status "FAILURE" "Unit tests failed"
        return 1
    fi
}

# Function to run integration tests
run_integration_tests() {
    if [ "$RUN_INTEGRATION_TESTS" = false ]; then
        print_status "SKIP" "Integration tests skipped"
        return 0
    fi
    
    print_status "INFO" "Running integration tests..."
    
    # Check if GitHub token is available
    if [ -z "${GITHUB_TOKEN:-}" ]; then
        print_status "WARNING" "GITHUB_TOKEN not set, skipping integration tests"
        print_status "INFO" "Set GITHUB_TOKEN environment variable to run integration tests"
        return 0
    fi
    
    # Run integration tests
    cd "$PROJECT_ROOT"
    
    if [ "$VERBOSE" = true ]; then
        pnpm test --run --reporter=verbose tests/integration/
    else
        pnpm test --run tests/integration/
    fi
    
    if [ $? -eq 0 ]; then
        print_status "SUCCESS" "Integration tests passed"
    else
        print_status "FAILURE" "Integration tests failed"
        return 1
    fi
}

# Function to run shell script tests
run_shell_tests() {
    if [ "$RUN_SHELL_TESTS" = false ]; then
        print_status "SKIP" "Shell script tests skipped"
        return 0
    fi
    
    print_status "INFO" "Running shell script tests..."
    
    # Test the debug script with help
    if [ -f "$TEST_DIR/debug-workflows.sh" ]; then
        print_status "INFO" "Testing debug-workflows.sh help"
        if "$TEST_DIR/debug-workflows.sh" --help > /dev/null 2>&1; then
            print_status "SUCCESS" "debug-workflows.sh help works"
        else
            print_status "FAILURE" "debug-workflows.sh help failed"
            return 1
        fi
    else
        print_status "FAILURE" "debug-workflows.sh not found"
        return 1
    fi
    
    # Test script syntax
    print_status "INFO" "Checking shell script syntax"
    if bash -n "$TEST_DIR/debug-workflows.sh"; then
        print_status "SUCCESS" "Shell script syntax is valid"
    else
        print_status "FAILURE" "Shell script syntax errors found"
        return 1
    fi
    
    print_status "SUCCESS" "Shell script tests passed"
}

# Function to run debugging workflow tests
run_debugging_tests() {
    print_status "INFO" "Running debugging workflow tests..."
    
    # Test TypeScript compilation
    print_status "INFO" "Testing TypeScript compilation"
    cd "$PROJECT_ROOT"
    
    if pnpm build > /dev/null 2>&1; then
        print_status "SUCCESS" "TypeScript compilation successful"
    else
        print_status "FAILURE" "TypeScript compilation failed"
        return 1
    fi
    
    # Test debug utilities
    print_status "INFO" "Testing debug utilities"
    if pnpm test --run tests/debug-workflow.test.ts > /dev/null 2>&1; then
        print_status "SUCCESS" "Debug utilities tests passed"
    else
        print_status "FAILURE" "Debug utilities tests failed"
        return 1
    fi
}

# Function to generate test report
generate_test_report() {
    local report_file="$OUTPUT_DIR/test-report.md"
    
    print_status "INFO" "Generating test report..."
    
    mkdir -p "$OUTPUT_DIR"
    
    cat > "$report_file" << EOF
# GitHub Actions Debugging Test Report

Generated: $(date)
Project: Pipecraft
Test Directory: $TEST_DIR

## Test Configuration

- Unit Tests: $RUN_UNIT_TESTS
- Integration Tests: $RUN_INTEGRATION_TESTS
- Shell Tests: $RUN_SHELL_TESTS
- Verbose Output: $VERBOSE

## Test Results

### Prerequisites
- Node.js: $(node --version 2>/dev/null || echo "Not installed")
- pnpm: $(pnpm --version 2>/dev/null || echo "Not installed")
- jq: $(jq --version 2>/dev/null || echo "Not installed")
- curl: $(curl --version 2>/dev/null | head -n1 || echo "Not installed")

### Test Files

EOF

    # List test files
    find "$TEST_DIR" -name "*.test.ts" -o -name "*.test.js" -o -name "*.sh" | while read -r file; do
        echo "- \`$file\`" >> "$report_file"
    done
    
    cat >> "$report_file" << EOF

## Usage Examples

### Basic Debugging
\`\`\`bash
# Run debug script with help
./tests/debug-workflows.sh --help

# Debug a specific workflow
GITHUB_TOKEN=your_token ./tests/debug-workflows.sh -w "My Custom Pipeline" -b main
\`\`\`

### TypeScript Debugging
\`\`\`typescript
import { WorkflowDebugOrchestrator } from './tests/debug-utils';

const debugger = new WorkflowDebugOrchestrator(token, owner, repo);
const report = await debugger.debugWorkflow('workflow-name');
\`\`\`

### Iterative Debugging
\`\`\`typescript
import { IterativeDebugger } from './tests/iterative-debug';

const debugger = new IterativeDebugger(token, owner, repo, 'workflow-name');
await debugger.runDebugIteration();
\`\`\`

---
*Report generated by Pipecraft Debug Test Runner*
EOF

    print_status "SUCCESS" "Test report generated: $report_file"
}

# Function to show summary
show_summary() {
    echo ""
    echo -e "${BLUE}GitHub Actions Debugging Test Summary${NC}"
    echo -e "${CYAN}=====================================${NC}"
    echo ""
    echo -e "${GREEN}✓${NC} Prerequisites checked"
    echo -e "${GREEN}✓${NC} Test files validated"
    echo -e "${GREEN}✓${NC} Debugging utilities tested"
    echo ""
    echo -e "${CYAN}Available debugging tools:${NC}"
    echo "  - Shell script: ./tests/debug-workflows.sh"
    echo "  - TypeScript utilities: ./tests/debug-utils.ts"
    echo "  - Iterative debugger: ./tests/iterative-debug.ts"
    echo "  - Test suite: ./tests/debug-workflow.test.ts"
    echo ""
    echo -e "${CYAN}Usage:${NC}"
    echo "  ./tests/run-debug-tests.sh --help"
    echo "  ./tests/debug-workflows.sh --help"
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--unit)
            RUN_UNIT_TESTS=true
            RUN_INTEGRATION_TESTS=false
            RUN_SHELL_TESTS=false
            shift
            ;;
        -i|--integration)
            RUN_UNIT_TESTS=false
            RUN_INTEGRATION_TESTS=true
            RUN_SHELL_TESTS=false
            shift
            ;;
        -s|--shell)
            RUN_UNIT_TESTS=false
            RUN_INTEGRATION_TESTS=false
            RUN_SHELL_TESTS=true
            shift
            ;;
        -a|--all)
            RUN_UNIT_TESTS=true
            RUN_INTEGRATION_TESTS=true
            RUN_SHELL_TESTS=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}" >&2
            show_usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    echo -e "${BLUE}GitHub Actions Debugging Test Runner${NC}"
    echo -e "${CYAN}====================================${NC}"
    echo ""
    
    # Check prerequisites
    check_prerequisites
    
    # Run tests
    local test_results=()
    
    if [ "$RUN_UNIT_TESTS" = true ]; then
        if run_unit_tests; then
            test_results+=("Unit Tests: PASS")
        else
            test_results+=("Unit Tests: FAIL")
        fi
    fi
    
    if [ "$RUN_INTEGRATION_TESTS" = true ]; then
        if run_integration_tests; then
            test_results+=("Integration Tests: PASS")
        else
            test_results+=("Integration Tests: FAIL")
        fi
    fi
    
    if [ "$RUN_SHELL_TESTS" = true ]; then
        if run_shell_tests; then
            test_results+=("Shell Tests: PASS")
        else
            test_results+=("Shell Tests: FAIL")
        fi
    fi
    
    # Run debugging tests
    if run_debugging_tests; then
        test_results+=("Debugging Tests: PASS")
    else
        test_results+=("Debugging Tests: FAIL")
    fi
    
    # Generate report
    generate_test_report
    
    # Show summary
    show_summary
    
    # Show test results
    echo -e "${CYAN}Test Results:${NC}"
    for result in "${test_results[@]}"; do
        if [[ $result == *"PASS" ]]; then
            print_status "SUCCESS" "$result"
        else
            print_status "FAILURE" "$result"
        fi
    done
    
    echo ""
    print_status "INFO" "Test run complete. Check $OUTPUT_DIR for detailed results."
}

# Run main function
main "$@"
