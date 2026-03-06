import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Kysely } from 'kysely';
import type { Database } from '../../src/db/schema.ts';
import { createInMemoryDatabase } from '../../src/db/connection.ts';
import { runMigrations } from '../../src/db/migrator.ts';
import { createWorkflow, getState } from '../../src/services/workflow.ts';
import { submitEvidence } from '../../src/services/evidence.ts';
import { storeContext } from '../../src/services/context.ts';
import { exportWorkflow, closeWorkflow } from '../../src/services/export.ts';
import { minimalPhaseConfig } from '../fixtures/phase-configs.ts';

let db: Kysely<Database>;

beforeEach(async () => {
  db = createInMemoryDatabase();
  await runMigrations(db);
});

afterEach(async () => {
  await db.destroy();
});

describe('exportWorkflow', () => {
  it('returns full ProgressState', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    const result = await exportWorkflow(db, workflowId);

    assert.ok(result.state);
    assert.equal(result.state.feature, 'Test');
  });

  it('includes events', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    const result = await exportWorkflow(db, workflowId);

    assert.ok(Array.isArray(result.events));
    assert.ok(result.events.length > 0, 'Should have at least the workflow-created event');
  });

  it('includes evidence', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    await submitEvidence(db, workflowId, {
      phaseKey: 'work',
      category: 'test-results',
      data: { passed: 10, failed: 0, total: 10 },
      submittedBy: 'ci',
    });

    const result = await exportWorkflow(db, workflowId);

    assert.ok(Array.isArray(result.evidence));
    assert.equal(result.evidence.length, 1);
  });

  it('includes context', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    await storeContext(db, workflowId, {
      category: 'briefing',
      key: 'overview',
      value: 'Project overview',
      authoredBy: 'user',
    });

    const result = await exportWorkflow(db, workflowId);

    assert.ok(Array.isArray(result.context));
    assert.equal(result.context.length, 1);
  });

  it('includes phaseConfig and metadata', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    const result = await exportWorkflow(db, workflowId);

    assert.ok(result.phaseConfig);
    assert.ok(result.workflowId);
    assert.ok(result.featureName);
    assert.ok(result.createdAt);
  });
});

describe('closeWorkflow', () => {
  it('returns export data before purge', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    const result = await closeWorkflow(db, workflowId);

    assert.ok(result.export);
    assert.equal(result.export.state.feature, 'Test');
    assert.equal(result.purged, true);
  });

  it('emits workflow-closed event in the export', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    const result = await closeWorkflow(db, workflowId);

    const closedEvents = result.export.events.filter(
      (e: Record<string, unknown>) => e.eventType === 'workflow-closed',
    );
    assert.equal(closedEvents.length, 1);
  });

  it('deletes workflow row (cascade purge)', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    await closeWorkflow(db, workflowId);

    const workflow = await db
      .selectFrom('workflows')
      .selectAll()
      .where('workflow_id', '=', workflowId)
      .executeTakeFirst();

    assert.equal(workflow, undefined);
  });

  it('cascades deletion to child tables', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    await submitEvidence(db, workflowId, {
      phaseKey: 'work',
      category: 'test-results',
      data: { passed: 10, failed: 0, total: 10 },
      submittedBy: 'ci',
    });
    await storeContext(db, workflowId, {
      category: 'briefing',
      key: 'test',
      value: 'val',
      authoredBy: 'user',
    });

    await closeWorkflow(db, workflowId);

    const stateRows = await db.selectFrom('workflow_state').selectAll().where('workflow_id', '=', workflowId).execute();
    const eventRows = await db.selectFrom('workflow_events').selectAll().where('workflow_id', '=', workflowId).execute();
    const evidenceRows = await db.selectFrom('workflow_evidence').selectAll().where('workflow_id', '=', workflowId).execute();
    const contextRows = await db.selectFrom('workflow_context').selectAll().where('workflow_id', '=', workflowId).execute();

    assert.equal(stateRows.length, 0);
    assert.equal(eventRows.length, 0);
    assert.equal(evidenceRows.length, 0);
    assert.equal(contextRows.length, 0);
  });

  it('subsequent getState fails after close', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    await closeWorkflow(db, workflowId);

    await assert.rejects(
      () => getState(db, workflowId),
      (err: any) => err.code === 'WORKFLOW_NOT_FOUND',
    );
  });
});
