// Shared TypeScript types for the Workflow State Service

export interface ProgressState {
  feature: string;
  branch?: string;
  spec?: string;
  complexityScore?: number;
  startedAt: string;
  phases: Record<string, PhaseState>;
  tasks: Task[];
  fixTasks: FixTask[];
  context: Record<string, unknown>;
  haltReason: string | null;
}

export interface PhaseState {
  status: 'not-started' | 'in-progress' | 'completed' | 'blocked';
  startedAt: string | null;
  completedAt: string | null;
  summary: string | null;
  metadata?: Record<string, unknown>;
}

export interface PhaseConfig {
  phases: PhaseDefinition[];
  transitions: TransitionRule[];
  maxCycles?: number;
}

export interface PhaseDefinition {
  key: string;
  label: string;
  ordinal: number;
}

export interface TransitionRule {
  from: string;
  to: string;
  gateRules: GateRule[];
}

export interface GateRule {
  evidenceCategory: EvidenceCategory;
  condition: 'must-pass' | 'should-pass' | 'informational';
  description: string;
}

export type EvidenceCategory =
  | 'test-results'
  | 'error-diagnostic'
  | 'checklist'
  | 'agent-completion'
  | 'code-review'
  | 'custom';

export interface Task {
  id: number;
  title: string;
  status: 'not-started' | 'in-progress' | 'completed';
}

export interface FixTask extends Task {
  source: 'gate' | 'review' | 'analysis' | 'manual';
}

export interface ContextEntry {
  category: 'briefing' | 'delegation' | 'decision';
  key: string;
  value: string;
  authoredBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceRecord {
  evidenceId: string;
  workflowId: string;
  phaseKey: string;
  category: EvidenceCategory;
  data: object;
  gateResult: 'pass' | 'fail' | 'warn' | 'pending';
  submittedBy: string;
  submittedAt: string;
}

export interface WorkflowEvent {
  eventId: string;
  workflowId: string;
  seq: number;
  timestamp: string;
  actorKind: 'coordinator' | 'subagent' | 'human' | 'tool';
  actorName: string;
  actorRunId?: string;
  phaseKey?: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface ToolError {
  code: string;
  message: string;
  details?: object;
}
