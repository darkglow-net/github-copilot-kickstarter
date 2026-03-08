import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Kysely } from 'kysely';
import type { Database } from '../../src/db/schema.ts';
import { createInMemoryDatabase } from '../../src/db/connection.ts';
import { runMigrations } from '../../src/db/migrator.ts';
import { createWorkflow } from '../../src/services/workflow.ts';
import { purgeOrphans } from '../../src/services/retention.ts';
import { minimalPhaseConfig } from '../fixtures/phase-configs.ts';

let db: Kysely<Database>;

beforeEach(async () => {
  db = createInMemoryDatabase();
  await runMigrations(db);
});

afterEach(async () => {
  await db.destroy();
});

describe('purgeOrphans', () => {
  it('deletes workflows older than TTL', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Old', phaseConfig: minimalPhaseConfig });

    // Backdate updated_at to 10 days ago
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    await db.updateTable('workflows')
      .set({ updated_at: tenDaysAgo })
      .where('workflow_id', '=', workflowId)
      .execute();

    const result = await purgeOrphans(db, 7);

    assert.equal(result.purgedCount, 1);
    assert.ok(result.purgedIds.includes(workflowId));

    const remaining = await db.selectFrom('workflows').selectAll().execute();
    assert.equal(remaining.length, 0);
  });

  it('does not delete recent workflows', async () => {
    await createWorkflow(db, { featureName: 'Recent', phaseConfig: minimalPhaseConfig });

    const result = await purgeOrphans(db, 7);

    assert.equal(result.purgedCount, 0);

    const remaining = await db.selectFrom('workflows').selectAll().execute();
    assert.equal(remaining.length, 1);
  });

  it('does not delete closed workflows (closed_at is set)', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Closed', phaseConfig: minimalPhaseConfig });

    // Backdate and close
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    await db.updateTable('workflows')
      .set({ updated_at: tenDaysAgo, closed_at: tenDaysAgo })
      .where('workflow_id', '=', workflowId)
      .execute();

    const result = await purgeOrphans(db, 7);

    assert.equal(result.purgedCount, 0);
  });

  it('handles mixed old and recent workflows', async () => {
    const { workflowId: oldId } = await createWorkflow(db, { featureName: 'Old', phaseConfig: minimalPhaseConfig });
    await createWorkflow(db, { featureName: 'Recent', phaseConfig: minimalPhaseConfig });

    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    await db.updateTable('workflows')
      .set({ updated_at: tenDaysAgo })
      .where('workflow_id', '=', oldId)
      .execute();

    const result = await purgeOrphans(db, 7);

    assert.equal(result.purgedCount, 1);

    const remaining = await db.selectFrom('workflows').selectAll().execute();
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].feature_name, 'Recent');
  });

  it('cascade deletes child rows', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Old', phaseConfig: minimalPhaseConfig });

    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    await db.updateTable('workflows')
      .set({ updated_at: tenDaysAgo })
      .where('workflow_id', '=', workflowId)
      .execute();

    await purgeOrphans(db, 7);

    const stateRows = await db.selectFrom('workflow_state').selectAll().where('workflow_id', '=', workflowId).execute();
    const eventRows = await db.selectFrom('workflow_events').selectAll().where('workflow_id', '=', workflowId).execute();

    assert.equal(stateRows.length, 0);
    assert.equal(eventRows.length, 0);
  });

  it('returns empty when no workflows exist', async () => {
    const result = await purgeOrphans(db, 7);
    assert.equal(result.purgedCount, 0);
    assert.deepEqual(result.purgedIds, []);
  });
});
