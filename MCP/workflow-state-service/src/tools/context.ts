import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.ts';
import * as z from 'zod/v4';
import { storeContext, getContext, getBriefing } from '../services/context.ts';

export function registerContextTools(server: McpServer, db: Kysely<Database>): void {
  server.tool(
    'store-context',
    'Store or update a context entry (briefing, delegation, or decision)',
    {
      workflowId: z.string().uuid(),
      category: z.string().min(1),
      key: z.string().min(1),
      value: z.string(),
      authoredBy: z.string().min(1),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async (args) => {
      try {
        const result = await storeContext(db, args.workflowId, {
          category: args.category,
          key: args.key,
          value: args.value,
          authoredBy: args.authoredBy,
        });
        return {
          content: [{ type: 'text', text: `Context ${result.created ? 'created' : 'updated'}: ${args.category}/${args.key}` }],
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
    'get-context',
    'Get context entries for a workflow, optionally filtered by category',
    {
      workflowId: z.string().uuid(),
      category: z.string().optional(),
      key: z.string().optional(),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async (args) => {
      const result = await getContext(db, args.workflowId, {
        category: args.category,
        key: args.key,
      });
      return {
        content: [{ type: 'text', text: `${result.entries.length} context entries` }],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );

  server.tool(
    'get-briefing',
    'Get briefing entries for agent recovery and context handoff',
    {
      workflowId: z.string().uuid(),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async (args) => {
      try {
        const result = await getBriefing(db, args.workflowId);
        return {
          content: [{ type: 'text', text: `Briefing for ${result.featureName} (${result.status})` }],
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
