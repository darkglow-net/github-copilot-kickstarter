import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.ts';
import * as z from 'zod/v4';
import { submitEvidence } from '../services/evidence.ts';
import { appendEvent, getState } from '../services/workflow.ts';

export function registerSubagentTools(server: McpServer, db: Kysely<Database>): void {
  server.tool(
    'report-done',
    'Report subagent completion: creates agent-completion evidence AND subagent event',
    {
      workflowId: z.string().uuid(),
      agentName: z.string().min(1),
      taskDescription: z.string().min(1),
      status: z.enum(['completed', 'failed', 'partial']),
      summary: z.string().min(1),
      phaseKey: z.string().optional(),
      runId: z.string().optional(),
      artifacts: z.string().optional().describe('JSON-encoded artifacts array'),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async (args) => {
      try {
        // Resolve phaseKey — default to current phase
        let phaseKey = args.phaseKey;
        if (!phaseKey) {
          const stateRow = await db
            .selectFrom('workflow_state')
            .select('current_phase_key')
            .where('workflow_id', '=', args.workflowId)
            .executeTakeFirst();
          phaseKey = stateRow?.current_phase_key ?? 'unknown';
        }

        const artifacts = args.artifacts ? JSON.parse(args.artifacts) : undefined;

        // Submit agent-completion evidence
        const evidenceResult = await submitEvidence(db, args.workflowId, {
          phaseKey,
          category: 'agent-completion',
          data: {
            agentName: args.agentName,
            runId: args.runId,
            taskDescription: args.taskDescription,
            status: args.status,
            summary: args.summary,
            artifacts,
          },
          submittedBy: args.agentName,
        });

        // Emit appropriate subagent event
        const eventType = args.status === 'failed' ? 'subagent-failed' : 'subagent-completed';
        const eventPayload: Record<string, unknown> = {
          agentName: args.agentName,
          runId: args.runId,
          taskDescription: args.taskDescription,
          summary: args.summary,
        };
        if (args.status === 'failed') {
          eventPayload.error = args.summary;
        }
        if (args.status !== 'failed' && artifacts) {
          eventPayload.artifacts = artifacts;
        }

        const eventResult = await appendEvent(db, args.workflowId, {
          eventType,
          actorKind: 'subagent',
          actorName: args.agentName,
          actorRunId: args.runId,
          phaseKey,
          payload: eventPayload,
        });

        return {
          content: [{ type: 'text', text: `${args.agentName} reported ${args.status}` }],
          structuredContent: {
            evidenceId: evidenceResult.evidenceId,
            gateResult: evidenceResult.gateResult,
            eventId: eventResult.eventId,
            seq: eventResult.seq,
          },
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
