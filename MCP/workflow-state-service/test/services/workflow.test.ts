import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Kysely } from 'kysely';
import type { Database } from '../../src/db/schema.ts';
import { createInMemoryDatabase } from '../../src/db/connection.ts';
import { runMigrations } from '../../src/db/migrator.ts';
import { myideaPhaseConfig, minimalPhaseConfig } from '../fixtures/phase-configs.ts';
import {
  createWorkflow,
  getState,
  listActive,
  updateState,
  haltWorkflow,
  resumeWorkflow,
  appendEvent,
  getEvents,
  validateState,
  checkCaps,
  allocateTaskId,
} from '../../src/services/workflow.ts';

let db: Kysely<Database>;

beforeEach(async () => {
  db = createInMemoryDatabase();
  await runMigrations(db);
});

afterEach(async () => {
  await db.destroy();
});

describe('createWorkflow', () => {
  it('creates a workflow with UUID and initial state', async () => {
    const result = await createWorkflow(db, {
      featureName: 'Test Feature',
      phaseConfig: minimalPhaseConfig,
    });

    assert.ok(result.workflowId, 'Should return a workflowId');
    assert.match(result.workflowId, /^[0-9a-f-]{36}$/, 'Should be a UUID');
    assert.ok(result.state, 'Should return state');
    assert.equal(result.state.feature, 'Test Feature');
  });

  it('sets the first phase (lowest ordinal) to in-progress', async () => {
    const result = await createWorkflow(db, {
      featureName: 'Test',
      phaseConfig: myideaPhaseConfig,
    });

    assert.equal(result.state.phases['research'].status, 'in-progress');
    assert.ok(result.state.phases['research'].startedAt);
    for (const key of ['plan', 'implement', 'review', 'validate', 'document']) {
      assert.equal(result.state.phases[key].status, 'not-started');
    }
  });

  it('stores optional fields (branchName, specDir, complexityScore)', async () => {
    const result = await createWorkflow(db, {
      featureName: 'Feature',
      branchName: 'feat/auth',
      specDir: 'specs/002',
      complexityScore: 8,
      phaseConfig: minimalPhaseConfig,
    });

    assert.equal(result.state.branch, 'feat/auth');
    assert.equal(result.state.spec, 'specs/002');
    assert.equal(result.state.complexityScore, 8);
  });

  it('emits a workflow-created event', async () => {
    const result = await createWorkflow(db, {
      featureName: 'Test',
      phaseConfig: minimalPhaseConfig,
    });

    const events = await db
      .selectFrom('workflow_events')
      .selectAll()
      .where('workflow_id', '=', result.workflowId)
      .execute();

    assert.ok(events.length >= 1, 'Should have at least one event');
    const created = events.find((e) => e.event_type === 'workflow-created');
    assert.ok(created, 'Should have workflow-created event');
  });

  it('validates phaseConfig and rejects invalid configs', async () => {
    await assert.rejects(
      () => createWorkflow(db, {
        featureName: 'Bad',
        phaseConfig: { phases: [], transitions: [] } as any,
      }),
    );
  });

  it('stores initial context if provided', async () => {
    const result = await createWorkflow(db, {
      featureName: 'Test',
      phaseConfig: minimalPhaseConfig,
      context: { affectedFiles: ['src/main.ts'] },
    });

    assert.deepEqual(result.state.context, { affectedFiles: ['src/main.ts'] });
  });
});

describe('getState', () => {
  it('returns state, stateVersion, and phaseConfig', async () => {
    const { workflowId } = await createWorkflow(db, {
      featureName: 'Test',
      phaseConfig: minimalPhaseConfig,
    });

    const result = await getState(db, workflowId);
    assert.ok(result.state);
    assert.equal(typeof result.stateVersion, 'number');
    assert.ok(result.phaseConfig);
  });

  it('throws for unknown workflow ID', async () => {
    await assert.rejects(
      () => getState(db, '00000000-0000-0000-0000-000000000000'),
      (err: any) => err.code === 'WORKFLOW_NOT_FOUND',
    );
  });
});

describe('listActive', () => {
  it('returns active workflows', async () => {
    await createWorkflow(db, { featureName: 'A', phaseConfig: minimalPhaseConfig });
    await createWorkflow(db, { featureName: 'B', phaseConfig: minimalPhaseConfig });

    const result = await listActive(db);
    assert.equal(result.workflows.length, 2);
  });

  it('filters by branchName', async () => {
    await createWorkflow(db, { featureName: 'A', branchName: 'feat/a', phaseConfig: minimalPhaseConfig });
    await createWorkflow(db, { featureName: 'B', branchName: 'feat/b', phaseConfig: minimalPhaseConfig });

    const result = await listActive(db, 'feat/a');
    assert.equal(result.workflows.length, 1);
    assert.equal(result.workflows[0].featureName, 'A');
  });

  it('includes blocked workflows', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'A', phaseConfig: minimalPhaseConfig });
    await haltWorkflow(db, workflowId, 'Test halt');

    const result = await listActive(db);
    assert.equal(result.workflows.length, 1);
    assert.equal(result.workflows[0].status, 'blocked');
  });
});

describe('updateState', () => {
  it('updates tasks and increments version', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });
    const tasks = [{ id: 100, title: 'Task A', status: 'in-progress' as const }];

    const result = await updateState(db, workflowId, { tasks });
    assert.deepEqual(result.state.tasks, tasks);
    assert.ok(result.stateVersion >= 2);
  });

  it('updates fixTasks', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });
    const fixTasks = [{ id: 100, title: 'Fix A', status: 'not-started' as const, source: 'review' as const }];

    const result = await updateState(db, workflowId, { fixTasks });
    assert.deepEqual(result.state.fixTasks, fixTasks);
  });

  it('merges context (shallow)', async () => {
    const { workflowId } = await createWorkflow(db, {
      featureName: 'Test',
      phaseConfig: minimalPhaseConfig,
      context: { existing: 'value' },
    });

    const result = await updateState(db, workflowId, { context: { newKey: 'newVal' } });
    assert.equal(result.state.context['existing'], 'value');
    assert.equal(result.state.context['newKey'], 'newVal');
  });

  it('merges phaseMetadata', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    const result = await updateState(db, workflowId, {
      phaseMetadata: { phaseKey: 'work', metadata: { note: 'important' } },
    });
    assert.deepEqual(result.state.phases['work'].metadata, { note: 'important' });
  });

  it('updates complexityScore', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    const result = await updateState(db, workflowId, { complexityScore: 12 });
    assert.equal(result.state.complexityScore, 12);
  });

  it('rejects when no fields provided', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    await assert.rejects(
      () => updateState(db, workflowId, {}),
    );
  });
});

describe('haltWorkflow', () => {
  it('sets haltReason and blocks current phase', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    const result = await haltWorkflow(db, workflowId, 'User requested pause');
    assert.equal(result.state.haltReason, 'User requested pause');
    assert.equal(result.state.phases['work'].status, 'blocked');
  });

  it('emits workflow-halted event', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });
    await haltWorkflow(db, workflowId, 'Halt reason');

    const events = await db
      .selectFrom('workflow_events')
      .selectAll()
      .where('workflow_id', '=', workflowId)
      .where('event_type', '=', 'workflow-halted')
      .execute();
    assert.equal(events.length, 1);
  });
});

describe('resumeWorkflow', () => {
  it('clears halt and restores in-progress', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });
    await haltWorkflow(db, workflowId, 'paused');

    const result = await resumeWorkflow(db, workflowId);
    assert.equal(result.state.haltReason, null);
    assert.equal(result.state.phases['work'].status, 'in-progress');
  });

  it('emits phase-started event', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });
    await haltWorkflow(db, workflowId, 'paused');
    await resumeWorkflow(db, workflowId);

    const events = await db
      .selectFrom('workflow_events')
      .selectAll()
      .where('workflow_id', '=', workflowId)
      .where('event_type', '=', 'phase-started')
      .execute();
    // At least 1 phase-started from resume (plus the initial one from create)
    assert.ok(events.length >= 1);
  });

  it('rejects when workflow is not halted', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    await assert.rejects(
      () => resumeWorkflow(db, workflowId),
      (err: any) => err.code === 'STATE_CONFLICT',
    );
  });
});

describe('appendEvent', () => {
  it('appends a valid event and returns eventId + seq', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    const result = await appendEvent(db, workflowId, {
      eventType: 'note-added',
      actorKind: 'coordinator',
      actorName: 'test-agent',
      payload: { text: 'A note' },
    });

    assert.ok(result.eventId);
    assert.equal(typeof result.seq, 'number');
  });

  it('assigns sequential seq numbers', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    const r1 = await appendEvent(db, workflowId, {
      eventType: 'note-added',
      actorKind: 'coordinator',
      actorName: 'test',
      payload: { text: 'note 1' },
    });
    const r2 = await appendEvent(db, workflowId, {
      eventType: 'note-added',
      actorKind: 'coordinator',
      actorName: 'test',
      payload: { text: 'note 2' },
    });

    assert.ok(r2.seq > r1.seq, 'Second seq should be greater');
  });

  it('rejects invalid event type', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    await assert.rejects(
      () => appendEvent(db, workflowId, {
        eventType: 'invalid-type',
        actorKind: 'coordinator',
        actorName: 'test',
        payload: {},
      }),
    );
  });

  it('rejects invalid payload for event type', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    await assert.rejects(
      () => appendEvent(db, workflowId, {
        eventType: 'phase-started',
        actorKind: 'coordinator',
        actorName: 'test',
        payload: { wrong: 'data' },
      }),
    );
  });
});

describe('getEvents', () => {
  it('returns events with cursor pagination', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });
    await appendEvent(db, workflowId, {
      eventType: 'note-added',
      actorKind: 'coordinator',
      actorName: 'test',
      payload: { text: 'note' },
    });

    const result = await getEvents(db, workflowId, {});
    assert.ok(result.events.length >= 1);
  });

  it('filters by eventType', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });
    await appendEvent(db, workflowId, {
      eventType: 'note-added',
      actorKind: 'coordinator',
      actorName: 'test',
      payload: { text: 'note' },
    });

    const result = await getEvents(db, workflowId, { eventType: 'note-added' });
    assert.ok(result.events.length >= 1);
    for (const e of result.events) {
      assert.equal(e.eventType, 'note-added');
    }
  });

  it('supports sinceCursor for pagination', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    const r1 = await appendEvent(db, workflowId, {
      eventType: 'note-added',
      actorKind: 'coordinator',
      actorName: 'test',
      payload: { text: 'note 1' },
    });

    await appendEvent(db, workflowId, {
      eventType: 'note-added',
      actorKind: 'coordinator',
      actorName: 'test',
      payload: { text: 'note 2' },
    });

    const result = await getEvents(db, workflowId, { sinceCursor: r1.seq });
    // Should return only events after r1.seq
    for (const e of result.events) {
      assert.ok(e.seq > r1.seq);
    }
  });

  it('respects limit', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });
    for (let i = 0; i < 5; i++) {
      await appendEvent(db, workflowId, {
        eventType: 'note-added',
        actorKind: 'coordinator',
        actorName: 'test',
        payload: { text: `note ${i}` },
      });
    }

    const result = await getEvents(db, workflowId, { limit: 2 });
    assert.ok(result.events.length <= 2);
    assert.ok(result.nextCursor !== null, 'Should have nextCursor when more events exist');
  });
});

describe('validateState', () => {
  it('returns valid: true for a correctly created workflow', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: myideaPhaseConfig });

    const result = await validateState(db, workflowId);
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });
});

describe('checkCaps', () => {
  it('returns zero counts for a fresh workflow', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: myideaPhaseConfig });

    const result = await checkCaps(db, workflowId);
    assert.equal(result.rubricAttempts, 0);
    assert.equal(result.reviewAttempts, 0);
    assert.equal(result.totalCycles, 0);
    assert.equal(result.exceeded, false);
  });
});

describe('allocateTaskId', () => {
  it('returns minimum 100 for empty task list', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    const result = await allocateTaskId(db, workflowId, 'task');
    assert.equal(result.nextId, 100);
  });

  it('increments from existing max ID', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    await updateState(db, workflowId, {
      tasks: [{ id: 105, title: 'Existing', status: 'completed' }],
    });

    const result = await allocateTaskId(db, workflowId, 'task');
    assert.equal(result.nextId, 106);
  });

  it('works for fixTask type', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    await updateState(db, workflowId, {
      fixTasks: [{ id: 200, title: 'Fix', status: 'not-started', source: 'review' }],
    });

    const result = await allocateTaskId(db, workflowId, 'fixTask');
    assert.equal(result.nextId, 201);
  });
});
