import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Kysely } from 'kysely';
import type { Database } from '../../src/db/schema.ts';
import { createInMemoryDatabase } from '../../src/db/connection.ts';
import { runMigrations } from '../../src/db/migrator.ts';
import { createWorkflow } from '../../src/services/workflow.ts';
import { submitEvidence, getEvidence } from '../../src/services/evidence.ts';
import { minimalPhaseConfig } from '../fixtures/phase-configs.ts';

let db: Kysely<Database>;

beforeEach(async () => {
  db = createInMemoryDatabase();
  await runMigrations(db);
});

afterEach(async () => {
  await db.destroy();
});

describe('submitEvidence', () => {
  it('stores test-results evidence and computes gateResult pass', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    const result = await submitEvidence(db, workflowId, {
      phaseKey: 'work',
      category: 'test-results',
      data: { passed: 10, failed: 0, total: 10 },
      submittedBy: 'test-agent',
    });

    assert.ok(result.evidenceId);
    assert.equal(result.gateResult, 'pass');
  });

  it('computes gateResult fail for failing tests', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    const result = await submitEvidence(db, workflowId, {
      phaseKey: 'work',
      category: 'test-results',
      data: { passed: 8, failed: 2, total: 10 },
      submittedBy: 'test-agent',
    });

    assert.equal(result.gateResult, 'fail');
  });

  it('stores error-diagnostic evidence', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    const result = await submitEvidence(db, workflowId, {
      phaseKey: 'work',
      category: 'error-diagnostic',
      data: { source: 'tsc', errors: 0, warnings: 3 },
      submittedBy: 'lint-agent',
    });

    assert.equal(result.gateResult, 'pass');
  });

  it('stores checklist evidence', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    const result = await submitEvidence(db, workflowId, {
      phaseKey: 'work',
      category: 'checklist',
      data: { checklistName: 'pre-review', totalItems: 5, completedItems: 5, failedItems: 0 },
      submittedBy: 'agent',
    });

    assert.equal(result.gateResult, 'pass');
  });

  it('stores agent-completion evidence', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    const result = await submitEvidence(db, workflowId, {
      phaseKey: 'work',
      category: 'agent-completion',
      data: { agentName: 'impl', taskDescription: 'Build', status: 'completed', summary: 'Done' },
      submittedBy: 'impl',
    });

    assert.equal(result.gateResult, 'pass');
  });

  it('stores code-review evidence', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    const result = await submitEvidence(db, workflowId, {
      phaseKey: 'work',
      category: 'code-review',
      data: { reviewer: 'dev', reviewerType: 'human', verdict: 'approved', findingCount: 0, criticalFindings: 0 },
      submittedBy: 'review-tool',
    });

    assert.equal(result.gateResult, 'pass');
  });

  it('stores custom evidence', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    const result = await submitEvidence(db, workflowId, {
      phaseKey: 'work',
      category: 'custom',
      data: { label: 'Manual check', payload: { ok: true }, passed: true },
      submittedBy: 'human',
    });

    assert.equal(result.gateResult, 'pass');
  });

  it('rejects invalid category', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    await assert.rejects(
      () => submitEvidence(db, workflowId, {
        phaseKey: 'work',
        category: 'invalid-category',
        data: {},
        submittedBy: 'test',
      }),
      (err: any) => err.code === 'INVALID_CATEGORY',
    );
  });

  it('rejects invalid data for category', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    await assert.rejects(
      () => submitEvidence(db, workflowId, {
        phaseKey: 'work',
        category: 'test-results',
        data: { invalid: 'data' },
        submittedBy: 'test',
      }),
      (err: any) => err.code === 'VALIDATION_FAILED',
    );
  });

  it('emits evidence-submitted event', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    await submitEvidence(db, workflowId, {
      phaseKey: 'work',
      category: 'test-results',
      data: { passed: 5, failed: 0, total: 5 },
      submittedBy: 'test',
    });

    const events = await db
      .selectFrom('workflow_events')
      .selectAll()
      .where('workflow_id', '=', workflowId)
      .where('event_type', '=', 'evidence-submitted')
      .execute();

    assert.equal(events.length, 1);
  });

  it('allows multiple submissions for same category+phase', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    await submitEvidence(db, workflowId, {
      phaseKey: 'work',
      category: 'test-results',
      data: { passed: 8, failed: 2, total: 10 },
      submittedBy: 'test',
    });

    const result2 = await submitEvidence(db, workflowId, {
      phaseKey: 'work',
      category: 'test-results',
      data: { passed: 10, failed: 0, total: 10 },
      submittedBy: 'test',
    });

    assert.equal(result2.gateResult, 'pass');

    const evidence = await db
      .selectFrom('workflow_evidence')
      .selectAll()
      .where('workflow_id', '=', workflowId)
      .where('category', '=', 'test-results')
      .execute();

    assert.equal(evidence.length, 2, 'Both submissions should be preserved');
  });
});

describe('getEvidence', () => {
  it('returns all evidence for a workflow', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    await submitEvidence(db, workflowId, {
      phaseKey: 'work',
      category: 'test-results',
      data: { passed: 10, failed: 0, total: 10 },
      submittedBy: 'test',
    });
    await submitEvidence(db, workflowId, {
      phaseKey: 'work',
      category: 'error-diagnostic',
      data: { source: 'tsc', errors: 0, warnings: 0 },
      submittedBy: 'test',
    });

    const result = await getEvidence(db, workflowId, {});
    assert.equal(result.evidence.length, 2);
  });

  it('filters by phaseKey', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    await submitEvidence(db, workflowId, {
      phaseKey: 'work',
      category: 'test-results',
      data: { passed: 10, failed: 0, total: 10 },
      submittedBy: 'test',
    });
    await submitEvidence(db, workflowId, {
      phaseKey: 'other',
      category: 'test-results',
      data: { passed: 5, failed: 0, total: 5 },
      submittedBy: 'test',
    });

    const result = await getEvidence(db, workflowId, { phaseKey: 'work' });
    assert.equal(result.evidence.length, 1);
  });

  it('filters by category', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    await submitEvidence(db, workflowId, {
      phaseKey: 'work',
      category: 'test-results',
      data: { passed: 10, failed: 0, total: 10 },
      submittedBy: 'test',
    });
    await submitEvidence(db, workflowId, {
      phaseKey: 'work',
      category: 'error-diagnostic',
      data: { source: 'tsc', errors: 0, warnings: 0 },
      submittedBy: 'test',
    });

    const result = await getEvidence(db, workflowId, { category: 'test-results' });
    assert.equal(result.evidence.length, 1);
    assert.equal(result.evidence[0].category, 'test-results');
  });

  it('filters by both phaseKey and category', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: minimalPhaseConfig });

    await submitEvidence(db, workflowId, {
      phaseKey: 'work',
      category: 'test-results',
      data: { passed: 10, failed: 0, total: 10 },
      submittedBy: 'test',
    });

    const result = await getEvidence(db, workflowId, { phaseKey: 'work', category: 'test-results' });
    assert.equal(result.evidence.length, 1);
  });
});
