import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.ts';
import type { ProgressState, PhaseConfig, Task, FixTask } from '../types.ts';
import { PhaseConfigSchema } from '../schemas/phase-config.ts';
import { EventTypeSchema, eventPayloadSchemas } from '../schemas/events.ts';
import { internalAppendEvent } from './event-emitter.ts';

function createToolError(code: string, message: string): never {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  throw err;
}

function nowISO(): string {
  return new Date().toISOString();
}

export async function createWorkflow(
  db: Kysely<Database>,
  params: {
    featureName: string;
    branchName?: string;
    specDir?: string;
    complexityScore?: number;
    phaseConfig: PhaseConfig;
    context?: Record<string, unknown>;
  },
): Promise<{ workflowId: string; state: ProgressState }> {
  const parseResult = PhaseConfigSchema.safeParse(params.phaseConfig);
  if (!parseResult.success) {
    createToolError('VALIDATION_FAILED', `Invalid phase config: ${parseResult.error.message}`);
  }

  const workflowId = crypto.randomUUID();
  const now = nowISO();

  const sortedPhases = [...params.phaseConfig.phases].sort((a, b) => a.ordinal - b.ordinal);
  const firstPhaseKey = sortedPhases[0].key;

  const phases: Record<string, ProgressState['phases'][string]> = {};
  for (const phase of params.phaseConfig.phases) {
    phases[phase.key] = {
      status: phase.key === firstPhaseKey ? 'in-progress' : 'not-started',
      startedAt: phase.key === firstPhaseKey ? now : null,
      completedAt: null,
      summary: null,
    };
  }

  const state: ProgressState = {
    feature: params.featureName,
    branch: params.branchName,
    spec: params.specDir,
    complexityScore: params.complexityScore,
    startedAt: now,
    phases,
    tasks: [],
    fixTasks: [],
    context: params.context ?? {},
    haltReason: null,
  };

  await db.insertInto('workflows').values({
    workflow_id: workflowId,
    feature_name: params.featureName,
    branch_name: params.branchName ?? null,
    spec_dir: params.specDir ?? null,
    phase_config_json: JSON.stringify(params.phaseConfig),
    created_at: now,
    updated_at: now,
    closed_at: null,
  }).execute();

  await db.insertInto('workflow_state').values({
    workflow_id: workflowId,
    progress_state_json: JSON.stringify(state),
    current_phase_key: firstPhaseKey,
  }).execute();

  await internalAppendEvent(db, workflowId, {
    eventType: 'workflow-created',
    actorKind: 'tool',
    actorName: 'create-workflow',
    phaseKey: firstPhaseKey,
    payload: {
      feature: params.featureName,
      branch: params.branchName,
      spec: params.specDir,
    },
  });

  await internalAppendEvent(db, workflowId, {
    eventType: 'phase-started',
    actorKind: 'tool',
    actorName: 'create-workflow',
    phaseKey: firstPhaseKey,
    payload: { phaseKey: firstPhaseKey, startedAt: now },
  });

  return { workflowId, state };
}

export async function getState(
  db: Kysely<Database>,
  workflowId: string,
): Promise<{ state: ProgressState; stateVersion: number; phaseConfig: PhaseConfig }> {
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

  return {
    state: JSON.parse(stateRow.progress_state_json),
    stateVersion: stateRow.state_version,
    phaseConfig: JSON.parse(workflow.phase_config_json),
  };
}

export async function listActive(
  db: Kysely<Database>,
  branchName?: string,
): Promise<{ workflows: Array<{
  workflowId: string;
  featureName: string;
  branchName: string | null;
  currentPhaseKey: string | null;
  status: 'active' | 'blocked' | 'completed';
  updatedAt: string;
}> }> {
  let query = db
    .selectFrom('workflows')
    .innerJoin('workflow_state', 'workflows.workflow_id', 'workflow_state.workflow_id')
    .select([
      'workflows.workflow_id',
      'workflows.feature_name',
      'workflows.branch_name',
      'workflows.updated_at',
      'workflow_state.progress_state_json',
      'workflow_state.current_phase_key',
    ])
    .where('workflows.closed_at', 'is', null);

  if (branchName) {
    query = query.where('workflows.branch_name', '=', branchName);
  }

  const rows = await query.execute();

  const workflows = rows.map((row) => {
    const state: ProgressState = JSON.parse(row.progress_state_json);
    let status: 'active' | 'blocked' | 'completed';

    if (state.haltReason) {
      status = 'blocked';
    } else if (Object.values(state.phases).every((p) => p.status === 'completed')) {
      status = 'completed';
    } else {
      status = 'active';
    }

    return {
      workflowId: row.workflow_id,
      featureName: row.feature_name,
      branchName: row.branch_name,
      currentPhaseKey: row.current_phase_key,
      status,
      updatedAt: row.updated_at,
    };
  });

  return { workflows };
}

export async function updateState(
  db: Kysely<Database>,
  workflowId: string,
  params: {
    tasks?: Task[];
    fixTasks?: FixTask[];
    context?: Record<string, unknown>;
    phaseMetadata?: { phaseKey: string; metadata: Record<string, unknown> };
    complexityScore?: number;
  },
): Promise<{ state: ProgressState; stateVersion: number }> {
  const hasAnyField = params.tasks !== undefined ||
    params.fixTasks !== undefined ||
    params.context !== undefined ||
    params.phaseMetadata !== undefined ||
    params.complexityScore !== undefined;

  if (!hasAnyField) {
    createToolError('VALIDATION_FAILED', 'At least one field must be provided');
  }

  const { state, stateVersion } = await getState(db, workflowId);

  if (params.tasks !== undefined) {
    state.tasks = params.tasks;
  }
  if (params.fixTasks !== undefined) {
    state.fixTasks = params.fixTasks;
  }
  if (params.context !== undefined) {
    state.context = { ...state.context, ...params.context };
  }
  if (params.phaseMetadata !== undefined) {
    const phase = state.phases[params.phaseMetadata.phaseKey];
    if (phase) {
      phase.metadata = { ...(phase.metadata ?? {}), ...params.phaseMetadata.metadata };
    }
  }
  if (params.complexityScore !== undefined) {
    state.complexityScore = params.complexityScore;
  }

  const newVersion = stateVersion + 1;

  await db
    .updateTable('workflow_state')
    .set({
      progress_state_json: JSON.stringify(state),
      state_version: newVersion,
    })
    .where('workflow_id', '=', workflowId)
    .execute();

  await db
    .updateTable('workflows')
    .set({ updated_at: nowISO() })
    .where('workflow_id', '=', workflowId)
    .execute();

  const updates: string[] = [];
  if (params.tasks !== undefined) updates.push('tasks');
  if (params.fixTasks !== undefined) updates.push('fixTasks');
  if (params.context !== undefined) updates.push('context');
  if (params.phaseMetadata !== undefined) updates.push('phaseMetadata');
  if (params.complexityScore !== undefined) updates.push('complexityScore');

  await internalAppendEvent(db, workflowId, {
    eventType: 'note-added',
    actorKind: 'tool',
    actorName: 'update-state',
    payload: { text: `Updated: ${updates.join(', ')}` },
  });

  return { state, stateVersion: newVersion };
}

export async function haltWorkflow(
  db: Kysely<Database>,
  workflowId: string,
  reason: string,
): Promise<{ state: ProgressState }> {
  const { state } = await getState(db, workflowId);

  state.haltReason = reason;

  const currentPhaseKey = findCurrentPhaseKey(state);
  if (currentPhaseKey && state.phases[currentPhaseKey]) {
    state.phases[currentPhaseKey].status = 'blocked';
  }

  await db
    .updateTable('workflow_state')
    .set({
      progress_state_json: JSON.stringify(state),
      current_phase_key: currentPhaseKey,
    })
    .where('workflow_id', '=', workflowId)
    .execute();

  await db
    .updateTable('workflows')
    .set({ updated_at: nowISO() })
    .where('workflow_id', '=', workflowId)
    .execute();

  await internalAppendEvent(db, workflowId, {
    eventType: 'workflow-halted',
    actorKind: 'tool',
    actorName: 'halt-workflow',
    phaseKey: currentPhaseKey ?? undefined,
    payload: { reason },
  });

  return { state };
}

export async function resumeWorkflow(
  db: Kysely<Database>,
  workflowId: string,
): Promise<{ state: ProgressState }> {
  const { state } = await getState(db, workflowId);

  if (!state.haltReason) {
    createToolError('STATE_CONFLICT', 'Workflow is not halted');
  }

  const blockedKey = Object.keys(state.phases).find(
    (k) => state.phases[k].status === 'blocked',
  );
  if (!blockedKey) {
    createToolError('STATE_CONFLICT', 'No blocked phase found');
  }

  state.haltReason = null;
  state.phases[blockedKey].status = 'in-progress';

  await db
    .updateTable('workflow_state')
    .set({
      progress_state_json: JSON.stringify(state),
      current_phase_key: blockedKey,
    })
    .where('workflow_id', '=', workflowId)
    .execute();

  await db
    .updateTable('workflows')
    .set({ updated_at: nowISO() })
    .where('workflow_id', '=', workflowId)
    .execute();

  await internalAppendEvent(db, workflowId, {
    eventType: 'phase-started',
    actorKind: 'tool',
    actorName: 'resume-workflow',
    phaseKey: blockedKey,
    payload: { phaseKey: blockedKey, startedAt: nowISO() },
  });

  return { state };
}

export async function appendEvent(
  db: Kysely<Database>,
  workflowId: string,
  params: {
    eventType: string;
    actorKind: string;
    actorName: string;
    actorRunId?: string;
    phaseKey?: string;
    payload: Record<string, unknown>;
  },
): Promise<{ eventId: string; seq: number }> {
  // Validate workflow exists
  const workflow = await db
    .selectFrom('workflows')
    .select('workflow_id')
    .where('workflow_id', '=', workflowId)
    .executeTakeFirst();

  if (!workflow) {
    createToolError('WORKFLOW_NOT_FOUND', `Workflow ${workflowId} not found`);
  }

  // Validate event type
  const typeResult = EventTypeSchema.safeParse(params.eventType);
  if (!typeResult.success) {
    createToolError('VALIDATION_FAILED', `Invalid event type: ${params.eventType}`);
  }

  // Validate payload against schema
  const payloadSchema = eventPayloadSchemas[params.eventType];
  if (payloadSchema) {
    const payloadResult = payloadSchema.safeParse(params.payload);
    if (!payloadResult.success) {
      createToolError('VALIDATION_FAILED', `Invalid payload for ${params.eventType}: ${payloadResult.error.message}`);
    }
  }

  await db
    .updateTable('workflows')
    .set({ updated_at: nowISO() })
    .where('workflow_id', '=', workflowId)
    .execute();

  return internalAppendEvent(db, workflowId, params);
}

export async function getEvents(
  db: Kysely<Database>,
  workflowId: string,
  params: {
    sinceCursor?: number;
    eventType?: string;
    limit?: number;
  },
): Promise<{ events: Array<Record<string, unknown>>; nextCursor: number | null }> {
  const limit = params.limit ?? 100;

  let query = db
    .selectFrom('workflow_events')
    .selectAll()
    .where('workflow_id', '=', workflowId)
    .orderBy('seq', 'asc')
    .limit(limit + 1);

  if (params.sinceCursor !== undefined) {
    query = query.where('seq', '>', params.sinceCursor);
  }
  if (params.eventType) {
    query = query.where('event_type', '=', params.eventType);
  }

  const rows = await query.execute();
  const hasMore = rows.length > limit;
  const sliced = hasMore ? rows.slice(0, limit) : rows;

  const events = sliced.map((row) => ({
    eventId: row.event_id,
    workflowId: row.workflow_id,
    seq: row.seq,
    timestamp: row.timestamp,
    actorKind: row.actor_kind,
    actorName: row.actor_name,
    actorRunId: row.actor_run_id,
    phaseKey: row.phase_key,
    eventType: row.event_type,
    payload: JSON.parse(row.payload_json),
  }));

  const nextCursor = hasMore ? sliced[sliced.length - 1].seq : null;
  return { events, nextCursor };
}

export async function validateState(
  db: Kysely<Database>,
  workflowId: string,
): Promise<{ valid: boolean; errors: string[] }> {
  const { state, phaseConfig } = await getState(db, workflowId);
  const errors: string[] = [];

  // Check all phases match config
  const configKeys = new Set(phaseConfig.phases.map((p) => p.key));
  const stateKeys = new Set(Object.keys(state.phases));

  for (const key of configKeys) {
    if (!stateKeys.has(key)) {
      errors.push(`Phase "${key}" defined in config but missing from state`);
    }
  }
  for (const key of stateKeys) {
    if (!configKeys.has(key)) {
      errors.push(`Phase "${key}" in state but not defined in config`);
    }
  }

  // Check phase status constraints
  const inProgress = Object.entries(state.phases).filter(([, p]) => p.status === 'in-progress');
  const blocked = Object.entries(state.phases).filter(([, p]) => p.status === 'blocked');
  const allCompleted = Object.values(state.phases).every((p) => p.status === 'completed');

  if (!allCompleted) {
    if (state.haltReason) {
      if (blocked.length !== 1) {
        errors.push('Halted workflow should have exactly one blocked phase');
      }
    } else {
      if (inProgress.length !== 1) {
        errors.push('Active workflow should have exactly one in-progress phase');
      }
    }
  }

  // Check completed phases have required fields
  for (const [key, phase] of Object.entries(state.phases)) {
    if (phase.status === 'completed') {
      if (!phase.completedAt) errors.push(`Completed phase "${key}" missing completedAt`);
      if (!phase.summary) errors.push(`Completed phase "${key}" missing summary`);
    }
  }

  // Check timestamp ordering
  for (const [key, phase] of Object.entries(state.phases)) {
    if (phase.startedAt && phase.completedAt) {
      if (new Date(phase.startedAt) > new Date(phase.completedAt)) {
        errors.push(`Phase "${key}" startedAt is after completedAt`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export async function checkCaps(
  db: Kysely<Database>,
  workflowId: string,
): Promise<{
  rubricAttempts: number;
  reviewAttempts: number;
  totalCycles: number;
  maxCycles: number;
  exceeded: boolean;
}> {
  const { phaseConfig } = await getState(db, workflowId);

  // rubricAttempts: count transition-rejected events
  const rejectedRows = await db
    .selectFrom('workflow_events')
    .select(db.fn.count('event_id').as('count'))
    .where('workflow_id', '=', workflowId)
    .where('event_type', '=', 'transition-rejected')
    .executeTakeFirst();
  const rubricAttempts = Number(rejectedRows?.count ?? 0);

  // reviewAttempts: count transition-approved from *review* to *implement*
  const approvedRows = await db
    .selectFrom('workflow_events')
    .selectAll()
    .where('workflow_id', '=', workflowId)
    .where('event_type', '=', 'transition-approved')
    .execute();

  let reviewAttempts = 0;
  for (const row of approvedRows) {
    const payload = JSON.parse(row.payload_json);
    if (
      typeof payload.from === 'string' && payload.from.includes('review') &&
      typeof payload.to === 'string' && payload.to.includes('implement')
    ) {
      reviewAttempts++;
    }
  }

  const totalCycles = rubricAttempts + reviewAttempts;
  const maxCycles = phaseConfig.maxCycles ?? 4;
  const exceeded = totalCycles >= maxCycles;

  return { rubricAttempts, reviewAttempts, totalCycles, maxCycles, exceeded };
}

export async function allocateTaskId(
  db: Kysely<Database>,
  workflowId: string,
  taskType: 'task' | 'fixTask',
): Promise<{ nextId: number }> {
  const { state } = await getState(db, workflowId);
  const items = taskType === 'task' ? state.tasks : state.fixTasks;
  const maxId = items.reduce((max, item) => Math.max(max, item.id), 0);
  const nextId = Math.max(maxId + 1, 100);
  return { nextId };
}

function findCurrentPhaseKey(state: ProgressState): string | null {
  for (const [key, phase] of Object.entries(state.phases)) {
    if (phase.status === 'in-progress' || phase.status === 'blocked') {
      return key;
    }
  }
  return null;
}
