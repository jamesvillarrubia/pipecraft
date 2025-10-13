#!/usr/bin/env node

/**
 * Pipeline Validation Script
 *
 * Validates GitHub Actions workflows and composite actions to catch common errors:
 * - Missing git config in actions that perform git operations
 * - Secrets usage in composite actions (should use inputs)
 * - Local actions used without checkout
 * - Missing token inputs for actions that need authentication
 * - Version format issues
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function error(message) {
  log(`❌ ${message}`, colors.red);
}

function warning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function success(message) {
  log(`✅ ${message}`, colors.green);
}

function info(message) {
  log(`ℹ️  ${message}`, colors.cyan);
}

/**
 * Validate that git operations have git config set
 */
function validateGitConfig(actionPath) {
  const content = fs.readFileSync(actionPath, 'utf8');
  // Only check for write operations that require git config
  // Exclude read-only operations like 'git tag --points-at'
  const gitWriteOps = [
    /git commit(?!\s+--points-at)/,
    /git tag(?!\s+(--points-at|--list))/,
    /git push/,
    /git merge/
  ];

  const hasGitWriteOps = gitWriteOps.some(op => op.test(content));
  const hasGitConfig = content.includes('git config user.name') ||
                       content.includes('git config --global user.name');

  if (hasGitWriteOps && !hasGitConfig) {
    return `Git operations without git config (user.name/email)`;
  }
  return null;
}

/**
 * Validate that composite actions don't access secrets directly
 */
function validateTokenUsage(actionPath) {
  const content = fs.readFileSync(actionPath, 'utf8');

  try {
    const action = yaml.parse(content);

    // Check if composite action tries to use secrets
    if (action.runs?.using === 'composite' && content.includes('secrets.')) {
      return `Composite action accessing secrets directly (use inputs instead)`;
    }

    // Check if action uses gh/hub CLI without token input
    if (content.includes('gh ') || content.includes('hub ') || content.includes('GITHUB_TOKEN')) {
      const hasTokenInput = action.inputs?.token !== undefined;
      if (!hasTokenInput && content.includes('secrets.GITHUB_TOKEN')) {
        return `Uses GITHUB_TOKEN via secrets instead of input parameter`;
      }
    }
  } catch (err) {
    return `Failed to parse YAML: ${err.message}`;
  }

  return null;
}

/**
 * Validate version format handling
 */
function validateVersionFormat(actionPath) {
  const content = fs.readFileSync(actionPath, 'utf8');

  // Check if action uses version input
  if (content.includes('${{ inputs.version }}') || content.includes('${VERSION}')) {
    // Check if it handles both v-prefixed and non-prefixed versions
    const hasStripPrefix = content.includes('VERSION="${VERSION#v}"') ||
                          content.includes('strip v prefix') ||
                          content.includes('VERSION#v');

    // Only warn if it looks like it's validating version format without stripping
    const hasVersionValidation = content.includes('=~ ^[0-9]+') ||
                                content.includes('version format');

    if (hasVersionValidation && !hasStripPrefix) {
      return `Validates version format but doesn't strip 'v' prefix (may reject v1.0.0)`;
    }
  }

  return null;
}

/**
 * Validate error handling in scripts
 */
function validateErrorHandling(actionPath) {
  const content = fs.readFileSync(actionPath, 'utf8');
  const warnings = [];

  // Check for suppressed error output (2>/dev/null) with critical commands
  const criticalCommands = ['gh pr create', 'gh pr merge', 'gh release create', 'git push', 'git tag'];

  for (const cmd of criticalCommands) {
    // Match command followed by 2>/dev/null
    const regex = new RegExp(`${cmd.replace(/\s+/g, '\\s+')}[^\\n]*2>/dev/null`, 'g');
    if (regex.test(content)) {
      warnings.push(`Suppresses errors for '${cmd}' (2>/dev/null hides useful error messages)`);
    }
  }

  return warnings.length > 0 ? warnings.join('; ') : null;
}

/**
 * Validate GitHub CLI usage has GH_TOKEN set
 */
function validateGhToken(actionPath) {
  const content = fs.readFileSync(actionPath, 'utf8');

  // Check if action uses gh CLI commands
  const ghCommands = ['gh pr', 'gh release', 'gh issue', 'gh workflow'];
  const usesGhCli = ghCommands.some(cmd => content.includes(cmd));

  if (!usesGhCli) {
    return null;
  }

  // Parse YAML to check for env: GH_TOKEN in steps that use gh
  try {
    const doc = yaml.parse(content);
    if (!doc.runs || !doc.runs.steps) {
      return null;
    }

    for (const step of doc.runs.steps) {
      if (step.run) {
        const hasGhCommand = ghCommands.some(cmd => step.run.includes(cmd));
        const hasGhToken = step.env && (step.env.GH_TOKEN || step.env.GITHUB_TOKEN);

        if (hasGhCommand && !hasGhToken) {
          const stepName = step.name || 'unnamed step';
          return `Uses 'gh' CLI without GH_TOKEN env var in step '${stepName}'`;
        }
      }
    }
  } catch (e) {
    // If YAML parsing fails, fall back to simple string check
    if (usesGhCli && !content.includes('GH_TOKEN:') && !content.includes('GITHUB_TOKEN:')) {
      return `Uses 'gh' CLI but no GH_TOKEN environment variable found`;
    }
  }

  return null;
}

/**
 * Validate workflow jobs
 */
function validateWorkflow(workflowPath) {
  const errors = [];
  const warnings = [];

  try {
    const content = fs.readFileSync(workflowPath, 'utf8');
    const workflow = yaml.parse(content);

    // Check for local actions without checkout
    for (const [jobName, job] of Object.entries(workflow.jobs || {})) {
      const steps = job.steps || [];
      let hasCheckout = false;

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];

        if (step.uses === 'actions/checkout@v4' || step.uses?.startsWith('actions/checkout@')) {
          hasCheckout = true;
        }

        // Check for local action usage
        if (step.uses && step.uses.startsWith('./')) {
          if (!hasCheckout) {
            // Check if the action itself has a checkout step
            const actionPath = path.join('.github', 'actions', path.basename(step.uses), 'action.yml');
            let actionHasCheckout = false;

            try {
              if (fs.existsSync(actionPath)) {
                const actionContent = fs.readFileSync(actionPath, 'utf8');
                actionHasCheckout = actionContent.includes('actions/checkout');
              }
            } catch (e) {
              // Ignore errors reading action file
            }

            if (!actionHasCheckout) {
              errors.push(`Job '${jobName}' step ${i + 1}: Local action '${step.uses}' used before checkout`);
            }
          }
        }
      }
    }

    // Check for pnpm cache before pnpm install
    for (const [jobName, job] of Object.entries(workflow.jobs || {})) {
      const steps = job.steps || [];
      let setupNodeWithPnpmCache = false;
      let pnpmInstalled = false;

      for (const step of steps) {
        if (step.uses?.includes('actions/setup-node') && step.with?.cache === 'pnpm') {
          setupNodeWithPnpmCache = true;
          if (!pnpmInstalled) {
            warnings.push(`Job '${jobName}': setup-node with pnpm cache before pnpm is installed`);
          }
        }

        if (step.uses?.includes('pnpm/action-setup')) {
          pnpmInstalled = true;
        }
      }
    }

  } catch (err) {
    errors.push(`Failed to parse workflow: ${err.message}`);
  }

  return { errors, warnings };
}

/**
 * Validate composite action
 */
function validateCompositeAction(actionPath) {
  const errors = [];
  const warnings = [];
  const fileName = path.basename(path.dirname(actionPath));

  // Git config validation
  const gitConfigError = validateGitConfig(actionPath);
  if (gitConfigError) {
    errors.push(`${fileName}: ${gitConfigError}`);
  }

  // Token usage validation
  const tokenError = validateTokenUsage(actionPath);
  if (tokenError) {
    errors.push(`${fileName}: ${tokenError}`);
  }

  // Version format validation
  const versionWarning = validateVersionFormat(actionPath);
  if (versionWarning) {
    warnings.push(`${fileName}: ${versionWarning}`);
  }

  // Error handling validation
  const errorHandlingWarning = validateErrorHandling(actionPath);
  if (errorHandlingWarning) {
    warnings.push(`${fileName}: ${errorHandlingWarning}`);
  }

  // GH_TOKEN validation
  const ghTokenError = validateGhToken(actionPath);
  if (ghTokenError) {
    errors.push(`${fileName}: ${ghTokenError}`);
  }

  return { errors, warnings };
}

/**
 * Main validation function
 */
function main() {
  info('🔍 Validating FlowCraft Pipeline...\n');

  let allErrors = [];
  let allWarnings = [];

  // Validate workflows
  const workflowsDir = path.join(process.cwd(), '.github/workflows');
  if (fs.existsSync(workflowsDir)) {
    const workflowFiles = fs.readdirSync(workflowsDir)
      .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
      .map(f => path.join(workflowsDir, f));

    log(`📄 Validating ${workflowFiles.length} workflow(s)...`, colors.blue);

    for (const workflowPath of workflowFiles) {
      const fileName = path.basename(workflowPath);
      const { errors, warnings } = validateWorkflow(workflowPath);

      if (errors.length === 0 && warnings.length === 0) {
        success(`  ${fileName}`);
      } else {
        if (errors.length > 0) {
          error(`  ${fileName}`);
          errors.forEach(err => error(`    ${err}`));
        }
        if (warnings.length > 0) {
          warning(`  ${fileName}`);
          warnings.forEach(warn => warning(`    ${warn}`));
        }
      }

      allErrors = allErrors.concat(errors);
      allWarnings = allWarnings.concat(warnings);
    }
  }

  console.log();

  // Validate composite actions
  const actionsDir = path.join(process.cwd(), '.github/actions');
  if (fs.existsSync(actionsDir)) {
    const actionDirs = fs.readdirSync(actionsDir)
      .map(dir => path.join(actionsDir, dir, 'action.yml'))
      .filter(p => fs.existsSync(p));

    log(`🎬 Validating ${actionDirs.length} action(s)...`, colors.blue);

    for (const actionPath of actionDirs) {
      const actionName = path.basename(path.dirname(actionPath));
      const { errors, warnings } = validateCompositeAction(actionPath);

      if (errors.length === 0 && warnings.length === 0) {
        success(`  ${actionName}`);
      } else {
        if (errors.length > 0) {
          error(`  ${actionName}`);
          errors.forEach(err => error(`    ${err}`));
        }
        if (warnings.length > 0) {
          warning(`  ${actionName}`);
          warnings.forEach(warn => warning(`    ${warn}`));
        }
      }

      allErrors = allErrors.concat(errors);
      allWarnings = allWarnings.concat(warnings);
    }
  }

  console.log();

  // Summary
  if (allErrors.length === 0 && allWarnings.length === 0) {
    success('✨ Pipeline validation passed! No issues found.');
    return 0;
  }

  if (allErrors.length > 0) {
    error(`\n❌ Found ${allErrors.length} error(s)`);
    return 1;
  }

  if (allWarnings.length > 0) {
    warning(`\n⚠️  Found ${allWarnings.length} warning(s)`);
    warning('Warnings do not fail validation but should be reviewed.');
    return 0;
  }

  return 0;
}

// Run validation
const exitCode = main();
process.exit(exitCode);
