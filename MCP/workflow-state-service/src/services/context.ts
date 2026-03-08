import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.ts';
import { ContextCategorySchema } from '../schemas/context.ts';
import { internalAppendEvent } from './event-emitter.ts';

function createToolError(code: string, message: string): never {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  throw err;
}

function nowISO(): string {
  return new Date().toISOString();
}

export async function storeContext(
  db: Kysely<Database>,
  workflowId: string,
  params: {
    category: string;
    key: string;
    value: string;
    authoredBy: string;
  },
): Promise<{ category: string; key: string; created: boolean }> {
  const catResult = ContextCategorySchema.safeParse(params.category);
  if (!catResult.success) {
    createToolError('VALIDATION_FAILED', `Invalid context category: ${params.category}`);
  }

  const now = nowISO();

  // Upsert: check if entry exists
  const existing = await db
    .selectFrom('workflow_context')
    .selectAll()
    .where('workflow_id', '=', workflowId)
    .where('category', '=', params.category)
    .where('key', '=', params.key)
    .executeTakeFirst();

  if (existing) {
    await db
      .updateTable('workflow_context')
      .set({
        value: params.value,
        authored_by: params.authoredBy,
        updated_at: now,
      })
      .where('workflow_id', '=', workflowId)
      .where('category', '=', params.category)
      .where('key', '=', params.key)
      .execute();
  } else {
    await db.insertInto('workflow_context').values({
      workflow_id: workflowId,
      category: params.category,
      key: params.key,
      value: params.value,
      authored_by: params.authoredBy,
      created_at: now,
      updated_at: now,
    }).execute();
  }

  // Update workflow activity timestamp
  await db
    .updateTable('workflows')
    .set({ updated_at: now })
    .where('workflow_id', '=', workflowId)
    .execute();

  // Emit context-stored event
  await internalAppendEvent(db, workflowId, {
    eventType: 'context-stored',
    actorKind: 'tool',
    actorName: 'store-context',
    payload: {
      category: params.category,
      key: params.key,
    },
  });

  return { category: params.category, key: params.key, created: !existing };
}

export async function getContext(
  db: Kysely<Database>,
  workflowId: string,
  filters: {
    category?: string;
    key?: string;
  },
): Promise<{ entries: Array<{
  category: string;
  key: string;
  value: string;
  authoredBy: string;
  createdAt: string;
  updatedAt: string;
}> }> {
  let query = db
    .selectFrom('workflow_context')
    .selectAll()
    .where('workflow_id', '=', workflowId)
    .orderBy('created_at', 'asc');

  if (filters.category) {
    query = query.where('category', '=', filters.category);
  }
  if (filters.key) {
    query = query.where('key', '=', filters.key);
  }

  const rows = await query.execute();

  const entries = rows.map((row) => ({
    category: row.category,
    key: row.key,
    value: row.value,
    authoredBy: row.authored_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return { entries };
}

export async function getBriefing(
  db: Kysely<Database>,
  workflowId: string,
): Promise<{
  workflowId: string;
  featureName: string;
  branchName?: string;
  currentPhaseKey: string | null;
  status: 'active' | 'blocked' | 'completed';
  briefing: Array<Record<string, unknown>>;
  decisions: Array<Record<string, unknown>>;
  delegations: Array<Record<string, unknown>>;
  phasesSummary: Array<{ key: string; label: string; status: string }>;
  haltReason?: string;
  stateVersion: number;
}> {
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

  const phaseConfig = JSON.parse(workflow.phase_config_json);
  const state = JSON.parse(stateRow.progress_state_json);

  const contextRows = await db
    .selectFrom('workflow_context')
    .selectAll()
    .where('workflow_id', '=', workflowId)
    .orderBy('created_at', 'asc')
    .execute();

  const mapEntry = (row: typeof contextRows[number]) => ({
    category: row.category,
    key: row.key,
    value: row.value,
    authoredBy: row.authored_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  const briefing = contextRows.filter((r) => r.category === 'briefing').map(mapEntry);
  const decisions = contextRows.filter((r) => r.category === 'decision').map(mapEntry);
  const delegations = contextRows.filter((r) => r.category === 'delegation').map(mapEntry);

  const phasesSummary = phaseConfig.phases.map((p: { key: string; label: string }) => ({
    key: p.key,
    label: p.label,
    status: state.phases[p.key]?.status ?? 'not-started',
  }));

  let status: 'active' | 'blocked' | 'completed';
  if (state.haltReason) {
    status = 'blocked';
  } else if (Object.values(state.phases as Record<string, { status: string }>).every((p) => p.status === 'completed')) {
    status = 'completed';
  } else {
    status = 'active';
  }

  return {
    workflowId,
    featureName: workflow.feature_name,
    ...(workflow.branch_name ? { branchName: workflow.branch_name } : {}),
    currentPhaseKey: stateRow.current_phase_key,
    status,
    briefing,
    decisions,
    delegations,
    phasesSummary,
    ...(state.haltReason ? { haltReason: state.haltReason } : {}),
    stateVersion: stateRow.state_version,
  };
}
