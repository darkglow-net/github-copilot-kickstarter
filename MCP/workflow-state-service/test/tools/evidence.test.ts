import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestHarness, type TestHarness } from './helpers.ts';
import { myideaPhaseConfig } from '../fixtures/phase-configs.ts';

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
    arguments: { featureName: 'EvidenceTest', phaseConfig: JSON.stringify(myideaPhaseConfig) },
  });
  return (result.structuredContent as any).workflowId;
}

describe('submit-evidence tool', () => {
  it('submits test-results evidence and returns gateResult', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'submit-evidence',
      arguments: {
        workflowId: wfId,
        phaseKey: 'implement',
        category: 'test-results',
        data: JSON.stringify({ passed: 10, failed: 0, total: 10 }),
        submittedBy: 'ci',
      },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.ok(sc.evidenceId);
    assert.equal(sc.gateResult, 'pass');
  });

  it('returns fail gateResult when tests fail', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'submit-evidence',
      arguments: {
        workflowId: wfId,
        phaseKey: 'implement',
        category: 'test-results',
        data: JSON.stringify({ passed: 8, failed: 2, total: 10 }),
        submittedBy: 'ci',
      },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.equal(sc.gateResult, 'fail');
  });

  it('submits error-diagnostic evidence', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'submit-evidence',
      arguments: {
        workflowId: wfId,
        phaseKey: 'implement',
        category: 'error-diagnostic',
        data: JSON.stringify({ source: 'tsc', errors: 0, warnings: 2 }),
        submittedBy: 'ci',
      },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.equal(sc.gateResult, 'pass');
  });

  it('submits checklist evidence', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'submit-evidence',
      arguments: {
        workflowId: wfId,
        phaseKey: 'research',
        category: 'checklist',
        data: JSON.stringify({ checklistName: 'research', totalItems: 5, completedItems: 5, failedItems: 0 }),
        submittedBy: 'agent',
      },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.equal(sc.gateResult, 'pass');
  });

  it('submits code-review evidence', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'submit-evidence',
      arguments: {
        workflowId: wfId,
        phaseKey: 'review',
        category: 'code-review',
        data: JSON.stringify({ reviewer: 'human', reviewerType: 'human', verdict: 'approved', findingCount: 0, criticalFindings: 0 }),
        submittedBy: 'reviewer',
      },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.equal(sc.gateResult, 'pass');
  });

  it('returns isError for unknown workflow', async () => {
    const result = await h.client.callTool({
      name: 'submit-evidence',
      arguments: {
        workflowId: '00000000-0000-0000-0000-000000000000',
        phaseKey: 'work',
        category: 'test-results',
        data: JSON.stringify({ passed: 1, failed: 0, total: 1 }),
        submittedBy: 'ci',
      },
    });

    assert.equal(result.isError, true);
  });
});

describe('get-evidence tool', () => {
  it('returns all evidence for a workflow', async () => {
    const wfId = await createWorkflow();

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
      name: 'get-evidence',
      arguments: { workflowId: wfId },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.equal(sc.evidence.length, 2);
  });

  it('filters by phaseKey', async () => {
    const wfId = await createWorkflow();

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
        phaseKey: 'research',
        category: 'checklist',
        data: JSON.stringify({ checklistName: 'research', totalItems: 3, completedItems: 3, failedItems: 0 }),
        submittedBy: 'agent',
      },
    });

    const result = await h.client.callTool({
      name: 'get-evidence',
      arguments: { workflowId: wfId, phaseKey: 'implement' },
    });

    const sc = result.structuredContent as any;
    assert.equal(sc.evidence.length, 1);
    assert.equal(sc.evidence[0].category, 'test-results');
  });

  it('filters by category', async () => {
    const wfId = await createWorkflow();

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
      name: 'get-evidence',
      arguments: { workflowId: wfId, category: 'test-results' },
    });

    const sc = result.structuredContent as any;
    assert.equal(sc.evidence.length, 1);
  });

  it('returns empty array when no evidence exists', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'get-evidence',
      arguments: { workflowId: wfId },
    });

    const sc = result.structuredContent as any;
    assert.deepEqual(sc.evidence, []);
  });
});
