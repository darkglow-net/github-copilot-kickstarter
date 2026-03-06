# Workflow State Service — Developer Guide

A guide for prompt authors and AI agents integrating with the Workflow State Service (WSS) MCP server.

## Tool Catalog

The WSS exposes 20 MCP tools organized by function.

### Lifecycle Tools

| Tool | Read-Only | Description |
|------|-----------|-------------|
| `create-workflow` | No | Create a workflow with feature name and phase config. Returns `workflowId` + initial `state`. |
| `list-active` | Yes | List all active (non-closed) workflows. Optional `branchName` filter. |
| `get-state` | Yes | Get current state, `stateVersion`, and `phaseConfig` for a workflow. |
| `export-workflow` | Yes | Export full snapshot (workflow, state, events, evidence, context) without closing. |
| `close-workflow` | No | Export then close the workflow. Sets `closed_at` timestamp. |

### Transition Tools

| Tool | Read-Only | Description |
|------|-----------|-------------|
| `transition-phase` | No | Request a phase transition. Evaluates gate rules. Requires `actorKind: 'coordinator'`. Returns `{ approved, state, stateVersion, warnings, unmetGates }`. |

### State Mutation Tools

| Tool | Read-Only | Description |
|------|-----------|-------------|
| `update-state` | No | Patch state fields: `tasks`, `fixTasks`, `context`, `phaseMetadata`, `complexityScore`. |
| `halt-workflow` | No | Block the current phase and set `haltReason`. |
| `resume-workflow` | No | Clear halt and restore the blocked phase to `in-progress`. |

### Event Tools

| Tool | Read-Only | Description |
|------|-----------|-------------|
| `append-event` | No | Append a typed event to the event log. |
| `get-events` | Yes | Query events with cursor-based pagination. Supports `sinceCursor`, `eventType`, `limit`. |

### Evidence Tools

| Tool | Read-Only | Description |
|------|-----------|-------------|
| `submit-evidence` | No | Submit evidence for gate evaluation. Returns `evidenceId` + computed `gateResult`. |
| `get-evidence` | Yes | Query evidence with optional `phaseKey` and `category` filters. |

### Context Tools

| Tool | Read-Only | Description |
|------|-----------|-------------|
| `store-context` | No | Store or update a context entry (upsert by `category` + `key`). |
| `get-context` | Yes | Query context entries with optional `category` and `key` filters. |
| `get-briefing` | Yes | Composite briefing for agent recovery: workflow identity, all context categories, phases summary. |

### Validation Tools

| Tool | Read-Only | Description |
|------|-----------|-------------|
| `validate-state` | Yes | Check structural integrity of state against phase config. |
| `check-caps` | Yes | Check cycle and attempt caps. |
| `allocate-task-id` | Yes | Compute next sequential task ID (minimum 100). |

### Subagent Tools

| Tool | Read-Only | Description |
|------|-----------|-------------|
| `report-done` | No | Report subagent completion. Creates `agent-completion` evidence AND emits `subagent-completed`/`subagent-failed` event. |

## Evidence Categories

Six categories, each with a validation schema and computed gate result:

| Category | Key Fields | Pass Condition |
|----------|-----------|----------------|
| `test-results` | `passed`, `failed`, `total` | `failed === 0` |
| `error-diagnostic` | `errorCount`, `warningCount`, `tool` | `errorCount === 0` |
| `checklist` | `checklistName`, `totalItems`, `completedItems`, `failedItems` | `failedItems === 0` |
| `agent-completion` | `agentName`, `status`, `summary` | `status === 'completed'` |
| `code-review` | `reviewer`, `approved`, `requestedChanges` | `approved === true && requestedChanges === 0` |
| `custom` | `label`, `gateResult` | Caller-defined |

## Phase Config Authoring

A `PhaseConfig` defines the workflow's phases and allowed transitions:

```json
{
  "phases": [
    { "key": "implement", "label": "Phase 1: Implement", "ordinal": 1 },
    { "key": "review", "label": "Phase 2: Code Review", "ordinal": 2 }
  ],
  "transitions": [
    {
      "from": "implement",
      "to": "review",
      "gateRules": [
        { "evidenceCategory": "test-results", "condition": "must-pass", "description": "All tests pass" }
      ]
    },
    { "from": "review", "to": "implement", "gateRules": [] },
    { "from": "review", "to": "_close", "gateRules": [] }
  ]
}
```

**Rules:**
- Every phase needs a unique `key`, display `label`, and `ordinal` (sort order)
- `_close` is a pseudo-phase — include it as a transition target to allow workflow closure
- Gate rules use `must-pass` (blocks transition on failure) or `should-pass` (warns but allows)
- Back-edge transitions (e.g., `review → implement`) are supported and reset the target phase

## Recovery Protocol

When an agent or coordinator resumes work after a context loss:

1. **`list-active`** — Find the active workflow(s)
2. **`get-briefing`** — Get the composite briefing with all context, decisions, delegations, and phase summaries
3. **`get-state`** — Get the current state and `stateVersion` for detailed phase/task status
4. **`get-events`** with `sinceCursor` — Catch up on events since last known position

## Subagent Integration

When delegating work to subagents:

1. **Store delegation context** before launching:
   ```
   store-context(category: 'delegation', key: 'implement-agent', value: 'Delegated to speckit.implement', authoredBy: 'coordinator')
   ```

2. **Subagent reports completion** via `report-done`:
   ```
   report-done(agentName: 'speckit.implement', taskDescription: 'Implement feature', status: 'completed', summary: 'All tasks done')
   ```
   This creates both an `agent-completion` evidence record and a `subagent-completed` event.

3. **Coordinator checks results** via `get-evidence` and `get-events`.

## Recommended Tool Sets by Role

| Role | Tools |
|------|-------|
| **Coordinator** | All tools. Only role that can call `transition-phase`. |
| **Subagent** | `get-state`, `get-briefing`, `update-state`, `submit-evidence`, `append-event`, `report-done` |
| **Observer** | `list-active`, `get-state`, `get-briefing`, `get-events`, `get-evidence`, `get-context` |

## Docker Operations

```bash
# Start the service
docker compose up -d

# View logs
docker compose logs -f wss

# Check health
curl http://127.0.0.1:3001/health

# Run tests
docker compose run --rm wss npm test

# Stop
docker compose down

# Reset database (remove volume)
docker compose down -v

# Rebuild after code changes
docker compose up -d --build
```

## Event Types

18 event types organized by category:

**Lifecycle:** `workflow-created`, `workflow-closed`
**Transitions:** `transition-requested`, `transition-approved`, `transition-rejected`, `phase-started`, `phase-completed`
**State:** `state-updated`, `workflow-halted`, `workflow-resumed`
**Evidence:** `evidence-submitted`
**Context:** `context-stored`
**Subagent:** `subagent-started`, `subagent-completed`, `subagent-failed`
**Tasks:** `task-status-changed`, `fix-task-created`
**Custom:** `custom`
