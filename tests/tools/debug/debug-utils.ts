/**
 * GitHub Actions Debugging Utilities
 * 
 * This module provides TypeScript utilities for analyzing GitHub Actions
 * workflow failures, parsing logs, and generating debugging reports.
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export interface WorkflowRun {
  id: number;
  status: string;
  conclusion: string | null;
  created_at: string;
  html_url: string;
  workflow_id: number;
  head_branch: string;
  head_sha: string;
}

export interface Job {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  steps: JobStep[];
  started_at: string;
  completed_at: string | null;
}

export interface JobStep {
  name: string;
  status: string;
  conclusion: string | null;
  number: number;
  started_at: string;
  completed_at: string | null;
}

export interface DebugAnalysis {
  runId: number;
  status: string;
  conclusion: string | null;
  failedJobs: Job[];
  totalJobs: number;
  successRate: number;
  commonFailurePatterns: string[];
  recommendations: string[];
}

export interface LogAnalysis {
  jobId: number;
  jobName: string;
  errorCount: number;
  warningCount: number;
  criticalErrors: string[];
  commonErrors: string[];
  executionTime: number;
}

/**
 * GitHub API client for fetching workflow data
 */
export class GitHubWorkflowDebugger {
  private token: string;
  private owner: string;
  private repo: string;
  private apiBase = 'https://api.github.com';

  constructor(token: string, owner: string, repo: string) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
  }

  /**
   * Make authenticated GitHub API request
   */
  private async apiRequest(endpoint: string, method: string = 'GET'): Promise<any> {
    const url = `${this.apiBase}/repos/${this.owner}/${this.repo}${endpoint}`;
    
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'pipecraft-debugger'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get recent workflow runs
   */
  async getWorkflowRuns(workflowName: string, branch?: string, limit: number = 10): Promise<WorkflowRun[]> {
    const endpoint = `/actions/workflows/${workflowName}/runs?per_page=${limit}${branch ? `&branch=${branch}` : ''}`;
    const response = await this.apiRequest(endpoint);
    return response.workflow_runs;
  }

  /**
   * Get detailed workflow run information
   */
  async getWorkflowRun(runId: number): Promise<WorkflowRun> {
    return this.apiRequest(`/actions/runs/${runId}`);
  }

  /**
   * Get jobs for a workflow run
   */
  async getWorkflowJobs(runId: number): Promise<Job[]> {
    const response = await this.apiRequest(`/actions/runs/${runId}/jobs`);
    return response.jobs;
  }

  /**
   * Download job logs
   */
  async getJobLogs(runId: number, jobId: number): Promise<string> {
    const url = `${this.apiBase}/repos/${this.owner}/${this.repo}/actions/runs/${runId}/jobs/${jobId}/logs`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'pipecraft-debugger'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to download logs: ${response.status} ${response.statusText}`);
    }

    return response.text();
  }
}

/**
 * Analyze workflow failures and generate insights
 */
export class WorkflowAnalyzer {
  /**
   * Analyze a workflow run for failures
   */
  static analyzeWorkflowRun(run: WorkflowRun, jobs: Job[]): DebugAnalysis {
    const failedJobs = jobs.filter(job => 
      job.conclusion === 'failure' || job.conclusion === 'cancelled'
    );

    const successRate = jobs.length > 0 ? 
      ((jobs.length - failedJobs.length) / jobs.length) * 100 : 0;

    const commonFailurePatterns = this.extractFailurePatterns(failedJobs);
    const recommendations = this.generateRecommendations(failedJobs, commonFailurePatterns);

    return {
      runId: run.id,
      status: run.status,
      conclusion: run.conclusion,
      failedJobs,
      totalJobs: jobs.length,
      successRate,
      commonFailurePatterns,
      recommendations
    };
  }

  /**
   * Extract common failure patterns from failed jobs
   */
  private static extractFailurePatterns(failedJobs: Job[]): string[] {
    const patterns: string[] = [];
    const stepFailures = new Map<string, number>();

    failedJobs.forEach(job => {
      job.steps.forEach(step => {
        if (step.conclusion === 'failure') {
          const pattern = this.categorizeFailure(step.name);
          stepFailures.set(pattern, (stepFailures.get(pattern) || 0) + 1);
        }
      });
    });

    // Sort by frequency and return top patterns
    return Array.from(stepFailures.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern]) => pattern);
  }

  /**
   * Categorize failure types based on step names
   */
  private static categorizeFailure(stepName: string): string {
    const name = stepName.toLowerCase();
    
    if (name.includes('test') || name.includes('spec')) return 'Test Failures';
    if (name.includes('build') || name.includes('compile')) return 'Build Failures';
    if (name.includes('lint') || name.includes('format')) return 'Linting Issues';
    if (name.includes('deploy') || name.includes('release')) return 'Deployment Issues';
    if (name.includes('install') || name.includes('dependencies')) return 'Dependency Issues';
    if (name.includes('docker') || name.includes('container')) return 'Docker Issues';
    if (name.includes('security') || name.includes('scan')) return 'Security Issues';
    
    return 'Other Failures';
  }

  /**
   * Generate recommendations based on failure analysis
   */
  private static generateRecommendations(failedJobs: Job[], patterns: string[]): string[] {
    const recommendations: string[] = [];

    if (patterns.includes('Test Failures')) {
      recommendations.push('Review test cases and ensure they are up to date');
      recommendations.push('Check for flaky tests and add retry mechanisms');
    }

    if (patterns.includes('Build Failures')) {
      recommendations.push('Verify build dependencies and versions');
      recommendations.push('Check for breaking changes in dependencies');
    }

    if (patterns.includes('Linting Issues')) {
      recommendations.push('Run linting locally before pushing');
      recommendations.push('Configure pre-commit hooks for automatic linting');
    }

    if (patterns.includes('Dependency Issues')) {
      recommendations.push('Update package-lock.json or yarn.lock');
      recommendations.push('Check for version conflicts in dependencies');
    }

    if (patterns.includes('Docker Issues')) {
      recommendations.push('Verify Dockerfile syntax and base images');
      recommendations.push('Check for resource constraints in CI environment');
    }

    if (failedJobs.length > 3) {
      recommendations.push('Consider breaking down large workflows into smaller, focused jobs');
    }

    return recommendations;
  }
}

/**
 * Analyze job logs for patterns and errors
 */
export class LogAnalyzer {
  /**
   * Analyze job logs for errors and patterns
   */
  static analyzeLogs(logs: string, jobName: string): LogAnalysis {
    const lines = logs.split('\n');
    const errorCount = lines.filter(line => 
      line.toLowerCase().includes('error') || 
      line.toLowerCase().includes('failed') ||
      line.toLowerCase().includes('exception')
    ).length;

    const warningCount = lines.filter(line => 
      line.toLowerCase().includes('warning') || 
      line.toLowerCase().includes('warn')
    ).length;

    const criticalErrors = this.extractCriticalErrors(lines);
    const commonErrors = this.extractCommonErrors(lines);
    const executionTime = this.calculateExecutionTime(lines);

    return {
      jobId: 0, // Will be set by caller
      jobName,
      errorCount,
      warningCount,
      criticalErrors,
      commonErrors,
      executionTime
    };
  }

  /**
   * Extract critical errors from logs
   */
  private static extractCriticalErrors(lines: string[]): string[] {
    const criticalPatterns = [
      /fatal error/i,
      /segmentation fault/i,
      /out of memory/i,
      /connection refused/i,
      /permission denied/i,
      /file not found/i,
      /timeout/i
    ];

    const errors: string[] = [];
    lines.forEach(line => {
      criticalPatterns.forEach(pattern => {
        if (pattern.test(line)) {
          errors.push(line.trim());
        }
      });
    });

    return [...new Set(errors)]; // Remove duplicates
  }

  /**
   * Extract common error patterns
   */
  private static extractCommonErrors(lines: string[]): string[] {
    const errorMap = new Map<string, number>();
    
    lines.forEach(line => {
      if (line.toLowerCase().includes('error')) {
        // Extract error type (first few words after "error")
        const match = line.match(/error[:\s]+([^:]+)/i);
        if (match) {
          const errorType = match[1].trim().split(' ').slice(0, 3).join(' ');
          errorMap.set(errorType, (errorMap.get(errorType) || 0) + 1);
        }
      }
    });

    return Array.from(errorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([error]) => error);
  }

  /**
   * Calculate execution time from logs
   */
  private static calculateExecutionTime(lines: string[]): number {
    const timePattern = /(\d+):(\d+):(\d+)/;
    const times: number[] = [];
    
    lines.forEach(line => {
      const match = line.match(timePattern);
      if (match) {
        const [, hours, minutes, seconds] = match;
        const totalSeconds = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
        times.push(totalSeconds);
      }
    });

    if (times.length < 2) return 0;
    
    const start = Math.min(...times);
    const end = Math.max(...times);
    return end - start;
  }
}

/**
 * Generate comprehensive debug reports
 */
export class DebugReportGenerator {
  /**
   * Generate a comprehensive debug report
   */
  static async generateReport(
    analysis: DebugAnalysis,
    logAnalyses: LogAnalysis[],
    outputDir: string
  ): Promise<string> {
    const reportPath = join(outputDir, 'debug-report.md');
    
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const report = this.buildMarkdownReport(analysis, logAnalyses);
    writeFileSync(reportPath, report);
    
    return reportPath;
  }

  /**
   * Build markdown report content
   */
  private static buildMarkdownReport(analysis: DebugAnalysis, logAnalyses: LogAnalysis[]): string {
    const timestamp = new Date().toISOString();
    
    return `# GitHub Actions Debug Report

Generated: ${timestamp}
Workflow Run: ${analysis.runId}
Status: ${analysis.status}
Conclusion: ${analysis.conclusion || 'N/A'}

## Summary

- **Total Jobs**: ${analysis.totalJobs}
- **Failed Jobs**: ${analysis.failedJobs.length}
- **Success Rate**: ${analysis.successRate.toFixed(1)}%

## Failed Jobs

${analysis.failedJobs.map(job => `
### ${job.name}
- **Status**: ${job.status}
- **Conclusion**: ${job.conclusion}
- **URL**: ${job.html_url}
- **Duration**: ${this.formatDuration(job.started_at, job.completed_at)}

#### Failed Steps
${job.steps.filter(step => step.conclusion === 'failure').map(step => `
- ${step.name} (${step.conclusion})
`).join('')}
`).join('')}

## Common Failure Patterns

${analysis.commonFailurePatterns.map(pattern => `- ${pattern}`).join('\n')}

## Recommendations

${analysis.recommendations.map(rec => `- ${rec}`).join('\n')}

## Log Analysis

${logAnalyses.map(log => `
### ${log.jobName}
- **Errors**: ${log.errorCount}
- **Warnings**: ${log.warningCount}
- **Execution Time**: ${log.executionTime}s

#### Critical Errors
${log.criticalErrors.map(error => `- ${error}`).join('\n')}

#### Common Errors
${log.commonErrors.map(error => `- ${error}`).join('\n')}
`).join('')}

## Next Steps

1. Review failed jobs and their logs
2. Address common failure patterns
3. Implement recommended improvements
4. Test changes locally before pushing
5. Consider adding more granular job dependencies

---
*Report generated by Pipecraft Debug Tools*
`;
  }

  /**
   * Format duration between two timestamps
   */
  private static formatDuration(start: string, end: string | null): string {
    if (!end) return 'In progress';
    
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const durationMs = endTime - startTime;
    
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Main debugging orchestrator
 */
export class WorkflowDebugOrchestrator {
  private debugger: GitHubWorkflowDebugger;
  private outputDir: string;

  constructor(token: string, owner: string, repo: string, outputDir: string = './debug-output') {
    this.debugger = new GitHubWorkflowDebugger(token, owner, repo);
    this.outputDir = outputDir;
  }

  /**
   * Run comprehensive workflow debugging
   */
  async debugWorkflow(workflowName: string, branch?: string, limit: number = 10): Promise<string> {
    console.log(`🔍 Debugging workflow: ${workflowName}`);
    
    // Get recent runs
    const runs = await this.debugger.getWorkflowRuns(workflowName, branch, limit);
    
    if (runs.length === 0) {
      throw new Error('No workflow runs found');
    }

    // Find failed runs
    const failedRuns = runs.filter(run => 
      run.conclusion === 'failure' || run.conclusion === 'cancelled'
    );

    if (failedRuns.length === 0) {
      console.log('✅ No failed runs found');
      return '';
    }

    console.log(`📊 Found ${failedRuns.length} failed runs`);

    // Analyze the most recent failed run
    const latestFailedRun = failedRuns[0];
    const jobs = await this.debugger.getWorkflowJobs(latestFailedRun.id);
    
    // Perform analysis
    const analysis = WorkflowAnalyzer.analyzeWorkflowRun(latestFailedRun, jobs);
    
    // Analyze logs for failed jobs
    const logAnalyses: LogAnalysis[] = [];
    for (const job of analysis.failedJobs) {
      try {
        const logs = await this.debugger.getJobLogs(latestFailedRun.id, job.id);
        const logAnalysis = LogAnalyzer.analyzeLogs(logs, job.name);
        logAnalysis.jobId = job.id;
        logAnalyses.push(logAnalysis);
      } catch (error) {
        console.warn(`⚠️  Could not fetch logs for job ${job.name}: ${error}`);
      }
    }

    // Generate report
    const reportPath = await DebugReportGenerator.generateReport(analysis, logAnalyses, this.outputDir);
    
    console.log(`📄 Debug report generated: ${reportPath}`);
    return reportPath;
  }
}
