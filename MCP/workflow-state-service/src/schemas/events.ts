import * as z from 'zod/v4';

// Event payload schemas for each of the 18 event types
export const PhaseStartedPayload = z.object({
  phaseKey: z.string(),
  startedAt: z.string(),
});

export const PhaseCompletedPayload = z.object({
  phaseKey: z.string(),
  completedAt: z.string(),
  summary: z.string(),
});

export const PhaseBlockedPayload = z.object({
  phaseKey: z.string(),
  reason: z.string(),
});

export const EvidenceSubmittedPayload = z.object({
  evidenceCategory: z.string(),
  gateResult: z.string(),
  data: z.record(z.string(), z.unknown()),
});

export const TransitionRequestedPayload = z.object({
  from: z.string(),
  to: z.string(),
});

export const TransitionApprovedPayload = z.object({
  from: z.string(),
  to: z.string(),
});

export const TransitionRejectedPayload = z.object({
  from: z.string(),
  to: z.string(),
  reason: z.string(),
});

export const SubagentDispatchedPayload = z.object({
  agentName: z.string(),
  runId: z.string(),
  taskDescription: z.string(),
});

export const SubagentCompletedPayload = z.object({
  agentName: z.string(),
  runId: z.string().optional(),
  summary: z.string(),
  artifacts: z.array(z.object({
    path: z.string(),
    action: z.enum(['created', 'modified']),
  })).optional(),
});

export const SubagentFailedPayload = z.object({
  agentName: z.string(),
  runId: z.string().optional(),
  error: z.string(),
});

export const FindingCreatedPayload = z.object({
  findingId: z.string(),
  severity: z.string(),
  description: z.string(),
});

export const FixTaskCreatedPayload = z.object({
  taskId: z.number(),
  title: z.string(),
  source: z.string(),
});

export const FixTaskCompletedPayload = z.object({
  taskId: z.number(),
  resolution: z.string(),
});

export const WorkflowCreatedPayload = z.object({
  feature: z.string(),
  branch: z.string().optional(),
  spec: z.string().optional(),
});

export const WorkflowHaltedPayload = z.object({
  reason: z.string(),
});

export const WorkflowClosedPayload = z.object({});

export const ContextStoredPayload = z.object({
  category: z.string(),
  key: z.string(),
});

export const NoteAddedPayload = z.object({
  text: z.string(),
});

export const EVENT_TYPES = [
  'phase-started',
  'phase-completed',
  'phase-blocked',
  'evidence-submitted',
  'transition-requested',
  'transition-approved',
  'transition-rejected',
  'subagent-dispatched',
  'subagent-completed',
  'subagent-failed',
  'finding-created',
  'fix-task-created',
  'fix-task-completed',
  'workflow-created',
  'workflow-halted',
  'workflow-closed',
  'context-stored',
  'note-added',
] as const;

export const EventTypeSchema = z.enum(EVENT_TYPES);

export const eventPayloadSchemas: Record<string, z.ZodType> = {
  'phase-started': PhaseStartedPayload,
  'phase-completed': PhaseCompletedPayload,
  'phase-blocked': PhaseBlockedPayload,
  'evidence-submitted': EvidenceSubmittedPayload,
  'transition-requested': TransitionRequestedPayload,
  'transition-approved': TransitionApprovedPayload,
  'transition-rejected': TransitionRejectedPayload,
  'subagent-dispatched': SubagentDispatchedPayload,
  'subagent-completed': SubagentCompletedPayload,
  'subagent-failed': SubagentFailedPayload,
  'finding-created': FindingCreatedPayload,
  'fix-task-created': FixTaskCreatedPayload,
  'fix-task-completed': FixTaskCompletedPayload,
  'workflow-created': WorkflowCreatedPayload,
  'workflow-halted': WorkflowHaltedPayload,
  'workflow-closed': WorkflowClosedPayload,
  'context-stored': ContextStoredPayload,
  'note-added': NoteAddedPayload,
};

export const ActorKindSchema = z.enum(['coordinator', 'subagent', 'human', 'tool']);

export const EventEnvelopeSchema = z.object({
  eventId: z.string(),
  workflowId: z.string(),
  seq: z.number().int(),
  timestamp: z.string(),
  actorKind: ActorKindSchema,
  actorName: z.string(),
  actorRunId: z.string().optional(),
  phaseKey: z.string().optional(),
  eventType: EventTypeSchema,
  payload: z.record(z.string(), z.unknown()),
});
