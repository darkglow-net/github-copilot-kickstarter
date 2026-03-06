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

describe('concurrent workflow isolation', () => {
  it('two workflows do not share state', async () => {
    const r1 = await h.client.callTool({
      name: 'create-workflow',
      arguments: { featureName: 'Alpha', phaseConfig: JSON.stringify(minimalPhaseConfig) },
    });
    const r2 = await h.client.callTool({
      name: 'create-workflow',
      arguments: { featureName: 'Beta', phaseConfig: JSON.stringify(minimalPhaseConfig) },
    });
    const wf1 = (r1.structuredContent as any).workflowId;
    const wf2 = (r2.structuredContent as any).workflowId;

    // Mutate wf1 only
    await h.client.callTool({
      name: 'update-state',
      arguments: {
        workflowId: wf1,
        tasks: JSON.stringify([{ id: 100, description: 'Task A', status: 'pending' }]),
      },
    });

    // Verify wf2 is unaffected
    const state2 = await h.client.callTool({
      name: 'get-state',
      arguments: { workflowId: wf2 },
    });
    const sc2 = state2.structuredContent as any;
    assert.deepEqual(sc2.state.tasks, []);
  });

  it('list-active returns both workflows', async () => {
    await h.client.callTool({
      name: 'create-workflow',
      arguments: { featureName: 'Alpha', phaseConfig: JSON.stringify(minimalPhaseConfig) },
    });
    await h.client.callTool({
      name: 'create-workflow',
      arguments: { featureName: 'Beta', phaseConfig: JSON.stringify(minimalPhaseConfig) },
    });

    const result = await h.client.callTool({
      name: 'list-active',
      arguments: {},
    });
    const sc = result.structuredContent as any;
    assert.equal(sc.workflows.length, 2);
  });

  it('events from one workflow do not appear in another', async () => {
    const r1 = await h.client.callTool({
      name: 'create-workflow',
      arguments: { featureName: 'Alpha', phaseConfig: JSON.stringify(minimalPhaseConfig) },
    });
    const r2 = await h.client.callTool({
      name: 'create-workflow',
      arguments: { featureName: 'Beta', phaseConfig: JSON.stringify(minimalPhaseConfig) },
    });
    const wf1 = (r1.structuredContent as any).workflowId;
    const wf2 = (r2.structuredContent as any).workflowId;

    await h.client.callTool({
      name: 'append-event',
      arguments: {
        workflowId: wf1,
        eventType: 'custom',
        actorKind: 'coordinator',
        actorName: 'test',
        payload: JSON.stringify({ note: 'wf1 only' }),
      },
    });

    const events2 = await h.client.callTool({
      name: 'get-events',
      arguments: { workflowId: wf2, eventType: 'custom' },
    });
    const sc = events2.structuredContent as any;
    assert.equal(sc.events.length, 0);
  });
});
