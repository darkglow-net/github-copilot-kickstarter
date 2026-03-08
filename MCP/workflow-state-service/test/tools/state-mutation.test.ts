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
    arguments: { featureName: 'Mut', phaseConfig: JSON.stringify(minimalPhaseConfig) },
  });
  return (result.structuredContent as any).workflowId;
}

describe('update-state tool', () => {
  it('patches tasks into state', async () => {
    const wfId = await createWorkflow();

    const tasks = [{ id: 100, description: 'Do thing', status: 'pending' }];
    const result = await h.client.callTool({
      name: 'update-state',
      arguments: {
        workflowId: wfId,
        tasks: JSON.stringify(tasks),
      },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.equal(sc.stateVersion, 2);
    assert.equal(sc.state.tasks.length, 1);
    assert.equal(sc.state.tasks[0].id, 100);
  });

  it('patches fixTasks', async () => {
    const wfId = await createWorkflow();

    const fixTasks = [{ id: 200, description: 'Fix bug', status: 'pending', parentTaskId: 100 }];
    const result = await h.client.callTool({
      name: 'update-state',
      arguments: {
        workflowId: wfId,
        fixTasks: JSON.stringify(fixTasks),
      },
    });

    const sc = result.structuredContent as any;
    assert.equal(sc.state.fixTasks.length, 1);
  });

  it('patches context', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'update-state',
      arguments: {
        workflowId: wfId,
        context: JSON.stringify({ newKey: 'value' }),
      },
    });

    const sc = result.structuredContent as any;
    assert.equal(sc.state.context.newKey, 'value');
  });

  it('patches phaseMetadata', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'update-state',
      arguments: {
        workflowId: wfId,
        phaseMetadata: JSON.stringify({ phaseKey: 'work', metadata: { notes: 'testing' } }),
      },
    });

    assert.equal(result.isError, undefined);
  });

  it('patches complexityScore', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'update-state',
      arguments: {
        workflowId: wfId,
        complexityScore: 8,
      },
    });

    const sc = result.structuredContent as any;
    assert.equal(sc.state.complexityScore, 8);
  });

  it('returns error when no fields provided', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'update-state',
      arguments: { workflowId: wfId },
    });

    assert.equal(result.isError, true);
    const sc = result.structuredContent as any;
    assert.equal(sc.code, 'VALIDATION_FAILED');
  });
});

describe('halt-workflow tool', () => {
  it('blocks the current phase and sets haltReason', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'halt-workflow',
      arguments: { workflowId: wfId, reason: 'Waiting for approval' },
    });

    assert.equal(result.isError, undefined);

    // Verify via get-state
    const stateResult = await h.client.callTool({
      name: 'get-state',
      arguments: { workflowId: wfId },
    });
    const sc = stateResult.structuredContent as any;
    assert.equal(sc.state.haltReason, 'Waiting for approval');
    assert.equal(sc.state.phases.work.status, 'blocked');
  });
});

describe('resume-workflow tool', () => {
  it('clears halt and restores in-progress', async () => {
    const wfId = await createWorkflow();

    await h.client.callTool({
      name: 'halt-workflow',
      arguments: { workflowId: wfId, reason: 'Paused' },
    });

    const result = await h.client.callTool({
      name: 'resume-workflow',
      arguments: { workflowId: wfId },
    });

    assert.equal(result.isError, undefined);

    const stateResult = await h.client.callTool({
      name: 'get-state',
      arguments: { workflowId: wfId },
    });
    const sc = stateResult.structuredContent as any;
    assert.equal(sc.state.haltReason, null);
    assert.equal(sc.state.phases.work.status, 'in-progress');
  });

  it('returns error if workflow is not halted', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'resume-workflow',
      arguments: { workflowId: wfId },
    });

    assert.equal(result.isError, true);
  });
});
