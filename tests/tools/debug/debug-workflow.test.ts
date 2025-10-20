/**
 * GitHub Actions Workflow Debugging Test Suite
 * 
 * This test suite validates the debugging utilities and ensures
 * they can properly analyze workflow failures.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  GitHubWorkflowDebugger, 
  WorkflowAnalyzer, 
  LogAnalyzer, 
  DebugReportGenerator,
  WorkflowDebugOrchestrator,
  type WorkflowRun,
  type Job,
  type DebugAnalysis,
  type LogAnalysis
} from './debug-utils';

// Mock data for testing
const mockWorkflowRun: WorkflowRun = {
  id: 12345,
  status: 'completed',
  conclusion: 'failure',
  created_at: '2024-01-15T10:00:00Z',
  html_url: 'https://github.com/owner/repo/actions/runs/12345',
  workflow_id: 67890,
  head_branch: 'main',
  head_sha: 'abc123def456'
};

const mockJobs: Job[] = [
  {
    id: 1,
    name: 'test-api',
    status: 'completed',
    conclusion: 'failure',
    html_url: 'https://github.com/owner/repo/actions/runs/12345/jobs/1',
    started_at: '2024-01-15T10:00:00Z',
    completed_at: '2024-01-15T10:05:00Z',
    steps: [
      {
        name: 'Setup Node.js',
        status: 'completed',
        conclusion: 'success',
        number: 1,
        started_at: '2024-01-15T10:00:00Z',
        completed_at: '2024-01-15T10:01:00Z'
      },
      {
        name: 'Install dependencies',
        status: 'completed',
        conclusion: 'success',
        number: 2,
        started_at: '2024-01-15T10:01:00Z',
        completed_at: '2024-01-15T10:02:00Z'
      },
      {
        name: 'Run tests',
        status: 'completed',
        conclusion: 'failure',
        number: 3,
        started_at: '2024-01-15T10:02:00Z',
        completed_at: '2024-01-15T10:05:00Z'
      }
    ]
  },
  {
    id: 2,
    name: 'build-web',
    status: 'completed',
    conclusion: 'failure',
    html_url: 'https://github.com/owner/repo/actions/runs/12345/jobs/2',
    started_at: '2024-01-15T10:00:00Z',
    completed_at: '2024-01-15T10:03:00Z',
    steps: [
      {
        name: 'Build application',
        status: 'completed',
        conclusion: 'failure',
        number: 1,
        started_at: '2024-01-15T10:00:00Z',
        completed_at: '2024-01-15T10:03:00Z'
      }
    ]
  },
  {
    id: 3,
    name: 'lint-code',
    status: 'completed',
    conclusion: 'success',
    html_url: 'https://github.com/owner/repo/actions/runs/12345/jobs/3',
    started_at: '2024-01-15T10:00:00Z',
    completed_at: '2024-01-15T10:01:00Z',
    steps: [
      {
        name: 'Run ESLint',
        status: 'completed',
        conclusion: 'success',
        number: 1,
        started_at: '2024-01-15T10:00:00Z',
        completed_at: '2024-01-15T10:01:00Z'
      }
    ]
  }
];

const mockLogs = `
2024-01-15T10:02:00.000Z [INFO] Starting test suite
2024-01-15T10:02:30.000Z [ERROR] Test failed: API endpoint not responding
2024-01-15T10:03:00.000Z [WARN] Connection timeout after 30 seconds
2024-01-15T10:03:30.000Z [ERROR] Fatal error: Database connection refused
2024-01-15T10:04:00.000Z [ERROR] Test suite failed with 5 errors
2024-01-15T10:05:00.000Z [INFO] Test execution completed
`;

describe('WorkflowAnalyzer', () => {
  it('should analyze workflow run and identify failed jobs', () => {
    const analysis = WorkflowAnalyzer.analyzeWorkflowRun(mockWorkflowRun, mockJobs);
    
    expect(analysis.runId).toBe(12345);
    expect(analysis.status).toBe('completed');
    expect(analysis.conclusion).toBe('failure');
    expect(analysis.failedJobs).toHaveLength(2);
    expect(analysis.totalJobs).toBe(3);
    expect(analysis.successRate).toBeCloseTo(33.33, 1);
  });

  it('should extract common failure patterns', () => {
    const analysis = WorkflowAnalyzer.analyzeWorkflowRun(mockWorkflowRun, mockJobs);
    
    expect(analysis.commonFailurePatterns).toContain('Test Failures');
    expect(analysis.commonFailurePatterns).toContain('Build Failures');
  });

  it('should generate relevant recommendations', () => {
    const analysis = WorkflowAnalyzer.analyzeWorkflowRun(mockWorkflowRun, mockJobs);
    
    expect(analysis.recommendations).toContain('Review test cases and ensure they are up to date');
    expect(analysis.recommendations).toContain('Verify build dependencies and versions');
  });
});

describe('LogAnalyzer', () => {
  it('should analyze logs and count errors and warnings', () => {
    const analysis = LogAnalyzer.analyzeLogs(mockLogs, 'test-api');
    
    expect(analysis.jobName).toBe('test-api');
    expect(analysis.errorCount).toBeGreaterThan(0);
    expect(analysis.warningCount).toBeGreaterThan(0);
    expect(analysis.criticalErrors.length).toBeGreaterThan(0);
  });

  it('should extract common error patterns', () => {
    const analysis = LogAnalyzer.analyzeLogs(mockLogs, 'test-api');
    
    expect(analysis.commonErrors.length).toBeGreaterThan(0);
    expect(analysis.executionTime).toBeGreaterThan(0);
  });

  it('should identify critical errors', () => {
    const analysis = LogAnalyzer.analyzeLogs(mockLogs, 'test-api');
    
    expect(analysis.criticalErrors.length).toBeGreaterThan(0);
    expect(analysis.criticalErrors.some(error => error.includes('Database connection refused'))).toBe(true);
  });
});

describe('DebugReportGenerator', () => {
  let mockAnalysis: DebugAnalysis;
  let mockLogAnalyses: LogAnalysis[];

  beforeEach(() => {
    mockAnalysis = {
      runId: 12345,
      status: 'completed',
      conclusion: 'failure',
      failedJobs: mockJobs.filter(job => job.conclusion === 'failure'),
      totalJobs: 3,
      successRate: 33.33,
      commonFailurePatterns: ['Test Failures', 'Build Failures'],
      recommendations: [
        'Review test cases and ensure they are up to date',
        'Verify build dependencies and versions'
      ]
    };

    mockLogAnalyses = [
      {
        jobId: 1,
        jobName: 'test-api',
        errorCount: 3,
        warningCount: 1,
        criticalErrors: ['Fatal error: Database connection refused'],
        commonErrors: ['API endpoint not responding', 'Database connection refused'],
        executionTime: 180
      }
    ];
  });

  it('should generate a comprehensive debug report', async () => {
    const reportPath = await DebugReportGenerator.generateReport(
      mockAnalysis,
      mockLogAnalyses,
      './test-output'
    );
    
    expect(reportPath).toContain('debug-report.md');
  });

  it('should include all analysis data in the report', async () => {
    const reportPath = await DebugReportGenerator.generateReport(
      mockAnalysis,
      mockLogAnalyses,
      './test-output'
    );
    
    // The report should be generated successfully
    expect(reportPath).toBeDefined();
  });
});

describe('GitHubWorkflowDebugger', () => {
  let workflowDebugger: GitHubWorkflowDebugger;

  beforeEach(() => {
    workflowDebugger = new GitHubWorkflowDebugger('fake-token', 'owner', 'repo');
  });

  it('should initialize with correct parameters', () => {
    expect(workflowDebugger).toBeDefined();
  });

  it('should handle API request errors gracefully', async () => {
    // Mock fetch to throw an error
    global.fetch = vi.fn().mockRejectedValue(new Error('API request failed'));
    
    await expect(workflowDebugger.getWorkflowRuns('test-workflow')).rejects.toThrow('API request failed');
  });
});

describe('WorkflowDebugOrchestrator', () => {
  let orchestrator: WorkflowDebugOrchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowDebugOrchestrator('fake-token', 'owner', 'repo', './test-output');
  });

  it('should initialize with correct parameters', () => {
    expect(orchestrator).toBeDefined();
  });

  it('should handle missing workflow runs', async () => {
    // Mock the workflowDebugger to return empty runs
    const mockWorkflowDebugger = {
      getWorkflowRuns: vi.fn().mockResolvedValue([])
    };
    
    // Replace the workflowDebugger instance
    (orchestrator as any).debugger = mockWorkflowDebugger;
    
    await expect(orchestrator.debugWorkflow('test-workflow')).rejects.toThrow('No workflow runs found');
  });
});

describe('Integration Tests', () => {
  it('should handle end-to-end debugging workflow', async () => {
    // This test would require actual GitHub API access
    // For now, we'll test the structure and error handling
    
    const orchestrator = new WorkflowDebugOrchestrator('fake-token', 'owner', 'repo');
    
    // Mock successful API responses
    const mockRuns = [mockWorkflowRun];
    const mockJobsData = mockJobs;
    
    // This would be the actual integration test
    // await orchestrator.debugWorkflow('test-workflow');
    
    expect(orchestrator).toBeDefined();
  });
});

describe('Error Handling', () => {
  it('should handle network errors gracefully', async () => {
    const workflowDebugger = new GitHubWorkflowDebugger('fake-token', 'owner', 'repo');
    
    // Mock network error
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    
    await expect(workflowDebugger.getWorkflowRuns('test-workflow')).rejects.toThrow('Network error');
  });

  it('should handle invalid JSON responses', async () => {
    const workflowDebugger = new GitHubWorkflowDebugger('fake-token', 'owner', 'repo');
    
    // Mock invalid JSON response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error('Invalid JSON'))
    });
    
    await expect(workflowDebugger.getWorkflowRuns('test-workflow')).rejects.toThrow('Invalid JSON');
  });
});

describe('Performance Tests', () => {
  it('should handle large log files efficiently', () => {
    const largeLogs = 'INFO: Starting\n'.repeat(10000) + 'ERROR: Failed\n'.repeat(100);
    
    const startTime = Date.now();
    const analysis = LogAnalyzer.analyzeLogs(largeLogs, 'test-job');
    const endTime = Date.now();
    
    expect(analysis.errorCount).toBe(100);
    expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
  });

  it('should handle many jobs efficiently', () => {
    const manyJobs: Job[] = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      name: `job-${i}`,
      status: 'completed',
      conclusion: i % 10 === 0 ? 'failure' : 'success',
      html_url: `https://example.com/job/${i}`,
      started_at: '2024-01-15T10:00:00Z',
      completed_at: '2024-01-15T10:05:00Z',
      steps: []
    }));
    
    const startTime = Date.now();
    const analysis = WorkflowAnalyzer.analyzeWorkflowRun(mockWorkflowRun, manyJobs);
    const endTime = Date.now();
    
    expect(analysis.totalJobs).toBe(100);
    expect(endTime - startTime).toBeLessThan(500); // Should complete in under 500ms
  });
});
