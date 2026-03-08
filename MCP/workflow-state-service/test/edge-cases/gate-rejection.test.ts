import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Kysely } from 'kysely';
import type { Database } from '../../src/db/schema.ts';
import type { PhaseConfig } from '../../src/types.ts';
import { createInMemoryDatabase } from '../../src/db/connection.ts';
import { runMigrations } from '../../src/db/migrator.ts';
import { createWorkflow } from '../../src/services/workflow.ts';
import { submitEvidence } from '../../src/services/evidence.ts';
import { transitionPhase } from '../../src/services/transition.ts';

let db: Kysely<Database>;

const gatedConfig: PhaseConfig = {
  phases: [
    { key: 'build', label: 'Build', ordinal: 1 },
    { key: 'review', label: 'Review', ordinal: 2 },
  ],
  transitions: [
    { from: 'build', to: 'review', gateRules: [
      { evidenceCategory: 'test-results', condition: 'must-pass', description: 'Tests must pass' },
    ]},
    { from: 'review', to: '_close', gateRules: [] },
  ],
};

const advisoryConfig: PhaseConfig = {
  phases: [
    { key: 'a', label: 'A', ordinal: 1 },
    { key: 'b', label: 'B', ordinal: 2 },
  ],
  transitions: [
    { from: 'a', to: 'b', gateRules: [
      { evidenceCategory: 'checklist', condition: 'should-pass', description: 'Advisory' },
    ]},
    { from: 'b', to: '_close', gateRules: [] },
  ],
};

beforeEach(async () => {
  db = createInMemoryDatabase();
  await runMigrations(db);
});

afterEach(async () => {
  await db.destroy();
});

describe('gate rejection edge cases', () => {
  it('rejects transition when no evidence submitted for must-pass gate', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: gatedConfig });

    const result = await transitionPhase(db, workflowId, {
      from: 'build',
      to: 'review',
      summary: 'Done',
      actorKind: 'coordinator',
      actorName: 'orchestrator',
    });

    assert.equal(result.approved, false);
    assert.ok(result.unmetGates.length > 0);
  });

  it('rejects transition when evidence has fail gateResult', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: gatedConfig });

    await submitEvidence(db, workflowId, {
      phaseKey: 'build',
      category: 'test-results',
      data: { passed: 5, failed: 3, total: 8 },
      submittedBy: 'ci',
    });

    const result = await transitionPhase(db, workflowId, {
      from: 'build',
      to: 'review',
      summary: 'Done',
      actorKind: 'coordinator',
      actorName: 'orchestrator',
    });

    assert.equal(result.approved, false);
    assert.ok(result.unmetGates.length > 0);
  });

  it('allows should-pass gate with warning when evidence fails', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: advisoryConfig });

    await submitEvidence(db, workflowId, {
      phaseKey: 'a',
      category: 'checklist',
      data: { checklistName: 'review', totalItems: 5, completedItems: 2, failedItems: 3 },
      submittedBy: 'agent',
    });

    const result = await transitionPhase(db, workflowId, {
      from: 'a',
      to: 'b',
      summary: 'Done',
      actorKind: 'coordinator',
      actorName: 'orchestrator',
    });

    assert.equal(result.approved, true);
    assert.ok(result.warnings.length > 0);
  });

  it('allows should-pass gate with no warning when evidence passes', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: advisoryConfig });

    await submitEvidence(db, workflowId, {
      phaseKey: 'a',
      category: 'checklist',
      data: { checklistName: 'review', totalItems: 5, completedItems: 5, failedItems: 0 },
      submittedBy: 'agent',
    });

    const result = await transitionPhase(db, workflowId, {
      from: 'a',
      to: 'b',
      summary: 'Done',
      actorKind: 'coordinator',
      actorName: 'orchestrator',
    });

    assert.equal(result.approved, true);
    assert.equal(result.warnings.length, 0);
  });
});
