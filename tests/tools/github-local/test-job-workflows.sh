#!/bin/bash

# GitHub Actions Job Workflow Testing Script
# Tests individual job workflows using Act

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

GitHub Actions Job Workflow Testing Script

OPTIONS:
    -w, --workflow FILE      Test specific workflow file
    -v, --verbose            Verbose output
    -d, --debug              Debug mode with extra logging
    -c, --no-cleanup         Don't clean up test artifacts
    -h, --help               Show this help message

EXAMPLES:
    $0                                    # Test all job workflows
    $0 -w job.changes.yml                 # Test specific workflow
    $0 -v -d                             # Verbose debug mode
    $0 -w job.version.yml --no-cleanup   # Test version workflow, keep artifacts

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

# Function to test changes workflow
test_changes_workflow() {
    local workflow_file="$WORKFLOWS_DIR/job.changes.yml"
    
    if [ ! -f "$workflow_file" ]; then
        print_status "WARNING" "Changes workflow not found: $workflow_file"
        return 0
    fi
    
    print_status "INFO" "Testing Changes workflow..."
    
    # Test with different branch scenarios
    local test_scenarios=(
        "refs/heads/main"
        "refs/heads/develop" 
        "refs/heads/staging"
        "refs/heads/test"
    )
    
    for ref in "${test_scenarios[@]}"; do
        print_status "DEBUG" "Testing with ref: $ref"
        
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
        
        if act "${act_args[@]}" > "$OUTPUT_DIR/changes-${ref//\//-}.log" 2>&1; then
            print_status "SUCCESS" "Changes workflow passed for $ref"
        else
            print_status "FAILURE" "Changes workflow failed for $ref"
            if [ "$VERBOSE" = true ]; then
                echo "Error details:"
                cat "$OUTPUT_DIR/changes-${ref//\//-}.log"
            fi
            return 1
        fi
    done
    
    print_status "SUCCESS" "Changes workflow testing completed"
}

# Function to test version workflow
test_version_workflow() {
    local workflow_file="$WORKFLOWS_DIR/job.version.yml"
    
    if [ ! -f "$workflow_file" ]; then
        print_status "WARNING" "Version workflow not found: $workflow_file"
        return 0
    fi
    
    print_status "INFO" "Testing Version workflow..."
    
    # Test with different base references
    local test_scenarios=(
        "main"
        "develop"
        "staging"
    )
    
    for base_ref in "${test_scenarios[@]}"; do
        print_status "DEBUG" "Testing with base ref: $base_ref"
        
        local act_args=(
            "-W" "$workflow_file"
            "--dry-run"
            "--input" "baseRef=$base_ref"
            "--env-file" "$PROJECT_ROOT/.env"
        )
        
        if [ "$VERBOSE" = true ]; then
            act_args+=("--verbose")
        fi
        
        if [ "$DEBUG" = true ]; then
            act_args+=("--debug")
        fi
        
        if act "${act_args[@]}" > "$OUTPUT_DIR/version-${base_ref}.log" 2>&1; then
            print_status "SUCCESS" "Version workflow passed for $base_ref"
        else
            print_status "FAILURE" "Version workflow failed for $base_ref"
            if [ "$VERBOSE" = true ]; then
                echo "Error details:"
                cat "$OUTPUT_DIR/version-${base_ref}.log"
            fi
            return 1
        fi
    done
    
    print_status "SUCCESS" "Version workflow testing completed"
}

# Function to test tag workflow
test_tag_workflow() {
    local workflow_file="$WORKFLOWS_DIR/job.tag.yml"
    
    if [ ! -f "$workflow_file" ]; then
        print_status "WARNING" "Tag workflow not found: $workflow_file"
        return 0
    fi
    
    print_status "INFO" "Testing Tag workflow..."
    
    # Test with different version formats
    local test_scenarios=(
        "v1.0.0"
        "v1.2.3"
        "v2.0.0"
    )
    
    for version in "${test_scenarios[@]}"; do
        print_status "DEBUG" "Testing with version: $version"
        
        local act_args=(
            "-W" "$workflow_file"
            "--dry-run"
            "--input" "version=$version"
            "--input" "tagMessage=Test release $version"
            "--env-file" "$PROJECT_ROOT/.env"
        )
        
        if [ "$VERBOSE" = true ]; then
            act_args+=("--verbose")
        fi
        
        if [ "$DEBUG" = true ]; then
            act_args+=("--debug")
        fi
        
        if act "${act_args[@]}" > "$OUTPUT_DIR/tag-${version}.log" 2>&1; then
            print_status "SUCCESS" "Tag workflow passed for $version"
        else
            print_status "FAILURE" "Tag workflow failed for $version"
            if [ "$VERBOSE" = true ]; then
                echo "Error details:"
                cat "$OUTPUT_DIR/tag-${version}.log"
            fi
            return 1
        fi
    done
    
    print_status "SUCCESS" "Tag workflow testing completed"
}

# Function to test createpr workflow
test_createpr_workflow() {
    local workflow_file="$WORKFLOWS_DIR/job.createpr.yml"
    
    if [ ! -f "$workflow_file" ]; then
        print_status "WARNING" "CreatePR workflow not found: $workflow_file"
        return 0
    fi
    
    print_status "INFO" "Testing CreatePR workflow..."
    
    # Test with different PR scenarios
    local test_scenarios=(
        "develop:main:Test PR:This is a test PR"
        "feature-branch:develop:Feature PR:New feature implementation"
        "hotfix-branch:main:Hotfix PR:Critical bug fix"
    )
    
    for scenario in "${test_scenarios[@]}"; do
        IFS=':' read -r source target title body <<< "$scenario"
        print_status "DEBUG" "Testing PR: $source → $target"
        
        local act_args=(
            "-W" "$workflow_file"
            "--dry-run"
            "--input" "sourceBranch=$source"
            "--input" "targetBranch=$target"
            "--input" "title=$title"
            "--input" "body=$body"
            "--input" "labels=test,automated"
            "--env-file" "$PROJECT_ROOT/.env"
        )
        
        if [ "$VERBOSE" = true ]; then
            act_args+=("--verbose")
        fi
        
        if [ "$DEBUG" = true ]; then
            act_args+=("--debug")
        fi
        
        if act "${act_args[@]}" > "$OUTPUT_DIR/createpr-${source}-${target}.log" 2>&1; then
            print_status "SUCCESS" "CreatePR workflow passed for $source → $target"
        else
            print_status "FAILURE" "CreatePR workflow failed for $source → $target"
            if [ "$VERBOSE" = true ]; then
                echo "Error details:"
                cat "$OUTPUT_DIR/createpr-${source}-${target}.log"
            fi
            return 1
        fi
    done
    
    print_status "SUCCESS" "CreatePR workflow testing completed"
}

# Function to test branch workflow
test_branch_workflow() {
    local workflow_file="$WORKFLOWS_DIR/job.branch.yml"
    
    if [ ! -f "$workflow_file" ]; then
        print_status "WARNING" "Branch workflow not found: $workflow_file"
        return 0
    fi
    
    print_status "INFO" "Testing Branch workflow..."
    
    # Test different branch actions
    local test_scenarios=(
        "fast-forward:develop:main"
        "create:main:feature-branch"
        "delete:feature-branch"
    )
    
    for scenario in "${test_scenarios[@]}"; do
        IFS=':' read -r action source target <<< "$scenario"
        print_status "DEBUG" "Testing branch action: $action"
        
        local act_args=(
            "-W" "$workflow_file"
            "--dry-run"
            "--input" "action=$action"
            "--input" "sourceBranch=$source"
            "--input" "targetBranch=$target"
            "--env-file" "$PROJECT_ROOT/.env"
        )
        
        if [ "$action" = "create" ]; then
            act_args+=("--input" "branchName=$target")
        fi
        
        if [ "$VERBOSE" = true ]; then
            act_args+=("--verbose")
        fi
        
        if [ "$DEBUG" = true ]; then
            act_args+=("--debug")
        fi
        
        if act "${act_args[@]}" > "$OUTPUT_DIR/branch-${action}.log" 2>&1; then
            print_status "SUCCESS" "Branch workflow passed for $action"
        else
            print_status "FAILURE" "Branch workflow failed for $action"
            if [ "$VERBOSE" = true ]; then
                echo "Error details:"
                cat "$OUTPUT_DIR/branch-${action}.log"
            fi
            return 1
        fi
    done
    
    print_status "SUCCESS" "Branch workflow testing completed"
}

# Function to test apps workflow
test_apps_workflow() {
    local workflow_file="$WORKFLOWS_DIR/job.apps.yml"
    
    if [ ! -f "$workflow_file" ]; then
        print_status "WARNING" "Apps workflow not found: $workflow_file"
        return 0
    fi
    
    print_status "INFO" "Testing Apps workflow..."
    
    # Test different deployment scenarios
    local test_scenarios=(
        "development:api,web:latest"
        "staging:api,web,libs:v1.2.3"
        "production:api,web:latest"
    )
    
    for scenario in "${test_scenarios[@]}"; do
        IFS=':' read -r environment domains version <<< "$scenario"
        print_status "DEBUG" "Testing deployment: $environment ($domains)"
        
        local act_args=(
            "-W" "$workflow_file"
            "--dry-run"
            "--input" "environment=$environment"
            "--input" "domains=$domains"
            "--input" "version=$version"
            "--env-file" "$PROJECT_ROOT/.env"
        )
        
        if [ "$VERBOSE" = true ]; then
            act_args+=("--verbose")
        fi
        
        if [ "$DEBUG" = true ]; then
            act_args+=("--debug")
        fi
        
        if act "${act_args[@]}" > "$OUTPUT_DIR/apps-${environment}.log" 2>&1; then
            print_status "SUCCESS" "Apps workflow passed for $environment"
        else
            print_status "FAILURE" "Apps workflow failed for $environment"
            if [ "$VERBOSE" = true ]; then
                echo "Error details:"
                cat "$OUTPUT_DIR/apps-${environment}.log"
            fi
            return 1
        fi
    done
    
    print_status "SUCCESS" "Apps workflow testing completed"
}

# Function to test all job workflows
test_all_workflows() {
    print_status "INFO" "Testing all job workflows..."
    
    local failed_tests=0
    local total_tests=0
    
    # Test each workflow type
    local workflows=(
        "changes:test_changes_workflow"
        "version:test_version_workflow"
        "tag:test_tag_workflow"
        "createpr:test_createpr_workflow"
        "branch:test_branch_workflow"
        "apps:test_apps_workflow"
    )
    
    for workflow in "${workflows[@]}"; do
        IFS=':' read -r name test_function <<< "$workflow"
        total_tests=$((total_tests + 1))
        
        print_status "INFO" "Testing $name workflow..."
        if $test_function; then
            print_status "SUCCESS" "✅ $name workflow passed"
        else
            print_status "FAILURE" "❌ $name workflow failed"
            failed_tests=$((failed_tests + 1))
        fi
    done
    
    # Summary
    echo ""
    print_status "INFO" "Test Summary:"
    echo "  Total workflows: $total_tests"
    echo "  Passed: $((total_tests - failed_tests))"
    echo "  Failed: $failed_tests"
    
    if [ $failed_tests -gt 0 ]; then
        print_status "FAILURE" "Some workflows failed testing"
        return 1
    else
        print_status "SUCCESS" "All workflows passed testing"
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
        -w|--workflow)
            WORKFLOW="$2"
            shift 2
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
    echo -e "${BLUE}GitHub Actions Job Workflow Testing${NC}"
    echo -e "${CYAN}====================================${NC}"
    echo ""
    
    # Check prerequisites
    check_prerequisites
    
    # Setup test environment
    setup_test_environment
    
    # Run tests
    if [ -n "${WORKFLOW:-}" ]; then
        # Test specific workflow
        case "$WORKFLOW" in
            "job.changes.yml"|"changes")
                test_changes_workflow
                ;;
            "job.version.yml"|"version")
                test_version_workflow
                ;;
            "job.tag.yml"|"tag")
                test_tag_workflow
                ;;
            "job.createpr.yml"|"createpr")
                test_createpr_workflow
                ;;
            "job.branch.yml"|"branch")
                test_branch_workflow
                ;;
            "job.apps.yml"|"apps")
                test_apps_workflow
                ;;
            *)
                print_status "FAILURE" "Unknown workflow: $WORKFLOW"
                exit 1
                ;;
        esac
    else
        # Test all workflows
        test_all_workflows
    fi
    
    # Show results
    show_test_results
    
    # Cleanup
    cleanup_test_artifacts
    
    echo ""
    print_status "SUCCESS" "Job workflow testing complete!"
}

# Run main function
main "$@"
