import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.ts';
import * as z from 'zod/v4';
import { validateState, checkCaps, allocateTaskId } from '../services/workflow.ts';

export function registerValidationTools(server: McpServer, db: Kysely<Database>): void {
  server.tool(
    'validate-state',
    'Validate structural integrity of workflow state against phase config',
    {
      workflowId: z.string().uuid(),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async (args) => {
      try {
        const result = await validateState(db, args.workflowId);
        return {
          content: [{ type: 'text', text: result.valid ? 'State is valid' : `${result.errors.length} error(s) found` }],
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
    'check-caps',
    'Check cycle and attempt caps for a workflow',
    {
      workflowId: z.string().uuid(),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async (args) => {
      try {
        const result = await checkCaps(db, args.workflowId);
        return {
          content: [{ type: 'text', text: `Caps: ${JSON.stringify(result)}` }],
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
    'allocate-task-id',
    'Allocate the next sequential task ID (minimum 100)',
    {
      workflowId: z.string().uuid(),
      taskType: z.enum(['task', 'fixTask']).optional(),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async (args) => {
      try {
        const result = await allocateTaskId(db, args.workflowId, args.taskType ?? 'task');
        return {
          content: [{ type: 'text', text: `Next ID: ${result.nextId}` }],
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
