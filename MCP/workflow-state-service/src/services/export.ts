import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.ts';
import type { ProgressState, PhaseConfig } from '../types.ts';
import { internalAppendEvent } from './event-emitter.ts';

function createToolError(code: string, message: string): never {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  throw err;
}

function nowISO(): string {
  return new Date().toISOString();
}

export interface WorkflowExport {
  workflowId: string;
  featureName: string;
  branchName: string | null;
  specDir: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  phaseConfig: PhaseConfig;
  state: ProgressState;
  stateVersion: number;
  events: Array<Record<string, unknown>>;
  evidence: Array<Record<string, unknown>>;
  context: Array<Record<string, unknown>>;
}

export async function exportWorkflow(
  db: Kysely<Database>,
  workflowId: string,
): Promise<WorkflowExport> {
  const workflow = await db
    .selectFrom('workflows')
    .selectAll()
    .where('workflow_id', '=', workflowId)
    .executeTakeFirst();

  if (!workflow) {
    createToolError('WORKFLOW_NOT_FOUND', `Workflow ${workflowId} not found`);
  }

  const stateRow = await db
    .selectFrom('workflow_state')
    .selectAll()
    .where('workflow_id', '=', workflowId)
    .executeTakeFirst();

  if (!stateRow) {
    createToolError('WORKFLOW_NOT_FOUND', `Workflow state for ${workflowId} not found`);
  }

  const eventRows = await db
    .selectFrom('workflow_events')
    .selectAll()
    .where('workflow_id', '=', workflowId)
    .orderBy('seq', 'asc')
    .execute();

  const evidenceRows = await db
    .selectFrom('workflow_evidence')
    .selectAll()
    .where('workflow_id', '=', workflowId)
    .orderBy('submitted_at', 'asc')
    .execute();

  const contextRows = await db
    .selectFrom('workflow_context')
    .selectAll()
    .where('workflow_id', '=', workflowId)
    .orderBy('created_at', 'asc')
    .execute();

  return {
    workflowId: workflow.workflow_id,
    featureName: workflow.feature_name,
    branchName: workflow.branch_name,
    specDir: workflow.spec_dir,
    createdAt: workflow.created_at,
    updatedAt: workflow.updated_at,
    closedAt: workflow.closed_at,
    phaseConfig: JSON.parse(workflow.phase_config_json),
    state: JSON.parse(stateRow.progress_state_json),
    stateVersion: stateRow.state_version,
    events: eventRows.map((row) => ({
      eventId: row.event_id,
      seq: row.seq,
      timestamp: row.timestamp,
      actorKind: row.actor_kind,
      actorName: row.actor_name,
      actorRunId: row.actor_run_id,
      phaseKey: row.phase_key,
      eventType: row.event_type,
      payload: JSON.parse(row.payload_json),
    })),
    evidence: evidenceRows.map((row) => ({
      evidenceId: row.evidence_id,
      phaseKey: row.phase_key,
      category: row.category,
      data: JSON.parse(row.data_json),
      gateResult: row.gate_result,
      submittedBy: row.submitted_by,
      submittedAt: row.submitted_at,
    })),
    context: contextRows.map((row) => ({
      category: row.category,
      key: row.key,
      value: row.value,
      authoredBy: row.authored_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  };
}

export async function closeWorkflow(
  db: Kysely<Database>,
  workflowId: string,
): Promise<{ export: WorkflowExport; purged: boolean }> {
  const now = nowISO();

  // Set closed_at timestamp
  await db
    .updateTable('workflows')
    .set({ closed_at: now, updated_at: now })
    .where('workflow_id', '=', workflowId)
    .execute();

  await internalAppendEvent(db, workflowId, {
    eventType: 'workflow-closed',
    actorKind: 'tool',
    actorName: 'close-workflow',
    payload: { closedAt: now },
  });

  // Export all data before purge
  const exportData = await exportWorkflow(db, workflowId);

  // Delete workflow row — cascades to all child tables
  await db
    .deleteFrom('workflows')
    .where('workflow_id', '=', workflowId)
    .execute();

  return { export: exportData, purged: true };
}
