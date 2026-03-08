import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestHarness, type TestHarness } from './helpers.ts';
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
    arguments: { featureName: 'ValTest', phaseConfig: JSON.stringify(minimalPhaseConfig) },
  });
  return (result.structuredContent as any).workflowId;
}

describe('validate-state tool', () => {
  it('returns valid for a freshly created workflow', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'validate-state',
      arguments: { workflowId: wfId },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.equal(sc.valid, true);
    assert.deepEqual(sc.errors, []);
  });

  it('returns isError for unknown workflow', async () => {
    const result = await h.client.callTool({
      name: 'validate-state',
      arguments: { workflowId: '00000000-0000-0000-0000-000000000000' },
    });

    assert.equal(result.isError, true);
  });
});

describe('check-caps tool', () => {
  it('returns cap information for a workflow', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'check-caps',
      arguments: { workflowId: wfId },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.ok(sc !== null && typeof sc === 'object');
  });

  it('returns isError for unknown workflow', async () => {
    const result = await h.client.callTool({
      name: 'check-caps',
      arguments: { workflowId: '00000000-0000-0000-0000-000000000000' },
    });

    assert.equal(result.isError, true);
  });
});

describe('allocate-task-id tool', () => {
  it('returns nextId >= 100 for a new workflow', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'allocate-task-id',
      arguments: { workflowId: wfId },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.ok(sc.nextId >= 100);
  });

  it('returns sequential IDs for task type', async () => {
    const wfId = await createWorkflow();

    // Add a task first to push the ID
    await h.client.callTool({
      name: 'update-state',
      arguments: {
        workflowId: wfId,
        tasks: JSON.stringify([{ id: 100, description: 'First', status: 'pending' }]),
      },
    });

    const result = await h.client.callTool({
      name: 'allocate-task-id',
      arguments: { workflowId: wfId, type: 'task' },
    });

    const sc = result.structuredContent as any;
    assert.ok(sc.nextId > 100);
  });

  it('handles fixTask type', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'allocate-task-id',
      arguments: { workflowId: wfId, taskType: 'fixTask' },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.ok(sc.nextId >= 100);
  });

  it('returns isError for unknown workflow', async () => {
    const result = await h.client.callTool({
      name: 'allocate-task-id',
      arguments: { workflowId: '00000000-0000-0000-0000-000000000000' },
    });

    assert.equal(result.isError, true);
  });
});
