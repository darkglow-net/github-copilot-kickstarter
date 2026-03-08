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

describe('validation edge cases', () => {
  it('rejects invalid phase config at creation (empty phases)', async () => {
    const result = await h.client.callTool({
      name: 'create-workflow',
      arguments: {
        featureName: 'Bad',
        phaseConfig: JSON.stringify({ phases: [], transitions: [] }),
      },
    });

    assert.equal(result.isError, true);
    const sc = result.structuredContent as any;
    assert.equal(sc.code, 'VALIDATION_FAILED');
  });

  it('_close pseudo-phase is handled correctly in transitions', async () => {
    const result = await h.client.callTool({
      name: 'create-workflow',
      arguments: { featureName: 'Close', phaseConfig: JSON.stringify(minimalPhaseConfig) },
    });
    const wfId = (result.structuredContent as any).workflowId;

    // work → _close
    const transition = await h.client.callTool({
      name: 'transition-phase',
      arguments: {
        workflowId: wfId,
        from: 'work',
        to: '_close',
        summary: 'All done',
        actorKind: 'coordinator',
        actorName: 'orchestrator',
      },
    });

    assert.equal(transition.isError, undefined);
    const sc = transition.structuredContent as any;
    assert.equal(sc.approved, true);
  });

  it('_close is not in the phases state (no phase entry for _close)', async () => {
    const result = await h.client.callTool({
      name: 'create-workflow',
      arguments: { featureName: 'NoClose', phaseConfig: JSON.stringify(minimalPhaseConfig) },
    });
    const wfId = (result.structuredContent as any).workflowId;

    const stateResult = await h.client.callTool({
      name: 'get-state',
      arguments: { workflowId: wfId },
    });
    const sc = stateResult.structuredContent as any;
    assert.equal(sc.state.phases['_close'], undefined);
  });

  it('context upsert: create then update', async () => {
    const result = await h.client.callTool({
      name: 'create-workflow',
      arguments: { featureName: 'Upsert', phaseConfig: JSON.stringify(minimalPhaseConfig) },
    });
    const wfId = (result.structuredContent as any).workflowId;

    // Create
    const r1 = await h.client.callTool({
      name: 'store-context',
      arguments: { workflowId: wfId, category: 'briefing', key: 'note', value: 'v1', authoredBy: 'coord' },
    });
    assert.equal((r1.structuredContent as any).created, true);

    // Update
    const r2 = await h.client.callTool({
      name: 'store-context',
      arguments: { workflowId: wfId, category: 'briefing', key: 'note', value: 'v2', authoredBy: 'coord' },
    });
    assert.equal((r2.structuredContent as any).created, false);

    // Verify updated value
    const ctx = await h.client.callTool({
      name: 'get-context',
      arguments: { workflowId: wfId, key: 'note' },
    });
    const entries = (ctx.structuredContent as any).entries;
    assert.equal(entries.length, 1);
    assert.equal(entries[0].value, 'v2');
  });

  it('get-context returns empty array when no entries', async () => {
    const result = await h.client.callTool({
      name: 'create-workflow',
      arguments: { featureName: 'Empty', phaseConfig: JSON.stringify(minimalPhaseConfig) },
    });
    const wfId = (result.structuredContent as any).workflowId;

    const ctx = await h.client.callTool({
      name: 'get-context',
      arguments: { workflowId: wfId },
    });
    const sc = ctx.structuredContent as any;
    assert.deepEqual(sc.entries, []);
  });
});
