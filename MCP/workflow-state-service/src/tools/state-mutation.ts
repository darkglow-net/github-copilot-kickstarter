import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.ts';
import * as z from 'zod/v4';
import { updateState, haltWorkflow, resumeWorkflow } from '../services/workflow.ts';

export function registerStateMutationTools(server: McpServer, db: Kysely<Database>): void {
  server.tool(
    'update-state',
    'Update workflow state: tasks, fixTasks, context, phaseMetadata, or complexityScore',
    {
      workflowId: z.string().uuid(),
      tasks: z.string().optional().describe('JSON-encoded Task[]'),
      fixTasks: z.string().optional().describe('JSON-encoded FixTask[]'),
      context: z.string().optional().describe('JSON-encoded context object'),
      phaseMetadata: z.string().optional().describe('JSON-encoded {phaseKey, metadata}'),
      complexityScore: z.number().optional(),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async (args) => {
      try {
        const result = await updateState(db, args.workflowId, {
          tasks: args.tasks ? JSON.parse(args.tasks) : undefined,
          fixTasks: args.fixTasks ? JSON.parse(args.fixTasks) : undefined,
          context: args.context ? JSON.parse(args.context) : undefined,
          phaseMetadata: args.phaseMetadata ? JSON.parse(args.phaseMetadata) : undefined,
          complexityScore: args.complexityScore,
        });
        return {
          content: [{ type: 'text', text: `State updated to v${result.stateVersion}` }],
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
    'halt-workflow',
    'Halt a workflow, blocking the current phase',
    {
      workflowId: z.string().uuid(),
      reason: z.string().min(1),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async (args) => {
      try {
        const result = await haltWorkflow(db, args.workflowId, args.reason);
        return {
          content: [{ type: 'text', text: `Workflow halted: ${args.reason}` }],
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
    'resume-workflow',
    'Resume a halted workflow',
    {
      workflowId: z.string().uuid(),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async (args) => {
      try {
        const result = await resumeWorkflow(db, args.workflowId);
        return {
          content: [{ type: 'text', text: 'Workflow resumed' }],
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
