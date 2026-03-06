import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.ts';
import * as z from 'zod/v4';
import { transitionPhase } from '../services/transition.ts';

export function registerTransitionTools(server: McpServer, db: Kysely<Database>): void {
  server.tool(
    'transition-phase',
    'Transition from one phase to the next, evaluating gate rules',
    {
      workflowId: z.string().uuid(),
      from: z.string().min(1),
      to: z.string().min(1),
      summary: z.string().min(1),
      actorKind: z.string().min(1),
      actorName: z.string().min(1),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async (args) => {
      try {
        const result = await transitionPhase(db, args.workflowId, {
          from: args.from,
          to: args.to,
          summary: args.summary,
          actorKind: args.actorKind,
          actorName: args.actorName,
        });
        const status = result.approved ? 'approved' : 'rejected';
        return {
          content: [{ type: 'text', text: `Transition ${args.from} → ${args.to}: ${status}` }],
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
