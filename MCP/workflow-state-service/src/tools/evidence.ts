import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.ts';
import * as z from 'zod/v4';
import { submitEvidence, getEvidence } from '../services/evidence.ts';

export function registerEvidenceTools(server: McpServer, db: Kysely<Database>): void {
  server.tool(
    'submit-evidence',
    'Submit evidence for a phase gate evaluation',
    {
      workflowId: z.string().uuid(),
      phaseKey: z.string().min(1),
      category: z.string().min(1),
      data: z.string().describe('JSON-encoded evidence data'),
      submittedBy: z.string().min(1),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async (args) => {
      try {
        const data = JSON.parse(args.data);
        const result = await submitEvidence(db, args.workflowId, {
          phaseKey: args.phaseKey,
          category: args.category,
          data,
          submittedBy: args.submittedBy,
        });
        return {
          content: [{ type: 'text', text: `Evidence ${result.evidenceId}: ${result.gateResult}` }],
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
    'get-evidence',
    'Get evidence records for a workflow, optionally filtered by phase and category',
    {
      workflowId: z.string().uuid(),
      phaseKey: z.string().optional(),
      category: z.string().optional(),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async (args) => {
      const result = await getEvidence(db, args.workflowId, {
        phaseKey: args.phaseKey,
        category: args.category,
      });
      return {
        content: [{ type: 'text', text: `${result.evidence.length} evidence record(s)` }],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );
}
