import type { Generated } from 'kysely';

export interface WorkflowsTable {
  workflow_id: string;
  feature_name: string;
  branch_name: string | null;
  spec_dir: string | null;
  phase_config_json: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface WorkflowStateTable {
  workflow_id: string;
  progress_state_json: string;
  current_phase_key: string | null;
  state_version: Generated<number>;
}

export interface WorkflowEventsTable {
  event_id: string;
  workflow_id: string;
  seq: number;
  timestamp: string;
  actor_kind: string;
  actor_name: string;
  actor_run_id: string | null;
  phase_key: string | null;
  event_type: string;
  payload_json: string;
}

export interface WorkflowEvidenceTable {
  evidence_id: string;
  workflow_id: string;
  phase_key: string;
  category: string;
  data_json: string;
  gate_result: string;
  submitted_by: string;
  submitted_at: string;
}

export interface WorkflowContextTable {
  workflow_id: string;
  category: string;
  key: string;
  value: string;
  authored_by: string;
  created_at: string;
  updated_at: string;
}

export interface Database {
  workflows: WorkflowsTable;
  workflow_state: WorkflowStateTable;
  workflow_events: WorkflowEventsTable;
  workflow_evidence: WorkflowEvidenceTable;
  workflow_context: WorkflowContextTable;
}
