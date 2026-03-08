import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PhaseStartedPayload,
  PhaseCompletedPayload,
  PhaseBlockedPayload,
  EvidenceSubmittedPayload,
  TransitionRequestedPayload,
  TransitionApprovedPayload,
  TransitionRejectedPayload,
  SubagentDispatchedPayload,
  SubagentCompletedPayload,
  SubagentFailedPayload,
  FindingCreatedPayload,
  FixTaskCreatedPayload,
  FixTaskCompletedPayload,
  WorkflowCreatedPayload,
  WorkflowHaltedPayload,
  WorkflowClosedPayload,
  ContextStoredPayload,
  NoteAddedPayload,
  EVENT_TYPES,
  EventTypeSchema,
  eventPayloadSchemas,
  ActorKindSchema,
  EventEnvelopeSchema,
} from '../../src/schemas/events.ts';

describe('EVENT_TYPES', () => {
  it('contains exactly 18 event types', () => {
    assert.equal(EVENT_TYPES.length, 18);
  });

  it('includes all expected types', () => {
    const expected = [
      'phase-started', 'phase-completed', 'phase-blocked',
      'evidence-submitted', 'transition-requested', 'transition-approved',
      'transition-rejected', 'subagent-dispatched', 'subagent-completed',
      'subagent-failed', 'finding-created', 'fix-task-created',
      'fix-task-completed', 'workflow-created', 'workflow-halted',
      'workflow-closed', 'context-stored', 'note-added',
    ];
    for (const t of expected) {
      assert.ok(EVENT_TYPES.includes(t as typeof EVENT_TYPES[number]), `Missing event type: ${t}`);
    }
  });
});

describe('EventTypeSchema', () => {
  it('accepts valid event types', () => {
    for (const t of EVENT_TYPES) {
      const r = EventTypeSchema.safeParse(t);
      assert.equal(r.success, true, `Expected ${t} to be valid`);
    }
  });

  it('rejects invalid event type', () => {
    const r = EventTypeSchema.safeParse('invalid-event');
    assert.equal(r.success, false);
  });
});

describe('ActorKindSchema', () => {
  it('accepts all valid actor kinds', () => {
    for (const kind of ['coordinator', 'subagent', 'human', 'tool']) {
      const r = ActorKindSchema.safeParse(kind);
      assert.equal(r.success, true, `Expected ${kind} to be valid`);
    }
  });

  it('rejects invalid actor kind', () => {
    const r = ActorKindSchema.safeParse('bot');
    assert.equal(r.success, false);
  });
});

describe('eventPayloadSchemas', () => {
  it('has a schema for every event type', () => {
    for (const t of EVENT_TYPES) {
      assert.ok(eventPayloadSchemas[t], `Missing payload schema for ${t}`);
    }
  });
});

describe('Payload schemas', () => {
  describe('PhaseStartedPayload', () => {
    it('accepts valid data', () => {
      const r = PhaseStartedPayload.safeParse({ phaseKey: 'research', startedAt: '2026-01-01T00:00:00Z' });
      assert.equal(r.success, true);
    });

    it('rejects missing phaseKey', () => {
      const r = PhaseStartedPayload.safeParse({ startedAt: '2026-01-01T00:00:00Z' });
      assert.equal(r.success, false);
    });
  });

  describe('PhaseCompletedPayload', () => {
    it('accepts valid data', () => {
      const r = PhaseCompletedPayload.safeParse({
        phaseKey: 'research',
        completedAt: '2026-01-01T01:00:00Z',
        summary: 'Done',
      });
      assert.equal(r.success, true);
    });

    it('rejects missing summary', () => {
      const r = PhaseCompletedPayload.safeParse({ phaseKey: 'research', completedAt: 'x' });
      assert.equal(r.success, false);
    });
  });

  describe('PhaseBlockedPayload', () => {
    it('accepts valid data', () => {
      const r = PhaseBlockedPayload.safeParse({ phaseKey: 'implement', reason: 'Halted by user' });
      assert.equal(r.success, true);
    });
  });

  describe('EvidenceSubmittedPayload', () => {
    it('accepts valid data', () => {
      const r = EvidenceSubmittedPayload.safeParse({
        evidenceCategory: 'test-results',
        gateResult: 'pass',
        data: { passed: 10, failed: 0 },
      });
      assert.equal(r.success, true);
    });
  });

  describe('TransitionRequestedPayload', () => {
    it('accepts valid data', () => {
      const r = TransitionRequestedPayload.safeParse({ from: 'research', to: 'plan' });
      assert.equal(r.success, true);
    });
  });

  describe('TransitionApprovedPayload', () => {
    it('accepts valid data', () => {
      const r = TransitionApprovedPayload.safeParse({ from: 'research', to: 'plan' });
      assert.equal(r.success, true);
    });
  });

  describe('TransitionRejectedPayload', () => {
    it('accepts valid data', () => {
      const r = TransitionRejectedPayload.safeParse({ from: 'implement', to: 'review', reason: 'Tests failing' });
      assert.equal(r.success, true);
    });

    it('rejects missing reason', () => {
      const r = TransitionRejectedPayload.safeParse({ from: 'implement', to: 'review' });
      assert.equal(r.success, false);
    });
  });

  describe('SubagentDispatchedPayload', () => {
    it('accepts valid data', () => {
      const r = SubagentDispatchedPayload.safeParse({
        agentName: 'tdd-red',
        runId: 'run-123',
        taskDescription: 'Write tests',
      });
      assert.equal(r.success, true);
    });
  });

  describe('SubagentCompletedPayload', () => {
    it('accepts valid data', () => {
      const r = SubagentCompletedPayload.safeParse({ agentName: 'tdd-red', summary: 'Tests written' });
      assert.equal(r.success, true);
    });

    it('accepts with optional fields', () => {
      const r = SubagentCompletedPayload.safeParse({
        agentName: 'impl',
        runId: 'r1',
        summary: 'Done',
        artifacts: [{ path: 'src/a.ts', action: 'created' }],
      });
      assert.equal(r.success, true);
    });
  });

  describe('SubagentFailedPayload', () => {
    it('accepts valid data', () => {
      const r = SubagentFailedPayload.safeParse({ agentName: 'impl', error: 'Compilation failed' });
      assert.equal(r.success, true);
    });
  });

  describe('FindingCreatedPayload', () => {
    it('accepts valid data', () => {
      const r = FindingCreatedPayload.safeParse({
        findingId: 'f-1',
        severity: 'high',
        description: 'SQL injection risk',
      });
      assert.equal(r.success, true);
    });
  });

  describe('FixTaskCreatedPayload', () => {
    it('accepts valid data', () => {
      const r = FixTaskCreatedPayload.safeParse({ taskId: 101, title: 'Fix SQL injection', source: 'review' });
      assert.equal(r.success, true);
    });
  });

  describe('FixTaskCompletedPayload', () => {
    it('accepts valid data', () => {
      const r = FixTaskCompletedPayload.safeParse({ taskId: 101, resolution: 'Used parameterized query' });
      assert.equal(r.success, true);
    });
  });

  describe('WorkflowCreatedPayload', () => {
    it('accepts valid data with optional fields', () => {
      const r = WorkflowCreatedPayload.safeParse({
        feature: 'Auth system',
        branch: 'feat/auth',
        spec: 'specs/002-auth',
      });
      assert.equal(r.success, true);
    });

    it('accepts minimal data', () => {
      const r = WorkflowCreatedPayload.safeParse({ feature: 'Auth' });
      assert.equal(r.success, true);
    });
  });

  describe('WorkflowHaltedPayload', () => {
    it('accepts valid data', () => {
      const r = WorkflowHaltedPayload.safeParse({ reason: 'User requested pause' });
      assert.equal(r.success, true);
    });
  });

  describe('WorkflowClosedPayload', () => {
    it('accepts empty object', () => {
      const r = WorkflowClosedPayload.safeParse({});
      assert.equal(r.success, true);
    });
  });

  describe('ContextStoredPayload', () => {
    it('accepts valid data', () => {
      const r = ContextStoredPayload.safeParse({ category: 'briefing', key: 'objective' });
      assert.equal(r.success, true);
    });
  });

  describe('NoteAddedPayload', () => {
    it('accepts valid data', () => {
      const r = NoteAddedPayload.safeParse({ text: 'Remember to check edge cases' });
      assert.equal(r.success, true);
    });
  });
});

describe('EventEnvelopeSchema', () => {
  it('accepts a valid event envelope', () => {
    const r = EventEnvelopeSchema.safeParse({
      eventId: '00000000-0000-0000-0000-000000000001',
      workflowId: '00000000-0000-0000-0000-000000000000',
      seq: 1,
      timestamp: '2026-01-01T00:00:00Z',
      actorKind: 'coordinator',
      actorName: 'workon.myspec',
      phaseKey: 'research',
      eventType: 'phase-started',
      payload: { phaseKey: 'research', startedAt: '2026-01-01T00:00:00Z' },
    });
    assert.equal(r.success, true);
  });

  it('accepts envelope without optional fields', () => {
    const r = EventEnvelopeSchema.safeParse({
      eventId: 'e1',
      workflowId: 'w1',
      seq: 1,
      timestamp: '2026-01-01T00:00:00Z',
      actorKind: 'tool',
      actorName: 'create-workflow',
      eventType: 'workflow-created',
      payload: { feature: 'Test' },
    });
    assert.equal(r.success, true);
  });

  it('rejects invalid actorKind', () => {
    const r = EventEnvelopeSchema.safeParse({
      eventId: 'e1',
      workflowId: 'w1',
      seq: 1,
      timestamp: '2026-01-01T00:00:00Z',
      actorKind: 'bot',
      actorName: 'test',
      eventType: 'workflow-created',
      payload: {},
    });
    assert.equal(r.success, false);
  });

  it('rejects invalid eventType', () => {
    const r = EventEnvelopeSchema.safeParse({
      eventId: 'e1',
      workflowId: 'w1',
      seq: 1,
      timestamp: '2026-01-01T00:00:00Z',
      actorKind: 'coordinator',
      actorName: 'test',
      eventType: 'invalid-event',
      payload: {},
    });
    assert.equal(r.success, false);
  });

  it('rejects non-integer seq', () => {
    const r = EventEnvelopeSchema.safeParse({
      eventId: 'e1',
      workflowId: 'w1',
      seq: 1.5,
      timestamp: '2026-01-01T00:00:00Z',
      actorKind: 'coordinator',
      actorName: 'test',
      eventType: 'workflow-created',
      payload: {},
    });
    assert.equal(r.success, false);
  });
});
