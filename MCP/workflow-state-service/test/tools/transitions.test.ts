import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestHarness, type TestHarness } from './helpers.ts';
import { myideaPhaseConfig, minimalPhaseConfig } from '../fixtures/phase-configs.ts';

let h: TestHarness;

beforeEach(async () => {
  h = await createTestHarness();
});

afterEach(async () => {
  await h.cleanup();
});

async function createWorkflowWithConfig(config: object): Promise<string> {
  const result = await h.client.callTool({
    name: 'create-workflow',
    arguments: { featureName: 'Trans', phaseConfig: JSON.stringify(config) },
  });
  return (result.structuredContent as any).workflowId;
}

describe('transition-phase tool', () => {
  it('approves transition with no gate rules', async () => {
    const wfId = await createWorkflowWithConfig(myideaPhaseConfig);

    // research → plan has should-pass checklist gate (no must-pass)
    const result = await h.client.callTool({
      name: 'transition-phase',
      arguments: {
        workflowId: wfId,
        from: 'research',
        to: 'plan',
        summary: 'Research done',
        actorKind: 'coordinator',
        actorName: 'test',
      },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.equal(sc.approved, true);
  });

  it('rejects transition when must-pass evidence is missing', async () => {
    const wfId = await createWorkflowWithConfig(myideaPhaseConfig);

    // Move to plan first (no must-pass gates)
    await h.client.callTool({
      name: 'transition-phase',
      arguments: { workflowId: wfId, from: 'research', to: 'plan', summary: 'Done', actorKind: 'coordinator', actorName: 'test' },
    });

    // Move to implement (no gates)
    await h.client.callTool({
      name: 'transition-phase',
      arguments: { workflowId: wfId, from: 'plan', to: 'implement', summary: 'Done', actorKind: 'coordinator', actorName: 'test' },
    });

    // implement → review requires must-pass test-results and error-diagnostic
    const result = await h.client.callTool({
      name: 'transition-phase',
      arguments: {
        workflowId: wfId,
        from: 'implement',
        to: 'review',
        summary: 'Impl done',
        actorKind: 'coordinator',
        actorName: 'test',
      },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.equal(sc.approved, false);
    assert.ok(sc.unmetGates.length >= 1);
  });

  it('rejects non-coordinator actorKind', async () => {
    const wfId = await createWorkflowWithConfig(minimalPhaseConfig);

    const result = await h.client.callTool({
      name: 'transition-phase',
      arguments: {
        workflowId: wfId,
        from: 'work',
        to: '_close',
        summary: 'Done',
        actorKind: 'agent',
        actorName: 'test',
      },
    });

    assert.equal(result.isError, true);
    const sc = result.structuredContent as any;
    assert.equal(sc.code, 'FORBIDDEN');
  });

  it('approves transition after submitting required evidence', async () => {
    const wfId = await createWorkflowWithConfig(myideaPhaseConfig);

    // research → plan → implement
    await h.client.callTool({
      name: 'transition-phase',
      arguments: { workflowId: wfId, from: 'research', to: 'plan', summary: 'Done', actorKind: 'coordinator', actorName: 'test' },
    });
    await h.client.callTool({
      name: 'transition-phase',
      arguments: { workflowId: wfId, from: 'plan', to: 'implement', summary: 'Done', actorKind: 'coordinator', actorName: 'test' },
    });

    // Submit required evidence for implement → review
    await h.client.callTool({
      name: 'submit-evidence',
      arguments: {
        workflowId: wfId,
        phaseKey: 'implement',
        category: 'test-results',
        data: JSON.stringify({ passed: 10, failed: 0, total: 10 }),
        submittedBy: 'ci',
      },
    });
    await h.client.callTool({
      name: 'submit-evidence',
      arguments: {
        workflowId: wfId,
        phaseKey: 'implement',
        category: 'error-diagnostic',
        data: JSON.stringify({ source: 'tsc', errors: 0, warnings: 0 }),
        submittedBy: 'ci',
      },
    });

    const result = await h.client.callTool({
      name: 'transition-phase',
      arguments: {
        workflowId: wfId,
        from: 'implement',
        to: 'review',
        summary: 'All done',
        actorKind: 'coordinator',
        actorName: 'test',
      },
    });

    const sc = result.structuredContent as any;
    assert.equal(sc.approved, true);
  });

  it('handles transition to _close', async () => {
    const wfId = await createWorkflowWithConfig(minimalPhaseConfig);

    const result = await h.client.callTool({
      name: 'transition-phase',
      arguments: {
        workflowId: wfId,
        from: 'work',
        to: '_close',
        summary: 'Work done',
        actorKind: 'coordinator',
        actorName: 'test',
      },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.equal(sc.approved, true);
  });

  it('rejects transition from wrong phase', async () => {
    const wfId = await createWorkflowWithConfig(myideaPhaseConfig);
    // Current is research, trying from plan
    const result = await h.client.callTool({
      name: 'transition-phase',
      arguments: {
        workflowId: wfId,
        from: 'plan',
        to: 'implement',
        summary: 'Done',
        actorKind: 'coordinator',
        actorName: 'test',
      },
    });

    assert.equal(result.isError, true);
    const sc = result.structuredContent as any;
    assert.equal(sc.code, 'STATE_CONFLICT');
  });
});
