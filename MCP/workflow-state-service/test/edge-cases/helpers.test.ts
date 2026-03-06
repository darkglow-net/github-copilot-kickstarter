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
    arguments: { featureName: 'HelperTest', phaseConfig: JSON.stringify(minimalPhaseConfig) },
  });
  return (result.structuredContent as any).workflowId;
}

describe('allocate-task-id edge cases', () => {
  it('returns minimum 100 for empty task list', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'allocate-task-id',
      arguments: { workflowId: wfId },
    });

    const sc = result.structuredContent as any;
    assert.ok(sc.nextId >= 100);
  });

  it('returns max(existing) + 1 when tasks exist', async () => {
    const wfId = await createWorkflow();

    await h.client.callTool({
      name: 'update-state',
      arguments: {
        workflowId: wfId,
        tasks: JSON.stringify([
          { id: 100, description: 'A', status: 'pending' },
          { id: 105, description: 'B', status: 'pending' },
        ]),
      },
    });

    const result = await h.client.callTool({
      name: 'allocate-task-id',
      arguments: { workflowId: wfId, type: 'task' },
    });

    const sc = result.structuredContent as any;
    assert.ok(sc.nextId > 105);
  });

  it('considers fixTasks when allocating fixTask ID', async () => {
    const wfId = await createWorkflow();

    await h.client.callTool({
      name: 'update-state',
      arguments: {
        workflowId: wfId,
        fixTasks: JSON.stringify([
          { id: 200, description: 'Fix A', status: 'pending', parentTaskId: 100 },
        ]),
      },
    });

    const result = await h.client.callTool({
      name: 'allocate-task-id',
      arguments: { workflowId: wfId, taskType: 'fixTask' },
    });

    const sc = result.structuredContent as any;
    assert.ok(sc.nextId > 200);
  });
});

describe('get-briefing edge cases', () => {
  it('includes entries from all 3 context categories', async () => {
    const wfId = await createWorkflow();

    await h.client.callTool({
      name: 'store-context',
      arguments: { workflowId: wfId, category: 'briefing', key: 'goal', value: 'Build it', authoredBy: 'coord' },
    });
    await h.client.callTool({
      name: 'store-context',
      arguments: { workflowId: wfId, category: 'decision', key: 'tech', value: 'TypeScript', authoredBy: 'user' },
    });
    await h.client.callTool({
      name: 'store-context',
      arguments: { workflowId: wfId, category: 'delegation', key: 'impl', value: 'speckit.implement', authoredBy: 'coord' },
    });

    const result = await h.client.callTool({
      name: 'get-briefing',
      arguments: { workflowId: wfId },
    });

    const sc = result.structuredContent as any;
    assert.ok(sc.briefing.length >= 1);
    assert.ok(sc.decisions.length >= 1);
    assert.ok(sc.delegations.length >= 1);
  });

  it('returns empty arrays when no context stored', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'get-briefing',
      arguments: { workflowId: wfId },
    });

    const sc = result.structuredContent as any;
    assert.deepEqual(sc.briefing, []);
    assert.deepEqual(sc.decisions, []);
    assert.deepEqual(sc.delegations, []);
  });
});

describe('check-caps edge cases', () => {
  it('returns cap data for a fresh workflow', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'check-caps',
      arguments: { workflowId: wfId },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.ok(sc !== null && typeof sc === 'object');
  });
});
