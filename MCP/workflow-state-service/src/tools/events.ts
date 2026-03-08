import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.ts';
import * as z from 'zod/v4';
import { appendEvent, getEvents } from '../services/workflow.ts';

export function registerEventTools(server: McpServer, db: Kysely<Database>): void {
  server.tool(
    'append-event',
    'Append a typed event to the workflow event log',
    {
      workflowId: z.string().uuid(),
      eventType: z.string().min(1),
      actorKind: z.string().min(1),
      actorName: z.string().min(1),
      actorRunId: z.string().optional(),
      phaseKey: z.string().optional(),
      payload: z.string().describe('JSON-encoded payload'),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async (args) => {
      try {
        const payload = JSON.parse(args.payload);
        const result = await appendEvent(db, args.workflowId, {
          eventType: args.eventType,
          actorKind: args.actorKind,
          actorName: args.actorName,
          actorRunId: args.actorRunId,
          phaseKey: args.phaseKey,
          payload,
        });
        return {
          content: [{ type: 'text', text: `Event ${result.eventId} appended (seq ${result.seq})` }],
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
    'get-events',
    'Get events from the workflow event log with cursor-based pagination',
    {
      workflowId: z.string().uuid(),
      sinceCursor: z.number().int().optional(),
      eventType: z.string().optional(),
      limit: z.number().int().positive().optional(),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async (args) => {
      const result = await getEvents(db, args.workflowId, {
        sinceCursor: args.sinceCursor,
        eventType: args.eventType,
        limit: args.limit,
      });
      return {
        content: [{ type: 'text', text: `${result.events.length} event(s)` }],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );
}
