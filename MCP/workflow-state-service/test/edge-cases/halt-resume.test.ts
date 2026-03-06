import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestHarness, type TestHarness } from '../tools/helpers.ts';
import { minimalPhaseConfig } from '../fixtures/phase-configs.ts';

let h: TestHarness;

beforeEach(async () => {
  h = await createTestHarness();
});

afterEach(async () => {
  await h.cleanup();
});

async function createWorkflow(): Promise<string> {
  const result = await h.client.callTool({
    name: 'create-workflow',
    arguments: { featureName: 'HaltTest', phaseConfig: JSON.stringify(minimalPhaseConfig) },
  });
  return (result.structuredContent as any).workflowId;
}

describe('halt/resume edge cases', () => {
  it('halt blocks the current phase', async () => {
    const wfId = await createWorkflow();

    await h.client.callTool({
      name: 'halt-workflow',
      arguments: { workflowId: wfId, reason: 'Need approval' },
    });

    const stateResult = await h.client.callTool({
      name: 'get-state',
      arguments: { workflowId: wfId },
    });
    const sc = stateResult.structuredContent as any;
    assert.equal(sc.state.haltReason, 'Need approval');
    assert.equal(sc.state.phases.work.status, 'blocked');
  });

  it('resume clears halt and restores in-progress', async () => {
    const wfId = await createWorkflow();

    await h.client.callTool({
      name: 'halt-workflow',
      arguments: { workflowId: wfId, reason: 'Paused' },
    });
    await h.client.callTool({
      name: 'resume-workflow',
      arguments: { workflowId: wfId },
    });

    const stateResult = await h.client.callTool({
      name: 'get-state',
      arguments: { workflowId: wfId },
    });
    const sc = stateResult.structuredContent as any;
    assert.equal(sc.state.haltReason, null);
    assert.equal(sc.state.phases.work.status, 'in-progress');
  });

  it('handles multiple halt/resume cycles', async () => {
    const wfId = await createWorkflow();

    for (let i = 0; i < 3; i++) {
      await h.client.callTool({
        name: 'halt-workflow',
        arguments: { workflowId: wfId, reason: `Pause ${i}` },
      });

      const halted = await h.client.callTool({
        name: 'get-state',
        arguments: { workflowId: wfId },
      });
      assert.equal((halted.structuredContent as any).state.phases.work.status, 'blocked');

      await h.client.callTool({
        name: 'resume-workflow',
        arguments: { workflowId: wfId },
      });

      const resumed = await h.client.callTool({
        name: 'get-state',
        arguments: { workflowId: wfId },
      });
      assert.equal((resumed.structuredContent as any).state.phases.work.status, 'in-progress');
    }
  });

  it('halt emits workflow-halted event', async () => {
    const wfId = await createWorkflow();

    await h.client.callTool({
      name: 'halt-workflow',
      arguments: { workflowId: wfId, reason: 'Stop' },
    });

    const events = await h.client.callTool({
      name: 'get-events',
      arguments: { workflowId: wfId, eventType: 'workflow-halted' },
    });
    const sc = events.structuredContent as any;
    assert.ok(sc.events.length >= 1);
  });

  it('resume emits workflow-resumed event', async () => {
    const wfId = await createWorkflow();

    await h.client.callTool({
      name: 'halt-workflow',
      arguments: { workflowId: wfId, reason: 'Stop' },
    });
    await h.client.callTool({
      name: 'resume-workflow',
      arguments: { workflowId: wfId },
    });

    const events = await h.client.callTool({
      name: 'get-events',
      arguments: { workflowId: wfId, eventType: 'phase-started' },
    });
    const sc = events.structuredContent as any;
    assert.ok(sc.events.length >= 2);
  });
});
