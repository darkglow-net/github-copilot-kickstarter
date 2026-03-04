# Comprehensive Recommendation: MCP‑Backed Workflow State Service (Shared DB) for VS Code Copilot Agent Mode

**Context:** You’re running a multi‑phase, spec‑driven development workflow in **GitHub Copilot Chat (Agent mode) in VS Code**, using **markdown prompts + instruction files + skills**, and delegating to **fresh-context “mind‑blank” subagents**. citeturn13search104turn5search54turn2search1  
**Decision:** Use a **single shared, local database** (KISS) behind an **MCP server** that becomes the *only* interface for workflow state and event logging; export final snapshots back into the spec folder at closeout. citeturn13search113turn17search132turn2search1

---

## 1) Executive Summary

### Recommendation (high confidence)
Implement a **local MCP “Workflow State Service”** that provides a small set of tools (e.g., `create`, `listActive`, `get_state`, `append_event`, `transition`, `export`, `close`) and backs them with a **single shared DB** (in Docker) for concurrency and durability during active work. citeturn13search104turn13search113turn17search132  

### Why this solves your specific failure modes
- **Chat context loss/compaction** no longer causes workflow drift because the workflow’s authoritative position and receipts live outside chat, and the agent can always re-read state via tools. citeturn13search104turn5search54turn2search1  
- **Concurrent workflows** become routine because the DB stores many workflows simultaneously without `PROGRESS.json` collisions. citeturn17search132turn17search131  
- **Subagent results can’t be “lost”** to summarization because subagents append durable events/receipts in the service; the coordinator can fetch them later by cursor/time. citeturn17search123turn17search125turn13search104  
- **No shortcutting**: Phase transitions become **tool-enforced**, not prose‑interpreted; the tool refuses illegal transitions or missing evidence. citeturn13search104turn2search1  

### End-of-life policy (your preference)
Treat the DB volume as **disposable** and export final artifacts for posterity:
- `specs/<feature>/PROGRESS.export.json`
- `specs/<feature>/EVENTS.export.jsonl` citeturn2search1turn17search123  

---

## 2) Problem Statement (as observed in your current design)

### Current pattern
- Coordinator prompt (large markdown workflow engine) orchestrates phases and delegates work to subagents. citeturn2search1  
- Subagents are “mind‑blank” sessions with minimal context, guided by markdown agent/persona definitions and instruction/skill scoping. citeturn15search2turn5search54turn5search55  
- Both coordinator and subagents currently write sections of `PROGRESS.json` directly. citeturn2search1  

### Failure modes
1. **Chat compaction/short context windows** can cause the agent to forget the current phase or to “interpret” strict rules loosely. citeturn5search54turn13search104  
2. **Subagent completion summaries** can be lost if the conversation is summarized or pruned, breaking the coordinator’s memory of what happened. citeturn5search54turn13search104  
3. **Concurrency limitations** arise because a single shared file is a write bottleneck and has no robust multi‑workflow selection binding to a session. citeturn2search1turn17search131  

---

## 3) Design Goals & Non‑Goals

### Goals
- **Deterministic resumability** across chat resets/compaction: coordinator can always recover position via `get_state()` + `get_events()`. citeturn13search104turn2search1  
- **Safe concurrency** for multiple workflows and multiple subagents: eliminate “lost updates.” citeturn17search132turn17search131  
- **Single-writer transitions**: coordinator exclusively transitions phases; subagents append events only. citeturn2search1turn15search2  
- **KISS**: a shared DB + minimal tool surface; export only at closeout. citeturn13search113turn17search132  

### Non‑Goals
- Replace Git history as the authoritative code artifact; Git diffs/PRs remain the core deliverable. citeturn9search72turn9search70  
- Encode the entire workflow engine in the DB; the DB stores *state + events*, while markdown instructions retain intent, boundaries, and persona guidance. citeturn5search54turn2search1  

---

## 4) Proposed Architecture

### 4.1 High-level flow

```mermaid
graph TD
  A[Copilot Agent Mode (Coordinator)] -->|MCP tool calls| B[Workflow State Service (MCP Server)]
  A -->|#subagents| C[Mind-blank Subagents]
  C -->|append_event/report_done| B
  B --> D[(Shared DB in Docker)]
  B -->|export| E[specs/<feature>/PROGRESS.export.json]
  B -->|export| F[specs/<feature>/EVENTS.export.jsonl]
```

VS Code Agent Mode is designed to use tools (built-in, MCP, extension tools) to complete tasks; MCP servers become a standard way to extend those capabilities. citeturn13search104turn13search113  

### 4.2 Why DB instead of flat files for active workflows
Databases provide concurrency control to prevent problems like **lost updates**, and support transactions/locking/isolation in multi-writer environments. citeturn17search132turn17search134turn17search131  

### 4.3 Why keep an event log
An append-only event log provides **auditability**, **replay**, and “how did we get here?” traceability—classic benefits of event sourcing. citeturn17search123turn17search121turn17search125  

---

## 5) Data Model (Shared DB)

### 5.1 Tables (conceptual)

#### `workflows`
- `workflow_id` (PK)
- `feature_name`
- `branch_name`
- `spec_dir`
- `created_at`, `updated_at`
- `state_version` (optimistic concurrency)

#### `workflow_state`
- `workflow_id` (PK/FK)
- `progress_state_json` (canonical state snapshot)
- `current_phase_key`
- `phase_statuses` (or embedded in `progress_state_json`)

#### `workflow_events`
- `event_id` (PK)
- `workflow_id` (FK)
- `seq` (monotonic cursor)
- `timestamp`
- `actor_kind` (`coordinator|subagent`)
- `actor_name`
- `actor_run_id`
- `phase_key`
- `event_type`
- `payload_json`

**Rationale:** Keep authoritative *current state* separate from append-only *events*; this aligns with event sourcing guidance and improves reliability and replayability. citeturn17search121turn17search123turn17search125  

---

## 6) MCP Tool Surface (KISS, minimal)

### 6.1 Core tools
1. `workflow.create(feature_name, branch_hint?, spec_dir_hint?) -> {workflow_id}`
2. `workflow.listActive() -> [{workflow_id, feature_name, branch_name, current_phase, status, updated_at}]`
3. `workflow.get_state(workflow_id) -> ProgressState`
4. `workflow.get_events(workflow_id, since_cursor? | since_time?) -> {events: [...], next_cursor}`
5. `workflow.append_event(workflow_id, event) -> {event_id, cursor}`
6. `workflow.report_subagent_done(workflow_id, run_id, summary, artifacts, evidence) -> {event_id}`
7. `workflow.transition(workflow_id, from_phase, to_phase, evidence) -> ProgressState`
8. `workflow.export(workflow_id, spec_dir) -> { progress_export_path, events_export_path }`
9. `workflow.close(workflow_id) -> {status}`

### 6.2 Cursor vs timestamps
Prefer `since_cursor` because it is deterministic and avoids ambiguity from clock skew; timestamps can be supported for convenience. citeturn17search129turn17search125turn17search123  

---

## 7) Authority & Permissions Model

### 7.1 Coordinator (exclusive state mutation)
- Only the coordinator can call `transition()` to change phase statuses.
- `transition()` must enforce legal transitions and required evidence.

This directly addresses your “agent can interpret steps as complete and shortcut validation” problem by making completion tool-enforced rather than prompt-enforced. citeturn13search104turn2search1  

### 7.2 Subagents (append-only)
- Subagents can call `get_state()` and `get_events()` to orient themselves.
- Subagents **append events** and call `report_subagent_done()`.
- Subagents do **not** mutate phase status or counters.

This preserves your “coordination flows through the coordinator” principle while ensuring subagent outputs aren’t lost to chat compaction. citeturn15search2turn5search54turn17search123  

---

## 8) Workflow Lifecycle

### 8.1 Start
1. Coordinator calls `workflow.create(...)`.
2. Coordinator writes/creates spec folder artifacts (spec.md, etc.) using existing Speckit tooling.
3. Coordinator transitions to Phase 1/2 as appropriate via `transition()`.

### 8.2 During work
- Coordinator and subagents use `get_state()` to know the current phase and constraints.
- Subagents write durable receipts via `append_event()` / `report_subagent_done()`.
- Coordinator polls `get_events()` by cursor to avoid missing subagent work.

### 8.3 Closeout
1. Coordinator transitions final phase to completed.
2. Coordinator calls `workflow.export(workflow_id, spec_dir)`.
3. Service writes:
   - `specs/<feature>/PROGRESS.export.json`
   - `specs/<feature>/EVENTS.export.jsonl`
4. Coordinator calls `workflow.close()`.

This meets your “DB volume disposable” policy while preserving an optional posterity snapshot. citeturn13search113turn2search1turn17search123  

---

## 9) Integrating with Your Existing Markdown Agents/Skills

### 9.1 Keep markdown as intent, tools as enforcement
VS Code supports using tools with agents and controlling tool availability; you should keep behavioral policy in instructions while enforcing workflow correctness via tools. citeturn13search104turn5search54  

### 9.2 Instruction files and skill scoping remain
Your existing structure—`.github/copilot-instructions.md`, `.github/instructions/*.instructions.md` with `applyTo`, and `.github/skills/**`—continues to add durable, repository-scoped context. citeturn5search54turn5search55turn5search60  

### 9.3 Update subagent personas to require receipts
Example rule to add to each `.agent.md` persona:
- “Before responding, call `workflow.report_subagent_done(...)` and include the returned `event_id` in your final message.” citeturn15search2turn13search104  

This ensures that even if chat compacts away the subagent’s text summary, the durable receipt remains queryable. citeturn5search54turn17search123  

---

## 10) Contract-First (TypeSpec) Blueprint for Future-Proofing (Optional but Recommended)

### 10.1 Why TypeSpec here
TypeSpec is designed to define data shapes up front and emit standards-based schemas (including JSON Schema) for tooling and validation. citeturn4search32turn4search34  

### 10.2 What to specify
Define in TypeSpec:
- `ProgressState` (your PROGRESS structure)
- `WorkflowEvent`
- tool request/response models (e.g., `TransitionRequest`, `AppendEventRequest`)

Then emit JSON Schema and validate all MCP tool payloads against it to prevent malformed updates from LLM/tool calls. citeturn3search17turn4search32turn4search34  

---

## 11) Security & Safety Notes (Single-machine, local server)

- Only install/run MCP servers from trusted sources; local MCP servers can execute arbitrary code and VS Code highlights trust considerations when adding servers. citeturn13search113turn13search104  
- Prefer a minimal tool surface and constrain tools by purpose so the agent’s blast radius stays small. citeturn13search104  

---

## 12) Implementation Plan (KISS, incremental)

### Phase A — MVP (2–3 days)
- Implement MCP server tools: `create`, `listActive`, `get_state`, `append_event`, `get_events`, `transition`, `export`, `close`. citeturn13search104turn13search113  
- DB schema: `workflows`, `workflow_state`, `workflow_events`. citeturn17search132turn17search121  
- Enforce: subagents append events only; coordinator transitions only. citeturn2search1turn15search2  

### Phase B — Integrate with markdown personas (1–2 days)
- Update `.agent.md` personas to record receipts (`report_subagent_done`). citeturn15search2turn15search3  
- Update coordinator prompt to always call `get_state()` at start of each phase and `get_events()` before transitions. citeturn2search1turn13search104  

### Phase C — Contract-first hardening (optional)
- Add TypeSpec definitions and emit JSON Schema.
- Validate tool payloads using emitted schemas. citeturn4search32turn4search34turn3search17  

---

## 13) Acceptance Criteria

1. **Concurrent workflows**: at least 2 workflows can be active concurrently without state collisions. citeturn17search132turn17search131  
2. **No lost subagent outputs**: subagent completion is always recoverable via `get_events()` even if chat history is compacted. citeturn17search123turn5search54  
3. **No shortcutting**: `transition()` refuses phase completion unless required evidence is provided. citeturn2search1turn13search104  
4. **Export works**: closeout writes `PROGRESS.export.json` and `EVENTS.export.jsonl` to `specs/<feature>/`. citeturn2search1turn17search123  
5. **KISS**: one shared DB, local-only, disposable volume (export optional). citeturn13search113turn17search132  

---

## 14) Final Recommendation (One Page)

- Keep your **markdown personas/skills** for intent and delegation. citeturn5search54turn5search55turn15search2  
- Add a local MCP **Workflow State Service** that becomes the only API for state + event receipts in VS Code agent mode. citeturn13search104turn13search113  
- Use a **shared DB** for concurrency and safe multi-writer access; make subagents append-only and let coordinator exclusively transition phases. citeturn17search132turn2search1turn15search2  
- Export final snapshot files for posterity: `PROGRESS.export.json` + `EVENTS.export.jsonl`, then dispose the DB volume. citeturn17search123turn2search1  
- (Optional) Move contracts to **TypeSpec** and emit JSON Schema for robust validation at the tool boundary. citeturn4search32turn4search34turn3search17  

