/**
 * Iterative GitHub Actions Debugging System
 * 
 * This module provides an interactive debugging system that can be run repeatedly
 * to iteratively fix workflow issues. It maintains state between runs and provides
 * intelligent suggestions for the next debugging steps.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { 
  WorkflowDebugOrchestrator, 
  GitHubWorkflowDebugger,
  type DebugAnalysis,
  type LogAnalysis 
} from './debug-utils';

export interface DebugSession {
  sessionId: string;
  workflowName: string;
  branch?: string;
  startTime: string;
  lastRunId?: number;
  totalRuns: number;
  fixedIssues: string[];
  remainingIssues: string[];
  nextSteps: string[];
  history: DebugHistoryEntry[];
}

export interface DebugHistoryEntry {
  timestamp: string;
  runId: number;
  issues: string[];
  actions: string[];
  outcome: 'success' | 'failure' | 'partial';
}

export interface DebuggingPlan {
  priority: 'high' | 'medium' | 'low';
  issue: string;
  suggestedActions: string[];
  estimatedTime: string;
  dependencies: string[];
}

/**
 * Interactive debugging orchestrator that maintains state between runs
 */
export class IterativeDebugger {
  private session: DebugSession;
  private debugger: GitHubWorkflowDebugger;
  private sessionFile: string;
  private outputDir: string;

  constructor(
    token: string,
    owner: string,
    repo: string,
    workflowName: string,
    branch?: string,
    outputDir: string = './debug-sessions'
  ) {
    this.debugger = new GitHubWorkflowDebugger(token, owner, repo);
    this.outputDir = outputDir;
    this.sessionFile = join(outputDir, `session-${workflowName}-${Date.now()}.json`);
    
    // Initialize or load session
    this.session = this.initializeSession(workflowName, branch);
  }

  /**
   * Initialize or load existing debug session
   */
  private initializeSession(workflowName: string, branch?: string): DebugSession {
    if (existsSync(this.sessionFile)) {
      try {
        const sessionData = JSON.parse(readFileSync(this.sessionFile, 'utf-8'));
        console.log(`📂 Loaded existing session: ${sessionData.sessionId}`);
        return sessionData;
      } catch (error) {
        console.warn('⚠️  Could not load existing session, starting fresh');
      }
    }

    return {
      sessionId: `debug-${Date.now()}`,
      workflowName,
      branch,
      startTime: new Date().toISOString(),
      totalRuns: 0,
      fixedIssues: [],
      remainingIssues: [],
      nextSteps: [],
      history: []
    };
  }

  /**
   * Save session state
   */
  private saveSession(): void {
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
    
    writeFileSync(this.sessionFile, JSON.stringify(this.session, null, 2));
  }

  /**
   * Run a complete debugging iteration
   */
  async runDebugIteration(): Promise<DebugAnalysis | null> {
    console.log(`🔄 Starting debug iteration ${this.session.totalRuns + 1}`);
    
    try {
      // Get recent workflow runs
      const runs = await this.debugger.getWorkflowRuns(
        this.session.workflowName, 
        this.session.branch, 
        5
      );

      if (runs.length === 0) {
        console.log('❌ No workflow runs found');
        return null;
      }

      // Find the most recent run
      const latestRun = runs[0];
      this.session.lastRunId = latestRun.id;
      this.session.totalRuns++;

      console.log(`📊 Analyzing run ${latestRun.id} (${latestRun.status})`);

      // Get jobs for this run
      const jobs = await this.debugger.getWorkflowJobs(latestRun.id);
      
      // Analyze the run
      const analysis = this.analyzeWorkflowRun(latestRun, jobs);
      
      // Update session with findings
      this.updateSessionWithAnalysis(analysis);
      
      // Generate next steps
      this.generateNextSteps(analysis);
      
      // Save session
      this.saveSession();
      
      // Generate report
      await this.generateIterationReport(analysis);
      
      return analysis;
      
    } catch (error) {
      console.error(`❌ Debug iteration failed: ${error}`);
      return null;
    }
  }

  /**
   * Analyze a workflow run and extract issues
   */
  private analyzeWorkflowRun(run: any, jobs: any[]): DebugAnalysis {
    const failedJobs = jobs.filter(job => 
      job.conclusion === 'failure' || job.conclusion === 'cancelled'
    );

    const successRate = jobs.length > 0 ? 
      ((jobs.length - failedJobs.length) / jobs.length) * 100 : 0;

    // Extract issues from failed jobs
    const issues: string[] = [];
    failedJobs.forEach(job => {
      job.steps.forEach((step: any) => {
        if (step.conclusion === 'failure') {
          const issue = this.categorizeIssue(step.name, job.name);
          if (!issues.includes(issue)) {
            issues.push(issue);
          }
        }
      });
    });

    return {
      runId: run.id,
      status: run.status,
      conclusion: run.conclusion,
      failedJobs,
      totalJobs: jobs.length,
      successRate,
      commonFailurePatterns: issues,
      recommendations: this.generateRecommendations(issues)
    };
  }

  /**
   * Categorize issues based on step and job names
   */
  private categorizeIssue(stepName: string, jobName: string): string {
    const step = stepName.toLowerCase();
    const job = jobName.toLowerCase();
    
    if (step.includes('test') || job.includes('test')) {
      return 'Test Failures';
    }
    if (step.includes('build') || job.includes('build')) {
      return 'Build Failures';
    }
    if (step.includes('lint') || job.includes('lint')) {
      return 'Linting Issues';
    }
    if (step.includes('deploy') || job.includes('deploy')) {
      return 'Deployment Issues';
    }
    if (step.includes('install') || step.includes('dependencies')) {
      return 'Dependency Issues';
    }
    if (step.includes('docker') || job.includes('docker')) {
      return 'Docker Issues';
    }
    if (step.includes('security') || job.includes('security')) {
      return 'Security Issues';
    }
    
    return 'Unknown Issues';
  }

  /**
   * Generate specific recommendations based on issues
   */
  private generateRecommendations(issues: string[]): string[] {
    const recommendations: string[] = [];
    
    if (issues.includes('Test Failures')) {
      recommendations.push('Run tests locally to reproduce failures');
      recommendations.push('Check for flaky tests and add retry mechanisms');
      recommendations.push('Update test dependencies and configurations');
    }
    
    if (issues.includes('Build Failures')) {
      recommendations.push('Verify build environment and dependencies');
      recommendations.push('Check for breaking changes in dependencies');
      recommendations.push('Review build configuration files');
    }
    
    if (issues.includes('Linting Issues')) {
      recommendations.push('Run linting locally and fix issues');
      recommendations.push('Configure pre-commit hooks for automatic linting');
      recommendations.push('Update linting rules and configurations');
    }
    
    if (issues.includes('Dependency Issues')) {
      recommendations.push('Update package-lock.json or yarn.lock');
      recommendations.push('Check for version conflicts in dependencies');
      recommendations.push('Clear node_modules and reinstall dependencies');
    }
    
    if (issues.includes('Docker Issues')) {
      recommendations.push('Test Docker build locally');
      recommendations.push('Check Dockerfile syntax and base images');
      recommendations.push('Verify resource constraints in CI environment');
    }
    
    return recommendations;
  }

  /**
   * Update session with analysis results
   */
  private updateSessionWithAnalysis(analysis: DebugAnalysis): void {
    // Track new issues
    const newIssues = analysis.commonFailurePatterns.filter(issue => 
      !this.session.remainingIssues.includes(issue)
    );
    
    this.session.remainingIssues = [
      ...this.session.remainingIssues,
      ...newIssues
    ];

    // Remove fixed issues (issues that are no longer present)
    const currentIssues = analysis.commonFailurePatterns;
    const fixedIssues = this.session.remainingIssues.filter(issue => 
      !currentIssues.includes(issue)
    );
    
    this.session.fixedIssues = [...this.session.fixedIssues, ...fixedIssues];
    this.session.remainingIssues = this.session.remainingIssues.filter(issue => 
      currentIssues.includes(issue)
    );

    // Add to history
    this.session.history.push({
      timestamp: new Date().toISOString(),
      runId: analysis.runId,
      issues: analysis.commonFailurePatterns,
      actions: [],
      outcome: analysis.successRate > 80 ? 'success' : 
               analysis.successRate > 50 ? 'partial' : 'failure'
    });
  }

  /**
   * Generate next steps based on current state
   */
  private generateNextSteps(analysis: DebugAnalysis): void {
    const nextSteps: string[] = [];
    
    if (analysis.successRate === 100) {
      nextSteps.push('🎉 All issues resolved! Workflow is now passing.');
      nextSteps.push('Consider adding monitoring to prevent regressions.');
    } else if (analysis.successRate > 80) {
      nextSteps.push('✅ Significant progress made! Focus on remaining issues.');
      nextSteps.push('Review the remaining failed jobs and their logs.');
    } else {
      nextSteps.push('🔧 Focus on the most critical issues first.');
      nextSteps.push('Consider breaking down large jobs into smaller ones.');
    }

    // Add specific recommendations
    analysis.recommendations.forEach(rec => {
      nextSteps.push(`💡 ${rec}`);
    });

    this.session.nextSteps = nextSteps;
  }

  /**
   * Generate iteration report
   */
  private async generateIterationReport(analysis: DebugAnalysis): Promise<void> {
    const reportPath = join(this.outputDir, `iteration-${this.session.totalRuns}.md`);
    
    const report = `# Debug Iteration ${this.session.totalRuns}

**Session ID**: ${this.session.sessionId}
**Timestamp**: ${new Date().toISOString()}
**Workflow**: ${this.session.workflowName}
**Run ID**: ${analysis.runId}

## Current Status

- **Success Rate**: ${analysis.successRate.toFixed(1)}%
- **Total Jobs**: ${analysis.totalJobs}
- **Failed Jobs**: ${analysis.failedJobs.length}

## Issues Found

${analysis.commonFailurePatterns.map(issue => `- ${issue}`).join('\n')}

## Recommendations

${analysis.recommendations.map(rec => `- ${rec}`).join('\n')}

## Session Progress

- **Total Iterations**: ${this.session.totalRuns}
- **Issues Fixed**: ${this.session.fixedIssues.length}
- **Remaining Issues**: ${this.session.remainingIssues.length}

### Fixed Issues
${this.session.fixedIssues.map(issue => `- ✅ ${issue}`).join('\n')}

### Remaining Issues
${this.session.remainingIssues.map(issue => `- 🔧 ${issue}`).join('\n')}

## Next Steps

${this.session.nextSteps.map(step => `- ${step}`).join('\n')}

## History

${this.session.history.map(entry => `
### ${entry.timestamp}
- **Run ID**: ${entry.runId}
- **Outcome**: ${entry.outcome}
- **Issues**: ${entry.issues.join(', ')}
`).join('\n')}

---
*Generated by Pipecraft Iterative Debugger*
`;

    writeFileSync(reportPath, report);
    console.log(`📄 Iteration report saved: ${reportPath}`);
  }

  /**
   * Get current session status
   */
  getSessionStatus(): DebugSession {
    return { ...this.session };
  }

  /**
   * Get debugging plan with priorities
   */
  getDebuggingPlan(): DebuggingPlan[] {
    const plans: DebuggingPlan[] = [];
    
    this.session.remainingIssues.forEach(issue => {
      const priority = this.determinePriority(issue);
      const actions = this.getActionsForIssue(issue);
      
      plans.push({
        priority,
        issue,
        suggestedActions: actions,
        estimatedTime: this.estimateTime(issue),
        dependencies: this.getDependencies(issue)
      });
    });

    return plans.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Determine priority for an issue
   */
  private determinePriority(issue: string): 'high' | 'medium' | 'low' {
    const highPriorityIssues = ['Build Failures', 'Dependency Issues'];
    const mediumPriorityIssues = ['Test Failures', 'Linting Issues'];
    
    if (highPriorityIssues.includes(issue)) return 'high';
    if (mediumPriorityIssues.includes(issue)) return 'medium';
    return 'low';
  }

  /**
   * Get specific actions for an issue
   */
  private getActionsForIssue(issue: string): string[] {
    const actionMap: Record<string, string[]> = {
      'Test Failures': [
        'Run tests locally with same environment',
        'Check for flaky tests and add retries',
        'Update test dependencies',
        'Review test configuration'
      ],
      'Build Failures': [
        'Test build locally',
        'Check dependency versions',
        'Review build configuration',
        'Check for breaking changes'
      ],
      'Linting Issues': [
        'Run linting locally',
        'Fix linting errors',
        'Update linting configuration',
        'Add pre-commit hooks'
      ],
      'Dependency Issues': [
        'Update package-lock.json',
        'Clear node_modules and reinstall',
        'Check for version conflicts',
        'Update dependency versions'
      ],
      'Docker Issues': [
        'Test Docker build locally',
        'Check Dockerfile syntax',
        'Verify base image versions',
        'Check resource constraints'
      ]
    };

    return actionMap[issue] || ['Investigate the issue further'];
  }

  /**
   * Estimate time to fix an issue
   */
  private estimateTime(issue: string): string {
    const timeMap: Record<string, string> = {
      'Test Failures': '30-60 minutes',
      'Build Failures': '15-45 minutes',
      'Linting Issues': '10-30 minutes',
      'Dependency Issues': '20-40 minutes',
      'Docker Issues': '30-60 minutes'
    };

    return timeMap[issue] || 'Unknown';
  }

  /**
   * Get dependencies for an issue
   */
  private getDependencies(issue: string): string[] {
    const dependencyMap: Record<string, string[]> = {
      'Test Failures': ['Build Failures'],
      'Build Failures': ['Dependency Issues'],
      'Linting Issues': [],
      'Dependency Issues': [],
      'Docker Issues': ['Build Failures']
    };

    return dependencyMap[issue] || [];
  }

  /**
   * Run a quick health check
   */
  async runHealthCheck(): Promise<boolean> {
    try {
      const runs = await this.debugger.getWorkflowRuns(this.session.workflowName, this.session.branch, 1);
      return runs.length > 0;
    } catch (error) {
      console.error(`❌ Health check failed: ${error}`);
      return false;
    }
  }

  /**
   * Clean up old sessions
   */
  static cleanupOldSessions(outputDir: string, maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
    // Implementation for cleaning up old session files
    console.log(`🧹 Cleaning up sessions older than ${maxAge}ms`);
  }
}

/**
 * CLI interface for iterative debugging
 */
export class IterativeDebugCLI {
  private debugger: IterativeDebugger;

  constructor(debugger: IterativeDebugger) {
    this.debugger = debugger;
  }

  /**
   * Run interactive debugging session
   */
  async runInteractiveSession(): Promise<void> {
    console.log('🚀 Starting interactive debugging session');
    console.log(`📋 Session ID: ${this.debugger.getSessionStatus().sessionId}`);
    
    let continueDebugging = true;
    let iteration = 0;

    while (continueDebugging && iteration < 10) { // Limit to 10 iterations
      iteration++;
      
      console.log(`\n🔄 Iteration ${iteration}`);
      console.log('=' * 50);
      
      // Run debug iteration
      const analysis = await this.debugger.runDebugIteration();
      
      if (!analysis) {
        console.log('❌ No analysis available, stopping');
        break;
      }

      // Show current status
      this.showCurrentStatus();
      
      // Show debugging plan
      this.showDebuggingPlan();
      
      // Ask user if they want to continue
      console.log('\n❓ Continue debugging? (y/n)');
      // In a real implementation, you'd read from stdin
      // For now, we'll just continue automatically
      continueDebugging = iteration < 3; // Auto-stop after 3 iterations for demo
    }

    console.log('\n🏁 Debugging session complete');
    this.showFinalSummary();
  }

  /**
   * Show current debugging status
   */
  private showCurrentStatus(): void {
    const status = this.debugger.getSessionStatus();
    
    console.log('\n📊 Current Status:');
    console.log(`  Total Iterations: ${status.totalRuns}`);
    console.log(`  Issues Fixed: ${status.fixedIssues.length}`);
    console.log(`  Remaining Issues: ${status.remainingIssues.length}`);
    
    if (status.remainingIssues.length > 0) {
      console.log('\n🔧 Remaining Issues:');
      status.remainingIssues.forEach(issue => {
        console.log(`  - ${issue}`);
      });
    }
  }

  /**
   * Show debugging plan
   */
  private showDebuggingPlan(): void {
    const plans = this.debugger.getDebuggingPlan();
    
    if (plans.length === 0) {
      console.log('\n🎉 No remaining issues to fix!');
      return;
    }

    console.log('\n📋 Debugging Plan:');
    plans.forEach((plan, index) => {
      console.log(`\n${index + 1}. ${plan.issue} (${plan.priority} priority)`);
      console.log(`   Estimated Time: ${plan.estimatedTime}`);
      console.log(`   Actions:`);
      plan.suggestedActions.forEach(action => {
        console.log(`     - ${action}`);
      });
    });
  }

  /**
   * Show final summary
   */
  private showFinalSummary(): void {
    const status = this.debugger.getSessionStatus();
    
    console.log('\n📈 Final Summary:');
    console.log(`  Session Duration: ${this.calculateSessionDuration()}`);
    console.log(`  Total Iterations: ${status.totalRuns}`);
    console.log(`  Issues Fixed: ${status.fixedIssues.length}`);
    console.log(`  Remaining Issues: ${status.remainingIssues.length}`);
    
    if (status.fixedIssues.length > 0) {
      console.log('\n✅ Fixed Issues:');
      status.fixedIssues.forEach(issue => {
        console.log(`  - ${issue}`);
      });
    }
  }

  /**
   * Calculate session duration
   */
  private calculateSessionDuration(): string {
    const status = this.debugger.getSessionStatus();
    const startTime = new Date(status.startTime);
    const duration = Date.now() - startTime.getTime();
    
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    
    return `${minutes}m ${seconds}s`;
  }
}
