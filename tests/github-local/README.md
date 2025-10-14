# GitHub Actions Local Testing

This directory contains tests for running GitHub Actions workflows locally using [Act](https://github.com/nektos/act).

## 🎯 Purpose

Local GitHub Actions testing allows us to:
- Test workflows locally without pushing to GitHub
- Debug workflow issues in a controlled environment
- Validate workflow syntax and logic before deployment
- Test different scenarios and edge cases quickly
- Iterate on workflow changes without GitHub API limits

## 📁 Structure

```
tests/github-local/
├── README.md                 # This file
├── run-local-tests.sh        # Main test runner script
├── setup-test-env.sh         # Environment setup script
├── test-workflows.sh         # Individual workflow testing
├── fixtures/                  # Test data and configurations
│   ├── test-configs/         # Test configurations
│   ├── mock-data/            # Mock data for workflows
│   └── expected-outputs/     # Expected test outputs
└── helpers/                  # Test helper scripts
    ├── act-runner.sh         # Act execution helper
    └── workflow-validator.sh  # Workflow validation helper
```

## 🚀 Quick Start

### Prerequisites
```bash
# Install Act
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Or via package manager
brew install act  # macOS
choco install act # Windows
```

### Running Tests
```bash
# Run all local tests
./tests/github-local/run-local-tests.sh

# Test specific workflow
./tests/github-local/test-workflows.sh --workflow pipeline.yml

# Run with verbose output
./tests/github-local/run-local-tests.sh --verbose

# Run with debug mode
./tests/github-local/run-local-tests.sh --debug
```

## 🔧 Configuration

### Act Configuration
Create `.actrc` file in project root:
```yaml
# Act configuration
-P ubuntu-latest=catthehacker/ubuntu:act-latest
-P ubuntu-20.04=catthehacker/ubuntu:act-20.04
-P ubuntu-18.04=catthehacker/ubuntu:act-18.04
```

### Test Environment
```bash
# Set up test environment
./tests/github-local/setup-test-env.sh

# This creates:
# - Test configuration files
# - Mock GitHub environment
# - Test data and fixtures
# - Expected output files
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

## 🧪 Test Examples

### Basic Workflow Test
```bash
# Test main pipeline
act -W .github/workflows/pipeline.yml --dry-run

# Test with specific event
act push -W .github/workflows/pipeline.yml --dry-run

# Test with environment variables
act -W .github/workflows/pipeline.yml --env GITHUB_REF=refs/heads/main --dry-run
```

### Advanced Testing
```bash
# Test with secrets
act -W .github/workflows/pipeline.yml --secret GITHUB_TOKEN=your_token

# Test with artifacts
act -W .github/workflows/pipeline.yml --artifact-server-path /tmp/artifacts

# Test with matrix strategy
act -W .github/workflows/pipeline.yml --matrix os:ubuntu-latest --matrix node:18
```

## 🔍 Debugging

### Common Issues
1. **Docker not running**: Ensure Docker is running
2. **Permission issues**: Check file permissions
3. **Environment variables**: Verify all required env vars are set
4. **Workflow syntax**: Check YAML syntax and GitHub Actions syntax

### Debug Commands
```bash
# List available workflows
act --list

# Show workflow details
act -W .github/workflows/pipeline.yml --list

# Run with verbose output
act -W .github/workflows/pipeline.yml --verbose

# Run with debug output
act -W .github/workflows/pipeline.yml --debug
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

## 🔄 Continuous Integration

### GitHub Actions Integration
```yaml
name: Local Act Tests
on: [push, pull_request]
jobs:
  local-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Act
        run: curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
      - name: Run Local Tests
        run: ./tests/github-local/run-local-tests.sh
```

### Local Development
```bash
# Watch mode for development
./tests/github-local/run-local-tests.sh --watch

# Run specific test suite
./tests/github-local/run-local-tests.sh --suite pipeline

# Run with coverage
./tests/github-local/run-local-tests.sh --coverage
```

## 📚 Best Practices

### Test Organization
1. **Group related tests**: Organize tests by workflow type
2. **Use fixtures**: Create reusable test data
3. **Mock external services**: Avoid external dependencies
4. **Test edge cases**: Include error scenarios and edge cases

### Performance
1. **Parallel execution**: Run independent tests in parallel
2. **Resource management**: Monitor Docker resource usage
3. **Cleanup**: Clean up test artifacts after runs
4. **Caching**: Use Docker layer caching for faster builds

### Maintenance
1. **Regular updates**: Keep Act and test dependencies updated
2. **Documentation**: Document test scenarios and expected outcomes
3. **Monitoring**: Track test performance and reliability
4. **Feedback**: Collect feedback from test results

## 🆘 Troubleshooting

### Common Problems
```bash
# Act not found
export PATH=$PATH:/usr/local/bin

# Docker permission denied
sudo usermod -aG docker $USER

# Workflow syntax errors
act -W .github/workflows/pipeline.yml --dry-run --verbose

# Environment variable issues
act -W .github/workflows/pipeline.yml --env-file .env
```

### Getting Help
- [Act Documentation](https://github.com/nektos/act)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Documentation](https://docs.docker.com/)
- [Project Issues](https://github.com/your-org/pipecraft/issues)
