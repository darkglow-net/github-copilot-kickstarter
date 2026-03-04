# TypeSpec‑First Blueprint for an AI Workflow (Contracts for MCP Tool I/O + PROGRESS.json)

**Document status:** Draft v0.1  \ 
**Audience:** Platform/infra engineers building AI‑assisted development workflows and MCP toolchains  \ 
**Primary intent:** Establish a human‑readable, refactor‑friendly *blueprint* (TypeSpec) that generates portable contracts (JSON Schema) consumed by TypeScript + Python runtimes.

---

## 1) Executive Summary

This specification defines a **TypeSpec‑as‑source‑of‑truth** pipeline for an AI workflow system (e.g., an orchestrator with phases, quality gates, retries, and recovery). TypeSpec is used to author **canonical models** and **tool request/response contracts**. Those definitions are compiled into **JSON Schema** artifacts that are then used by:

- **MCP servers** (TypeScript FastMCP and Python FastMCP) to publish tool parameter schemas and validate tool calls.
- The workflow runtime to validate and safely read/write **`PROGRESS.json`** (authoritative workflow state).
- Agents/subagents to consistently interpret the meaning of workflow state and tool inputs/outputs.

> Why JSON Schema? MCP tool interfaces are described using JSON Schema (input schemas), which makes JSON Schema the portable interoperability layer across languages.

---

## 2) Goals & Non‑Goals

### Goals

1. **Single source of truth:** TypeSpec definitions are authoritative for workflow state and MCP tool I/O contracts.
2. **Cross‑language portability:** Generated JSON Schema is the contract used by both TypeScript and Python components.
3. **AI‑readable intent:** Doc comments and constrained enums encode intent (not just structure) for agents.
4. **Refactor friendliness:** Contract changes are versioned, diffable, reviewable, and enforced via CI.
5. **Boundary safety:** Runtime validation prevents malformed LLM tool arguments from crashing workflows.

### Non‑Goals

- TypeSpec does **not** implement orchestration logic (phase transition rules, retries, etc.). That logic lives in the TS/Python runtime.
- This spec does **not** prescribe a particular validation library beyond “must validate against the emitted JSON Schema artifacts.”

---

## 3) Definitions

- **Blueprint:** The TypeSpec `.tsp` files and their documentation comments.
- **Contract artifacts:** Emitted JSON Schema files consumed at runtime.
- **Workflow state:** `PROGRESS.json` (or equivalent) persisted state enabling resume/recovery.
- **Tool contracts:** Request/response schemas for MCP tools (e.g., transition phase).

---

## 4) System Architecture

### 4.1 Data & contract flow

```
TypeSpec (blueprint)
   └─(compile)
      JSON Schema artifacts (portable contracts)
          ├─ TS MCP server (FastMCP) publishes tool schemas + validates tool args/results
          ├─ PY MCP server (FastMCP) validates tool args/results
          └─ Workflow runtime validates PROGRESS.json read/write
```

### 4.2 Runtime responsibilities

- **TypeSpec:** Defines *what exists* and *what it means* (models/enums/docs).
- **Runtime (TS/PY):** Enforces *what is allowed to happen* (legal transitions, retries, guardrails, HALT behavior).

---

## 5) Contract Scope (TypeSpec MUST cover)

### 5.1 Workflow State (PROGRESS.json)

TypeSpec defines the complete schema for the persisted workflow state, including:

- `feature`, `branch`, `spec` identifiers
- `complexityScore`
- `phases` object with per‑phase status, timestamps, summaries
- `haltReason`
- optional arrays such as `fixTasks` and review/analyze findings

> Rationale: A typed, validated state file is the best recovery mechanism for long multi‑turn workflows.

### 5.2 Tool I/O Contracts (MCP Tools)

TypeSpec defines request/response models for every MCP tool exposed by your workflow toolset (coordinator and subagents), for example:

- `ReadProgressRequest` / `ReadProgressResult`
- `WriteProgressRequest` / `WriteProgressResult`
- `TransitionPhaseRequest` / `TransitionPhaseResult`
- `AppendFixTaskRequest` / `AppendFixTaskResult`

> Note: Each tool’s input must be representable as JSON Schema and consumable by MCP clients.

---

## 6) Minimal Contract Set (Recommended Starting Slice)

Start with a minimal set that delivers immediate value:

1. `PhaseStatus` enum
2. `PhaseState` model
3. `ProgressState` model (core of PROGRESS.json)
4. `TransitionPhaseRequest` + `TransitionPhaseResult`

Then expand to:

- `Finding` / `Severity` enums
- `FixTask` model
- Review rubric results model

---

## 7) TypeSpec Blueprint Design

### 7.1 Modules

Recommended contract modules:

- `contracts/state.tsp` — `ProgressState`, `PhaseState`, enums
- `contracts/tools.tsp` — tool request/response models
- `contracts/common.tsp` — shared types (IDs, timestamps, severity, etc.)

### 7.2 Example TypeSpec (core state)

```typespec
import "@typespec/json-schema";
using TypeSpec.JsonSchema;

@jsonSchema
namespace Workflow;

/** Finite workflow status values used by all phases. */
enum PhaseStatus {
  "not-started",
  "in-progress",
  "completed",
  "blocked"
}

/** A single phase record for progress tracking and recovery. */
model PhaseState {
  status: PhaseStatus;
  /** ISO-8601 timestamp */
  startedAt?: string;
  /** ISO-8601 timestamp */
  completedAt?: string;
  summary?: string;
}

/** Authoritative workflow state persisted to disk as PROGRESS.json. */
model ProgressState {
  feature: string;
  branch: string;
  spec: string;
  complexityScore: int32;
  phases: {
    research: PhaseState;
    specification: PhaseState;
    plan: PhaseState;
    tasks: PhaseState;
    analyze: PhaseState;
    implement: PhaseState;
    review: PhaseState;
    validate: PhaseState;
    document: PhaseState;
  };
  haltReason?: string;
}
```

### 7.3 Tool contracts example

```typespec
import "@typespec/json-schema";
using TypeSpec.JsonSchema;

@jsonSchema
namespace Workflow.Tools;

enum PhaseKey {
  "research",
  "specification",
  "plan",
  "tasks",
  "analyze",
  "implement",
  "review",
  "validate",
  "document"
}

model TransitionPhaseRequest {
  specDirectory: string;
  from: PhaseKey;
  to: PhaseKey;
  summary: string;
  completedAt: string; // ISO-8601
  startedAt: string;   // ISO-8601
}

model TransitionPhaseResult {
  progress: Workflow.ProgressState;
}
```

---

## 8) Emission (Build) Requirements

### 8.1 TypeSpec compilation

Use TypeSpec to emit JSON Schema artifacts.

`tspconfig.yaml` (example):

```yaml
emit:
  - "@typespec/json-schema"
options:
  "@typespec/json-schema":
    file-type: "json"
    # Optional: produce a single bundled schema file
    # bundleId: "workflow-contracts"
```

### 8.2 Output expectations

Build MUST produce either:

- **Per-type schema files** (default) under `generated/jsonschema/`, or
- **A bundled schema** (via `bundleId`) for easier distribution.

---

## 9) Runtime Integration

### 9.1 TypeScript MCP server (FastMCP)

- TS server registers tools and publishes parameter schemas.
- TS server validates incoming tool args against emitted JSON Schema before execution.
- TS server validates structured outputs (recommended) against emitted JSON Schema.

### 9.2 Python MCP server (FastMCP)

- Python server validates tool inputs/outputs against the same emitted JSON Schema.
- If Python FastMCP auto-generates schemas from signatures, it must still be compatible with the emitted canonical schema or be treated as an implementation detail.

---

## 10) Repository Layout

```
contracts/
  common.tsp
  state.tsp
  tools.tsp
  tspconfig.yaml

generated/
  jsonschema/
    Workflow.ProgressState.schema.json
    Workflow.PhaseState.schema.json
    Workflow.Tools.TransitionPhaseRequest.schema.json
    ...

runtime-ts/
  server.ts
  tools/
  validators/

runtime-py/
  server.py
  tools/
  validators/

.github/
  copilot-instructions.md
  instructions/
    workflow.instructions.md
```

---

## 11) Versioning & Compatibility

### 11.1 Semantic versioning

- **MAJOR:** breaking changes (removed fields, renamed enums/values, tighter constraints)
- **MINOR:** additive backward-compatible changes (new optional fields, new tools)
- **PATCH:** docs/metadata fixes, clarifications, non-functional improvements

### 11.2 CI policy

CI SHOULD:

- Re-generate JSON Schema and fail if the generated output differs from committed artifacts (unless a deliberate “regen” step is performed).
- Enforce version bumps when schema diffs are not backward compatible.

---

## 12) Security & Safety

- Reject unknown fields (prefer “sealed” object schemas where possible).
- Constrain enums and IDs to prevent prompt injection via tool args.
- Prefer bundled or local schemas; avoid runtime fetching of remote schemas.

---

## 13) Acceptance Criteria

1. TypeSpec contracts compile and emit JSON Schema deterministically.
2. TS and PY runtimes validate tool args/results against emitted schemas.
3. Workflow state file (PROGRESS.json) read/write is validated against emitted schema.
4. Contract versioning and CI checks prevent accidental breaking changes.

---

# Tech Stack / Dependency List

## A) Contract authoring & build

- **TypeSpec** (compiler/tooling) — author `.tsp` blueprints and compile artifacts.
- **`@typespec/json-schema`** — emit JSON Schema artifacts from TypeSpec.

## B) TypeScript MCP server runtime

- **FastMCP (TypeScript)** — MCP server framework; typically used with stdio transport.
- **JSON Schema validator** (TS) — validate tool inputs/outputs and state files against emitted schemas.
  - (Optional) **Zod** or another **Standard Schema** library for authoring ergonomics, but canonical contracts remain TypeSpec/JSON Schema.

## C) Python MCP server runtime

- **FastMCP (Python)** — MCP server framework.
- **JSON Schema validator** (Python) — validate tool inputs/outputs and state files against emitted schemas.

## D) Agent guidance (repository)

- **Copilot custom instruction files** in `.github/` and `.github/instructions/` for durable agent guidance.

---

# Notes for Implementation Planning

- Begin by implementing the **minimal contract set** (Section 6) end-to-end.
- Add tools incrementally: each tool gets a TypeSpec contract, an emitted JSON Schema, then TS+PY validation.
- Keep orchestration rules in code (legal transitions, retries), but keep all *data shapes* in TypeSpec.

