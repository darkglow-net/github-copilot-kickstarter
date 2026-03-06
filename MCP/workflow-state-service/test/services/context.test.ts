import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Kysely } from 'kysely';
import type { Database } from '../../src/db/schema.ts';
import { createInMemoryDatabase } from '../../src/db/connection.ts';
import { runMigrations } from '../../src/db/migrator.ts';
import { createWorkflow } from '../../src/services/workflow.ts';
import { storeContext, getContext, getBriefing } from '../../src/services/context.ts';
import { minimalPhaseConfig } from '../fixtures/phase-configs.ts';

let db: Kysely<Database>;

beforeEach(async () => {
  db = createInMemoryDatabase();
  await runMigrations(db);
});

afterEach(async () => {
  await db.destroy();
});

describe('storeContext', () => {
  it('stores a briefing entry', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    const result = await storeContext(db, workflowId, {
      category: 'briefing',
      key: 'overview',
      value: 'This is a test project',
      authoredBy: 'user',
    });

    assert.equal(result.created, true);
  });

  it('stores a delegation entry', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    const result = await storeContext(db, workflowId, {
      category: 'delegation',
      key: 'agent-task',
      value: 'Implement feature X',
      authoredBy: 'coordinator',
    });

    assert.equal(result.created, true);
  });

  it('stores a decision entry', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    const result = await storeContext(db, workflowId, {
      category: 'decision',
      key: 'tech-choice',
      value: 'Use SQLite for storage',
      authoredBy: 'architect',
    });

    assert.equal(result.created, true);
  });

  it('upserts when same category+key exists', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    await storeContext(db, workflowId, {
      category: 'briefing',
      key: 'overview',
      value: 'v1',
      authoredBy: 'user',
    });

    await storeContext(db, workflowId, {
      category: 'briefing',
      key: 'overview',
      value: 'v2',
      authoredBy: 'user',
    });

    const result = await getContext(db, workflowId, {});
    const overviews = result.entries.filter(e => e.key === 'overview');
    assert.equal(overviews.length, 1);
    assert.equal(overviews[0].value, 'v2');
  });

  it('rejects invalid category', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    await assert.rejects(
      () => storeContext(db, workflowId, {
        category: 'invalid',
        key: 'test',
        value: 'test',
        authoredBy: 'user',
      }),
      (err: any) => err.code === 'VALIDATION_FAILED',
    );
  });

  it('emits context-updated event', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    await storeContext(db, workflowId, {
      category: 'briefing',
      key: 'overview',
      value: 'Test',
      authoredBy: 'user',
    });

    const events = await db
      .selectFrom('workflow_events')
      .selectAll()
      .where('workflow_id', '=', workflowId)
      .where('event_type', '=', 'context-stored')
      .execute();

    assert.equal(events.length, 1);
  });
});

describe('getContext', () => {
  it('returns all context entries', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    await storeContext(db, workflowId, { category: 'briefing', key: 'a', value: 'va', authoredBy: 'user' });
    await storeContext(db, workflowId, { category: 'decision', key: 'b', value: 'vb', authoredBy: 'user' });

    const result = await getContext(db, workflowId, {});
    assert.equal(result.entries.length, 2);
  });

  it('filters by category', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    await storeContext(db, workflowId, { category: 'briefing', key: 'a', value: 'va', authoredBy: 'user' });
    await storeContext(db, workflowId, { category: 'decision', key: 'b', value: 'vb', authoredBy: 'user' });

    const result = await getContext(db, workflowId, { category: 'briefing' });
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].category, 'briefing');
  });
});

describe('getBriefing', () => {
  it('returns only briefing entries', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    await storeContext(db, workflowId, { category: 'briefing', key: 'overview', value: 'Project overview', authoredBy: 'user' });
    await storeContext(db, workflowId, { category: 'briefing', key: 'goals', value: 'Project goals', authoredBy: 'user' });
    await storeContext(db, workflowId, { category: 'decision', key: 'tech', value: 'Tech stack', authoredBy: 'user' });

    const result = await getBriefing(db, workflowId);
    assert.equal(result.briefing.length, 2);
  });

  it('returns empty array when no briefing exists', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    const result = await getBriefing(db, workflowId);
    assert.equal(result.briefing.length, 0);
  });
});
