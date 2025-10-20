#!/bin/bash

# GitHub Actions Pipeline Workflow Testing Script
# Tests the main pipeline workflow using Act

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
WORKFLOWS_DIR="$PROJECT_ROOT/.github/workflows"
OUTPUT_DIR="$SCRIPT_DIR/output"
VERBOSE=false
DEBUG=false
CLEANUP=true

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

GitHub Actions Pipeline Workflow Testing Script

OPTIONS:
    -v, --verbose            Verbose output
    -d, --debug              Debug mode with extra logging
    -c, --no-cleanup         Don't clean up test artifacts
    -h, --help               Show this help message

EXAMPLES:
    $0                       # Test pipeline workflow
    $0 -v -d                 # Verbose debug mode
    $0 --no-cleanup          # Test pipeline, keep artifacts

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

# Function to test pipeline workflow
test_pipeline_workflow() {
    local workflow_file="$WORKFLOWS_DIR/pipeline.yml"
    
    if [ ! -f "$workflow_file" ]; then
        print_status "FAILURE" "Pipeline workflow not found: $workflow_file"
        return 1
    fi
    
    print_status "INFO" "Testing Pipeline workflow..."
    
    # Test with different branch scenarios
    local test_scenarios=(
        "refs/heads/main"
        "refs/heads/develop"
        "refs/heads/staging"
        "refs/heads/test"
    )
    
    for ref in "${test_scenarios[@]}"; do
        print_status "DEBUG" "Testing pipeline with ref: $ref"
        
        local act_args=(
            "-W" "$workflow_file"
            "--dry-run"
            "--env" "GITHUB_REF=$ref"
            "--env-file" "$PROJECT_ROOT/.env"
        )
        
        if [ "$VERBOSE" = true ]; then
            act_args+=("--verbose")
        fi
        
        if [ "$DEBUG" = true ]; then
            act_args+=("--debug")
        fi
        
        if act "${act_args[@]}" > "$OUTPUT_DIR/pipeline-${ref//\//-}.log" 2>&1; then
            print_status "SUCCESS" "Pipeline workflow passed for $ref"
        else
            print_status "FAILURE" "Pipeline workflow failed for $ref"
            if [ "$VERBOSE" = true ]; then
                echo "Error details:"
                cat "$OUTPUT_DIR/pipeline-${ref//\//-}.log"
            fi
            return 1
        fi
    done
    
    print_status "SUCCESS" "Pipeline workflow testing completed"
}

# Function to test pipeline with different events
test_pipeline_events() {
    local workflow_file="$WORKFLOWS_DIR/pipeline.yml"
    
    print_status "INFO" "Testing Pipeline workflow with different events..."
    
    # Test with different GitHub events
    local test_events=(
        "push"
        "pull_request"
        "workflow_dispatch"
    )
    
    for event in "${test_events[@]}"; do
        print_status "DEBUG" "Testing pipeline with event: $event"
        
        local act_args=(
            "-W" "$workflow_file"
            "--dry-run"
            "--event" "$event"
            "--env-file" "$PROJECT_ROOT/.env"
        )
        
        if [ "$VERBOSE" = true ]; then
            act_args+=("--verbose")
        fi
        
        if [ "$DEBUG" = true ]; then
            act_args+=("--debug")
        fi
        
        if act "${act_args[@]}" > "$OUTPUT_DIR/pipeline-${event}.log" 2>&1; then
            print_status "SUCCESS" "Pipeline workflow passed for $event event"
        else
            print_status "FAILURE" "Pipeline workflow failed for $event event"
            if [ "$VERBOSE" = true ]; then
                echo "Error details:"
                cat "$OUTPUT_DIR/pipeline-${event}.log"
            fi
            return 1
        fi
    done
    
    print_status "SUCCESS" "Pipeline event testing completed"
}

# Function to test pipeline job dependencies
test_pipeline_dependencies() {
    local workflow_file="$WORKFLOWS_DIR/pipeline.yml"
    
    print_status "INFO" "Testing Pipeline workflow job dependencies..."
    
    # Test workflow structure and job dependencies
    local act_args=(
        "-W" "$workflow_file"
        "--list"
        "--env-file" "$PROJECT_ROOT/.env"
    )
    
    if act "${act_args[@]}" > "$OUTPUT_DIR/pipeline-jobs.log" 2>&1; then
        print_status "SUCCESS" "Pipeline job dependencies validated"
        
        # Parse job information
        if [ "$VERBOSE" = true ]; then
            echo "Job information:"
            cat "$OUTPUT_DIR/pipeline-jobs.log"
        fi
    else
        print_status "FAILURE" "Pipeline job dependencies validation failed"
        if [ "$VERBOSE" = true ]; then
            echo "Error details:"
            cat "$OUTPUT_DIR/pipeline-jobs.log"
        fi
        return 1
    fi
    
    print_status "SUCCESS" "Pipeline dependencies testing completed"
}

# Function to test pipeline with custom inputs
test_pipeline_inputs() {
    local workflow_file="$WORKFLOWS_DIR/pipeline.yml"
    
    print_status "INFO" "Testing Pipeline workflow with custom inputs..."
    
    # Test with workflow_dispatch inputs
    local act_args=(
        "-W" "$workflow_file"
        "--dry-run"
        "--event" "workflow_dispatch"
        "--input" "migration_input=true"
        "--input" "seed_input=false"
        "--env-file" "$PROJECT_ROOT/.env"
    )
    
    if [ "$VERBOSE" = true ]; then
        act_args+=("--verbose")
    fi
    
    if [ "$DEBUG" = true ]; then
        act_args+=("--debug")
    fi
    
    if act "${act_args[@]}" > "$OUTPUT_DIR/pipeline-inputs.log" 2>&1; then
        print_status "SUCCESS" "Pipeline workflow passed with custom inputs"
    else
        print_status "FAILURE" "Pipeline workflow failed with custom inputs"
        if [ "$VERBOSE" = true ]; then
            echo "Error details:"
            cat "$OUTPUT_DIR/pipeline-inputs.log"
        fi
        return 1
    fi
    
    print_status "SUCCESS" "Pipeline inputs testing completed"
}

# Function to test all pipeline scenarios
test_all_pipeline_scenarios() {
    print_status "INFO" "Testing all pipeline scenarios..."
    
    local failed_tests=0
    local total_tests=0
    
    # Test each scenario
    local test_functions=(
        "test_pipeline_workflow:Pipeline Workflow"
        "test_pipeline_events:Pipeline Events"
        "test_pipeline_dependencies:Pipeline Dependencies"
        "test_pipeline_inputs:Pipeline Inputs"
    )
    
    for test in "${test_functions[@]}"; do
        IFS=':' read -r test_function test_name <<< "$test"
        total_tests=$((total_tests + 1))
        
        print_status "INFO" "Testing $test_name..."
        if $test_function; then
            print_status "SUCCESS" "✅ $test_name passed"
        else
            print_status "FAILURE" "❌ $test_name failed"
            failed_tests=$((failed_tests + 1))
        fi
    done
    
    # Summary
    echo ""
    print_status "INFO" "Test Summary:"
    echo "  Total scenarios: $total_tests"
    echo "  Passed: $((total_tests - failed_tests))"
    echo "  Failed: $failed_tests"
    
    if [ $failed_tests -gt 0 ]; then
        print_status "FAILURE" "Some pipeline scenarios failed testing"
        return 1
    else
        print_status "SUCCESS" "All pipeline scenarios passed testing"
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
    echo -e "${BLUE}GitHub Actions Pipeline Workflow Testing${NC}"
    echo -e "${CYAN}=========================================${NC}"
    echo ""
    
    # Check prerequisites
    check_prerequisites
    
    # Setup test environment
    setup_test_environment
    
    # Run all pipeline tests
    test_all_pipeline_scenarios
    
    # Show results
    show_test_results
    
    # Cleanup
    cleanup_test_artifacts
    
    echo ""
    print_status "SUCCESS" "Pipeline workflow testing complete!"
}

# Run main function
main "$@"
