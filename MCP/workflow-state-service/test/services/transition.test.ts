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

const twoPhaseConfig: PhaseConfig = {
  phases: [
    { key: 'build', label: 'Build', ordinal: 1 },
    { key: 'review', label: 'Review', ordinal: 2 },
  ],
  transitions: [
    { from: 'build', to: 'review', gateRules: [
      { evidenceCategory: 'test-results', condition: 'must-pass', description: 'Tests must pass' },
    ]},
    { from: 'review', to: 'build', gateRules: [] },
    { from: 'review', to: '_close', gateRules: [] },
  ],
};

const threePhaseWithShouldPass: PhaseConfig = {
  phases: [
    { key: 'a', label: 'A', ordinal: 1 },
    { key: 'b', label: 'B', ordinal: 2 },
    { key: 'c', label: 'C', ordinal: 3 },
  ],
  transitions: [
    { from: 'a', to: 'b', gateRules: [
      { evidenceCategory: 'checklist', condition: 'should-pass', description: 'Advisory checklist' },
    ]},
    { from: 'b', to: 'c', gateRules: [] },
    { from: 'c', to: '_close', gateRules: [] },
  ],
};

beforeEach(async () => {
  db = createInMemoryDatabase();
  await runMigrations(db);
});

afterEach(async () => {
  await db.destroy();
});

describe('transitionPhase', () => {
  it('succeeds when must-pass gate is satisfied', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: twoPhaseConfig });

    await submitEvidence(db, workflowId, {
      phaseKey: 'build',
      category: 'test-results',
      data: { passed: 10, failed: 0, total: 10 },
      submittedBy: 'ci',
    });

    const result = await transitionPhase(db, workflowId, {
      from: 'build',
      to: 'review',
      summary: 'Build complete',
      actorKind: 'coordinator',
      actorName: 'orchestrator',
    });

    assert.equal(result.approved, true);
    assert.equal(result.warnings.length, 0);

    const { state } = await getState(db, workflowId);
    assert.equal(state.phases['build'].status, 'completed');
    assert.ok(state.phases['build'].completedAt);
    assert.equal(state.phases['review'].status, 'in-progress');
    assert.ok(state.phases['review'].startedAt);
  });

  it('rejects when must-pass gate is not satisfied', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: twoPhaseConfig });

    await submitEvidence(db, workflowId, {
      phaseKey: 'build',
      category: 'test-results',
      data: { passed: 8, failed: 2, total: 10 },
      submittedBy: 'ci',
    });

    const result = await transitionPhase(db, workflowId, {
      from: 'build',
      to: 'review',
      summary: 'Build done',
      actorKind: 'coordinator',
      actorName: 'orchestrator',
    });

    assert.equal(result.approved, false);
    assert.ok(result.unmetGates.length > 0);

    const { state } = await getState(db, workflowId);
    assert.equal(state.phases['build'].status, 'in-progress');
    assert.equal(state.phases['review'].status, 'not-started');
  });

  it('rejects when no evidence for must-pass gate exists', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: twoPhaseConfig });

    const result = await transitionPhase(db, workflowId, {
      from: 'build',
      to: 'review',
      summary: 'Build done',
      actorKind: 'coordinator',
      actorName: 'orchestrator',
    });

    assert.equal(result.approved, false);
    assert.ok(result.unmetGates.length > 0);
  });

  it('warns on failing should-pass gate but allows transition', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: threePhaseWithShouldPass });

    await submitEvidence(db, workflowId, {
      phaseKey: 'a',
      category: 'checklist',
      data: { checklistName: 'review', totalItems: 5, completedItems: 3, failedItems: 2 },
      submittedBy: 'agent',
    });

    const result = await transitionPhase(db, workflowId, {
      from: 'a',
      to: 'b',
      summary: 'Phase A done',
      actorKind: 'coordinator',
      actorName: 'orchestrator',
    });

    assert.equal(result.approved, true);
    assert.ok(result.warnings.length > 0);
  });

  it('rejects non-coordinator actorKind', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: twoPhaseConfig });

    await assert.rejects(
      () => transitionPhase(db, workflowId, {
        from: 'build',
        to: 'review',
        summary: 'Done',
        actorKind: 'agent',
        actorName: 'some-agent',
      }),
      (err: any) => err.code === 'FORBIDDEN',
    );
  });

  it('rejects when from does not match current phase', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: twoPhaseConfig });

    await assert.rejects(
      () => transitionPhase(db, workflowId, {
        from: 'review',
        to: '_close',
        summary: 'Done',
        actorKind: 'coordinator',
        actorName: 'orchestrator',
      }),
      (err: any) => err.code === 'STATE_CONFLICT',
    );
  });

  it('rejects when transition is not defined', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: twoPhaseConfig });

    await assert.rejects(
      () => transitionPhase(db, workflowId, {
        from: 'build',
        to: '_close',
        summary: 'Done',
        actorKind: 'coordinator',
        actorName: 'orchestrator',
      }),
      (err: any) => err.code === 'INVALID_TRANSITION',
    );
  });

  it('handles _close pseudo-phase transition', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: twoPhaseConfig });

    // Move to review first
    await submitEvidence(db, workflowId, {
      phaseKey: 'build',
      category: 'test-results',
      data: { passed: 10, failed: 0, total: 10 },
      submittedBy: 'ci',
    });
    await transitionPhase(db, workflowId, {
      from: 'build',
      to: 'review',
      summary: 'Build complete',
      actorKind: 'coordinator',
      actorName: 'orchestrator',
    });

    // Close from review
    const result = await transitionPhase(db, workflowId, {
      from: 'review',
      to: '_close',
      summary: 'Review complete',
      actorKind: 'coordinator',
      actorName: 'orchestrator',
    });

    assert.equal(result.approved, true);

    const { state } = await getState(db, workflowId);
    assert.equal(state.phases['review'].status, 'completed');

    const stateRow = await db
      .selectFrom('workflow_state')
      .selectAll()
      .where('workflow_id', '=', workflowId)
      .executeTakeFirst();
    assert.equal(stateRow!.current_phase_key, null);

    const wf = await db
      .selectFrom('workflows')
      .selectAll()
      .where('workflow_id', '=', workflowId)
      .executeTakeFirst();
    assert.equal(wf!.closed_at, null, '_close transition should not set closed_at — close-workflow does that');
  });

  it('handles back-edge re-entry (clears completedAt/summary)', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: twoPhaseConfig });

    // Move build -> review
    await submitEvidence(db, workflowId, {
      phaseKey: 'build',
      category: 'test-results',
      data: { passed: 10, failed: 0, total: 10 },
      submittedBy: 'ci',
    });
    await transitionPhase(db, workflowId, {
      from: 'build',
      to: 'review',
      summary: 'Build complete',
      actorKind: 'coordinator',
      actorName: 'orchestrator',
    });

    // Verify build is completed
    let { state } = await getState(db, workflowId);
    assert.equal(state.phases['build'].status, 'completed');
    assert.ok(state.phases['build'].completedAt);

    // Back-edge: review -> build
    const result = await transitionPhase(db, workflowId, {
      from: 'review',
      to: 'build',
      summary: 'Back to build',
      actorKind: 'coordinator',
      actorName: 'orchestrator',
    });

    assert.equal(result.approved, true);

    ({ state } = await getState(db, workflowId));
    assert.equal(state.phases['build'].status, 'in-progress');
    assert.equal(state.phases['build'].completedAt, null);
    assert.equal(state.phases['build'].summary, null);
    assert.equal(state.phases['review'].status, 'completed');
  });

  it('emits transition-requested and transition-approved events on success', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: twoPhaseConfig });

    await submitEvidence(db, workflowId, {
      phaseKey: 'build',
      category: 'test-results',
      data: { passed: 10, failed: 0, total: 10 },
      submittedBy: 'ci',
    });

    await transitionPhase(db, workflowId, {
      from: 'build',
      to: 'review',
      summary: 'Build complete',
      actorKind: 'coordinator',
      actorName: 'orchestrator',
    });

    const events = await db
      .selectFrom('workflow_events')
      .selectAll()
      .where('workflow_id', '=', workflowId)
      .orderBy('seq', 'asc')
      .execute();

    const types = events.map(e => e.event_type);
    assert.ok(types.includes('transition-requested'));
    assert.ok(types.includes('transition-approved'));
    assert.ok(types.includes('phase-completed'));
    assert.ok(types.includes('phase-started'));
  });

  it('emits transition-requested and transition-rejected events on failure', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: twoPhaseConfig });

    await transitionPhase(db, workflowId, {
      from: 'build',
      to: 'review',
      summary: 'Build done',
      actorKind: 'coordinator',
      actorName: 'orchestrator',
    });

    const events = await db
      .selectFrom('workflow_events')
      .selectAll()
      .where('workflow_id', '=', workflowId)
      .orderBy('seq', 'asc')
      .execute();

    const types = events.map(e => e.event_type);
    assert.ok(types.includes('transition-requested'));
    assert.ok(types.includes('transition-rejected'));
  });

  it('allows transition with no gate rules', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: twoPhaseConfig });

    // Move to review first
    await submitEvidence(db, workflowId, {
      phaseKey: 'build',
      category: 'test-results',
      data: { passed: 10, failed: 0, total: 10 },
      submittedBy: 'ci',
    });
    await transitionPhase(db, workflowId, {
      from: 'build',
      to: 'review',
      summary: 'Build complete',
      actorKind: 'coordinator',
      actorName: 'orchestrator',
    });

    // review->build has no gate rules
    const result = await transitionPhase(db, workflowId, {
      from: 'review',
      to: 'build',
      summary: 'Back to build',
      actorKind: 'coordinator',
      actorName: 'orchestrator',
    });

    assert.equal(result.approved, true);
  });

  it('uses latest evidence when multiple submissions exist', async () => {
    const { workflowId } = await createWorkflow(db, { featureName: 'Test', phaseConfig: twoPhaseConfig });

    // First submission fails
    await submitEvidence(db, workflowId, {
      phaseKey: 'build',
      category: 'test-results',
      data: { passed: 8, failed: 2, total: 10 },
      submittedBy: 'ci',
    });

    // Second submission passes
    await submitEvidence(db, workflowId, {
      phaseKey: 'build',
      category: 'test-results',
      data: { passed: 10, failed: 0, total: 10 },
      submittedBy: 'ci',
    });

    const result = await transitionPhase(db, workflowId, {
      from: 'build',
      to: 'review',
      summary: 'Build complete',
      actorKind: 'coordinator',
      actorName: 'orchestrator',
    });

    assert.equal(result.approved, true);
  });
});
