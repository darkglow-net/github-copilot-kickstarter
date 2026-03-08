# Data Model: Workflow State Service

**Feature**: Workflow State Service
**Source**: [spec.md](spec.md) Section 5
**Date**: 2026-03-06

---

## Entity Relationship Diagram

```
┌──────────────────────┐
│     workflows        │
│──────────────────────│
│ PK workflow_id  TEXT │──┐
│    feature_name TEXT │  │
│    branch_name  TEXT │  │
│    spec_dir     TEXT │  │  1:1
│    phase_config_json │  │───────────┐
│    created_at   TEXT │  │           │
│    updated_at   TEXT │  │           ▼
│    closed_at    TEXT │  │  ┌──────────────────────┐
└──────────────────────┘  │  │   workflow_state      │
                          │  │──────────────────────│
                          │  │ PK/FK workflow_id     │
                          │  │ progress_state_json   │
                          │  │ current_phase_key     │
                          │  │ state_version INTEGER │
                          │  └──────────────────────┘
                          │
                          │  1:N
                          │───────────┐
                          │           ▼
                          │  ┌──────────────────────────┐
                          │  │   workflow_events         │
                          │  │──────────────────────────│
                          │  │ PK event_id       TEXT   │
                          │  │ FK workflow_id     TEXT   │
                          │  │    seq            INTEGER │
                          │  │    timestamp       TEXT   │
                          │  │    actor_kind       TEXT  │
                          │  │    actor_name       TEXT  │
                          │  │    actor_run_id     TEXT  │
                          │  │    phase_key        TEXT  │
                          │  │    event_type       TEXT  │
                          │  │    payload_json     TEXT  │
                          │  └──────────────────────────┘
                          │
                          │  1:N
                          │───────────┐
                          │           ▼
                          │  ┌──────────────────────────┐
                          │  │   workflow_evidence       │
                          │  │──────────────────────────│
                          │  │ PK evidence_id     TEXT  │
                          │  │ FK workflow_id      TEXT  │
                          │  │    phase_key        TEXT  │
                          │  │    category         TEXT  │
                          │  │    data_json        TEXT  │
                          │  │    gate_result      TEXT  │
                          │  │    submitted_by     TEXT  │
                          │  │    submitted_at     TEXT  │
                          │  └──────────────────────────┘
                          │
                          │  1:N (composite PK)
                          └───────────┐
                                      ▼
                             ┌──────────────────────────┐
                             │   workflow_context        │
                             │──────────────────────────│
                             │ PK/FK workflow_id   TEXT  │
                             │ PK    category      TEXT  │
                             │ PK    key           TEXT  │
                             │       value         TEXT  │
                             │       authored_by   TEXT  │
                             │       created_at    TEXT  │
                             │       updated_at    TEXT  │
                             └──────────────────────────┘
```

---

## Table Definitions

### 1. `workflows` (Root Entity)

Stores workflow identity and immutable phase configuration.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `workflow_id` | TEXT | PRIMARY KEY | UUID v4 |
| `feature_name` | TEXT | NOT NULL | Human-readable feature name |
| `branch_name` | TEXT | | Git branch (optional) |
| `spec_dir` | TEXT | | Workspace path to spec directory |
| `phase_config_json` | TEXT | NOT NULL | Serialized `PhaseConfig` (immutable after creation) |
| `created_at` | TEXT | NOT NULL | ISO-8601 timestamp |
| `updated_at` | TEXT | NOT NULL | ISO-8601 timestamp (updated on every mutation) |
| `closed_at` | TEXT | | ISO-8601 timestamp (set on close) |

**Indexes**: `idx_workflows_updated` on `(updated_at)` — used by TTL purge queries.

**Activity tracking**: `updated_at` is touched by all mutating tools: `create-workflow`, `transition-phase`, `update-state`, `halt-workflow`, `resume-workflow`, `append-event`, `submit-evidence`, `store-context`, `close-workflow`. Read-only tools do not update it.

### 2. `workflow_state` (1:1 with `workflows`)

Stores the mutable `ProgressState` JSON and current phase pointer.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `workflow_id` | TEXT | PK, FK → workflows ON DELETE CASCADE | 1:1 relationship |
| `progress_state_json` | TEXT | NOT NULL | Serialized `ProgressState` |
| `current_phase_key` | TEXT | | Active phase key (`null` when all completed) |
| `state_version` | INTEGER | NOT NULL, DEFAULT 1 | Monotonic counter (debug/audit, not concurrency control) |

### 3. `workflow_events` (1:N with `workflows`)

Append-only event log. Events are never modified or deleted except via workflow purge.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `event_id` | TEXT | PRIMARY KEY | UUID v4 |
| `workflow_id` | TEXT | NOT NULL, FK → workflows ON DELETE CASCADE | Parent workflow |
| `seq` | INTEGER | NOT NULL | Auto-incrementing per workflow |
| `timestamp` | TEXT | NOT NULL | ISO-8601 |
| `actor_kind` | TEXT | NOT NULL | `coordinator`, `subagent`, `human`, `tool` |
| `actor_name` | TEXT | NOT NULL | Actor identifier |
| `actor_run_id` | TEXT | | Subagent invocation ID |
| `phase_key` | TEXT | | Phase this event relates to |
| `event_type` | TEXT | NOT NULL | Discriminator (18 types) |
| `payload_json` | TEXT | NOT NULL | Typed payload per event_type |

**Indexes**:
- `idx_events_workflow_seq` on `(workflow_id, seq)` — cursor-based pagination
- `idx_events_workflow_type` on `(workflow_id, event_type)` — event type filtering

**`seq` assignment**: `COALESCE((SELECT MAX(seq) FROM workflow_events WHERE workflow_id = ?), 0) + 1` within the INSERT transaction.

### 4. `workflow_evidence` (1:N with `workflows`)

Stores typed evidence records submitted to satisfy phase gates.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `evidence_id` | TEXT | PRIMARY KEY | UUID v4 |
| `workflow_id` | TEXT | NOT NULL, FK → workflows ON DELETE CASCADE | Parent workflow |
| `phase_key` | TEXT | NOT NULL | Phase this evidence relates to |
| `category` | TEXT | NOT NULL | One of 6 evidence categories |
| `data_json` | TEXT | NOT NULL | Category-specific data |
| `gate_result` | TEXT | NOT NULL | `pass`, `fail`, `warn`, `pending` |
| `submitted_by` | TEXT | NOT NULL | Actor name |
| `submitted_at` | TEXT | NOT NULL | ISO-8601 |

**Indexes**:
- `idx_evidence_workflow_phase_cat` on `(workflow_id, phase_key, category)` — gate evaluation
- `idx_evidence_workflow` on `(workflow_id)` — full evidence retrieval

**Scoping**: Evidence is scoped to phases, not transitions. Gate evaluation uses the latest `gate_result` per `(phase_key, category)`.

### 5. `workflow_context` (1:N with `workflows`, composite PK)

Stores workflow-scoped context entries that survive chat compaction.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `workflow_id` | TEXT | NOT NULL, FK → workflows ON DELETE CASCADE | Parent workflow |
| `category` | TEXT | NOT NULL | `briefing`, `delegation`, `decision` |
| `key` | TEXT | NOT NULL | Entry identifier within category |
| `value` | TEXT | NOT NULL | Content (plain text or JSON string) |
| `authored_by` | TEXT | NOT NULL | Agent that created/updated |
| `created_at` | TEXT | NOT NULL | ISO-8601 (initial creation) |
| `updated_at` | TEXT | NOT NULL | ISO-8601 (last update) |

**Primary Key**: `(workflow_id, category, key)` — composite.

**Indexes**: `idx_context_workflow_cat` on `(workflow_id, category)`.

**Upsert**: `INSERT OR REPLACE` on composite PK — replaces `value`, `authored_by`, `updated_at`.

---

## Domain Types (Serialized as JSON)

### ProgressState

Serialized in `workflow_state.progress_state_json`. Contains all mutable workflow state.

| Field | Type | Description |
|-------|------|-------------|
| `feature` | string | Feature name |
| `branch` | string? | Git branch |
| `spec` | string? | Spec directory path |
| `complexityScore` | number? | 0-15 range |
| `startedAt` | string | ISO-8601 |
| `phases` | `Record<string, PhaseState>` | Phase key → state |
| `tasks` | `Task[]` | Work items |
| `fixTasks` | `FixTask[]` | Fix items from gates/reviews |
| `context` | `Record<string, unknown>` | Arbitrary context data |
| `haltReason` | `string \| null` | Non-null when halted |

### PhaseState

| Field | Type | Description |
|-------|------|-------------|
| `status` | `"not-started" \| "in-progress" \| "completed" \| "blocked"` | Current status |
| `startedAt` | `string \| null` | ISO-8601 |
| `completedAt` | `string \| null` | ISO-8601 |
| `summary` | `string \| null` | Completion summary |
| `metadata` | `Record<string, unknown>?` | Phase-specific data |

### PhaseConfig (Immutable after creation)

| Field | Type | Description |
|-------|------|-------------|
| `phases` | `PhaseDefinition[]` | Phase definitions |
| `transitions` | `TransitionRule[]` | Legal transitions with gate rules |
| `maxCycles` | `number?` | Max implement↔review cycles (default: 4) |

### Task / FixTask

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Sequential ID (minimum 100) |
| `title` | string | Description |
| `status` | `"not-started" \| "in-progress" \| "completed"` | Current status |
| `source` | string | (FixTask only) `gate`, `review`, `analysis`, `manual` |

---

## Evidence Categories (6 MVP)

| Category | Key Fields | Gate Result Rule |
|----------|------------|-----------------|
| `test-results` | `passed`, `failed`, `total` | `failed === 0 ? "pass" : "fail"` |
| `error-diagnostic` | `errors`, `warnings` | `errors === 0 ? "pass" : "fail"` |
| `checklist` | `totalItems`, `completedItems`, `failedItems` | `failedItems === 0 && completedItems === totalItems ? "pass" : "fail"` |
| `agent-completion` | `status`, `summary` | `status === "completed" ? "pass" : "fail"` |
| `code-review` | `verdict`, `criticalFindings` | `verdict === "approved" && criticalFindings === 0 ? "pass" : "fail"` |
| `custom` | `label`, `payload`, `passed` | `passed ? "pass" : "fail"` |

---

## Event Types (18)

| Event Type | Key Payload Fields |
|------------|-------------------|
| `phase-started` | `phaseKey`, `startedAt` |
| `phase-completed` | `phaseKey`, `completedAt`, `summary` |
| `phase-blocked` | `phaseKey`, `reason` |
| `evidence-submitted` | `evidenceCategory`, `gateResult`, `data` |
| `transition-requested` | `from`, `to` |
| `transition-approved` | `from`, `to` |
| `transition-rejected` | `from`, `to`, `reason` |
| `subagent-dispatched` | `agentName`, `runId`, `taskDescription` |
| `subagent-completed` | `agentName`, `runId`, `summary`, `artifacts` |
| `subagent-failed` | `agentName`, `runId`, `error` |
| `finding-created` | `findingId`, `severity`, `description` |
| `fix-task-created` | `taskId`, `title`, `source` |
| `fix-task-completed` | `taskId`, `resolution` |
| `workflow-created` | `feature`, `branch`, `spec` |
| `workflow-halted` | `reason` |
| `workflow-closed` | (empty) |
| `context-stored` | `category`, `key` |
| `note-added` | `text` |

---

## Context Entry Categories (3)

| Category | Purpose |
|----------|---------|
| `briefing` | Original user request, mission statement |
| `delegation` | Instructions given to subagents |
| `decision` | Key design decisions, rejected alternatives |

---

## Cascade Behavior

All child tables use `ON DELETE CASCADE` on `workflow_id`. Deleting a `workflows` row automatically removes all:
- `workflow_state` (1:1)
- `workflow_events` (1:N)
- `workflow_evidence` (1:N)
- `workflow_context` (1:N)

This is the mechanism for both `close-workflow` purge and orphan TTL purge.

---

## State Transitions

Valid `PhaseState.status` transitions:

```
not-started → in-progress    (transition-phase sets "to" phase)
in-progress → completed      (transition-phase completes "from" phase)
in-progress → blocked        (halt-workflow)
blocked     → in-progress    (resume-workflow)
```

**Re-entry**: A phase that was previously `completed` can be re-entered (set back to `in-progress`) via a back-edge transition (e.g., `review → implement`). The `completedAt` and `summary` are cleared on re-entry. Phase metadata is preserved.
