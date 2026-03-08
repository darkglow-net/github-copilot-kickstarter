import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryDatabase } from '../../src/db/connection.ts';
import { runMigrations } from '../../src/db/migrator.ts';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Database } from '../../src/db/schema.ts';

let db: Kysely<Database>;

beforeEach(async () => {
  db = createInMemoryDatabase();
  await runMigrations(db);
});

afterEach(async () => {
  await db.destroy();
});

describe('Database connection', () => {
  it('creates an in-memory database', () => {
    assert.ok(db, 'Database instance should exist');
  });

  it('has WAL journal mode', async () => {
    const result = await sql<{ journal_mode: string }>`PRAGMA journal_mode`.execute(db);
    // In-memory databases may report 'memory' instead of 'wal'
    const mode = result.rows[0].journal_mode;
    assert.ok(mode === 'wal' || mode === 'memory', `Expected wal or memory, got ${mode}`);
  });

  it('has foreign keys enabled', async () => {
    const result = await sql<{ foreign_keys: number }>`PRAGMA foreign_keys`.execute(db);
    assert.equal(result.rows[0].foreign_keys, 1);
  });
});

describe('Migration creates all 5 tables', () => {
  it('creates workflows table', async () => {
    const result = await sql<{ name: string }>`SELECT name FROM sqlite_master WHERE type='table' AND name='workflows'`.execute(db);
    assert.equal(result.rows.length, 1);
  });

  it('creates workflow_state table', async () => {
    const result = await sql<{ name: string }>`SELECT name FROM sqlite_master WHERE type='table' AND name='workflow_state'`.execute(db);
    assert.equal(result.rows.length, 1);
  });

  it('creates workflow_events table', async () => {
    const result = await sql<{ name: string }>`SELECT name FROM sqlite_master WHERE type='table' AND name='workflow_events'`.execute(db);
    assert.equal(result.rows.length, 1);
  });

  it('creates workflow_evidence table', async () => {
    const result = await sql<{ name: string }>`SELECT name FROM sqlite_master WHERE type='table' AND name='workflow_evidence'`.execute(db);
    assert.equal(result.rows.length, 1);
  });

  it('creates workflow_context table', async () => {
    const result = await sql<{ name: string }>`SELECT name FROM sqlite_master WHERE type='table' AND name='workflow_context'`.execute(db);
    assert.equal(result.rows.length, 1);
  });
});

describe('Indexes exist', () => {
  const expectedIndexes = [
    'idx_workflows_updated',
    'idx_events_workflow_seq',
    'idx_events_workflow_type',
    'idx_evidence_workflow_phase_cat',
    'idx_evidence_workflow',
    'idx_context_pk',
    'idx_context_workflow_cat',
  ];

  for (const indexName of expectedIndexes) {
    it(`has index ${indexName}`, async () => {
      const result = await sql<{ name: string }>`SELECT name FROM sqlite_master WHERE type='index' AND name=${indexName}`.execute(db);
      assert.equal(result.rows.length, 1, `Index ${indexName} should exist`);
    });
  }
});

describe('Foreign keys with cascade delete', () => {
  it('cascade deletes workflow_state when workflow is deleted', async () => {
    await db.insertInto('workflows').values({
      workflow_id: 'w1',
      feature_name: 'Test',
      branch_name: null,
      spec_dir: null,
      phase_config_json: '{}',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      closed_at: null,
    }).execute();

    await db.insertInto('workflow_state').values({
      workflow_id: 'w1',
      progress_state_json: '{}',
      current_phase_key: 'research',
    }).execute();

    await db.deleteFrom('workflows').where('workflow_id', '=', 'w1').execute();

    const state = await db.selectFrom('workflow_state').selectAll().where('workflow_id', '=', 'w1').execute();
    assert.equal(state.length, 0, 'workflow_state should be cascade deleted');
  });

  it('cascade deletes workflow_events when workflow is deleted', async () => {
    await db.insertInto('workflows').values({
      workflow_id: 'w2',
      feature_name: 'Test',
      branch_name: null,
      spec_dir: null,
      phase_config_json: '{}',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      closed_at: null,
    }).execute();

    await db.insertInto('workflow_events').values({
      event_id: 'e1',
      workflow_id: 'w2',
      seq: 1,
      timestamp: '2026-01-01T00:00:00Z',
      actor_kind: 'coordinator',
      actor_name: 'test',
      actor_run_id: null,
      phase_key: null,
      event_type: 'workflow-created',
      payload_json: '{}',
    }).execute();

    await db.deleteFrom('workflows').where('workflow_id', '=', 'w2').execute();

    const events = await db.selectFrom('workflow_events').selectAll().where('workflow_id', '=', 'w2').execute();
    assert.equal(events.length, 0, 'workflow_events should be cascade deleted');
  });

  it('cascade deletes workflow_evidence when workflow is deleted', async () => {
    await db.insertInto('workflows').values({
      workflow_id: 'w3',
      feature_name: 'Test',
      branch_name: null,
      spec_dir: null,
      phase_config_json: '{}',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      closed_at: null,
    }).execute();

    await db.insertInto('workflow_evidence').values({
      evidence_id: 'ev1',
      workflow_id: 'w3',
      phase_key: 'research',
      category: 'test-results',
      data_json: '{}',
      gate_result: 'pass',
      submitted_by: 'test',
      submitted_at: '2026-01-01T00:00:00Z',
    }).execute();

    await db.deleteFrom('workflows').where('workflow_id', '=', 'w3').execute();

    const evidence = await db.selectFrom('workflow_evidence').selectAll().where('workflow_id', '=', 'w3').execute();
    assert.equal(evidence.length, 0, 'workflow_evidence should be cascade deleted');
  });

  it('cascade deletes workflow_context when workflow is deleted', async () => {
    await db.insertInto('workflows').values({
      workflow_id: 'w4',
      feature_name: 'Test',
      branch_name: null,
      spec_dir: null,
      phase_config_json: '{}',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      closed_at: null,
    }).execute();

    await db.insertInto('workflow_context').values({
      workflow_id: 'w4',
      category: 'briefing',
      key: 'objective',
      value: 'Build feature X',
      authored_by: 'test',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }).execute();

    await db.deleteFrom('workflows').where('workflow_id', '=', 'w4').execute();

    const context = await db.selectFrom('workflow_context').selectAll().where('workflow_id', '=', 'w4').execute();
    assert.equal(context.length, 0, 'workflow_context should be cascade deleted');
  });

  it('rejects insert with invalid workflow_id foreign key', async () => {
    await assert.rejects(
      () => db.insertInto('workflow_state').values({
        workflow_id: 'nonexistent',
        progress_state_json: '{}',
        current_phase_key: null,
      }).execute(),
      /FOREIGN KEY constraint failed/,
    );
  });
});

describe('Table operations', () => {
  it('can insert and query a workflow', async () => {
    const now = new Date().toISOString();
    await db.insertInto('workflows').values({
      workflow_id: 'test-wf',
      feature_name: 'Test Feature',
      branch_name: 'feat/test',
      spec_dir: 'specs/001',
      phase_config_json: JSON.stringify({ phases: [], transitions: [] }),
      created_at: now,
      updated_at: now,
      closed_at: null,
    }).execute();

    const rows = await db.selectFrom('workflows').selectAll().where('workflow_id', '=', 'test-wf').execute();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].feature_name, 'Test Feature');
    assert.equal(rows[0].branch_name, 'feat/test');
  });

  it('state_version defaults to 1', async () => {
    await db.insertInto('workflows').values({
      workflow_id: 'sv-test',
      feature_name: 'Test',
      branch_name: null,
      spec_dir: null,
      phase_config_json: '{}',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      closed_at: null,
    }).execute();

    await db.insertInto('workflow_state').values({
      workflow_id: 'sv-test',
      progress_state_json: '{}',
      current_phase_key: 'work',
    }).execute();

    const rows = await db.selectFrom('workflow_state').selectAll().where('workflow_id', '=', 'sv-test').execute();
    assert.equal(rows[0].state_version, 1);
  });

  it('enforces unique composite key on workflow_context', async () => {
    await db.insertInto('workflows').values({
      workflow_id: 'ctx-test',
      feature_name: 'Test',
      branch_name: null,
      spec_dir: null,
      phase_config_json: '{}',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      closed_at: null,
    }).execute();

    await db.insertInto('workflow_context').values({
      workflow_id: 'ctx-test',
      category: 'briefing',
      key: 'objective',
      value: 'v1',
      authored_by: 'test',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }).execute();

    await assert.rejects(
      () => db.insertInto('workflow_context').values({
        workflow_id: 'ctx-test',
        category: 'briefing',
        key: 'objective',
        value: 'v2',
        authored_by: 'test',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }).execute(),
      /UNIQUE constraint failed/,
    );
  });
});
