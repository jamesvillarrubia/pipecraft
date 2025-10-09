#!/bin/bash

# Comprehensive GitHub Actions Testing Suite
# Runs all GitHub Actions tests using Act

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
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/output"
VERBOSE=false
DEBUG=false
CLEANUP=true
SKIP_JOB_TESTS=false
SKIP_PIPELINE_TESTS=false

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    
    case $status in
        "SUCCESS") echo -e "${GREEN}✓${NC} $message" ;;
        "FAILURE") echo -e "${RED}✗${NC} $message" ;;
        "WARNING") echo -e "${YELLOW}⚠${NC} $message" ;;
        "INFO") echo -e "${BLUE}ℹ${NC} $message" ;;
        "DEBUG") echo -e "${PURPLE}🐛${NC} $message" ;;
        *) echo -e "${CYAN}?${NC} $message" ;;
    esac
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Comprehensive GitHub Actions Testing Suite

OPTIONS:
    -j, --skip-job-tests      Skip individual job workflow tests
    -p, --skip-pipeline-tests Skip pipeline workflow tests
    -v, --verbose             Verbose output
    -d, --debug               Debug mode with extra logging
    -c, --no-cleanup          Don't clean up test artifacts
    -h, --help                Show this help message

EXAMPLES:
    $0                                    # Run all tests
    $0 -j                                # Skip job tests, run pipeline tests
    $0 -p                                # Skip pipeline tests, run job tests
    $0 -v -d                             # Verbose debug mode
    $0 --no-cleanup                      # Run tests, keep artifacts

EOF
}

# Function to check prerequisites
check_prerequisites() {
    print_status "INFO" "Checking prerequisites..."
    
    local missing_deps=()
    
    # Check for required commands
    if ! command -v act &> /dev/null; then
        missing_deps+=("act")
    fi
    
    if ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
    fi
    
    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        print_status "FAILURE" "Missing dependencies: ${missing_deps[*]}"
        echo -e "${YELLOW}Please install missing dependencies:${NC}"
        for dep in "${missing_deps[@]}"; do
            case $dep in
                "act") echo "  - Act: curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash" ;;
                "docker") echo "  - Docker: https://docs.docker.com/get-docker/" ;;
                "jq") echo "  - jq: brew install jq (macOS) or apt-get install jq (Ubuntu)" ;;
            esac
        done
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        print_status "FAILURE" "Docker is not running"
        echo -e "${YELLOW}Please start Docker and try again${NC}"
        exit 1
    fi
    
    print_status "SUCCESS" "All prerequisites satisfied"
}

# Function to setup test environment
setup_test_environment() {
    print_status "INFO" "Setting up test environment..."
    
    # Create output directory
    mkdir -p "$OUTPUT_DIR"
    
    # Create test configuration
    cat > "$PROJECT_ROOT/.actrc" << EOF
# Act configuration for testing
-P ubuntu-latest=catthehacker/ubuntu:act-latest
-P ubuntu-20.04=catthehacker/ubuntu:act-20.04
-P ubuntu-18.04=catthehacker/ubuntu:act-18.04
EOF
    
    # Create test environment file
    cat > "$PROJECT_ROOT/.env" << EOF
# Test environment variables
GITHUB_ACTIONS=true
GITHUB_WORKFLOW=test-workflow
GITHUB_RUN_ID=123456789
GITHUB_RUN_NUMBER=1
GITHUB_ACTOR=test-user
GITHUB_REPOSITORY=test-org/test-repo
GITHUB_EVENT_NAME=push
GITHUB_SHA=abc123def456
GITHUB_REF=refs/heads/main
GITHUB_HEAD_REF=""
GITHUB_BASE_REF=""
GITHUB_WORKSPACE=$PROJECT_ROOT
GITHUB_TOKEN=test-token
EOF
    
    print_status "SUCCESS" "Test environment setup complete"
}

# Function to run job workflow tests
run_job_tests() {
    if [ "$SKIP_JOB_TESTS" = true ]; then
        print_status "WARNING" "Skipping job workflow tests"
        return 0
    fi
    
    print_status "INFO" "Running job workflow tests..."
    
    local test_script="$SCRIPT_DIR/test-job-workflows.sh"
    if [ ! -f "$test_script" ]; then
        print_status "FAILURE" "Job test script not found: $test_script"
        return 1
    fi
    
    local test_args=()
    if [ "$VERBOSE" = true ]; then
        test_args+=("-v")
    fi
    if [ "$DEBUG" = true ]; then
        test_args+=("-d")
    fi
    if [ "$CLEANUP" = false ]; then
        test_args+=("-c")
    fi
    
    if "$test_script" "${test_args[@]}"; then
        print_status "SUCCESS" "Job workflow tests passed"
        return 0
    else
        print_status "FAILURE" "Job workflow tests failed"
        return 1
    fi
}

# Function to run pipeline workflow tests
run_pipeline_tests() {
    if [ "$SKIP_PIPELINE_TESTS" = true ]; then
        print_status "WARNING" "Skipping pipeline workflow tests"
        return 0
    fi
    
    print_status "INFO" "Running pipeline workflow tests..."
    
    local test_script="$SCRIPT_DIR/test-pipeline-workflow.sh"
    if [ ! -f "$test_script" ]; then
        print_status "FAILURE" "Pipeline test script not found: $test_script"
        return 1
    fi
    
    local test_args=()
    if [ "$VERBOSE" = true ]; then
        test_args+=("-v")
    fi
    if [ "$DEBUG" = true ]; then
        test_args+=("-d")
    fi
    if [ "$CLEANUP" = false ]; then
        test_args+=("-c")
    fi
    
    if "$test_script" "${test_args[@]}"; then
        print_status "SUCCESS" "Pipeline workflow tests passed"
        return 0
    else
        print_status "FAILURE" "Pipeline workflow tests failed"
        return 1
    fi
}

# Function to run workflow generation tests
run_generation_tests() {
    print_status "INFO" "Running workflow generation tests..."
    
    # Check if workflows exist
    local workflows_dir="$PROJECT_ROOT/.github/workflows"
    if [ ! -d "$workflows_dir" ]; then
        print_status "FAILURE" "Workflows directory not found: $workflows_dir"
        return 1
    fi
    
    # Check for required workflow files
    local required_workflows=(
        "pipeline.yml"
        "job.changes.yml"
        "job.version.yml"
        "job.tag.yml"
        "job.createpr.yml"
        "job.branch.yml"
        "job.apps.yml"
    )
    
    local missing_workflows=()
    for workflow in "${required_workflows[@]}"; do
        if [ ! -f "$workflows_dir/$workflow" ]; then
            missing_workflows+=("$workflow")
        fi
    done
    
    if [ ${#missing_workflows[@]} -gt 0 ]; then
        print_status "FAILURE" "Missing workflow files: ${missing_workflows[*]}"
        echo -e "${YELLOW}Please generate workflows first using: ./flowcraft generate${NC}"
        return 1
    fi
    
    print_status "SUCCESS" "All required workflow files found"
    return 0
}

# Function to run syntax validation tests
run_syntax_tests() {
    print_status "INFO" "Running workflow syntax validation..."
    
    local workflows_dir="$PROJECT_ROOT/.github/workflows"
    local syntax_errors=0
    
    # Check each workflow file for syntax errors
    find "$workflows_dir" -name "*.yml" -o -name "*.yaml" | while read -r workflow_file; do
        local workflow_name=$(basename "$workflow_file")
        
        # Basic YAML syntax check
        if ! python3 -c "import yaml; yaml.safe_load(open('$workflow_file'))" 2>/dev/null; then
            print_status "FAILURE" "Syntax error in $workflow_name"
            syntax_errors=$((syntax_errors + 1))
        else
            print_status "SUCCESS" "Syntax valid: $workflow_name"
        fi
    done
    
    if [ $syntax_errors -gt 0 ]; then
        print_status "FAILURE" "Found $syntax_errors syntax errors"
        return 1
    else
        print_status "SUCCESS" "All workflow files have valid syntax"
        return 0
    fi
}

# Function to run all tests
run_all_tests() {
    print_status "INFO" "Running comprehensive GitHub Actions test suite..."
    
    local failed_tests=0
    local total_tests=0
    
    # Test scenarios
    local test_scenarios=(
        "run_generation_tests:Workflow Generation"
        "run_syntax_tests:Workflow Syntax"
        "run_job_tests:Job Workflows"
        "run_pipeline_tests:Pipeline Workflow"
    )
    
    for test in "${test_scenarios[@]}"; do
        IFS=':' read -r test_function test_name <<< "$test"
        total_tests=$((total_tests + 1))
        
        print_status "INFO" "Running $test_name tests..."
        if $test_function; then
            print_status "SUCCESS" "✅ $test_name tests passed"
        else
            print_status "FAILURE" "❌ $test_name tests failed"
            failed_tests=$((failed_tests + 1))
        fi
    done
    
    # Summary
    echo ""
    print_status "INFO" "Test Suite Summary:"
    echo "  Total test suites: $total_tests"
    echo "  Passed: $((total_tests - failed_tests))"
    echo "  Failed: $failed_tests"
    
    if [ $failed_tests -gt 0 ]; then
        print_status "FAILURE" "Some test suites failed"
        return 1
    else
        print_status "SUCCESS" "All test suites passed"
        return 0
    fi
}

# Function to cleanup test artifacts
cleanup_test_artifacts() {
    if [ "$CLEANUP" = true ]; then
        print_status "INFO" "Cleaning up test artifacts..."
        
        # Remove test files
        rm -f "$PROJECT_ROOT/.actrc"
        rm -f "$PROJECT_ROOT/.env"
        
        # Clean up output directory
        if [ -d "$OUTPUT_DIR" ]; then
            rm -rf "$OUTPUT_DIR"
        fi
        
        print_status "SUCCESS" "Cleanup complete"
    fi
}

# Function to show test results
show_test_results() {
    if [ -d "$OUTPUT_DIR" ]; then
        echo ""
        print_status "INFO" "Test Results:"
        echo "  Output directory: $OUTPUT_DIR"
        
        if [ "$VERBOSE" = true ]; then
            echo "  Log files:"
            find "$OUTPUT_DIR" -name "*.log" -exec basename {} \; | while read -r log_file; do
                echo "    - $log_file"
            done
        fi
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -j|--skip-job-tests)
            SKIP_JOB_TESTS=true
            shift
            ;;
        -p|--skip-pipeline-tests)
            SKIP_PIPELINE_TESTS=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -d|--debug)
            DEBUG=true
            shift
            ;;
        -c|--no-cleanup)
            CLEANUP=false
            shift
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
    echo -e "${BLUE}Comprehensive GitHub Actions Testing Suite${NC}"
    echo -e "${CYAN}==========================================${NC}"
    echo ""
    
    # Check prerequisites
    check_prerequisites
    
    # Setup test environment
    setup_test_environment
    
    # Run all tests
    run_all_tests
    
    # Show results
    show_test_results
    
    # Cleanup
    cleanup_test_artifacts
    
    echo ""
    print_status "SUCCESS" "Comprehensive testing complete!"
}

# Run main function
main "$@"
