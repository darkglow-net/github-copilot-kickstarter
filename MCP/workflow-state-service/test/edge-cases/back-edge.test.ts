import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Kysely } from 'kysely';
import type { Database } from '../../src/db/schema.ts';
import type { PhaseConfig } from '../../src/types.ts';
import { createInMemoryDatabase } from '../../src/db/connection.ts';
import { runMigrations } from '../../src/db/migrator.ts';
import { createWorkflow, getState } from '../../src/services/workflow.ts';
import { submitEvidence } from '../../src/services/evidence.ts';
import { transitionPhase } from '../../src/services/transition.ts';

let db: Kysely<Database>;

const backEdgeConfig: PhaseConfig = {
  phases: [
    { key: 'implement', label: 'Implement', ordinal: 1 },
    { key: 'review', label: 'Review', ordinal: 2 },
  ],
  transitions: [
    { from: 'implement', to: 'review', gateRules: [
      { evidenceCategory: 'test-results', condition: 'must-pass', description: 'Tests pass' },
    ]},
    { from: 'review', to: 'implement', gateRules: [] },
    { from: 'review', to: '_close', gateRules: [] },
  ],
};

beforeEach(async () => {
  db = createInMemoryDatabase();
  await runMigrations(db);
});

afterEach(async () => {
  await db.destroy();
});

describe('back-edge transition edge cases', () => {
  it('clears completedAt and summary on re-entry', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'BackEdge', phaseConfig: backEdgeConfig });

    // Forward: implement → review
    await submitEvidence(db, workflowId, {
      phaseKey: 'implement',
      category: 'test-results',
      data: { passed: 10, failed: 0, total: 10 },
      submittedBy: 'ci',
    });
    await transitionPhase(db, workflowId, {
      from: 'implement',
      to: 'review',
      summary: 'Implementation complete',
      actorKind: 'coordinator',
      actorName: 'orchestrator',
    });

    // Verify implement is completed with summary
    let { state } = await getState(db, workflowId);
    assert.equal(state.phases['implement'].status, 'completed');
    assert.equal(state.phases['implement'].summary, 'Implementation complete');
    assert.ok(state.phases['implement'].completedAt);

    // Back-edge: review → implement
    await transitionPhase(db, workflowId, {
      from: 'review',
      to: 'implement',
      summary: 'Sending back',
      actorKind: 'coordinator',
      actorName: 'orchestrator',
    });

    // Verify implement is reset
    ({ state } = await getState(db, workflowId));
    assert.equal(state.phases['implement'].status, 'in-progress');
    assert.equal(state.phases['implement'].completedAt, null);
    assert.equal(state.phases['implement'].summary, null);
  });

  it('requires fresh evidence for re-exit after back-edge', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'FreshEvidence', phaseConfig: backEdgeConfig });

    // Forward then back
    await submitEvidence(db, workflowId, {
      phaseKey: 'implement',
      category: 'test-results',
      data: { passed: 10, failed: 0, total: 10 },
      submittedBy: 'ci',
    });
    await transitionPhase(db, workflowId, {
      from: 'implement',
      to: 'review',
      summary: 'First pass',
      actorKind: 'coordinator',
      actorName: 'orchestrator',
    });
    await transitionPhase(db, workflowId, {
      from: 'review',
      to: 'implement',
      summary: 'Needs changes',
      actorKind: 'coordinator',
      actorName: 'orchestrator',
    });

    // Submit fresh passing evidence
    await submitEvidence(db, workflowId, {
      phaseKey: 'implement',
      category: 'test-results',
      data: { passed: 12, failed: 0, total: 12 },
      submittedBy: 'ci',
    });

    // Should succeed with fresh evidence
    const result = await transitionPhase(db, workflowId, {
      from: 'implement',
      to: 'review',
      summary: 'Second pass',
      actorKind: 'coordinator',
      actorName: 'orchestrator',
    });
    assert.equal(result.approved, true);
  });

  it('review phase becomes completed on back-edge', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'ReviewStatus', phaseConfig: backEdgeConfig });

    await submitEvidence(db, workflowId, {
      phaseKey: 'implement',
      category: 'test-results',
      data: { passed: 10, failed: 0, total: 10 },
      submittedBy: 'ci',
    });
    await transitionPhase(db, workflowId, {
      from: 'implement',
      to: 'review',
      summary: 'Done',
      actorKind: 'coordinator',
      actorName: 'orchestrator',
    });

    // Back-edge
    await transitionPhase(db, workflowId, {
      from: 'review',
      to: 'implement',
      summary: 'Sending back',
      actorKind: 'coordinator',
      actorName: 'orchestrator',
    });

    const { state } = await getState(db, workflowId);
    assert.equal(state.phases['review'].status, 'completed');
  });
});
