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
    arguments: { featureName: 'SubagentTest', phaseConfig: JSON.stringify(myideaPhaseConfig) },
  });
  return (result.structuredContent as any).workflowId;
}

describe('report-done tool', () => {
  it('submits agent-completion evidence and emits subagent-completed event', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'report-done',
      arguments: {
        workflowId: wfId,
        agentName: 'speckit.implement',
        taskDescription: 'Implement feature',
        status: 'completed',
        summary: 'All tasks done successfully',
      },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.ok(sc.evidenceId);
    assert.ok(sc.eventId);

    // Verify evidence was stored
    const evidence = await h.client.callTool({
      name: 'get-evidence',
      arguments: { workflowId: wfId, category: 'agent-completion' },
    });
    const evSc = evidence.structuredContent as any;
    assert.ok(evSc.evidence.length >= 1);

    // Verify event was emitted
    const events = await h.client.callTool({
      name: 'get-events',
      arguments: { workflowId: wfId, eventType: 'subagent-completed' },
    });
    const evtSc = events.structuredContent as any;
    assert.ok(evtSc.events.length >= 1);
  });

  it('emits subagent-failed event on failure status', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'report-done',
      arguments: {
        workflowId: wfId,
        agentName: 'builder-agent',
        taskDescription: 'Build feature',
        status: 'failed',
        summary: 'Compile errors encountered',
      },
    });

    assert.equal(result.isError, undefined);

    const events = await h.client.callTool({
      name: 'get-events',
      arguments: { workflowId: wfId, eventType: 'subagent-failed' },
    });
    const sc = events.structuredContent as any;
    assert.ok(sc.events.length >= 1);
  });

  it('handles partial status', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'report-done',
      arguments: {
        workflowId: wfId,
        agentName: 'test-agent',
        taskDescription: 'Partial work',
        status: 'partial',
        summary: '70% complete',
      },
    });

    assert.equal(result.isError, undefined);

    // Partial status emits subagent-completed (not failed)
    const events = await h.client.callTool({
      name: 'get-events',
      arguments: { workflowId: wfId, eventType: 'subagent-completed' },
    });
    const sc = events.structuredContent as any;
    assert.ok(sc.events.length >= 1);
  });

  it('accepts optional phaseKey and runId', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'report-done',
      arguments: {
        workflowId: wfId,
        agentName: 'test-agent',
        taskDescription: 'Do thing',
        status: 'completed',
        summary: 'Done',
        phaseKey: 'implement',
        runId: 'run-abc-123',
      },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.ok(sc.evidenceId);
  });

  it('accepts optional artifacts', async () => {
    const wfId = await createWorkflow();

    const artifacts = [{ path: 'src/index.ts', action: 'created' }];
    const result = await h.client.callTool({
      name: 'report-done',
      arguments: {
        workflowId: wfId,
        agentName: 'test-agent',
        taskDescription: 'Create files',
        status: 'completed',
        summary: 'Created 1 file',
        artifacts: JSON.stringify(artifacts),
      },
    });

    assert.equal(result.isError, undefined);
  });

  it('returns isError for unknown workflow', async () => {
    const result = await h.client.callTool({
      name: 'report-done',
      arguments: {
        workflowId: '00000000-0000-0000-0000-000000000000',
        agentName: 'test-agent',
        taskDescription: 'Fail',
        status: 'completed',
        summary: 'Done',
      },
    });

    assert.equal(result.isError, true);
  });
});
