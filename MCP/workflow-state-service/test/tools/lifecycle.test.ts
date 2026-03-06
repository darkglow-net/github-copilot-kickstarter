import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestHarness, type TestHarness } from './helpers.ts';
import { minimalPhaseConfig, myideaPhaseConfig } from '../fixtures/phase-configs.ts';

let h: TestHarness;

beforeEach(async () => {
  h = await createTestHarness();
});

afterEach(async () => {
  await h.cleanup();
});

describe('create-workflow tool', () => {
  it('creates a workflow with valid config and returns workflowId + state', async () => {
    const result = await h.client.callTool({
      name: 'create-workflow',
      arguments: {
        featureName: 'Widget',
        phaseConfig: JSON.stringify(minimalPhaseConfig),
      },
    });

    assert.equal(result.isError, undefined);
    assert.ok(Array.isArray(result.content));
    const text = (result.content as any[])[0].text;
    assert.ok(text.includes('created'));

    const sc = result.structuredContent as any;
    assert.ok(sc.workflowId);
    assert.ok(sc.state);
    assert.equal(sc.state.feature, 'Widget');
  });

  it('returns isError for invalid phase config', async () => {
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

  it('passes optional fields through', async () => {
    const result = await h.client.callTool({
      name: 'create-workflow',
      arguments: {
        featureName: 'Feature',
        branchName: 'feat/test',
        specDir: '/specs/001',
        complexityScore: 7,
        phaseConfig: JSON.stringify(minimalPhaseConfig),
        context: JSON.stringify({ goal: 'test it' }),
      },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.equal(sc.state.branch, 'feat/test');
    assert.equal(sc.state.spec, '/specs/001');
    assert.equal(sc.state.complexityScore, 7);
    assert.deepEqual(sc.state.context, { goal: 'test it' });
  });
});

describe('list-active tool', () => {
  it('returns empty list initially', async () => {
    const result = await h.client.callTool({
      name: 'list-active',
      arguments: {},
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.deepEqual(sc.workflows, []);
  });

  it('returns created workflows', async () => {
    await h.client.callTool({
      name: 'create-workflow',
      arguments: { featureName: 'A', phaseConfig: JSON.stringify(minimalPhaseConfig) },
    });
    await h.client.callTool({
      name: 'create-workflow',
      arguments: { featureName: 'B', phaseConfig: JSON.stringify(minimalPhaseConfig) },
    });

    const result = await h.client.callTool({
      name: 'list-active',
      arguments: {},
    });

    const sc = result.structuredContent as any;
    assert.equal(sc.workflows.length, 2);
  });

  it('filters by branchName', async () => {
    await h.client.callTool({
      name: 'create-workflow',
      arguments: { featureName: 'A', branchName: 'main', phaseConfig: JSON.stringify(minimalPhaseConfig) },
    });
    await h.client.callTool({
      name: 'create-workflow',
      arguments: { featureName: 'B', branchName: 'dev', phaseConfig: JSON.stringify(minimalPhaseConfig) },
    });

    const result = await h.client.callTool({
      name: 'list-active',
      arguments: { branchName: 'main' },
    });

    const sc = result.structuredContent as any;
    assert.equal(sc.workflows.length, 1);
    assert.equal(sc.workflows[0].featureName, 'A');
  });
});

describe('get-state tool', () => {
  it('returns state + version + config for existing workflow', async () => {
    const created = await h.client.callTool({
      name: 'create-workflow',
      arguments: { featureName: 'Test', phaseConfig: JSON.stringify(minimalPhaseConfig) },
    });
    const wfId = (created.structuredContent as any).workflowId;

    const result = await h.client.callTool({
      name: 'get-state',
      arguments: { workflowId: wfId },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.ok(sc.state);
    assert.equal(sc.stateVersion, 1);
    assert.ok(sc.phaseConfig);
  });

  it('returns isError for unknown workflow ID', async () => {
    const result = await h.client.callTool({
      name: 'get-state',
      arguments: { workflowId: '00000000-0000-0000-0000-000000000000' },
    });

    assert.equal(result.isError, true);
    const sc = result.structuredContent as any;
    assert.equal(sc.code, 'WORKFLOW_NOT_FOUND');
  });
});

describe('export-workflow tool', () => {
  it('returns full workflow data', async () => {
    const created = await h.client.callTool({
      name: 'create-workflow',
      arguments: { featureName: 'Export', phaseConfig: JSON.stringify(minimalPhaseConfig) },
    });
    const wfId = (created.structuredContent as any).workflowId;

    const result = await h.client.callTool({
      name: 'export-workflow',
      arguments: { workflowId: wfId },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.ok(sc.workflowId);
    assert.ok(Array.isArray(sc.events));
    assert.ok(Array.isArray(sc.evidence));
    assert.ok(Array.isArray(sc.context));
  });
});

describe('close-workflow tool', () => {
  it('exports and purges workflow', async () => {
    const created = await h.client.callTool({
      name: 'create-workflow',
      arguments: { featureName: 'Close', phaseConfig: JSON.stringify(minimalPhaseConfig) },
    });
    const wfId = (created.structuredContent as any).workflowId;

    const result = await h.client.callTool({
      name: 'close-workflow',
      arguments: { workflowId: wfId },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.equal(sc.purged, true);
    assert.ok(sc.export);

    // Subsequent get-state should fail
    const getResult = await h.client.callTool({
      name: 'get-state',
      arguments: { workflowId: wfId },
    });
    assert.equal(getResult.isError, true);
  });
});
