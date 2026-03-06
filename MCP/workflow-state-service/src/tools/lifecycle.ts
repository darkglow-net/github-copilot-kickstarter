import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.ts';
import * as z from 'zod/v4';
import { createWorkflow, getState, listActive } from '../services/workflow.ts';
import { exportWorkflow, closeWorkflow } from '../services/export.ts';

export function registerLifecycleTools(server: McpServer, db: Kysely<Database>): void {
  server.tool(
    'create-workflow',
    'Create a new workflow with caller-provided phase configuration',
    {
      featureName: z.string().min(1),
      branchName: z.string().optional(),
      specDir: z.string().optional(),
      complexityScore: z.number().optional(),
      phaseConfig: z.string().describe('JSON-encoded PhaseConfig'),
      context: z.string().optional().describe('JSON-encoded context object'),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async (args) => {
      try {
        const phaseConfig = JSON.parse(args.phaseConfig);
        const context = args.context ? JSON.parse(args.context) : undefined;
        const result = await createWorkflow(db, {
          featureName: args.featureName,
          branchName: args.branchName,
          specDir: args.specDir,
          complexityScore: args.complexityScore,
          phaseConfig,
          context,
        });
        return {
          content: [{ type: 'text', text: `Workflow ${result.workflowId} created` }],
          structuredContent: result as unknown as Record<string, unknown>,
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: err.message }],
          isError: true,
          structuredContent: { code: err.code ?? 'INTERNAL_ERROR', message: err.message },
        };
      }
    },
  );

  server.tool(
    'list-active',
    'List all active (non-closed) workflows',
    {
      branchName: z.string().optional(),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async (args) => {
      const result = await listActive(db, args.branchName);
      return {
        content: [{ type: 'text', text: `Found ${result.workflows.length} workflow(s)` }],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );

  server.tool(
    'get-state',
    'Get the current state, version, and phase config of a workflow',
    {
      workflowId: z.string().uuid(),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async (args) => {
      try {
        const result = await getState(db, args.workflowId);
        return {
          content: [{ type: 'text', text: `Workflow ${args.workflowId} state v${result.stateVersion}` }],
          structuredContent: result as unknown as Record<string, unknown>,
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: err.message }],
          isError: true,
          structuredContent: { code: err.code ?? 'INTERNAL_ERROR', message: err.message },
        };
      }
    },
  );

  server.tool(
    'export-workflow',
    'Export full workflow data (state, events, evidence, context)',
    {
      workflowId: z.string().uuid(),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async (args) => {
      try {
        const result = await exportWorkflow(db, args.workflowId);
        return {
          content: [{ type: 'text', text: `Exported workflow ${args.workflowId}` }],
          structuredContent: result as unknown as Record<string, unknown>,
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: err.message }],
          isError: true,
          structuredContent: { code: err.code ?? 'INTERNAL_ERROR', message: err.message },
        };
      }
    },
  );

  server.tool(
    'close-workflow',
    'Export workflow data then purge from database',
    {
      workflowId: z.string().uuid(),
    },
    { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    async (args) => {
      try {
        const result = await closeWorkflow(db, args.workflowId);
        return {
          content: [{ type: 'text', text: `Closed workflow ${args.workflowId}` }],
          structuredContent: result as unknown as Record<string, unknown>,
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: err.message }],
          isError: true,
          structuredContent: { code: err.code ?? 'INTERNAL_ERROR', message: err.message },
        };
      }
    },
  );
}
