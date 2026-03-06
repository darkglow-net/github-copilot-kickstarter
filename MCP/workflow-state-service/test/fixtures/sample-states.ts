import type { ProgressState, EvidenceRecord, WorkflowEvent } from '../../src/types.ts';

export const sampleProgressState: ProgressState = {
  feature: 'Test Feature',
  branch: 'feat/test',
  spec: 'specs/001-test',
  complexityScore: 5,
  startedAt: '2026-03-06T10:00:00Z',
  phases: {
    research: {
      status: 'completed',
      startedAt: '2026-03-06T10:00:00Z',
      completedAt: '2026-03-06T11:00:00Z',
      summary: 'Research complete',
    },
    implement: {
      status: 'in-progress',
      startedAt: '2026-03-06T11:00:00Z',
      completedAt: null,
      summary: null,
    },
    review: {
      status: 'not-started',
      startedAt: null,
      completedAt: null,
      summary: null,
    },
  },
  tasks: [
    { id: 100, title: 'Setup project', status: 'completed' },
    { id: 101, title: 'Implement core', status: 'in-progress' },
  ],
  fixTasks: [],
  context: { affectedFiles: ['src/main.ts'] },
  haltReason: null,
};

export const sampleTestResultsPass = {
  framework: 'node:test',
  passed: 10,
  failed: 0,
  total: 10,
};

export const sampleTestResultsFail = {
  framework: 'node:test',
  passed: 8,
  failed: 2,
  total: 10,
};

export const sampleErrorDiagnosticPass = {
  source: 'typescript-compiler',
  errors: 0,
  warnings: 2,
};

export const sampleErrorDiagnosticFail = {
  source: 'typescript-compiler',
  errors: 3,
  warnings: 1,
};

export const sampleChecklistPass = {
  checklistName: 'pre-review',
  totalItems: 5,
  completedItems: 5,
  failedItems: 0,
};

export const sampleChecklistFail = {
  checklistName: 'pre-review',
  totalItems: 5,
  completedItems: 3,
  failedItems: 1,
};

export const sampleAgentCompletionPass = {
  agentName: 'speckit.implement',
  taskDescription: 'Implement feature',
  status: 'completed' as const,
  summary: 'All tasks done',
};

export const sampleCodeReviewPass = {
  reviewer: 'code-review-agent',
  reviewerType: 'agent' as const,
  verdict: 'approved' as const,
  findingCount: 2,
  criticalFindings: 0,
};

export const sampleCodeReviewFail = {
  reviewer: 'code-review-agent',
  reviewerType: 'agent' as const,
  verdict: 'changes-requested' as const,
  findingCount: 3,
  criticalFindings: 1,
};

export const sampleCustomEvidencePass = {
  label: 'Custom check',
  payload: { detail: 'ok' },
  passed: true,
};

export const sampleEvent: WorkflowEvent = {
  eventId: '00000000-0000-0000-0000-000000000001',
  workflowId: '00000000-0000-0000-0000-000000000000',
  seq: 1,
  timestamp: '2026-03-06T10:00:00Z',
  actorKind: 'coordinator',
  actorName: 'workon.myspec',
  phaseKey: 'research',
  eventType: 'phase-started',
  payload: { phaseKey: 'research', startedAt: '2026-03-06T10:00:00Z' },
};
