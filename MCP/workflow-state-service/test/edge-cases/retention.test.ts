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
    arguments: { featureName: 'RetentionTest', phaseConfig: JSON.stringify(minimalPhaseConfig) },
  });
  return (result.structuredContent as any).workflowId;
}

describe('retention and close edge cases', () => {
  it('close-workflow returns complete export', async () => {
    const wfId = await createWorkflow();

    // Add some data
    await h.client.callTool({
      name: 'store-context',
      arguments: { workflowId: wfId, category: 'briefing', key: 'goal', value: 'Test', authoredBy: 'coord' },
    });

    const result = await h.client.callTool({
      name: 'close-workflow',
      arguments: { workflowId: wfId },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.ok(sc.export);
    assert.ok(sc.export.workflowId);
    assert.ok(sc.export.state);
    assert.ok(Array.isArray(sc.export.events));
    assert.ok(Array.isArray(sc.export.evidence));
    assert.ok(Array.isArray(sc.export.context));
  });

  it('export-workflow returns full snapshot without closing', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'export-workflow',
      arguments: { workflowId: wfId },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.ok(sc.workflowId);
    assert.ok(sc.state);
    assert.ok(Array.isArray(sc.events));

    // Workflow is still active
    const list = await h.client.callTool({
      name: 'list-active',
      arguments: {},
    });
    const listSc = list.structuredContent as any;
    assert.equal(listSc.workflows.length, 1);
  });

  it('closed workflow is not in list-active', async () => {
    const wfId = await createWorkflow();

    await h.client.callTool({
      name: 'close-workflow',
      arguments: { workflowId: wfId },
    });

    const list = await h.client.callTool({
      name: 'list-active',
      arguments: {},
    });
    const sc = list.structuredContent as any;
    assert.equal(sc.workflows.length, 0);
  });
});
