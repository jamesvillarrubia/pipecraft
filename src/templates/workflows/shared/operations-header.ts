/**
 * Shared Header Operations
 *
 * Generates workflow header operations (name, run-name, on triggers) that are
 * common to both Nx and path-based pipeline templates.
 */

import { PathOperationConfig } from '../../../utils/ast-path-operations.js'
import { Scalar } from 'yaml'

export interface HeaderContext {
  branchFlow: string[]
}

/**
 * Create workflow header operations (name, run-name, on triggers)
 */
export function createHeaderOperations(ctx: HeaderContext): PathOperationConfig[] {
  const { branchFlow } = ctx
  const branchList = branchFlow.join(',')

  return [
    // =============================================================================
    // WORKFLOW NAME
    // =============================================================================
    {
      path: 'name',
      operation: 'preserve',
      value: (() => {
        const nameScalar = new Scalar('Pipeline')
        nameScalar.type = Scalar.QUOTE_DOUBLE
        return nameScalar
      })(),
      required: true
    },

    // =============================================================================
    // RUN NAME - Display name for workflow runs
    // =============================================================================
    {
      path: 'run-name',
      operation: 'preserve',
      value: (() => {
        const runNameScalar = new Scalar(
          `\${{ github.event_name == 'pull_request' && !contains('${branchList}', github.head_ref) && github.event.pull_request.title || github.ref_name }} #\${{ inputs.run_number || github.run_number }}\${{ inputs.version && format(' - {0}', inputs.version) || '' }}`
        )
        runNameScalar.type = Scalar.QUOTE_DOUBLE
        return runNameScalar
      })(),
      required: true,
      spaceBefore: true
    },

    // =============================================================================
    // WORKFLOW TRIGGERS
    // =============================================================================
    {
      path: 'on',
      operation: 'set',
      value: {},
      required: true,
      spaceBefore: true
    },

    // workflow_dispatch inputs
    {
      path: 'on.workflow_dispatch.inputs.version',
      operation: 'set',
      value: {
        description: 'The version to deploy',
        required: false,
        type: 'string'
      },
      required: true
    },
    {
      path: 'on.workflow_dispatch.inputs.baseRef',
      operation: 'set',
      value: {
        description: 'The base reference for comparison',
        required: false,
        type: 'string'
      },
      required: true
    },
    {
      path: 'on.workflow_dispatch.inputs.run_number',
      operation: 'set',
      value: {
        description: 'The original run number from develop branch',
        required: false,
        type: 'string'
      },
      required: true
    },
    {
      path: 'on.workflow_dispatch.inputs.commitSha',
      operation: 'set',
      value: {
        description: 'The exact commit SHA to checkout and test',
        required: false,
        type: 'string'
      },
      required: true
    },

    // workflow_call inputs (same as workflow_dispatch)
    {
      path: 'on.workflow_call.inputs.version',
      operation: 'set',
      value: {
        description: 'The version to deploy',
        required: false,
        type: 'string'
      },
      required: true
    },
    {
      path: 'on.workflow_call.inputs.baseRef',
      operation: 'set',
      value: {
        description: 'The base reference for comparison',
        required: false,
        type: 'string'
      },
      required: true
    },
    {
      path: 'on.workflow_call.inputs.run_number',
      operation: 'set',
      value: {
        description: 'The original run number from develop branch',
        required: false,
        type: 'string'
      },
      required: true
    },
    {
      path: 'on.workflow_call.inputs.commitSha',
      operation: 'set',
      value: {
        description: 'The exact commit SHA to checkout and test',
        required: false,
        type: 'string'
      },
      required: true
    },

    // push trigger
    {
      path: 'on.push.branches',
      operation: 'set',
      value: branchFlow,
      required: true
    },

    // pull_request trigger
    {
      path: 'on.pull_request.types',
      operation: 'set',
      value: ['opened', 'synchronize', 'reopened'],
      required: true
    },
    {
      path: 'on.pull_request.branches',
      operation: 'set',
      value: [branchFlow[0]], // Only target initial branch
      required: true
    }
  ]
}
