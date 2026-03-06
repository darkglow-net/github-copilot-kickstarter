# Workflow State Service — Specification

**Version**: 0.1.0
**Date**: 2026-03-06
**Status**: Approved
**Author**: Coordinator + User brainstorming session

---

## 1. Overview

### 1.1 Problem Statement

AI workflow coordinators (like `workon.myspec` and `workon.myidea`) manage multi-phase development workflows where state is tracked via `PROGRESS.json` files. This approach has three critical failure modes:

1. **Chat compaction** erases workflow progress — the LLM's context window is the only place state lives during a session
2. **File-based state** lacks concurrency control — concurrent subagent writes risk clobbering
3. **Phase transitions are prompt-interpreted** — no enforcement mechanism prevents skipping phases or bypassing quality gates

### 1.2 Solution

A local MCP server (the **Workflow State Service**) that:

- Stores workflow state and event logs in a SQLite database inside a Docker container
- Exposes a typed tool surface for state management, transitions, and audit
- Enforces phase transition rules and evidence requirements defined per-workflow
- Survives chat compaction and session boundaries
- Exports final state as structured data on workflow close

### 1.3 Design Principles

- **Session-survivable**: State lives outside chat context — recovered via tool calls, not memory
- **Coordinator-only mutations**: Only the coordinator can transition phases; subagents append events
- **Generic engine**: Phase names and transitions are caller-defined, not hardcoded
- **Typed boundaries**: Zod validates all tool I/O at the MCP boundary
- **Disposable data**: Workflow data is exported to the caller before purge; the database is a cache, not the source of truth. Code and git diffs are the permanent artifacts.
- **Trust-but-validate**: Server validates evidence structure, not truthfulness (MVP)

---

## 2. Functional Requirements

### FR-001: Workflow Lifecycle Management

The server SHALL support creating, querying, resuming, exporting, and closing workflows.

- **FR-001.1**: `create-workflow` creates a new workflow with caller-provided phase configuration
- **FR-001.2**: `list-active` returns all workflows with a phase status of `in-progress`, `blocked`, or all phases `completed` (awaiting close)
- **FR-001.3**: `get-state` returns the current state of a specific workflow
- **FR-001.4**: `export-workflow` returns the full `ProgressState` snapshot and event log as structured data in the tool response (the caller writes files if desired)
- **FR-001.5**: `close-workflow` returns export data, then purges the workflow from the database
- **FR-001.6**: `resume-workflow` clears a halted workflow's block, restoring the blocked phase to `in-progress`

### FR-002: Phase Transition Enforcement

The server SHALL enforce legal phase transitions as defined in the workflow's phase configuration.

- **FR-002.1**: `transition-phase` validates that the requested transition is allowed by the workflow's declared transition map
- **FR-002.2**: Transitions require evidence matching the categories declared in the phase configuration's gate rules
- **FR-002.3**: The server rejects transitions missing `must-pass` evidence or evidence with a `fail` gate result
- **FR-002.4**: Only the coordinator (identified by `actorKind: "coordinator"`) may call `transition-phase`

### FR-003: Event Log

The server SHALL maintain an append-only event log for each workflow.

- **FR-003.1**: `append-event` adds a typed event to the workflow's event log
- **FR-003.2**: `get-events` retrieves events with cursor-based pagination
- **FR-003.3**: Events use a common envelope (see Section 5.4) with typed payloads discriminated by `eventType`

### FR-004: Evidence Management

The server SHALL validate evidence against typed category schemas.

- **FR-004.1**: Evidence categories are registered as typed schemas (see Section 5.5)
- **FR-004.2**: `submit-evidence` accepts evidence for a workflow phase, validates it against the category schema, and records it
- **FR-004.3**: `get-evidence` retrieves evidence for a workflow, optionally filtered by phase and/or category
- **FR-004.4**: Evidence carries a unified `gateResult` field: `pass`, `fail`, `warn`, or `pending`

### FR-005: Validation Tools

The server SHALL provide tools for common validation queries without requiring the coordinator to compute them.

- **FR-005.1**: `validate-state` checks a workflow's state for structural integrity and returns any inconsistencies
- **FR-005.2**: `check-caps` computes cycle counts (rubric attempts + review attempts) and reports whether caps are exceeded
- **FR-005.3**: `allocate-task-id` returns the next sequential task ID (minimum 100) for a workflow's task or fix-task list

### FR-006: Data Retention

The server SHALL automatically manage database size.

- **FR-006.1**: `close-workflow` returns export data then purges the workflow from the database
- **FR-006.2**: Workflows with no activity for a configurable TTL (default: 7 days) are automatically purged on server startup and periodically (every 24 hours while the server is running)
- **FR-006.3**: The server logs a warning when purging orphaned workflows

### FR-007: Subagent Event Reporting

Subagents SHALL be able to append events and report completion without mutating workflow state.

- **FR-007.1**: `report-done` is a convenience tool that creates an `agent-completion` evidence record and a `subagent-completed` event in one call
- **FR-007.2**: Subagents may call `get-state`, `get-events`, `append-event`, `report-done`, `store-context`, and `get-context`
- **FR-007.3**: Subagents SHOULD NOT call `transition-phase`, `close-workflow`, or `export-workflow`. The server does not distinguish callers since all MCP connections share the same transport, but this restriction can be **structurally enforced** at the agent layer:
  - `transition-phase` enforces `actorKind === "coordinator"` on every call (server-side guard)
  - Subagent `.agent.md` files declare a restricted `tools` frontmatter listing only FR-007.2 tools (e.g., `tools: ['workflow-state-service/get-state', 'workflow-state-service/report-done', ...]`), which prevents the LLM from invoking omitted tools
  - Coordinator `.agent.md` files use `agents` frontmatter to restrict which subagents may be delegated to
  - See Section 10.4 for recommended tool sets and example agent configurations

### FR-008: Context Memory

Both coordinators and subagents SHALL be able to store and retrieve workflow-scoped context entries that survive chat compaction and session boundaries.

- **FR-008.1**: `store-context` upserts a categorized context entry identified by `(workflowId, category, key)`
- **FR-008.2**: `get-context` retrieves context entries with optional category/key filters
- **FR-008.3**: `get-briefing` returns a compiled summary of the workflow's identity, original request, active decisions, current phase, and recent context entries — designed as the first tool call after compaction recovery
- **FR-008.4**: Context entries are included in `export-workflow` and `close-workflow` responses
- **FR-008.5**: Context entries are purged with the workflow (ON DELETE CASCADE)

---

## 3. Non-Functional Requirements

### NFR-001: Containerization

- The server runs in a single Docker container (Node.js 24 Alpine + SQLite)
- No external database dependencies
- SQLite data stored on a Docker named volume (persists across container restarts)
- Docker Compose file provided for single-command startup

### NFR-002: Transport

- HTTP/SSE via `createMcpExpressApp()` (MCP SDK v2 Express middleware)
- Supports concurrent connections from multiple VS Code windows or external clients
- Default port: 3001 (configurable via environment variable)
- `/health` endpoint returns 200 + database connection status (used by Docker HEALTHCHECK)

### NFR-003: Performance

- Tool call latency < 50ms for state operations (SQLite on local disk)
- Event log queries support cursor-based pagination (default page size: 100)
- SQLite WAL mode for concurrent read/write safety

### NFR-004: Reliability

- SQLite atomic writes prevent state corruption
- Transactions wrap all multi-step state mutations
- Server gracefully handles corrupt database (logs error, offers reset)

### NFR-005: Security

- Local-only server (binds to 127.0.0.1 by default)
- No authentication for MVP (local trust model)
- Input validation via Zod on all tool parameters
- No arbitrary command execution (trust caller for evidence, MVP)
- DNS rebinding protection enabled

### NFR-006: Observability

- Structured logging (JSON format) to stdout
- MCP protocol logging via `ctx.mcpReq.log()`
- Log level configurable via environment variable (default: `info`)

### NFR-007: Client Notifications

- On MCP client connection, the server sends a notification if active workflows exist: `{ activeWorkflows: number }` with a human-readable message listing feature names
- Uses MCP SDK v2 `server.notification()` — no client action required, but clients that support notifications will surface the alert
- This serves as the **generic recovery anchor** — any agent in any prompt, on any branch, without a spec folder, receives the signal that prior work exists

---

## 4. Tech Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Runtime | Node.js | 24 LTS (24.14.0) | Active LTS, broad ecosystem |
| Language | TypeScript | 5.x (5.9.3) | Type safety, MCP SDK integration |
| MCP SDK | @modelcontextprotocol/server | v2 (pre-alpha, GitHub main) | Official SDK, `registerTool()` API, Zod v4 integration. Stable v2 release expected Q1 2026. |
| MCP Middleware | @modelcontextprotocol/express | v2 (pre-alpha, GitHub main) | Official Express adapter — `createMcpExpressApp()` with DNS rebinding protection, CORS, body parsing |
| Validation | Zod | v4 (4.3.6) | Built-in MCP SDK v2 support, `import * as z from 'zod/v4'` |
| Database | SQLite | 3.x | Embedded, zero-config, WAL mode |
| SQLite Driver | better-sqlite3 | 12.6.2 | Synchronous (< 1ms queries), WAL support, Node 24 prebuilds |
| Query Builder | Kysely | 0.28.11 | Type-safe SQL, `SqliteDialect`, compile-time column validation |
| Container | Docker | latest | Single container, `node:24-alpine` base |
| Transport | (managed by `createMcpExpressApp()`) | (MCP SDK) | HTTP/SSE transport created internally by Express middleware, concurrent client support |
| HTTP Framework | Express | 5.x (5.2.1) | Required by `@modelcontextprotocol/express` middleware |
| Testing | Node.js test runner | built-in | Zero dependencies |

### 4.1 Rejected Alternatives

| Alternative | Reason for rejection |
|-------------|---------------------|
| TypeSpec | Adds DSL + build step + 5 npm deps. Produces identical JSON Schema to Zod. Overhead not justified for this use case. See [typespec-typescript-workflow-validation-spike.md](../../docs/spikes/typespec-typescript-workflow-validation-spike.md). |
| Python runtime | Less MCP SDK ecosystem alignment. User's workspace instructions target TypeScript. |
| PostgreSQL | Overkill for local disposable state. Requires separate container. |
| stdio transport | Doesn't support concurrent connections from multiple clients. HTTP/SSE future-proofs. |
| Full event sourcing | Significant complexity. Flat event log with state-as-primary is sufficient for audit and recovery. |
| Server-side evidence verification | Requires workspace filesystem access and arbitrary command execution. Trust caller for MVP. |
| `@modelcontextprotocol/node` | Zero framework dep but requires manual Host header validation, body parsing, HTTP setup. More boilerplate than Express adapter. |
| `@modelcontextprotocol/hono` | `createMcpHonoApp()` similar ergonomics to Express. Hono is ultra-light (~14KB) but less Node.js server ecosystem presence. |
| `fastify-mcp` (third-party) | No official MCP SDK middleware for Fastify. Third-party plugin by haroldadmin; not maintained by MCP SDK team. |

---

## 5. Data Model

### 5.1 Database Schema

Five tables: `workflows`, `workflow_state`, `workflow_events`, `workflow_evidence`, and `workflow_context`.

#### `workflows`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `workflow_id` | TEXT | PRIMARY KEY | UUID v4 |
| `feature_name` | TEXT | NOT NULL | Human-readable feature name |
| `branch_name` | TEXT | | Git branch (optional) |
| `spec_dir` | TEXT | | Workspace path to spec directory |
| `phase_config_json` | TEXT | NOT NULL | Serialized phase configuration (names, transitions, gate rules) |
| `created_at` | TEXT | NOT NULL | ISO-8601 timestamp |
| `updated_at` | TEXT | NOT NULL | ISO-8601 timestamp |
| `closed_at` | TEXT | | ISO-8601 timestamp, set on close |

**Indexes**:

- `idx_workflows_updated` on `(updated_at)` — TTL purge queries

**Activity tracking**: `updated_at` is set to the current timestamp on every mutating tool call: `create-workflow`, `transition-phase`, `update-state`, `halt-workflow`, `resume-workflow`, `append-event`, `submit-evidence`, `store-context`, and `close-workflow`. Read-only tools (`get-state`, `get-events`, `get-evidence`, `get-context`, `get-briefing`, `list-active`, `validate-state`, `check-caps`, `export-workflow`) do not update it. The TTL purge (FR-006.2) uses this timestamp to identify orphaned workflows.

#### `workflow_state`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `workflow_id` | TEXT | PRIMARY KEY, FK → workflows ON DELETE CASCADE | 1:1 with workflow |
| `progress_state_json` | TEXT | NOT NULL | Serialized `ProgressState` |
| `current_phase_key` | TEXT | | Active phase key (null when all phases completed, awaiting `close-workflow`) |
| `state_version` | INTEGER | NOT NULL, DEFAULT 1 | Monotonic change counter (incremented on every state mutation; used for debugging and audit, NOT for optimistic concurrency control) |

#### `workflow_events`

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
| `event_type` | TEXT | NOT NULL | Discriminator (see Section 5.4) |
| `payload_json` | TEXT | NOT NULL | Typed payload, schema per event_type |

**`seq` implementation**: Assigned via `COALESCE((SELECT MAX(seq) FROM workflow_events WHERE workflow_id = ?), 0) + 1` within the INSERT transaction. This ensures monotonic ordering per workflow without a global sequence.

**Indexes**:

- `idx_events_workflow_seq` on `(workflow_id, seq)` — cursor-based pagination
- `idx_events_workflow_type` on `(workflow_id, event_type)` — event type filtering

#### `workflow_evidence`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `evidence_id` | TEXT | PRIMARY KEY | UUID v4 |
| `workflow_id` | TEXT | NOT NULL, FK → workflows ON DELETE CASCADE | Parent workflow |
| `phase_key` | TEXT | NOT NULL | Phase this evidence relates to |
| `category` | TEXT | NOT NULL | Evidence category (see Section 5.5) |
| `data_json` | TEXT | NOT NULL | Category-specific evidence data |
| `gate_result` | TEXT | NOT NULL | `pass`, `fail`, `warn`, or `pending` |
| `submitted_by` | TEXT | NOT NULL | Actor name |
| `submitted_at` | TEXT | NOT NULL | ISO-8601 timestamp |

**Indexes**:

- `idx_evidence_workflow_phase_cat` on `(workflow_id, phase_key, category)` — gate evaluation queries
- `idx_evidence_workflow` on `(workflow_id)` — full evidence retrieval

**Evidence scoping**: Evidence is scoped to **phases**, not transitions. When a phase has multiple outgoing transitions (e.g., `review → validate` and `review → implement`), all evidence for that phase is visible to gates on any transition from it. This is intentional — back-edge transitions (rework loops) declare empty `gateRules: []`, so shared evidence does not interfere. Forward transitions declare the gates they require. On re-entry to a previously visited phase, the coordinator submits fresh evidence; the **latest** `gate_result` per `(phase_key, category)` is used for gate evaluation (see `submit-evidence` behavior).

**Foreign key cascade behavior**: All child tables (`workflow_state`, `workflow_events`, `workflow_evidence`, `workflow_context`) use `ON DELETE CASCADE` on `workflow_id`. When `close-workflow` deletes the `workflows` row, all related rows are automatically removed.

#### `workflow_context`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `workflow_id` | TEXT | NOT NULL, FK → workflows ON DELETE CASCADE | Parent workflow |
| `category` | TEXT | NOT NULL | Entry category (see Section 5.6) |
| `key` | TEXT | NOT NULL | Entry identifier within category |
| `value` | TEXT | NOT NULL | Entry content (plain text or JSON string) |
| `authored_by` | TEXT | NOT NULL | Agent/actor that created or last updated the entry |
| `created_at` | TEXT | NOT NULL | ISO-8601 timestamp of initial creation |
| `updated_at` | TEXT | NOT NULL | ISO-8601 timestamp of last update |

**Primary key**: `(workflow_id, category, key)` — composite. Upserts replace `value`, `authored_by`, and `updated_at`.

**Indexes**:

- `idx_context_workflow_cat` on `(workflow_id, category)` — category-filtered retrieval

### 5.2 ProgressState (Serialized in `workflow_state.progress_state_json`)

```typescript
interface ProgressState {
  feature: string;
  branch?: string;
  spec?: string;
  complexityScore?: number;
  startedAt: string; // ISO-8601
  phases: Record<string, PhaseState>;
  tasks: Task[];
  fixTasks: FixTask[];
  context: Record<string, unknown>;
  haltReason: string | null;
}

interface PhaseState {
  status: "not-started" | "in-progress" | "completed" | "blocked";
  startedAt: string | null;
  completedAt: string | null;
  summary: string | null;
  metadata?: Record<string, unknown>; // Phase-specific data (e.g., review.attempts)
}

interface Task {
  id: number;
  title: string;
  status: "not-started" | "in-progress" | "completed";
}

interface FixTask extends Task {
  source: "gate" | "review" | "analysis" | "manual";
}
```

### 5.3 Phase Configuration (Provided at `create-workflow`)

```typescript
interface PhaseConfig {
  phases: PhaseDefinition[];
  transitions: TransitionRule[];
  maxCycles?: number;    // Max total implement↔review cycles (default: 4)
}

interface PhaseDefinition {
  key: string;           // e.g., "research", "implement"
  label: string;         // e.g., "Phase 1: Research"
  ordinal: number;       // Display order
}

interface TransitionRule {
  from: string;          // Phase key
  to: string;            // Phase key
  gateRules: GateRule[];
}

interface GateRule {
  evidenceCategory: EvidenceCategory;
  condition: "must-pass" | "should-pass" | "informational";
  description: string;
}
```

**Reserved phase key**: `_close` is a reserved pseudo-phase used as a transition target to signal that the workflow is ready to close. The server does NOT auto-trigger `close-workflow` on transition to `_close`. Instead, `transition-phase` with `to: "_close"` completes the `from` phase and sets `current_phase_key` to `null` (no phase in-progress). The coordinator then calls `close-workflow` explicitly. Gate rules ARE allowed on transitions targeting `_close` (e.g., requiring final documentation evidence). `_close` must NOT appear in the `phases` array — it is only valid as a `to` value in `transitions`.

**Phase config semantic validation** (enforced at `create-workflow` time):

- All `key` values in `phases` must be unique
- All `ordinal` values must be unique
- Every `from` and `to` in `transitions` must reference a defined phase key, except `_close` (reserved)
- At least one phase must be defined
- At least one transition must be defined
- `_close` must NOT appear in the `phases` array

### 5.4 Event Types

Events use a common envelope with typed payloads discriminated by `eventType`:

| Event Type | Payload Fields | Description |
|------------|---------------|-------------|
| `phase-started` | `{ phaseKey, startedAt }` | Phase has begun |
| `phase-completed` | `{ phaseKey, completedAt, summary }` | Phase finished |
| `phase-blocked` | `{ phaseKey, reason }` | Phase is blocked |
| `evidence-submitted` | `{ evidenceCategory, gateResult, data }` | Evidence recorded |
| `transition-requested` | `{ from, to }` | Coordinator requests transition |
| `transition-approved` | `{ from, to }` | Transition passed validation |
| `transition-rejected` | `{ from, to, reason }` | Transition failed validation |
| `subagent-dispatched` | `{ agentName, runId, taskDescription }` | Subagent invoked |
| `subagent-completed` | `{ agentName, runId, summary, artifacts }` | Subagent finished |
| `subagent-failed` | `{ agentName, runId, error }` | Subagent errored |
| `finding-created` | `{ findingId, severity, description }` | Review/analysis finding |
| `fix-task-created` | `{ taskId, title, source }` | Fix task generated |
| `fix-task-completed` | `{ taskId, resolution }` | Fix task resolved |
| `workflow-created` | `{ feature, branch, spec }` | Workflow initialized |
| `workflow-halted` | `{ reason }` | Workflow hit cap or fatal error |
| `workflow-closed` | `{}` | Workflow done |
| `context-stored` | `{ category, key }` | Context memory entry created or updated |
| `note-added` | `{ text }` | Freeform observation |

### 5.5 Evidence Categories (MVP)

Six categories for MVP. Each has a typed schema validated by the server:

#### `test-results`

```typescript
{
  framework?: string;        // e.g., "vitest", "node:test"
  passed: number;
  failed: number;
  skipped?: number;
  total: number;
  duration?: number;         // seconds
  coveragePercent?: number;
}
// gateResult: failed === 0 ? "pass" : "fail"
```

#### `error-diagnostic`

```typescript
{
  source: string;            // e.g., "typescript-compiler", "get_errors"
  errors: number;
  warnings: number;
  filesChecked?: number;
}
// gateResult: errors === 0 ? "pass" : "fail"
```

#### `checklist`

```typescript
{
  checklistName: string;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  items?: Array<{
    label: string;
    status: "passed" | "failed" | "skipped";
    note?: string;
  }>;
}
// gateResult: failedItems === 0 && completedItems === totalItems ? "pass" : "fail"
```

#### `agent-completion`

```typescript
{
  agentName: string;
  runId?: string;
  taskDescription: string;
  status: "completed" | "failed" | "partial";
  summary: string;
  artifacts?: Array<{ path: string; action: "created" | "modified" }>;
}
// gateResult: status === "completed" ? "pass" : "fail"
```

#### `code-review`

```typescript
{
  reviewer: string;
  reviewerType: "human" | "agent" | "automated";
  verdict: "approved" | "changes-requested" | "commented";
  findingCount: number;
  criticalFindings: number;
  findings?: Array<{
    severity: "critical" | "high" | "medium" | "low" | "info";
    category?: string;
    file?: string;
    line?: number;
    description: string;
    suggestion?: string;
  }>;
}
// gateResult: verdict === "approved" && criticalFindings === 0 ? "pass" : "fail"
```

#### `custom`

```typescript
{
  label: string;
  payload: Record<string, unknown>;
  passed: boolean;
}
// gateResult: passed ? "pass" : "fail"
```

### 5.6 Context Entry Categories

Context memory entries use a fixed set of categories:

| Category | Purpose | Typical Authors | Example Key |
|----------|---------|----------------|-------------|
| `briefing` | Original user request, mission statement, workflow purpose | Coordinator | `original-request`, `mission` |
| `delegation` | Instructions given when delegating to a subagent | Coordinator | `speckit.implement-run-1`, `code-review-task` |
| `decision` | Key design decisions, user preferences, rejected alternatives | Coordinator, subagents | `export-format`, `auth-strategy`, `rejected-redis` |

Categories are validated by the server — unrecognized categories return `INVALID_CATEGORY`.

### 5.7 ContextEntry Interface

```typescript
interface ContextEntry {
  category: "briefing" | "delegation" | "decision";
  key: string;
  value: string;
  authoredBy: string;
  createdAt: string;   // ISO-8601
  updatedAt: string;   // ISO-8601
}
```

### 5.8 EvidenceRecord (Stored in `workflow_evidence` table)

```typescript
interface EvidenceRecord {
  evidenceId: string;      // UUID v4
  workflowId: string;
  phaseKey: string;
  category: EvidenceCategory;
  data: object;            // Category-specific evidence data
  gateResult: "pass" | "fail" | "warn" | "pending";
  submittedBy: string;
  submittedAt: string;     // ISO-8601
}
```

### 5.9 Common Error Response

All tools return errors using `isError: true` with a consistent structure:

```typescript
interface ToolError {
  code: string;        // Machine-readable error code
  message: string;     // Human-readable description
  details?: object;    // Additional context (optional)
}
```

**Standard error codes**:

- `WORKFLOW_NOT_FOUND` — `workflowId` does not exist
- `INVALID_PHASE` — `phaseKey` not defined in phase config
- `INVALID_TRANSITION` — `from → to` not in transition map
- `VALIDATION_FAILED` — Zod schema validation failed (includes `details` with validation errors)
- `INVALID_CATEGORY` — evidence category not recognized
- `STATE_CONFLICT` — operation conflicts with current workflow state (e.g., transition from wrong phase)
- `WORKFLOW_HALTED` — workflow is halted; mutations blocked until resumed or closed

---

## 6. MCP Tool Surface

All tools use kebab-case names. The MCP server name is `workflow-state-service`, so tools appear in VS Code as `mcp_workflow-state-service_{tool-name}`.

Each tool definition includes `title`, `description`, `inputSchema` (Zod), and `outputSchema` (Zod) following MCP SDK v2 `registerTool()` conventions. Tools return both `content` (human-readable text) and `structuredContent` (typed JSON).

### 6.1 Lifecycle Tools

#### `create-workflow`

Creates a new workflow with caller-provided phase configuration.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `featureName` | string | yes | Human-readable feature name |
| `branchName` | string | no | Git branch name |
| `specDir` | string | no | Workspace path to spec directory |
| `complexityScore` | number | no | Estimated complexity (0-15) |
| `phaseConfig` | PhaseConfig | yes | Phase definitions and transition rules |
| `context` | object | no | Initial context data (affected files, research notes) |

**Returns**: `{ workflowId, state: ProgressState }`

**Behavior**:

- Generates a UUID v4 workflow ID
- Creates initial `ProgressState` with all phases set to `not-started`
- Sets the first phase (lowest ordinal) to `in-progress`
- Validates `phaseConfig` against the phase configuration schema
- Emits a `workflow-created` event

#### `list-active`

Lists workflows with at least one phase `in-progress` or `blocked`, or all phases `completed` but not yet closed.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `branchName` | string | no | Filter by git branch name (exact match) |

**Returns**: `{ workflows: Array<{ workflowId, featureName, branchName, currentPhaseKey, status, updatedAt }> }`

**Note**: `status` is `"active"` when a phase is in-progress, `"blocked"` when halted, or `"completed"` when all phases are done but `close-workflow` has not been called. `currentPhaseKey` is `null` for completed-but-unclosed workflows.

#### `get-state`

Returns the full current state of a workflow.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflowId` | string | yes | Workflow UUID |

**Returns**: `{ state: ProgressState, stateVersion: number, phaseConfig: PhaseConfig }`

#### `export-workflow`

Returns the full workflow state and event log as structured data. The server performs no file I/O — the calling agent writes files to the workspace if desired. Export is a convenience for posterity; code and git diffs are the true source of truth.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflowId` | string | yes | Workflow UUID |

**Returns**: `{ progressState: ProgressState, events: WorkflowEvent[], evidence: EvidenceRecord[], context: ContextEntry[] }`

**Behavior**:

- Reads the current `ProgressState`, all events, all evidence records, and all context entries
- Returns all data in `structuredContent` — the agent can write `PROGRESS.export.json` and `EVENTS.export.jsonl` to the workspace using its own file tools

#### `close-workflow`

Closes a workflow: returns export data, then purges all data from the database.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflowId` | string | yes | Workflow UUID |

**Returns**: `{ progressState: ProgressState, events: WorkflowEvent[], evidence: EvidenceRecord[], context: ContextEntry[], purged: true }`

**Behavior**:

1. Reads all workflow data (state, events, evidence)
2. Emits `workflow-closed` event (appended to the returned events)
3. Deletes the `workflows` row (cascades to `workflow_state`, `workflow_events`, `workflow_evidence`, `workflow_context`)
4. Returns the complete export data in `structuredContent`

**Atomicity caveat**: The server reads all data, deletes the `workflows` row, then returns the response. If the HTTP response is lost after deletion (e.g., network failure), the data is gone from the database. For durable export, call `export-workflow` before `close-workflow`. This is acceptable because code and git diffs are the permanent artifacts; exported workflow state is for posterity only.

### 6.2 Transition Tools

#### `transition-phase`

Transitions a workflow from one phase to the next, with evidence validation.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflowId` | string | yes | Workflow UUID |
| `from` | string | yes | Current phase key |
| `to` | string | yes | Target phase key |
| `summary` | string | yes | Summary of completed phase |
| `actorKind` | string | yes | Must be `"coordinator"` |

**Returns**: `{ state: ProgressState, stateVersion: number }` on success, or `{ rejected: true, reason: string, unmetGates: Array<{ category, condition, currentResult }> }` on failure.

Rejection is a valid business outcome, NOT an error. The response uses `isError: false` with `structuredContent` containing the rejection details. The coordinator reads the structured response and decides how to proceed (loop back, fix, retry, or halt).

**Behavior**:

1. Validates `actorKind === "coordinator"` (rejects otherwise)
2. Verifies `from` matches the current in-progress phase
3. Checks the transition `from → to` exists in the phase configuration
4. Retrieves gate rules for this transition
5. For each `must-pass` gate rule: checks that matching evidence exists with `gateResult === "pass"`
6. For each `should-pass` gate rule: warns if missing but does not block
7. If all `must-pass` gates satisfied: executes transition (completes `from`, starts `to`)
8. Emits `transition-requested`, then `transition-approved` or `transition-rejected` events
9. Increments `state_version` (change counter)

### 6.3 Event Tools

#### `append-event`

Appends a typed event to the workflow's event log.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflowId` | string | yes | Workflow UUID |
| `eventType` | string | yes | Event type (see Section 5.4) |
| `actorKind` | string | yes | Actor kind |
| `actorName` | string | yes | Actor identifier |
| `actorRunId` | string | no | Subagent invocation ID |
| `phaseKey` | string | no | Related phase |
| `payload` | object | yes | Event-type-specific payload |

**Returns**: `{ eventId, seq }`

**Behavior**:

- Validates `eventType` against the known event types in Section 5.4
- Validates `payload` against the schema for the given `eventType` (returns `VALIDATION_FAILED` if invalid)
- Assigns the next `seq` number atomically (see `seq` implementation note in Section 5.1)
- Sets `timestamp` to the current server time (ISO-8601)

#### `get-events`

Retrieves events with cursor-based pagination.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflowId` | string | yes | Workflow UUID |
| `sinceCursor` | number | no | Return events with `seq` > this value |
| `eventType` | string | no | Filter by event type |
| `limit` | number | no | Max events to return (default: 100) |

**Returns**: `{ events: WorkflowEvent[], nextCursor: number | null }`

### 6.4 Evidence Tools

#### `submit-evidence`

Submits evidence for a workflow phase, validated against the category schema.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflowId` | string | yes | Workflow UUID |
| `phaseKey` | string | yes | Phase this evidence relates to |
| `category` | string | yes | Evidence category (see Section 5.5) |
| `data` | object | yes | Category-specific evidence data |
| `submittedBy` | string | yes | Actor name |

**Returns**: `{ evidenceId, gateResult: "pass" | "fail" | "warn" | "pending" }`

**Behavior**:

- Validates `data` against the Zod schema for the specified `category`
- Computes `gateResult` from the evidence data (see per-category rules in Section 5.5)
- Stores evidence and emits an `evidence-submitted` event
- Multiple submissions for the same category + phase are allowed; the **latest** `gateResult` is used for gate evaluation. All submissions are preserved in the event log.

#### `get-evidence`

Retrieves evidence for a workflow, optionally filtered by phase or category.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflowId` | string | yes | Workflow UUID |
| `phaseKey` | string | no | Filter by phase |
| `category` | string | no | Filter by evidence category |

**Returns**: `{ evidence: EvidenceRecord[] }`

### 6.5 Validation Tools

#### `validate-state`

Checks a workflow's state for structural integrity.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflowId` | string | yes | Workflow UUID |

**Returns**: `{ valid: boolean, errors: string[] }`

**Checks**:

- All phases in `ProgressState.phases` match the phase config
- Exactly one phase is `in-progress`, OR one is `blocked` with a `haltReason`, OR all phases are `completed` (valid terminal state awaiting `close-workflow`)
- No completed phase is missing `completedAt` or `summary`
- `startedAt` timestamps precede `completedAt` timestamps

#### `check-caps`

Computes cycle counts and reports whether caps are exceeded.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflowId` | string | yes | Workflow UUID |

**Returns**: `{ rubricAttempts: number, reviewAttempts: number, totalCycles: number, maxCycles: number, exceeded: boolean }`

**Computation**:

- `rubricAttempts`: count of `transition-rejected` events where the rejection was due to evidence gate failure (pre-review rubric failures)
- `reviewAttempts`: count of `transition-approved` events from any phase with key containing `review` to any phase with key containing `implement` (review → implement loop-backs indicate rejection cycles)
- `totalCycles`: `rubricAttempts + reviewAttempts`
- `maxCycles`: from `PhaseConfig.maxCycles` (default: 4 if not specified)
- `exceeded`: `totalCycles >= maxCycles`

**Implementation note**: Counts are derived from the `workflow_events` table by querying event types and payloads. The coordinator uses this to decide whether to halt (see V1 prompt error handling: "Total Phase 4 executions > 4 → HALT").

#### `allocate-task-id`

Returns the next sequential task ID for a workflow.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflowId` | string | yes | Workflow UUID |
| `taskType` | string | yes | `"task"` or `"fixTask"` |

**Returns**: `{ nextId: number }`

**Rule**: `nextId = max(existing IDs in tasks[] or fixTasks[]) + 1`, minimum 100.

**Implementation note**: Task ID allocation reads from and writes to `progress_state_json` atomically within a single SQLite transaction. The caller should treat the returned `nextId` as reserved — no second allocation call is needed to "confirm" it.

### 6.6 State Mutation Tools

#### `update-state`

Patches `ProgressState` fields mid-phase without triggering a transition. Used by the coordinator to update tasks, fix tasks, context, and phase metadata.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflowId` | string | yes | Workflow UUID |
| `tasks` | Task[] | no | Replace the full tasks array |
| `fixTasks` | FixTask[] | no | Replace the full fixTasks array |
| `context` | object | no | Merge into existing context (shallow merge) |
| `phaseMetadata` | object | no | `{ phaseKey: string, metadata: object }` — merge into phase's metadata |
| `complexityScore` | number | no | Set or update complexity score |

**Returns**: `{ state: ProgressState, stateVersion: number }`

**Behavior**:

- At least one optional field must be provided
- Tasks and fixTasks replace the full array (not a patch — caller sends the complete list)
- Context and phaseMetadata use shallow merge (new keys added, existing keys overwritten)
- Emits a `note-added` event summarizing what was updated

#### `halt-workflow`

Halts a workflow, setting a halt reason and blocking the current phase.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflowId` | string | yes | Workflow UUID |
| `reason` | string | yes | Why the workflow is halting |

**Returns**: `{ state: ProgressState }`

**Behavior**:

- Sets `ProgressState.haltReason` to the provided reason
- Changes the current in-progress phase to `blocked`
- Emits a `workflow-halted` event

#### `resume-workflow`

Clears a halted workflow, restoring the blocked phase to `in-progress`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflowId` | string | yes | Workflow UUID |

**Returns**: `{ state: ProgressState }`

**Behavior**:

- Verifies the workflow has a non-null `haltReason` and a `blocked` phase (rejects with `STATE_CONFLICT` otherwise)
- Clears `ProgressState.haltReason` to `null`
- Changes the `blocked` phase back to `in-progress`
- Emits a `phase-started` event for the resumed phase

#### `report-done`

Convenience tool for subagents to report completion in one call.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflowId` | string | yes | Workflow UUID |
| `phaseKey` | string | no | Phase the subagent worked on (defaults to `current_phase_key`) |
| `agentName` | string | yes | Subagent identity |
| `runId` | string | no | Invocation ID |
| `summary` | string | yes | What the agent accomplished |
| `artifacts` | array | no | Files created/modified |
| `status` | string | yes | `"completed"`, `"failed"`, or `"partial"` |

**Returns**: `{ evidenceId, eventId }`

**Behavior**: Creates an `agent-completion` evidence record AND a `subagent-completed` event (or `subagent-failed` event when `status` is `"failed"`).

### 6.8 Context Memory Tools

#### `store-context`

Upserts a categorized context entry. If an entry with the same `(workflowId, category, key)` exists, it is overwritten.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflowId` | string | yes | Workflow UUID |
| `category` | string | yes | `"briefing"`, `"delegation"`, or `"decision"` |
| `key` | string | yes | Entry identifier (e.g., `"original-request"`, `"auth-strategy"`) |
| `value` | string | yes | Entry content (plain text or serialized JSON) |
| `authoredBy` | string | yes | Agent/actor name |

**Returns**: `{ category, key, created: boolean }` — `created` is `true` for new entries, `false` for updates.

**Behavior**:

- Validates `category` against allowed values
- Upserts the entry (INSERT OR REPLACE on composite primary key)
- Emits a `context-stored` event with `{ category, key }` payload

#### `get-context`

Retrieves context entries with optional filters.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflowId` | string | yes | Workflow UUID |
| `category` | string | no | Filter by category |
| `key` | string | no | Filter by exact key (requires `category`) |

**Returns**: `{ entries: ContextEntry[] }`

**Behavior**:

- No filters: returns all context entries for the workflow
- Category only: returns all entries in that category
- Category + key: returns the single matching entry (or empty array)

#### `get-briefing`

Returns a compiled recovery summary designed as the **first tool call after compaction**. Combines workflow identity, current state, and context memory into a single response.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflowId` | string | yes | Workflow UUID |

**Returns**:

```typescript
{
  // Workflow identity
  workflowId: string;
  featureName: string;
  branchName?: string;
  currentPhaseKey: string | null;
  status: "active" | "blocked" | "completed";

  // Context memory
  briefing: ContextEntry[];    // All entries in "briefing" category
  decisions: ContextEntry[];   // All entries in "decision" category
  delegations: ContextEntry[]; // All entries in "delegation" category

  // Current state summary
  phasesSummary: Array<{ key: string; label: string; status: string }>;
  haltReason?: string;
  stateVersion: number;
}
```

**Behavior**:

- Reads workflow metadata, current state, and all context entries
- Groups context entries by category
- Returns phase summary (key + label + status) without full metadata — just enough to orient the agent
- After compaction, an agent calls `list-active()` to find its workflow, then `get-briefing(workflowId)` to reload everything it needs

**Recovery protocol** (multi-workflow scenario):

1. Server announces `"N active workflows"` on client connect (NFR-007)
2. Agent calls `list-active(branchName)` filtered by current git branch
3. Single match → auto-select, call `get-briefing(workflowId)`
4. Multiple matches → present feature names and current phases to user, ask which to resume
5. Zero matches → call `list-active()` without filter to show all, or start a new workflow

---

## 7. Tool Annotations

MCP SDK v2 supports tool annotations that hint client behavior. Apply these to each tool:

| Tool | `readOnlyHint` | `destructiveHint` | `idempotentHint` |
|------|---------------|-------------------|-------------------|
| `list-active` | true | false | true |
| `get-state` | true | false | true |
| `get-events` | true | false | true |
| `get-evidence` | true | false | true |
| `validate-state` | true | false | true |
| `check-caps` | true | false | true |
| `create-workflow` | false | false | false |
| `transition-phase` | false | false | false |
| `append-event` | false | false | false |
| `submit-evidence` | false | false | false |
| `allocate-task-id` | false | false | false |
| `update-state` | false | false | false |
| `halt-workflow` | false | false | false |
| `resume-workflow` | false | false | true |
| `report-done` | false | false | false |
| `export-workflow` | true | false | true |
| `close-workflow` | false | true | false |
| `store-context` | false | false | false |
| `get-context` | true | false | true |
| `get-briefing` | true | false | true |

---

## 8. Docker Architecture

### 8.1 Container Composition

Single container: Node.js 24 Alpine + SQLite (via better-sqlite3 native binding).

```
┌──────────────────────────────────────┐
│  Docker Container                     │
│  node:24-alpine                       │
│                                       │
│  ┌─────────────────────────────────┐  │
│  │  MCP Server (HTTP/SSE :3001)    │  │
│  │  @modelcontextprotocol/express  │  │
│  │  createMcpExpressApp()          │  │
│  │  Zod v4 validation              │  │
│  │  Kysely + better-sqlite3        │  │
│  └──────────┬──────────────────────┘  │
│             │                         │
│  ┌──────────▼──────────────────────┐  │
│  │  SQLite DB (WAL mode)           │  │
│  │  /data/workflow-state.db        │  │
│  └─────────────────────────────────┘  │
│                                       │
│  Volume: wss-data → /data             │
└──────────────────────────────────────┘
```

### 8.2 Dockerfile (Multi-stage Build)

```dockerfile
# Build stage
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM node:24-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
RUN mkdir -p /data && chown app:app /data
USER app
EXPOSE 3001
VOLUME ["/data"]
ENV NODE_ENV=production
ENV PORT=3001
ENV LOG_LEVEL=info
ENV DB_PATH=/data/workflow-state.db
ENV ORPHAN_TTL_DAYS=7
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health || exit 1
CMD ["node", "dist/server.js"]
```

### 8.4 Build Scripts

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "dev": "node --watch src/server.ts",
    "test": "node --test test/**/*.test.ts",
    "lint": "tsc --noEmit"
  }
}
```

### 8.3 Docker Compose

```yaml
services:
  workflow-state-service:
    build: .
    ports:
      - "127.0.0.1:3001:3001"
    volumes:
      - wss-data:/data
    environment:
      - PORT=3001
      - LOG_LEVEL=info
      - ORPHAN_TTL_DAYS=7
    healthcheck:
      test: wget -qO- http://127.0.0.1:3001/health || exit 1
      interval: 30s
      timeout: 5s
      retries: 3
    restart: unless-stopped

volumes:
  wss-data:
    driver: local
```

### 8.5 VS Code MCP Configuration

Add to `.vscode/mcp.json` or VS Code settings:

```json
{
  "servers": {
    "workflow-state-service": {
      "type": "http",
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

---

## 9. Project Structure

```
MCP/workflow-state-service/
├── spec.md                    # This specification
├── package.json
├── tsconfig.json
├── Dockerfile
├── compose.yaml
├── .env.example
├── src/
│   ├── server.ts              # MCP server setup + transport
│   ├── tools/                 # Tool registrations (one file per tool group)
│   │   ├── lifecycle.ts       # create, list, get, export, close
│   │   ├── transitions.ts     # transition-phase
│   │   ├── state-mutation.ts  # update-state, halt-workflow, resume-workflow
│   │   ├── events.ts          # append-event, get-events
│   │   ├── evidence.ts        # submit-evidence, get-evidence
│   │   ├── context.ts         # store-context, get-context, get-briefing
│   │   ├── validation.ts      # validate-state, check-caps, allocate-task-id
│   │   └── subagent.ts        # report-done
│   ├── db/
│   │   ├── schema.ts          # Kysely database interface definitions
│   │   ├── connection.ts      # Database connection + WAL setup
│   │   └── migrations/        # Schema migrations
│   │       └── 001-initial.ts
│   ├── schemas/               # Zod schemas
│   │   ├── phase-config.ts    # Phase configuration validation
│   │   ├── progress-state.ts  # ProgressState validation
│   │   ├── events.ts          # Event envelope + payload schemas
│   │   ├── evidence.ts        # Evidence category schemas
│   │   └── context.ts         # Context entry category + key schemas
│   ├── services/              # Business logic
│   │   ├── workflow.ts        # Workflow CRUD + state management
│   │   ├── transition.ts      # Transition enforcement logic
│   │   ├── evidence.ts        # Evidence validation + gate evaluation
│   │   ├── retention.ts       # Orphan purge + TTL logic
│   │   └── export.ts          # Export data assembly (returns structured data)
│   └── types.ts               # Shared TypeScript types
├── test/
│   ├── tools/                 # Tool-level integration tests
│   ├── services/              # Service-level unit tests
│   └── fixtures/              # Test data (phase configs, states)
└── docs/
    └── developer-guide.md     # Developer/prompt writer documentation
```

---

## 10. Workflow Prompt Integration (V2 Prompts)

### 10.1 Changes from V1 Prompts

V2 prompts (`workon.myspecv2.prompt.md` and `workon.myideav2.prompt.md`) replace file-based PROGRESS.json management with MCP tool calls:

| V1 (File-based) | V2 (MCP Tools) |
|------------------|-----------------|
| `Read PROGRESS.json` | `get-state(workflowId)` |
| `Write PROGRESS.json` | State mutated via `transition-phase`, `submit-evidence` |
| `Scan specs/*/PROGRESS.json` for resume | `list-active()` |
| Manual phase status checks | `validate-state(workflowId)` |
| Manual cycle cap calculation | `check-caps(workflowId)` |
| Manual task ID allocation | `allocate-task-id(workflowId, taskType)` |
| Subagent reports in chat | `report-done(workflowId, ...)` |
| PROGRESS.json as recovery artifact | `get-briefing(workflowId)` for compaction recovery |
| Decisions remembered in chat only | `store-context(workflowId, "decision", key, value)` |
| Original request forgotten after compaction | `store-context(workflowId, "briefing", "original-request", ...)` at workflow start |

### 10.2 Phase Configuration Presets

V2 prompts pass phase configurations at `create-workflow` time:

#### workon.myideav2 (6 phases)

```json
{
  "phases": [
    { "key": "research", "label": "Phase 1: Research & Context", "ordinal": 1 },
    { "key": "plan", "label": "Phase 2: Plan & Track", "ordinal": 2 },
    { "key": "implement", "label": "Phase 3: Implement", "ordinal": 3 },
    { "key": "review", "label": "Phase 4: Code Review", "ordinal": 4 },
    { "key": "validate", "label": "Phase 5: Validate", "ordinal": 5 },
    { "key": "document", "label": "Phase 6: Document", "ordinal": 6 }
  ],
  "transitions": [
    { "from": "research", "to": "plan", "gateRules": [
      { "evidenceCategory": "checklist", "condition": "should-pass", "description": "Research completeness" }
    ]},
    { "from": "plan", "to": "implement", "gateRules": [] },
    { "from": "implement", "to": "review", "gateRules": [
      { "evidenceCategory": "test-results", "condition": "must-pass", "description": "All tests pass" },
      { "evidenceCategory": "error-diagnostic", "condition": "must-pass", "description": "Zero compile/lint errors" }
    ]},
    { "from": "review", "to": "validate", "gateRules": [
      { "evidenceCategory": "code-review", "condition": "must-pass", "description": "Review approved" }
    ]},
    { "from": "review", "to": "implement", "gateRules": [] },
    { "from": "validate", "to": "document", "gateRules": [
      { "evidenceCategory": "test-results", "condition": "must-pass", "description": "Final test pass" },
      { "evidenceCategory": "error-diagnostic", "condition": "must-pass", "description": "Zero errors" }
    ]},
    { "from": "document", "to": "_close", "gateRules": [] }
  ]
}
```

#### workon.myspecv2 (9 phases)

```json
{
  "phases": [
    { "key": "research", "label": "Phase 1: Research", "ordinal": 1 },
    { "key": "specification", "label": "Phase 2: Specification", "ordinal": 2 },
    { "key": "plan", "label": "Phase 3a: Plan", "ordinal": 3 },
    { "key": "tasks", "label": "Phase 3b: Tasks", "ordinal": 4 },
    { "key": "analyze", "label": "Phase 3c: Analyze", "ordinal": 5 },
    { "key": "implement", "label": "Phase 4: Implement", "ordinal": 6 },
    { "key": "review", "label": "Phase 5: Code Review", "ordinal": 7 },
    { "key": "validate", "label": "Phase 6: Validate", "ordinal": 8 },
    { "key": "document", "label": "Phase 7: Document", "ordinal": 9 }
  ],
  "transitions": [
    { "from": "research", "to": "specification", "gateRules": [
      { "evidenceCategory": "checklist", "condition": "should-pass", "description": "Research completeness" }
    ]},
    { "from": "specification", "to": "plan", "gateRules": [
      { "evidenceCategory": "agent-completion", "condition": "must-pass", "description": "Spec agent completed" },
      { "evidenceCategory": "checklist", "condition": "must-pass", "description": "Spec quality checklist" }
    ]},
    { "from": "plan", "to": "tasks", "gateRules": [
      { "evidenceCategory": "agent-completion", "condition": "must-pass", "description": "Plan agent completed" }
    ]},
    { "from": "tasks", "to": "analyze", "gateRules": [
      { "evidenceCategory": "agent-completion", "condition": "must-pass", "description": "Tasks agent completed" }
    ]},
    { "from": "analyze", "to": "implement", "gateRules": [
      { "evidenceCategory": "agent-completion", "condition": "must-pass", "description": "Analysis completed" },
      { "evidenceCategory": "checklist", "condition": "must-pass", "description": "Findings triaged" }
    ]},
    { "from": "implement", "to": "review", "gateRules": [
      { "evidenceCategory": "test-results", "condition": "must-pass", "description": "All tests pass" },
      { "evidenceCategory": "error-diagnostic", "condition": "must-pass", "description": "Zero errors" },
      { "evidenceCategory": "checklist", "condition": "must-pass", "description": "All tasks complete, no TODO/FIXME" }
    ]},
    { "from": "review", "to": "validate", "gateRules": [
      { "evidenceCategory": "code-review", "condition": "must-pass", "description": "Review approved" }
    ]},
    { "from": "review", "to": "implement", "gateRules": [] },
    { "from": "validate", "to": "document", "gateRules": [
      { "evidenceCategory": "test-results", "condition": "must-pass", "description": "Final test pass" },
      { "evidenceCategory": "error-diagnostic", "condition": "must-pass", "description": "Zero errors" },
      { "evidenceCategory": "checklist", "condition": "must-pass", "description": "Spec compliance verified" }
    ]},
    { "from": "document", "to": "_close", "gateRules": [] }
  ]
}
```

### 10.3 Coordinator Workflow with MCP Tools

Example flow for Phase 4 → Phase 5 transition in workon.myspecv2:

```
1. Coordinator: submit-evidence(workflowId, "implement", "test-results", { passed: 42, failed: 0, total: 42 })
   → { evidenceId: "...", gateResult: "pass" }

2. Coordinator: submit-evidence(workflowId, "implement", "error-diagnostic", { source: "get_errors", errors: 0, warnings: 2 })
   → { evidenceId: "...", gateResult: "pass" }

3. Coordinator: submit-evidence(workflowId, "implement", "checklist", { checklistName: "pre-review", totalItems: 5, completedItems: 5, failedItems: 0 })
   → { evidenceId: "...", gateResult: "pass" }

4. Coordinator: transition-phase(workflowId, "implement", "review", "All tasks complete, tests passing")
   → Server checks must-pass evidence → all pass
   → { state: { ...phases: { implement: { status: "completed" }, review: { status: "in-progress" } } } }
```

### 10.4 Subagent Integration Patterns

VS Code supports structurally restricting which MCP tools each agent can access via the `tools` frontmatter property in `.agent.md` files. Combined with the `agents` frontmatter (restricting which subagents a coordinator delegates to) and `user-invocable: false` (preventing direct user invocation of subagent-only agents), this provides layered enforcement of FR-007.3 without relying solely on prompt discipline.

#### 10.4.1 Recommended Tool Sets

MCP SDK v2 does not support native tool groups. The following named sets are a **spec convention** that agent authors reference when configuring `tools` frontmatter. Individual tool names use the VS Code MCP tool format: `workflow-state-service/{tool-name}`.

| Role | Set Name | Tools |
|------|----------|-------|
| **Coordinator** | `full` | `workflow-state-service/*` (all 20 tools) |
| **Subagent (safe)** | `subagent-safe` | `get-state`, `get-events`, `append-event`, `report-done`, `store-context`, `get-context` |
| **Read-only observer** | `read-only` | `get-state`, `get-events`, `get-context`, `get-briefing` |
| **Recovery agent** | `recovery` | `list-active`, `get-state`, `get-briefing`, `get-context` |

> **Note**: The `subagent-safe` set maps directly to FR-007.2. Agent authors may extend it for specialized roles (e.g., adding `submit-evidence` for a test-runner subagent) as long as FR-007.3 coordinator-only tools are excluded.

#### 10.4.2 Example Agent Configurations

**Coordinator agent** (`workon.myspecv2.agent.md`):

```yaml
---
name: workon.myspecv2
description: Orchestrates spec-driven development workflow using MCP workflow state
tools:
  - 'workflow-state-service/*'
  - 'read'
  - 'edit'
  - 'search'
  - 'agent'
  - 'todo'
agents:
  - 'speckit.specify'
  - 'speckit.plan'
  - 'speckit.tasks'
  - 'speckit.implement'
  - 'code-review'
---
```

**Subagent** (`speckit.implement.agent.md` — restricted tool set):

```yaml
---
name: speckit.implement
description: Implements tasks from the plan using MCP workflow state for progress tracking
user-invocable: false
tools:
  - 'workflow-state-service/get-state'
  - 'workflow-state-service/get-events'
  - 'workflow-state-service/append-event'
  - 'workflow-state-service/report-done'
  - 'workflow-state-service/store-context'
  - 'workflow-state-service/get-context'
  - 'workflow-state-service/submit-evidence'
  - 'read'
  - 'edit'
  - 'execute'
---
```

**Recovery agent** (invoked after chat compaction):

```yaml
---
name: workflow-recovery
description: Recovers workflow context after session compaction
user-invocable: false
tools:
  - 'workflow-state-service/list-active'
  - 'workflow-state-service/get-state'
  - 'workflow-state-service/get-briefing'
  - 'workflow-state-service/get-context'
  - 'read'
---
```

#### 10.4.3 Enforcement Layers

Subagent tool restriction is enforced at three layers:

1. **Server-side**: `transition-phase` rejects calls where `actorKind !== "coordinator"` (returns `isError: true`)
2. **Agent frontmatter**: Subagent `.agent.md` files declare only their permitted WSS tools in `tools` — the LLM will not invoke omitted tools
3. **Coordinator frontmatter**: The coordinator's `agents` list restricts which subagents can be delegated to, preventing unregistered agents from participating in the workflow

---

## 11. Export Format

### 11.1 PROGRESS.export.json

Final snapshot of `ProgressState`, matching the schema in Section 5.2. Includes all phase metadata, tasks, fix tasks, context, and halt reason. Written as formatted JSON (2-space indent).

### 11.2 EVENTS.export.jsonl

All events for the workflow, one JSON object per line. Each line is a complete `WorkflowEvent` object:

```jsonl
{"eventId":"...","workflowId":"...","seq":1,"timestamp":"2026-03-05T10:00:00Z","actorKind":"coordinator","actorName":"workon.myspec","eventType":"workflow-created","payload":{"feature":"add-auth","branch":"feat/add-auth"}}
{"eventId":"...","workflowId":"...","seq":2,"timestamp":"2026-03-05T10:00:01Z","actorKind":"coordinator","actorName":"workon.myspec","phaseKey":"research","eventType":"phase-started","payload":{"phaseKey":"research","startedAt":"2026-03-05T10:00:01Z"}}
```

---

## 12. Success Criteria

### 12.1 MVP (Server Tools)

- [ ] All 20 MCP tools registered and functional
- [ ] Tool I/O validated by Zod schemas (invalid input returns `isError: true` with descriptive message)
- [ ] Phase transitions enforce declared gate rules (reject on missing `must-pass` evidence)
- [ ] Event log is append-only and supports cursor-based pagination
- [ ] Evidence categories validate against typed schemas and compute `gateResult`
- [ ] Data retention: close purges, orphan TTL purges on startup
- [ ] Docker single-container build and run with `docker compose up`
- [ ] All tests pass with Node.js built-in test runner (`node --test`)
- [ ] Two concurrent workflows do not collide (test with parallel tool calls)

### 12.2 V2 Prompts (Manual Verification)

- [ ] `workon.myspecv2.prompt.md` created with MCP tool calls replacing file-based state
- [ ] `workon.myideav2.prompt.md` created with MCP tool calls replacing file-based state
- [ ] Session resumption works via `list-active` after chat compaction
- [ ] Phase transition rejected when evidence is missing
- [ ] Subagent completion captured via `report-done` and survives session reset
- [ ] Export returns complete data in `structuredContent` (agent writes files)
- [ ] Context memory entries survive chat compaction (store, compact, get-briefing)
- [ ] Subagent `.agent.md` with restricted `tools` cannot invoke coordinator-only tools
- [ ] Coordinator `agents` frontmatter restricts delegation to registered subagents only

### 12.3 Future Enhancements (Post-MVP)

- Server-side evidence verification (run test commands)
- Additional evidence categories (security-scan, code-coverage, compliance)
- stdio transport option for simpler single-session setups
- Dashboard UI for viewing active workflows and event logs
- Webhook notifications on phase transitions
- Multi-workspace support (multiple project roots)
- Bulk evidence submission (multiple items in one call)
- Resume event logging (explicit recovery marker after compaction)

---

## 13. Dependencies

### Runtime Dependencies

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP server framework (v2) — provides `@modelcontextprotocol/server` |
| `zod` | Schema validation (v4, via `zod/v4`) |
| `better-sqlite3` | SQLite driver |
| `kysely` | Type-safe query builder |
| `@modelcontextprotocol/express` | Official Express middleware adapter (includes Express as peer dep) |
| `express` | HTTP framework (required by `@modelcontextprotocol/express`) |
| `uuid` | UUID v4 generation |

### Dev Dependencies

| Package | Purpose |
|---------|---------|
| `typescript` | TypeScript compiler |
| `@types/better-sqlite3` | Type definitions |
| `@types/express` | Type definitions |
| `@modelcontextprotocol/client` | MCP client for integration tests |
| `@types/uuid` | Type definitions |

---

## 14. Design Decisions (Resolved)

| # | Question | Decision | Rationale |
|---|----------|----------|----------|
| 1 | Express vs native HTTP vs Fastify | `@modelcontextprotocol/express` | Official SDK middleware. `createMcpExpressApp()` provides DNS rebinding protection, CORS, body parsing in one call. All SDK docs/examples use Express. |
| 2 | Optimistic concurrency | No — trust SQLite WAL | Simpler API. SQLite serializes writes via WAL lock. `state_version` is a monotonic change counter for debugging/audit, not a concurrency control mechanism. |
| 3 | Phase config immutability | Immutable after `create-workflow()` | Structure locked at creation. Review/refactor loops are handled by back-edges in the transition map (e.g., `review → implement`). Repeated transitions on existing phases with metadata tracking attempts. |
| 4 | Export mechanism | Return data in tool response | Server performs no file I/O. Export data returned in `structuredContent`; the calling agent writes files to workspace if desired. Code and git diffs are the true source of truth; exports are for posterity. |
| 5 | V2 prompt fallback | Require MCP — no fallback | Clean implementation, no dual codepaths, forces MCP adoption. V1 prompts remain available for file-based usage. |
| 6 | Evidence scoping | Phase-scoped (not transition-scoped) | Evidence belongs to a phase. Back-edge transitions declare empty `gateRules: []`, so shared evidence doesn't interfere. Latest `gateResult` per `(phase, category)` is used for gate evaluation on re-entry. |
| 7 | Subagent access control | Structurally enforced via agent frontmatter | MCP transport doesn't distinguish callers. `transition-phase` enforces `actorKind` server-side. Other restrictions enforced by declaring restricted `tools` lists in subagent `.agent.md` files and `agents` lists in coordinator `.agent.md` files (see Section 10.4). No MCP-level tool grouping exists; recommended tool sets are documented as a spec convention. |
| 8 | Context memory vs VS Code memory | Workflow-scoped MCP tool | VS Code session memory dies on compaction. User/repo memories are not workflow-scoped and inaccessible to subagents. WSS context memory is workflow-scoped, cross-agent, and auto-purged with the workflow. |
| 9 | Session-to-workflow binding | Branch match + user selection + server announce | No filesystem anchor needed. Server announces active workflows on connect. Agent filters by git branch for auto-match. If ambiguous (multiple workflows on same branch or `main`), agent presents options to user. Covers the common case automatically, handles edge cases gracefully. |

---

## Appendix A: Related Documents

- [MCP Workflow State Service Recommendation](../../docs/spikes/mcp-workflow-state-service-recommendation.md) — Architecture recommendation and authority model
- [TypeSpec-First Blueprint](../../docs/spikes/typespec-first-ai-workflow-spec.md) — Contract design exploration
- [TypeSpec & TypeScript Validation Spike](../../docs/spikes/typespec-typescript-workflow-validation-spike.md) — Technology evaluation
- [Evidence Categories Research](../../docs/spikes/evidence-categories-research.md) — Evidence type research

## Appendix B: Glossary

| Term | Definition |
|------|-----------|
| **Coordinator** | The primary LLM agent that orchestrates the workflow (e.g., `workon.myspec`) |
| **Subagent** | A delegated specialist agent (e.g., `speckit.implement`, `code-review`) |
| **Phase** | A discrete stage in the workflow (e.g., research, implement, review) |
| **Evidence** | Structured proof submitted to justify a phase transition |
| **Gate rule** | A requirement that evidence of a specific category must exist and pass before a transition is allowed |
| **Phase configuration** | Caller-provided definition of phases, transitions, and gate rules |
| **Event** | An immutable log entry recording something that happened in the workflow |
| **Context entry** | A categorized key-value note stored in context memory for recovery after compaction |
| **Briefing** | A compiled recovery summary returned by `get-briefing` — the first tool call after compaction |
