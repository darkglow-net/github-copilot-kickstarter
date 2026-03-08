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
    arguments: { featureName: 'Events', phaseConfig: JSON.stringify(minimalPhaseConfig) },
  });
  return (result.structuredContent as any).workflowId;
}

describe('append-event tool', () => {
  it('appends a custom event and returns eventId + seq', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'append-event',
      arguments: {
        workflowId: wfId,
        eventType: 'note-added',
        actorKind: 'coordinator',
        actorName: 'test',
        payload: JSON.stringify({ text: 'hello' }),
      },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.ok(sc.eventId);
    assert.ok(typeof sc.seq === 'number');
  });

  it('appends event with optional phaseKey and actorRunId', async () => {
    const wfId = await createWorkflow();

    const result = await h.client.callTool({
      name: 'append-event',
      arguments: {
        workflowId: wfId,
        eventType: 'note-added',
        actorKind: 'agent',
        actorName: 'builder',
        actorRunId: 'run-123',
        phaseKey: 'work',
        payload: JSON.stringify({ text: 'with extras' }),
      },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    assert.ok(sc.eventId);
  });

  it('returns isError for unknown workflow', async () => {
    const result = await h.client.callTool({
      name: 'append-event',
      arguments: {
        workflowId: '00000000-0000-0000-0000-000000000000',
        eventType: 'note-added',
        actorKind: 'coordinator',
        actorName: 'test',
        payload: JSON.stringify({ text: '' }),
      },
    });

    assert.equal(result.isError, true);
  });
});

describe('get-events tool', () => {
  it('returns events for a workflow', async () => {
    const wfId = await createWorkflow();

    // Append two events
    await h.client.callTool({
      name: 'append-event',
      arguments: {
        workflowId: wfId,
        eventType: 'note-added',
        actorKind: 'coordinator',
        actorName: 'test',
        payload: JSON.stringify({ text: 'note 1' }),
      },
    });
    await h.client.callTool({
      name: 'append-event',
      arguments: {
        workflowId: wfId,
        eventType: 'note-added',
        actorKind: 'coordinator',
        actorName: 'test',
        payload: JSON.stringify({ text: 'note 2' }),
      },
    });

    const result = await h.client.callTool({
      name: 'get-events',
      arguments: { workflowId: wfId },
    });

    assert.equal(result.isError, undefined);
    const sc = result.structuredContent as any;
    // At least the workflow-created event + phase-started + 2 note-added events
    assert.ok(sc.events.length >= 3);
  });

  it('filters by eventType', async () => {
    const wfId = await createWorkflow();

    await h.client.callTool({
      name: 'append-event',
      arguments: {
        workflowId: wfId,
        eventType: 'note-added',
        actorKind: 'coordinator',
        actorName: 'test',
        payload: JSON.stringify({ text: 'filtered' }),
      },
    });

    const result = await h.client.callTool({
      name: 'get-events',
      arguments: { workflowId: wfId, eventType: 'note-added' },
    });

    const sc = result.structuredContent as any;
    assert.ok(sc.events.length >= 1);
    assert.ok(sc.events.every((e: any) => e.eventType === 'note-added'));
  });

  it('supports sinceCursor pagination', async () => {
    const wfId = await createWorkflow();

    await h.client.callTool({
      name: 'append-event',
      arguments: {
        workflowId: wfId,
        eventType: 'note-added',
        actorKind: 'coordinator',
        actorName: 'test',
        payload: JSON.stringify({ text: 'first' }),
      },
    });

    // Get all events to find cursor
    const all = await h.client.callTool({
      name: 'get-events',
      arguments: { workflowId: wfId },
    });
    const allSc = all.structuredContent as any;
    const lastSeq = allSc.events[allSc.events.length - 1].seq;

    // Append one more
    await h.client.callTool({
      name: 'append-event',
      arguments: {
        workflowId: wfId,
        eventType: 'note-added',
        actorKind: 'coordinator',
        actorName: 'test',
        payload: JSON.stringify({ text: 'second' }),
      },
    });

    const after = await h.client.callTool({
      name: 'get-events',
      arguments: { workflowId: wfId, sinceCursor: lastSeq },
    });

    const afterSc = after.structuredContent as any;
    assert.equal(afterSc.events.length, 1);
  });

  it('supports limit', async () => {
    const wfId = await createWorkflow();

    for (let i = 0; i < 5; i++) {
      await h.client.callTool({
        name: 'append-event',
        arguments: {
          workflowId: wfId,
          eventType: 'note-added',
          actorKind: 'coordinator',
          actorName: 'test',
          payload: JSON.stringify({ text: `note ${i}` }),
        },
      });
    }

    const result = await h.client.callTool({
      name: 'get-events',
      arguments: { workflowId: wfId, limit: 2 },
    });

    const sc = result.structuredContent as any;
    assert.equal(sc.events.length, 2);
  });
});
