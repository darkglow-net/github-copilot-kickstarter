import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.ts';
import { EvidenceCategorySchema, evidenceSchemaByCategory, computeGateResult } from '../schemas/evidence.ts';
import { internalAppendEvent } from './event-emitter.ts';

function createToolError(code: string, message: string): never {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  throw err;
}

function nowISO(): string {
  return new Date().toISOString();
}

export async function submitEvidence(
  db: Kysely<Database>,
  workflowId: string,
  params: {
    phaseKey: string;
    category: string;
    data: Record<string, unknown>;
    submittedBy: string;
  },
): Promise<{ evidenceId: string; gateResult: string }> {
  const categoryResult = EvidenceCategorySchema.safeParse(params.category);
  if (!categoryResult.success) {
    createToolError('INVALID_CATEGORY', `Unknown evidence category: ${params.category}`);
  }

  const schema = evidenceSchemaByCategory[params.category as keyof typeof evidenceSchemaByCategory];
  if (schema) {
    const dataResult = schema.safeParse(params.data);
    if (!dataResult.success) {
      createToolError('VALIDATION_FAILED', `Invalid data for ${params.category}: ${dataResult.error.message}`);
    }
  }

  const gateResult = computeGateResult(params.category, params.data);
  const evidenceId = crypto.randomUUID();
  const now = nowISO();

  await db.insertInto('workflow_evidence').values({
    evidence_id: evidenceId,
    workflow_id: workflowId,
    phase_key: params.phaseKey,
    category: params.category,
    data_json: JSON.stringify(params.data),
    gate_result: gateResult,
    submitted_by: params.submittedBy,
    submitted_at: now,
  }).execute();

  await db
    .updateTable('workflows')
    .set({ updated_at: now })
    .where('workflow_id', '=', workflowId)
    .execute();

  await internalAppendEvent(db, workflowId, {
    eventType: 'evidence-submitted',
    actorKind: 'tool',
    actorName: 'submit-evidence',
    phaseKey: params.phaseKey,
    payload: {
      evidenceCategory: params.category,
      gateResult,
      data: params.data,
    },
  });

  return { evidenceId, gateResult };
}

export async function getEvidence(
  db: Kysely<Database>,
  workflowId: string,
  filters: {
    phaseKey?: string;
    category?: string;
  },
): Promise<{ evidence: Array<{
  evidenceId: string;
  phaseKey: string;
  category: string;
  data: Record<string, unknown>;
  gateResult: string;
  submittedBy: string;
  submittedAt: string;
}> }> {
  let query = db
    .selectFrom('workflow_evidence')
    .selectAll()
    .where('workflow_id', '=', workflowId)
    .orderBy('submitted_at', 'asc');

  if (filters.phaseKey) {
    query = query.where('phase_key', '=', filters.phaseKey);
  }
  if (filters.category) {
    query = query.where('category', '=', filters.category);
  }

  const rows = await query.execute();

  const evidence = rows.map((row) => ({
    evidenceId: row.evidence_id,
    phaseKey: row.phase_key,
    category: row.category,
    data: JSON.parse(row.data_json),
    gateResult: row.gate_result,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
  }));

  return { evidence };
}
