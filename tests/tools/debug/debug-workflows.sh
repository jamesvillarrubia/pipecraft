#!/bin/bash

# GitHub Actions Workflow Debugging Script
# This script fetches workflow status, job details, and logs for debugging

set -euo pipefail

# Configuration
REPO_OWNER="${GITHUB_REPOSITORY_OWNER:-$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^/]*\)\/\([^/]*\)\.git.*/\1/')}"
REPO_NAME="${GITHUB_REPOSITORY##*/:-$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^/]*\)\/\([^/]*\)\.git.*/\2/')}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
API_BASE="https://api.github.com"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default values
WORKFLOW_NAME=""
BRANCH=""
LIMIT=10
OUTPUT_DIR="./debug-output"
VERBOSE=false
FETCH_LOGS=true

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    
    case $status in
        "SUCCESS") echo -e "${GREEN}✓${NC} $message" ;;
        "FAILURE") echo -e "${RED}✗${NC} $message" ;;
        "CANCELLED") echo -e "${YELLOW}⚠${NC} $message" ;;
        "IN_PROGRESS") echo -e "${BLUE}⟳${NC} $message" ;;
        "QUEUED") echo -e "${PURPLE}⏳${NC} $message" ;;
        "SKIPPED") echo -e "${CYAN}⊘${NC} $message" ;;
        *) echo -e "${YELLOW}?${NC} $message" ;;
    esac
}

# Function to make GitHub API calls
github_api() {
    local endpoint=$1
    local method=${2:-GET}
    
    if [[ -z "$GITHUB_TOKEN" ]]; then
        echo -e "${RED}Error: GITHUB_TOKEN environment variable is required${NC}" >&2
        exit 1
    fi
    
    curl -s -H "Authorization: token $GITHUB_TOKEN" \
         -H "Accept: application/vnd.github.v3+json" \
         -X "$method" \
         "$API_BASE/repos/$REPO_OWNER/$REPO_NAME$endpoint"
}

# Function to get workflow runs
get_workflow_runs() {
    local workflow_name=$1
    local branch=$2
    local limit=$3
    
    local endpoint="/actions/workflows/$workflow_name/runs"
    local params="?per_page=$limit"
    
    if [[ -n "$branch" ]]; then
        params="${params}&branch=$branch"
    fi
    
    github_api "$endpoint$params"
}

# Function to get workflow run details
get_workflow_run() {
    local run_id=$1
    github_api "/actions/runs/$run_id"
}

# Function to get jobs for a workflow run
get_workflow_jobs() {
    local run_id=$1
    github_api "/actions/runs/$run_id/jobs"
}

# Function to get job logs
get_job_logs() {
    local run_id=$1
    local job_id=$2
    local output_file=$3
    
    local endpoint="/actions/runs/$run_id/jobs/$job_id/logs"
    
    if [[ -z "$GITHUB_TOKEN" ]]; then
        echo -e "${RED}Error: GITHUB_TOKEN required for log download${NC}" >&2
        return 1
    fi
    
    curl -s -H "Authorization: token $GITHUB_TOKEN" \
         -H "Accept: application/vnd.github.v3+json" \
         "$API_BASE/repos/$REPO_OWNER/$REPO_NAME$endpoint" > "$output_file"
}

# Function to analyze workflow failures
analyze_failures() {
    local run_id=$1
    local output_dir=$2
    
    echo -e "${BLUE}Analyzing workflow failures for run $run_id...${NC}"
    
    # Get workflow run details
    local run_details=$(get_workflow_run "$run_id")
    local run_status=$(echo "$run_details" | jq -r '.conclusion // .status')
    local run_url=$(echo "$run_details" | jq -r '.html_url')
    
    echo -e "${CYAN}Workflow Status:${NC} $run_status"
    echo -e "${CYAN}Workflow URL:${NC} $run_url"
    
    # Get jobs
    local jobs=$(get_workflow_jobs "$run_id")
    local failed_jobs=$(echo "$jobs" | jq -r '.jobs[] | select(.conclusion == "failure" or .conclusion == "cancelled") | .name')
    
    if [[ -z "$failed_jobs" ]]; then
        echo -e "${GREEN}No failed jobs found${NC}"
        return 0
    fi
    
    echo -e "${RED}Failed Jobs:${NC}"
    echo "$failed_jobs" | while read -r job_name; do
        echo -e "  ${RED}•${NC} $job_name"
    done
    
    # Get detailed job information
    echo "$jobs" | jq -r '.jobs[] | select(.conclusion == "failure" or .conclusion == "cancelled") | .id' | while read -r job_id; do
        local job_info=$(echo "$jobs" | jq -r ".jobs[] | select(.id == $job_id)")
        local job_name=$(echo "$job_info" | jq -r '.name')
        local job_conclusion=$(echo "$job_info" | jq -r '.conclusion')
        local job_url=$(echo "$job_info" | jq -r '.html_url')
        
        echo -e "\n${YELLOW}Job: $job_name${NC}"
        echo -e "${YELLOW}Status:${NC} $job_conclusion"
        echo -e "${YELLOW}URL:${NC} $job_url"
        
        # Get job steps
        local steps=$(echo "$job_info" | jq -r '.steps[] | select(.conclusion == "failure") | "\(.name): \(.conclusion)"')
        if [[ -n "$steps" ]]; then
            echo -e "${YELLOW}Failed Steps:${NC}"
            echo "$steps" | while read -r step; do
                echo -e "  ${RED}•${NC} $step"
            done
        fi
        
        # Download logs if requested
        if [[ "$FETCH_LOGS" == "true" ]]; then
            local log_file="$output_dir/job-${job_id}-logs.txt"
            echo -e "${BLUE}Downloading logs for job $job_name...${NC}"
            if get_job_logs "$run_id" "$job_id" "$log_file"; then
                echo -e "${GREEN}Logs saved to: $log_file${NC}"
            else
                echo -e "${RED}Failed to download logs for job $job_name${NC}"
            fi
        fi
    done
}

# Function to create summary report
create_summary_report() {
    local output_dir=$1
    local report_file="$output_dir/debug-summary.md"
    
    echo -e "${BLUE}Creating summary report...${NC}"
    
    cat > "$report_file" << EOF
# GitHub Actions Debug Summary

Generated: $(date)
Repository: $REPO_OWNER/$REPO_NAME
Workflow: $WORKFLOW_NAME
Branch: ${BRANCH:-"all"}

## Recent Workflow Runs

EOF

    # Get recent runs
    local runs=$(get_workflow_runs "$WORKFLOW_NAME" "$BRANCH" "$LIMIT")
    
    echo "$runs" | jq -r '.workflow_runs[] | "\(.id)|\(.status)|\(.conclusion)|\(.created_at)|\(.html_url)"' | while IFS='|' read -r run_id status conclusion created_at url; do
        echo "### Run $run_id" >> "$report_file"
        echo "- **Status**: $status" >> "$report_file"
        echo "- **Conclusion**: $conclusion" >> "$report_file"
        echo "- **Created**: $created_at" >> "$report_file"
        echo "- **URL**: $url" >> "$report_file"
        echo "" >> "$report_file"
    done
    
    echo -e "${GREEN}Summary report created: $report_file${NC}"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

GitHub Actions Workflow Debugging Script

OPTIONS:
    -w, --workflow NAME     Workflow name to debug (required)
    -b, --branch BRANCH     Branch to filter runs (optional)
    -l, --limit NUMBER      Number of recent runs to fetch (default: 10)
    -o, --output DIR        Output directory for logs and reports (default: ./debug-output)
    -t, --token TOKEN       GitHub token (or set GITHUB_TOKEN env var)
    -v, --verbose           Verbose output
    --no-logs               Don't download job logs
    -h, --help              Show this help message

EXAMPLES:
    $0 -w "My Custom Pipeline" -b main -l 5
    $0 -w "CI" --no-logs -o ./debug-logs
    GITHUB_TOKEN=your_token $0 -w "Deploy" -v

ENVIRONMENT VARIABLES:
    GITHUB_TOKEN            GitHub personal access token
    GITHUB_REPOSITORY_OWNER Repository owner (auto-detected from git)
    GITHUB_REPOSITORY       Repository name (auto-detected from git)

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -w|--workflow)
            WORKFLOW_NAME="$2"
            shift 2
            ;;
        -b|--branch)
            BRANCH="$2"
            shift 2
            ;;
        -l|--limit)
            LIMIT="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -t|--token)
            GITHUB_TOKEN="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --no-logs)
            FETCH_LOGS=false
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

# Validate required parameters
if [[ -z "$WORKFLOW_NAME" ]]; then
    echo -e "${RED}Error: Workflow name is required${NC}" >&2
    show_usage
    exit 1
fi

if [[ -z "$GITHUB_TOKEN" ]]; then
    echo -e "${RED}Error: GitHub token is required${NC}" >&2
    echo -e "${YELLOW}Set GITHUB_TOKEN environment variable or use -t option${NC}"
    exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required but not installed${NC}" >&2
    echo -e "${YELLOW}Install jq: brew install jq (macOS) or apt-get install jq (Ubuntu)${NC}"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo -e "${BLUE}GitHub Actions Workflow Debugger${NC}"
echo -e "${CYAN}Repository:${NC} $REPO_OWNER/$REPO_NAME"
echo -e "${CYAN}Workflow:${NC} $WORKFLOW_NAME"
echo -e "${CYAN}Branch:${NC} ${BRANCH:-"all"}"
echo -e "${CYAN}Output:${NC} $OUTPUT_DIR"
echo ""

# Get recent workflow runs
echo -e "${BLUE}Fetching recent workflow runs...${NC}"
runs=$(get_workflow_runs "$WORKFLOW_NAME" "$BRANCH" "$LIMIT")

if [[ "$runs" == "null" || $(echo "$runs" | jq '.workflow_runs | length') -eq 0 ]]; then
    echo -e "${YELLOW}No workflow runs found${NC}"
    exit 0
fi

# Display recent runs
echo -e "${CYAN}Recent Workflow Runs:${NC}"
echo "$runs" | jq -r '.workflow_runs[] | "\(.id)|\(.status)|\(.conclusion)|\(.created_at)|\(.html_url)"' | while IFS='|' read -r run_id status conclusion created_at url; do
    print_status "$conclusion" "Run $run_id ($status) - $created_at"
    if [[ "$VERBOSE" == "true" ]]; then
        echo "  URL: $url"
    fi
done

# Analyze failures
echo ""
echo -e "${BLUE}Analyzing failures...${NC}"
echo "$runs" | jq -r '.workflow_runs[] | select(.conclusion == "failure" or .conclusion == "cancelled") | .id' | while read -r run_id; do
    analyze_failures "$run_id" "$OUTPUT_DIR"
done

# Create summary report
create_summary_report "$OUTPUT_DIR"

echo ""
echo -e "${GREEN}Debug analysis complete!${NC}"
echo -e "${CYAN}Output directory:${NC} $OUTPUT_DIR"
echo -e "${CYAN}Summary report:${NC} $OUTPUT_DIR/debug-summary.md"
