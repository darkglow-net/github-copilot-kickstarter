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
    arguments: { featureName: 'CtxTest', phaseConfig: JSON.stringify(minimalPhaseConfig) },
  });
  return (result.structuredContent as any).workflowId;
}

describe('store-context tool', () => {
  it('creates a new context entry', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'store-context',
      arguments: {
        workflowId: wfId,
        category: 'briefing',
        key: 'goal',
        value: 'Build the widget',
        authoredBy: 'coordinator',
      },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.equal(sc.category, 'briefing');
    assert.equal(sc.key, 'goal');
    assert.equal(sc.created, true);
  });

  it('updates an existing context entry', async () => {
    const wfId = await createWorkflow();

    await h.client.callTool({
      name: 'store-context',
      arguments: {
        workflowId: wfId,
        category: 'briefing',
        key: 'goal',
        value: 'Original',
        authoredBy: 'coordinator',
      },
    });

    const result = await h.client.callTool({
      name: 'store-context',
      arguments: {
        workflowId: wfId,
        category: 'briefing',
        key: 'goal',
        value: 'Updated',
        authoredBy: 'coordinator',
      },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.equal(sc.created, false);
  });

  it('stores decision context', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'store-context',
      arguments: {
        workflowId: wfId,
        category: 'decision',
        key: 'auth-strategy',
        value: 'JWT tokens',
        authoredBy: 'user',
      },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.equal(sc.category, 'decision');
  });

  it('stores delegation context', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'store-context',
      arguments: {
        workflowId: wfId,
        category: 'delegation',
        key: 'implement-agent',
        value: 'Assigned to speckit.implement',
        authoredBy: 'coordinator',
      },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.equal(sc.category, 'delegation');
  });

  it('returns isError for unknown workflow', async () => {
    const result = await h.client.callTool({
      name: 'store-context',
      arguments: {
        workflowId: '00000000-0000-0000-0000-000000000000',
        category: 'briefing',
        key: 'goal',
        value: 'Test',
        authoredBy: 'coordinator',
      },
    });

    assert.equal(result.isError, true);
  });
});

describe('get-context tool', () => {
  it('returns all context entries', async () => {
    const wfId = await createWorkflow();

    await h.client.callTool({
      name: 'store-context',
      arguments: { workflowId: wfId, category: 'briefing', key: 'goal', value: 'Build it', authoredBy: 'coord' },
    });
    await h.client.callTool({
      name: 'store-context',
      arguments: { workflowId: wfId, category: 'decision', key: 'db', value: 'SQLite', authoredBy: 'coord' },
    });

    const result = await h.client.callTool({
      name: 'get-context',
      arguments: { workflowId: wfId },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.equal(sc.entries.length, 2);
  });

  it('filters by category', async () => {
    const wfId = await createWorkflow();

    await h.client.callTool({
      name: 'store-context',
      arguments: { workflowId: wfId, category: 'briefing', key: 'goal', value: 'Build it', authoredBy: 'coord' },
    });
    await h.client.callTool({
      name: 'store-context',
      arguments: { workflowId: wfId, category: 'decision', key: 'db', value: 'SQLite', authoredBy: 'coord' },
    });

    const result = await h.client.callTool({
      name: 'get-context',
      arguments: { workflowId: wfId, category: 'briefing' },
    });

    const sc = result.structuredContent as any;
    assert.equal(sc.entries.length, 1);
    assert.equal(sc.entries[0].category, 'briefing');
  });

  it('filters by key', async () => {
    const wfId = await createWorkflow();

    await h.client.callTool({
      name: 'store-context',
      arguments: { workflowId: wfId, category: 'briefing', key: 'goal', value: 'Build it', authoredBy: 'coord' },
    });
    await h.client.callTool({
      name: 'store-context',
      arguments: { workflowId: wfId, category: 'briefing', key: 'scope', value: 'MVP', authoredBy: 'coord' },
    });

    const result = await h.client.callTool({
      name: 'get-context',
      arguments: { workflowId: wfId, key: 'goal' },
    });

    const sc = result.structuredContent as any;
    assert.equal(sc.entries.length, 1);
    assert.equal(sc.entries[0].key, 'goal');
  });

  it('returns empty entries when none exist', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'get-context',
      arguments: { workflowId: wfId },
    });

    const sc = result.structuredContent as any;
    assert.deepEqual(sc.entries, []);
  });
});

describe('get-briefing tool', () => {
  it('returns composite briefing with workflow identity', async () => {
    const wfId = await createWorkflow();

    // Store some context
    await h.client.callTool({
      name: 'store-context',
      arguments: { workflowId: wfId, category: 'briefing', key: 'goal', value: 'Build widget', authoredBy: 'coord' },
    });

    const result = await h.client.callTool({
      name: 'get-briefing',
      arguments: { workflowId: wfId },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.equal(sc.workflowId, wfId);
    assert.equal(sc.featureName, 'CtxTest');
    assert.ok(sc.currentPhaseKey);
    assert.ok(sc.status);
    assert.ok(Array.isArray(sc.briefing));
    assert.ok(Array.isArray(sc.decisions));
    assert.ok(Array.isArray(sc.delegations));
    assert.ok(Array.isArray(sc.phasesSummary));
    assert.ok(typeof sc.stateVersion === 'number');
  });

  it('includes briefing entries in correct category', async () => {
    const wfId = await createWorkflow();

    await h.client.callTool({
      name: 'store-context',
      arguments: { workflowId: wfId, category: 'briefing', key: 'goal', value: 'Build widget', authoredBy: 'coord' },
    });
    await h.client.callTool({
      name: 'store-context',
      arguments: { workflowId: wfId, category: 'decision', key: 'framework', value: 'Express', authoredBy: 'coord' },
    });

    const result = await h.client.callTool({
      name: 'get-briefing',
      arguments: { workflowId: wfId },
    });

    const sc = result.structuredContent as any;
    assert.ok(sc.briefing.length >= 1);
    assert.ok(sc.decisions.length >= 1);
  });

  it('returns isError for unknown workflow', async () => {
    const result = await h.client.callTool({
      name: 'get-briefing',
      arguments: { workflowId: '00000000-0000-0000-0000-000000000000' },
    });

    assert.equal(result.isError, true);
  });
});
