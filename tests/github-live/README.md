# GitHub Actions Live Testing

This directory contains tests for running GitHub Actions workflows on actual GitHub infrastructure.

## 🎯 Purpose

Live GitHub Actions testing allows us to:
- Test workflows in the real GitHub environment
- Validate workflow behavior with actual GitHub APIs
- Test performance under real conditions
- Debug issues that only occur in the live environment
- Validate workflow reliability and stability

## 📁 Structure

```
tests/github-live/
├── README.md                 # This file
├── run-live-tests.sh         # Main test runner script
├── setup-test-env.sh         # Environment setup script
├── test-workflows.sh         # Individual workflow testing
├── fixtures/                  # Test data and configurations
│   ├── test-configs/         # Test configurations
│   ├── mock-data/            # Mock data for workflows
│   └── expected-outputs/     # Expected test outputs
└── helpers/                  # Test helper scripts
    ├── github-runner.sh      # GitHub Actions execution helper
    └── workflow-monitor.sh    # Workflow monitoring helper
```

## 🚀 Quick Start

### Prerequisites
```bash
# Install GitHub CLI
brew install gh  # macOS
# Or download from: https://cli.github.com/

# Authenticate with GitHub
gh auth login

# Set up GitHub token
export GITHUB_TOKEN="your_github_token"
```

### Running Tests
```bash
# Run all live tests
./tests/github-live/run-live-tests.sh

# Test specific workflow
./tests/github-live/test-workflows.sh --workflow pipeline.yml

# Run with verbose output
./tests/github-live/run-live-tests.sh --verbose

# Run with debug mode
./tests/github-live/run-live-tests.sh --debug
```

## 🔧 Configuration

### GitHub Authentication
```bash
# Set up GitHub token
export GITHUB_TOKEN="your_github_token"

# Or use GitHub CLI
gh auth token
```

### Test Environment
```bash
# Set up test environment
./tests/github-live/setup-test-env.sh

# This creates:
# - Test repository setup
# - Workflow trigger configuration
# - Test data and fixtures
# - Monitoring setup
```

## 📋 Test Workflows

### Supported Workflows
- **pipeline.yml**: Main workflow orchestration
- **job.changes.yml**: Change detection workflow
- **job.version.yml**: Version management workflow
- **job.tag.yml**: Tag creation workflow
- **job.createpr.yml**: PR creation workflow
- **job.branch.yml**: Branch management workflow
- **job.apps.yml**: Application-specific workflows

### Test Scenarios
1. **Basic Execution**: Test workflow runs without errors
2. **Environment Variables**: Test with different env vars
3. **Conditional Logic**: Test workflow conditions and branches
4. **Job Dependencies**: Test job dependency chains
5. **Error Handling**: Test failure scenarios
6. **Performance**: Test execution time and resource usage
7. **API Limits**: Test GitHub API rate limiting
8. **Concurrency**: Test parallel workflow execution

## 🧪 Test Examples

### Basic Workflow Test
```bash
# Test main pipeline
./tests/github-live/test-workflows.sh --workflow pipeline.yml

# Test with specific event
./tests/github-live/test-workflows.sh --workflow pipeline.yml --event push

# Test with environment variables
./tests/github-live/test-workflows.sh --workflow pipeline.yml --env GITHUB_REF=refs/heads/main
```

### Advanced Testing
```bash
# Test with secrets
./tests/github-live/test-workflows.sh --workflow pipeline.yml --secrets GITHUB_TOKEN=your_token

# Test with artifacts
./tests/github-live/test-workflows.sh --workflow pipeline.yml --artifacts

# Test with matrix strategy
./tests/github-live/test-workflows.sh --workflow pipeline.yml --matrix os:ubuntu-latest,node:18
```

## 🔍 Debugging

### Common Issues
1. **Authentication**: Verify GitHub token permissions
2. **Rate limits**: Check GitHub API rate limits
3. **Workflow syntax**: Check YAML syntax and GitHub Actions syntax
4. **Environment variables**: Verify all required env vars are set
5. **Secrets**: Ensure all required secrets are available

### Debug Commands
```bash
# List available workflows
gh workflow list

# Show workflow details
gh workflow view pipeline.yml

# Run workflow manually
gh workflow run pipeline.yml

# Check workflow runs
gh run list

# View workflow logs
gh run view <run-id>
```

## 📊 Test Results

### Output Format
```
✅ Workflow: pipeline.yml
  ✅ Job: changes (2.3s)
  ✅ Job: versioning (1.8s)
  ✅ Job: deployments (4.2s)
  ⚠️  Job: testing (skipped - no changes)

❌ Workflow: job.changes.yml
  ❌ Job: changes (failed - missing env var)
  📝 Error: GITHUB_TOKEN not set
```

### Performance Metrics
- **Execution Time**: Track workflow execution time
- **Resource Usage**: Monitor CPU and memory usage
- **Job Dependencies**: Validate dependency chains
- **Error Rates**: Track failure rates and patterns
- **API Usage**: Monitor GitHub API usage

## 🔄 Continuous Integration

### GitHub Actions Integration
```yaml
name: Live Tests
on: [push, pull_request]
jobs:
  live-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Live Tests
        run: ./tests/github-live/run-live-tests.sh
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Local Development
```bash
# Watch mode for development
./tests/github-live/run-live-tests.sh --watch

# Run specific test suite
./tests/github-live/run-live-tests.sh --suite pipeline

# Run with coverage
./tests/github-live/run-live-tests.sh --coverage
```

## 📚 Best Practices

### Test Organization
1. **Group related tests**: Organize tests by workflow type
2. **Use fixtures**: Create reusable test data
3. **Mock external services**: Avoid external dependencies where possible
4. **Test edge cases**: Include error scenarios and edge cases

### Performance
1. **Parallel execution**: Run independent tests in parallel
2. **Resource management**: Monitor GitHub Actions resource usage
3. **Cleanup**: Clean up test artifacts after runs
4. **Rate limiting**: Respect GitHub API rate limits

### Maintenance
1. **Regular updates**: Keep test dependencies updated
2. **Documentation**: Document test scenarios and expected outcomes
3. **Monitoring**: Track test performance and reliability
4. **Feedback**: Collect feedback from test results

## 🆘 Troubleshooting

### Common Problems
```bash
# GitHub token issues
gh auth status

# Workflow syntax errors
gh workflow view pipeline.yml

# Environment variable issues
gh workflow run pipeline.yml --env GITHUB_REF=refs/heads/main

# Rate limit issues
gh api rate_limit
```

### Getting Help
- [GitHub CLI Documentation](https://cli.github.com/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [Project Issues](https://github.com/your-org/flowcraft/issues)
