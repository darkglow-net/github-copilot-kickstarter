# Technical Spike: TypeSpec & TypeScript for Workon Workflow Validation

## Status: Completed

## Date: 2026-03-04

## Objective

Investigate whether TypeSpec, TypeScript, or adjacent technologies (JSON Schema, Zod, XState) can improve the reliability, determinism, and correctness of the `workon.myidea` and `workon.myspec` orchestration workflows — specifically targeting PROGRESS.json schema enforcement, phase transition validation, and retry/cap logic.

---

## Executive Summary

The `workon.myidea` and `workon.myspec` prompts implement distributed workflow engines inside LLM prompts. They rely on PROGRESS.json as the authoritative state store, prompt-interpreted phase transitions, and socially-enforced schema contracts. This research investigates whether TypeSpec, TypeScript runtime validation, or adjacent technologies can make these workflows more deterministic.

**Key findings:**

1. **TypeSpec is a poor fit for this use case.** It is a declarative API modeling language that generates OpenAPI/JSON Schema/Protobuf — it cannot enforce runtime validation, state transitions, or imperative logic. It adds a build-time compilation step, a new DSL dependency, and produces the same JSON Schema that could be written directly.

2. **JSON Schema + Ajv is the simplest viable path** for PROGRESS.json structural validation. A JSON Schema file can be shipped alongside the prompts as a reference artifact and validated at runtime via a lightweight MCP tool or shell script.

3. **Zod offers the best developer experience** for combined schema validation + transition enforcement in TypeScript, but requires a Node.js runtime dependency in consumer projects.

4. **A custom MCP server is the most architecturally aligned approach** for this repository. It can expose `validate_progress`, `transition_phase`, and `check_caps` tools that the coordinator prompt calls instead of performing raw JSON read/write operations.

5. **XState is theoretically ideal but practically overkill.** It models the exact finite-state-machine pattern these workflows implement, but introduces significant complexity and a heavy runtime dependency for what is currently a prompt-driven template library.

6. **Portability is the critical constraint.** This repository is a template library — not an application. Any solution that requires consumer projects to install Node.js, npm packages, or run build steps fundamentally conflicts with the project's design philosophy of "copy what you need and move on."

---

## Research Questions

**Primary Question:** Can TypeSpec and/or TypeScript improve the reliability of the `workon.myidea` and `workon.myspec` workflows?

**Secondary Questions:**

- What exactly would TypeSpec protect against, and is it worth the toolchain overhead?
- Could JSON Schema alone (without TypeSpec) provide equivalent structural safety?
- What runtime validation approach best fits the Copilot agent execution model?
- Can an MCP server provide deterministic transition enforcement without code in consumer projects?
- How do these options affect the portability of this template library?
- What failure modes in the current prompt-only approach are most critical to address?

---

## Part 1: Current Architecture Analysis

### What the Workon Prompts Actually Implement

Both `workon.myidea` and `workon.myspec` implement **finite workflow engines** inside LLM prompts:

| Architectural Component | Workon Implementation |
|-------------------------|----------------------|
| State store | PROGRESS.json (file-based) |
| State machine | Phase statuses with ordered transitions |
| Transition protocol | READ → VERIFY → UPDATE → WRITE → REPORT |
| Retry policies | `rubricAttempts` < 3, `review.attempts` ≤ 2 |
| Master cap | Total Phase 4 cycles > 4 → HALT |
| Quality gates | Pre-Review Gate (5 checks), Post-Phase Validation |
| Recovery mechanism | Session Resumption via PROGRESS.json scan |
| Task allocator | Sequential IDs from 100 |
| Delegation contracts | Delegation Template + Anti-Laziness Addendum |

### Current Failure Modes (Observed and Theoretical)

These are the specific failure modes that any validation improvement should target:

| # | Failure Mode | Severity | Currently Mitigated? |
|---|-------------|----------|---------------------|
| 1 | Invalid phase status value (e.g., `"complete"` instead of `"completed"`) | HIGH | No — prompt-enforced only |
| 2 | Phase transition skipping (e.g., jumping from research to implement) | HIGH | Partially — Hard Rules in prompt |
| 3 | Retry counter reset on session boundary | HIGH | Partially — PROGRESS.json persists but LLM may misread |
| 4 | FixTask ID collision or non-sequential assignment | MEDIUM | No — prompt-enforced only |
| 5 | Invalid severity enum in review findings | LOW | No — prompt-enforced only |
| 6 | Missing required fields in PROGRESS.json | MEDIUM | No — schema documented but not enforced |
| 7 | Timestamp format inconsistency | LOW | No — prompt says ISO-8601 but not validated |
| 8 | Total cycle cap bypass (rubricAttempts + review.attempts) | HIGH | Prompt-enforced, fragile across sessions |
| 9 | PROGRESS.json corruption during concurrent subagent writes | LOW | Mitigated — subagents don't write PROGRESS.json |
| 10 | Phase marked completed without required summary/timestamp | MEDIUM | No — prompt-enforced only |

---

## Part 2: TypeSpec Evaluation

### What TypeSpec Is

TypeSpec is a Microsoft-developed domain-specific language (DSL) for API modeling. It uses a TypeScript-inspired syntax to define data models, API endpoints, and validation constraints. It compiles to OpenAPI, JSON Schema, and Protobuf.

**Sources:**
- https://typespec.io/
- https://github.com/Microsoft/typespec
- https://learn.microsoft.com/en-us/azure/developer/typespec/overview

### What TypeSpec Can Do for This Use Case

TypeSpec could define the PROGRESS.json schema as a `.tsp` file:

```typespec
enum PhaseStatus {
  notStarted: "not-started",
  inProgress: "in-progress",
  completed: "completed",
  blocked: "blocked"
}

model PhaseState {
  status: PhaseStatus;
  startedAt?: utcDateTime;
  completedAt?: utcDateTime;
  summary?: string;
}

model FixTask {
  id: int32 & @minValue(100);
  title: string;
  status: "not-started" | "in-progress" | "completed";
  source: "gate" | "review";
}
```

This would generate a JSON Schema that structurally validates PROGRESS.json.

### What TypeSpec Cannot Do

| Capability | TypeSpec Support |
|-----------|----------------|
| Define data shapes and constraints | ✅ Yes |
| Generate JSON Schema | ✅ Yes |
| Enforce valid status enum values | ✅ Yes (via generated schema) |
| Enforce phase transition ordering | ❌ No — declarative only |
| Calculate retry cap (rubricAttempts + review.attempts > 4) | ❌ No — no imperative logic |
| Enforce sequential fixTask ID allocation | ❌ No — no runtime logic |
| Gate implementation on analysis results | ❌ No — no conditional logic |
| Validate timestamp format at write time | ❌ Indirectly — schema `format: date-time` |
| Prevent phase skipping | ❌ No — no transition modeling |
| Manage state across sessions | ❌ No — compile-time only |

**Source:** https://typespec.io/ — TypeSpec documentation explicitly states it is a declarative modeling language. All rules must be statically expressible. No if/else, no loops, no dynamic code.

### TypeSpec: Cost vs. Benefit Analysis

**Costs:**
- New DSL dependency (TypeSpec compiler `tsp` + npm packages)
- Build step required (`tsp compile` → JSON Schema output)
- Learning curve for contributors unfamiliar with TypeSpec
- Compilation pipeline adds complexity to a template library
- Generated JSON Schema is identical to hand-written JSON Schema
- Consumer projects must either install TypeSpec or use the generated output

**Benefits:**
- Concise, readable schema definitions (vs. verbose JSON Schema)
- Modular type reuse across multiple schemas (if the project had many schemas)
- IDE support in VS Code (syntax highlighting, autocomplete)

**Verdict: NOT RECOMMENDED for this use case.**

The workspace-baseline repository has exactly **two** JSON state files (PROGRESS.json for myidea and myspec). TypeSpec's value proposition — DRY schemas across many APIs — does not apply here. The generated output (JSON Schema) can be written directly with less toolchain overhead. TypeSpec introduces a build dependency that conflicts with the repository's "copy and move on" design philosophy.

---

## Part 3: JSON Schema (Direct) Evaluation

### Approach

Write a `progress.schema.json` file that validates PROGRESS.json structure directly, without a TypeSpec compilation step. Ship it as a reference artifact alongside the prompt files.

### Example Schema (workon.myspec PROGRESS.json)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "workon.myspec PROGRESS.json",
  "type": "object",
  "required": ["feature", "branch", "spec", "complexityScore", "startedAt", "phases"],
  "properties": {
    "feature": { "type": "string", "minLength": 1 },
    "branch": { "type": "string", "minLength": 1 },
    "spec": { "type": "string" },
    "complexityScore": { "type": ["string", "integer"] },
    "startedAt": { "type": "string", "format": "date-time" },
    "phases": {
      "type": "object",
      "required": ["research", "specification", "plan", "tasks", "analyze", "implement", "review", "validate", "document"],
      "properties": {
        "research": { "$ref": "#/definitions/phaseState" },
        "specification": { "$ref": "#/definitions/phaseState" },
        "plan": { "$ref": "#/definitions/phaseState" },
        "tasks": { "$ref": "#/definitions/phaseState" },
        "analyze": { "$ref": "#/definitions/analyzePhaseState" },
        "implement": { "$ref": "#/definitions/phaseState" },
        "review": { "$ref": "#/definitions/reviewPhaseState" },
        "validate": { "$ref": "#/definitions/phaseState" },
        "document": { "$ref": "#/definitions/phaseState" }
      }
    },
    "fixTasks": { "type": "array", "items": { "$ref": "#/definitions/fixTask" } },
    "haltReason": { "type": ["string", "null"] }
  },
  "definitions": {
    "phaseStatus": {
      "type": "string",
      "enum": ["not-started", "in-progress", "completed", "blocked"]
    },
    "phaseState": {
      "type": "object",
      "required": ["status"],
      "properties": {
        "status": { "$ref": "#/definitions/phaseStatus" },
        "startedAt": { "type": ["string", "null"], "format": "date-time" },
        "completedAt": { "type": ["string", "null"], "format": "date-time" },
        "summary": { "type": ["string", "null"] }
      }
    },
    "analyzePhaseState": {
      "allOf": [
        { "$ref": "#/definitions/phaseState" },
        {
          "properties": {
            "findings": {
              "type": "object",
              "properties": {
                "critical": { "type": "integer", "minimum": 0 },
                "high": { "type": "integer", "minimum": 0 },
                "medium": { "type": "integer", "minimum": 0 },
                "low": { "type": "integer", "minimum": 0 }
              }
            },
            "autoResolved": { "type": "integer", "minimum": 0 },
            "userResolved": { "type": "integer", "minimum": 0 }
          }
        }
      ]
    },
    "reviewPhaseState": {
      "allOf": [
        { "$ref": "#/definitions/phaseState" },
        {
          "properties": {
            "attempts": { "type": "integer", "minimum": 0 },
            "rubricAttempts": { "type": "integer", "minimum": 0 },
            "findings": { "type": "array" },
            "rubricScores": { "type": ["object", "null"] }
          }
        }
      ]
    },
    "fixTask": {
      "type": "object",
      "required": ["id", "title", "status", "source"],
      "properties": {
        "id": { "type": "integer", "minimum": 100 },
        "title": { "type": "string", "minLength": 1 },
        "status": { "type": "string", "enum": ["not-started", "in-progress", "completed"] },
        "source": { "type": "string", "enum": ["gate", "review"] }
      }
    }
  }
}
```

### What JSON Schema Protects Against

| Failure Mode | Protected? | How |
|-------------|-----------|-----|
| Invalid phase status value | ✅ Yes | `enum` constraint |
| Missing required fields | ✅ Yes | `required` arrays |
| Invalid timestamp format | ✅ Yes | `format: date-time` |
| FixTask ID below 100 | ✅ Yes | `minimum: 100` |
| Invalid fixTask source | ✅ Yes | `enum` constraint |
| Invalid severity in findings | ✅ Yes | Can be added via enum |
| Phase transition skipping | ❌ No | Structural only, no sequencing logic |
| Retry cap calculation | ❌ No | No arithmetic/logic |
| Phase completion without timestamp | ❌ Partially | Can use `if/then` conditional schemas |

### How It Would Be Used

The JSON Schema could be referenced:
1. **In the prompt itself** — "Validate PROGRESS.json against `progress.schema.json` before writing"
2. **Via a shell command** — `node -e "require('ajv')..."` or `npx ajv validate`
3. **Via an MCP tool** — A custom validation tool that reads the schema and validates
4. **As documentation** — LLMs can read JSON Schema and understand the expected structure

### Cost vs. Benefit

**Costs:**
- One JSON file to maintain per workflow variant (~100 lines each)
- Runtime validation requires a validator (Ajv, or a simple `node` script)
- Does not address transition logic or cap enforcement

**Benefits:**
- Zero build step — JSON Schema is immediately usable
- Universal — every JSON tool, IDE, and language supports JSON Schema
- Can be embedded in the prompt or loaded as a skill reference
- Protects against the most common structural errors (failure modes 1, 4, 5, 6, 7, 10)
- LLMs can read JSON Schema and use it as a structural contract

**Verdict: RECOMMENDED as the baseline approach.**

---

## Part 4: Zod (TypeScript Runtime) Evaluation

### What Zod Is

Zod is a TypeScript-first schema validation library that provides runtime validation with full type inference. It has zero dependencies, is lightweight (~50KB), and is the de facto standard for TypeScript runtime validation.

**Source:** https://zod.dev/ — Zod v3 documentation.

### How Zod Would Work Here

```typescript
import { z } from 'zod';

const PhaseStatus = z.enum(["not-started", "in-progress", "completed", "blocked"]);

const PhaseState = z.object({
  status: PhaseStatus,
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  summary: z.string().nullable(),
});

const ReviewPhaseState = PhaseState.extend({
  attempts: z.number().int().min(0),
  rubricAttempts: z.number().int().min(0),
  findings: z.array(z.object({
    severity: z.enum(["critical", "high", "medium", "low"]),
    file: z.string(),
    description: z.string(),
    requirement: z.string().nullable(),
  })),
  rubricScores: z.object({
    frImplemented: z.boolean(),
    frTested: z.boolean(),
    errorsClean: z.boolean(),
    testsPass: z.boolean(),
    noTodoFixme: z.boolean(),
  }).nullable(),
});

const ProgressSchema = z.object({
  feature: z.string().min(1),
  branch: z.string().min(1),
  phases: z.object({
    research: PhaseState,
    specification: PhaseState,
    plan: PhaseState,
    tasks: PhaseState,
    analyze: PhaseState, // extend for findings
    implement: PhaseState,
    review: ReviewPhaseState,
    validate: PhaseState,
    document: PhaseState,
  }),
  fixTasks: z.array(z.object({
    id: z.number().int().min(100),
    title: z.string().min(1),
    status: z.enum(["not-started", "in-progress", "completed"]),
    source: z.enum(["gate", "review"]),
  })),
  haltReason: z.string().nullable(),
});
```

### What Zod Can Do Beyond JSON Schema

| Capability | Zod Support |
|-----------|-------------|
| Structural validation (same as JSON Schema) | ✅ Yes |
| Custom refinements (e.g., "if status is completed, completedAt must not be null") | ✅ Yes |
| Transform data during validation | ✅ Yes |
| Type inference (TypeScript types from schema) | ✅ Yes |
| Composable schemas (extend, merge, pick) | ✅ Yes |
| Transition validation (if embedded in a function) | ✅ Yes — via `.refine()` or wrapper function |

### Transition Enforcement Example (Zod + TypeScript)

```typescript
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  "research": ["specification"],
  "specification": ["plan"],
  "plan": ["tasks"],
  "tasks": ["analyze"],
  "analyze": ["implement"],
  "implement": ["review"],
  "review": ["validate", "implement"], // implement = rejection cycle
  "validate": ["document"],
  "document": [],
};

function validateTransition(from: string, to: string): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

function checkCycleCap(progress: z.infer<typeof ProgressSchema>): boolean {
  const total = progress.phases.review.rubricAttempts + progress.phases.review.attempts;
  return total <= 4;
}
```

### Portability Concern

Zod requires:
- Node.js installed in the consumer project
- `npm install zod` (or bundled as a skill script)
- A TypeScript or JavaScript execution context

This is the critical problem: the workspace-baseline repository is a **template library**. Consumer projects may use Python, PowerShell, Go, or any other language. Requiring Node.js fundamentally limits portability.

**Verdict: STRONG TECHNICALLY, BUT PORTABILITY CONCERN IS A BLOCKER for direct inclusion in prompts. Best suited for an optional MCP server or skill.**

---

## Part 5: XState (Formal State Machine) Evaluation

### What XState Is

XState is a TypeScript library for creating finite state machines and statecharts. It provides:
- Typed states with exhaustive transition definitions
- Guard conditions on transitions
- Actor model for concurrent workflows
- Visual editor (Stately Studio) for designing workflows
- Serializable machine definitions

**Source:** https://stately.ai/docs/xstate — XState v5 documentation.

### How XState Would Model the Workon Workflow

```typescript
import { createMachine } from 'xstate';

const workonSpecMachine = createMachine({
  id: 'workonSpec',
  initial: 'research',
  context: { rubricAttempts: 0, reviewAttempts: 0 },
  states: {
    research: { on: { COMPLETE: 'specification' } },
    specification: { on: { COMPLETE: 'plan' } },
    plan: { on: { COMPLETE: 'tasks' } },
    tasks: { on: { COMPLETE: 'analyze' } },
    analyze: {
      on: {
        PASS: 'implement',
        CRITICAL: 'halted',
      }
    },
    implement: { on: { COMPLETE: 'review' } },
    review: {
      on: {
        APPROVED: 'validate',
        REJECTED: {
          target: 'implement',
          guard: 'underReviewCap',
          actions: 'incrementReviewAttempts',
        },
        REJECTED_OVER_CAP: 'halted',
      }
    },
    validate: { on: { PASS: 'document', FAIL: 'halted' } },
    document: { on: { COMPLETE: 'done' } },
    done: { type: 'final' },
    halted: { on: { RESUME: 'research' } }, // simplified
  },
});
```

### XState Advantages

- **Impossible to skip phases** — transitions are exhaustively defined
- **Guards prevent cap bypass** — `guard: 'underReviewCap'` is evaluated before transition
- **Visual tooling** — Stately Studio can visualize and document the workflow
- **Serializable** — machine definitions can be stored as JSON
- **Industry-validated** — used by Stately AI for LLM agent orchestration

### XState Disadvantages for This Use Case

- **Heavy dependency** — XState is a significant runtime library (~30KB gzipped)
- **Requires Node.js** — same portability concern as Zod
- **Paradigm shift** — moves workflow logic from prompt to code, which may be premature
- **Overhead for template library** — consumer projects would need to integrate XState
- **LLM cannot execute XState** — the state machine would need to run in a separate process (MCP server) and expose its state via tool calls

**Verdict: THEORETICALLY IDEAL but practically premature. Would be appropriate if the project evolves from a template library to a framework with a runtime component.**

---

## Part 6: Custom MCP Server Evaluation

### Concept

Build a lightweight MCP server that exposes workflow validation as tools. The coordinator prompt calls these tools instead of performing raw JSON read/write/validate operations itself.

### Proposed Tools

| Tool Name | Input | Output | What It Enforces |
|-----------|-------|--------|-----------------|
| `validate_progress` | `{ path: string }` | `{ valid: boolean, errors: string[] }` | Schema validation against JSON Schema |
| `transition_phase` | `{ path: string, from: string, to: string }` | `{ success: boolean, error?: string }` | Legal transition check + state update |
| `check_caps` | `{ path: string }` | `{ totalCycles: number, underCap: boolean, details: object }` | rubricAttempts + review.attempts ≤ 4 |
| `allocate_fix_task_id` | `{ path: string }` | `{ nextId: number }` | max(existing IDs) + 1, minimum 100 |

### How Prompts Would Change

Current (prompt-interpreted):
```markdown
1. READ PROGRESS.json
2. Verify phase statuses are coherent
3. Set current phase to "completed" with timestamp
4. Set next phase to "in-progress" with timestamp
5. Write PROGRESS.json
```

With MCP tools:
```markdown
1. Call `validate_progress` with spec directory path
2. If valid, call `transition_phase` with current and next phase
3. If transition succeeds, report to user
4. If transition fails, execute HALT Protocol
```

### Architecture

```
Coordinator Prompt (LLM)
    │
    ├── calls → validate_progress (MCP tool)
    ├── calls → transition_phase (MCP tool)
    ├── calls → check_caps (MCP tool)
    └── calls → allocate_fix_task_id (MCP tool)
    │
    ▼
MCP Server (TypeScript + Zod)
    │
    ├── reads/writes → PROGRESS.json
    ├── validates against → progress.schema.json
    └── enforces → transition rules, caps, ID allocation
```

### Advantages

- **Deterministic** — validation and transitions happen in code, not prompt interpretation
- **Portable prompts** — the prompts themselves stay as pure markdown (no TypeScript dependency)
- **Optional** — prompts can fall back to manual validation if MCP server is unavailable
- **Skill-compatible** — the MCP server can be packaged as a skill with bundled scripts
- **Addresses all critical failure modes** — schema validation + transition logic + cap enforcement

### Disadvantages

- **Requires MCP server setup** — consumer projects must configure the server
- **Node.js dependency** — the MCP server itself needs a TypeScript/Node.js runtime
- **Maintenance burden** — a code component to maintain alongside the prompts
- **Not all environments support MCP** — GitHub Copilot coding agent has limited MCP support compared to VS Code agent mode

### Implementation Complexity

| Component | Estimated Size | Complexity |
|-----------|---------------|------------|
| MCP server scaffold | ~100 lines | Low (use `@modelcontextprotocol/sdk`) |
| Validation tool (Zod/Ajv) | ~80 lines | Low |
| Transition tool | ~60 lines | Medium |
| Cap check tool | ~30 lines | Low |
| ID allocator tool | ~20 lines | Low |
| JSON Schema files | ~100 lines each | Low |
| **Total** | **~400 lines** | **Medium** |

**Verdict: BEST ARCHITECTURAL FIT if the project decides to add a runtime component. Should be implemented as an optional skill, not a hard requirement.**

---

## Part 7: Portability Impact Assessment

This is the critical evaluation for a template library.

### Current State

The repository's design philosophy (from README.md):
> "Copy what you need into your project's `.github/` folder, customize to fit, and move on."

The prompts currently have **zero runtime dependencies**. They work with any language, any framework, any project structure. The only requirement is that the consumer has GitHub Copilot.

### Impact of Each Approach

| Approach | New Dependencies | Consumer Setup Required | Portability Impact |
|----------|-----------------|------------------------|-------------------|
| **TypeSpec** | `@typespec/compiler`, `@typespec/json-schema` | `npm install` + `tsp compile` | 🔴 HIGH — build step required |
| **JSON Schema (static)** | None | None (reference file) | 🟢 NONE — universally supported |
| **Zod (in prompt)** | `zod` npm package | `npm install zod` | 🔴 HIGH — Node.js required |
| **MCP Server (optional)** | `@modelcontextprotocol/sdk`, `zod` | MCP server config | 🟡 MEDIUM — optional, fallback exists |
| **XState** | `xstate` npm package | `npm install xstate` + integration | 🔴 HIGH — heavy integration |
| **Agent Hooks** | None | VS Code configuration | 🟡 MEDIUM — VS Code specific |

### Recommended Portability Strategy

**Layered approach** — each layer is optional and additive:

1. **Layer 0 (always included):** Improved prompt language with stricter schema documentation inline
2. **Layer 1 (ship as reference):** JSON Schema files alongside prompts — consumers can use them or ignore them
3. **Layer 2 (optional skill):** MCP validation server packaged as a skill — consumers opt in by configuring the MCP server
4. **Layer 3 (future consideration):** Full XState-based workflow engine — only if the project evolves into a framework

---

## Part 8: MCP Tooling Improvements

### Current MCP Usage in Workon Prompts

Both prompts currently reference external knowledge MCP tools:

| Tool | Purpose | Improvement Opportunity |
|------|---------|----------------------|
| `mcp_microsoftdocs_microsoft_docs_search` | .NET/Microsoft docs | None — external knowledge only |
| `mcp_context7_resolve-library-id` | Library docs | None — external knowledge only |
| `mcp_brave-search_brave_web_search` | Current versions/APIs | None — external knowledge only |
| `mcp_sequential-th_sequentialthinking` | Complex reasoning | None — reasoning aid only |

### Proposed New MCP Tools (Workflow Validation Server)

If the project pursues the MCP server approach (Part 6), the following tools would be added to the Configuration table:

| Need | Tool | Fallback if unavailable |
|------|------|-------------------------|
| PROGRESS.json validation | `mcp_workon_validate_progress` | Manual schema check (prompt-interpreted) |
| Phase transition | `mcp_workon_transition_phase` | Manual READ/UPDATE/WRITE protocol |
| Cycle cap check | `mcp_workon_check_caps` | Manual counter arithmetic |
| FixTask ID allocation | `mcp_workon_allocate_fix_task_id` | `max(existing IDs) + 1` (prompt-interpreted) |

### Prompt Modifications Required

The Phase Transition Protocol section would add a conditional path:

```markdown
### Phase Transition Protocol

**If `mcp_workon_transition_phase` is available:**
1. Call `mcp_workon_validate_progress` — verify current state is valid
2. Call `mcp_workon_transition_phase` with `from` and `to` phase keys
3. If success: update `manage_todo_list` display, report transition
4. If failure: report error, execute HALT Protocol

**If MCP tool is not available (fallback):**
1. READ + VERIFY: Read PROGRESS.json. Confirm statuses are coherent.
2. UPDATE + WRITE: Set current to "completed", next to "in-progress"
3. REPORT: Update display, report transition.
```

This maintains backward compatibility while enabling deterministic enforcement when the tool is available.

---

## Part 9: Adjacent Concepts Discovered During Research

### Agent Hooks (VS Code)

VS Code supports "agent hooks" — deterministic shell commands that run at lifecycle points during agent sessions. These could enforce validation without an MCP server:

```json
{
  "github.copilot.chat.agent.hooks": {
    "postSaveFile": {
      "command": "node validate-progress.js ${file}",
      "when": "resourceFilename == 'PROGRESS.json'"
    }
  }
}
```

**Source:** https://code.visualstudio.com/docs/copilot/customization/hooks

**Assessment:** Promising for VS Code users, but not portable to GitHub Copilot coding agent or other environments.

### GitHub Blog: Multi-Agent Workflow Engineering

GitHub's engineering blog specifically recommends typed schemas and explicit action schemas for multi-agent workflows:

> "Use explicit, machine-checkable schemas. Relying on typed data structures allows agents to fail fast on schema violations and ensures all parties share a robust contract about what is exchanged."

**Source:** https://github.blog/ai-and-ml/generative-ai/multi-agent-workflows-often-fail-heres-how-to-engineer-ones-that-dont/

This validates the JSON Schema approach as an industry-endorsed minimum viable improvement.

### SpecKit Framework Integration

GitHub's SpecKit framework already generates Zod schemas for TypeScript projects during the `/speckit.plan` phase. If the consumer project uses TypeScript, SpecKit's generated validation code could be extended to cover PROGRESS.json validation as well — without requiring changes to the workspace-baseline prompts.

**Source:** https://speckit.org/

### Prompt-Embedded Schema Documentation

An alternative to external validation files: embed the JSON Schema directly in the prompt as a code block. LLMs are highly effective at reading JSON Schema and using it as a structural contract. This is already partially done in the current prompts (the Schema section documents the structure) but could be made more formal by using actual JSON Schema syntax.

---

## Part 10: Comparison Matrix

| Criterion | TypeSpec | JSON Schema | Zod | XState | MCP Server | Agent Hooks |
|-----------|---------|-------------|-----|--------|------------|-------------|
| **Schema validation** | ✅ (via output) | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Transition enforcement** | ❌ | ❌ | ✅ (with code) | ✅ | ✅ | ❌ |
| **Retry cap logic** | ❌ | ❌ | ✅ (with code) | ✅ | ✅ | ✅ (script) |
| **Zero dependencies** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ (VS Code) |
| **Works with any language** | ❌ | ✅ | ❌ | ❌ | ✅ (via MCP) | ❌ |
| **LLM-readable** | ❌ | ✅ | ✅ | ❌ | N/A | N/A |
| **Build step required** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Consumer project impact** | HIGH | NONE | HIGH | HIGH | MEDIUM | LOW |
| **Addresses failure modes** | 1,4,5,6,7 | 1,4,5,6,7 | 1-10 | 1-10 | 1-10 | 8 (partial) |
| **Implementation effort** | MEDIUM | LOW | MEDIUM | HIGH | MEDIUM | LOW |

---

## Recommendations

### Immediate (No Code Changes Required)

1. **Ship JSON Schema files as reference artifacts** alongside the prompts. Place them in the same directory or a shared `schemas/` directory. This addresses failure modes 1, 4, 5, 6, 7 with zero consumer impact.

2. **Strengthen prompt schema documentation** by replacing the current informal schema section with a formal JSON Schema code block. LLMs read JSON Schema more reliably than prose descriptions of expected structures.

3. **Add a `$schema` reference** to the PROGRESS.json template in the prompt:
   ```json
   { "$schema": "./progress.schema.json", ... }
   ```
   This enables IDE validation for consumers using VS Code or JetBrains.

### Short-Term (Skill Development)

4. **Create a `workon-validator` skill** that bundles:
   - JSON Schema files for both myidea and myspec PROGRESS.json variants
   - A lightweight validation script (Node.js or PowerShell) that can be run ad-hoc
   - Reference documentation for the schema
   - The skill's SKILL.md triggers on "validate PROGRESS" or "check workflow state"

### Medium-Term (MCP Server)

5. **Build an optional MCP validation server** (packaged as a skill with scripts) that exposes `validate_progress`, `transition_phase`, `check_caps`, and `allocate_fix_task_id` tools. Update prompts with conditional MCP tool usage (with prompt-interpreted fallback).

### Not Recommended

6. **TypeSpec** — overhead exceeds value for this use case. The generated output (JSON Schema) can be written directly.

7. **XState** — architecturally ideal but introduces too much runtime complexity for a template library.

8. **Zod as a direct prompt dependency** — breaks portability. Suitable only inside an MCP server or skill script.

---

## Decision Required

This research identifies **four implementation tiers**. The project owner should decide which tiers to pursue:

| Tier | What | Effort | Impact | Dependencies |
|------|------|--------|--------|-------------|
| **0: Prompt improvements** | Formal JSON Schema in prompt docs | 1-2 hours | Moderate | None |
| **1: JSON Schema files** | Ship `.schema.json` alongside prompts | 2-4 hours | Moderate | None |
| **2: Validator skill** | Skill with scripts + schemas + docs | 1-2 days | High | Node.js (optional) |
| **3: MCP server** | Full validation/transition server | 3-5 days | Very high | Node.js + MCP config |

Tiers 0 and 1 can be implemented immediately with zero risk. Tiers 2 and 3 require architectural decisions about whether this repository should include runtime components.

---

## Sources

### TypeSpec
- TypeSpec Official: https://typespec.io/
- TypeSpec GitHub: https://github.com/Microsoft/typespec
- TypeSpec Overview (Microsoft Learn): https://learn.microsoft.com/en-us/azure/developer/typespec/overview
- TypeSpec JSON Schema Emitter: https://www.npmjs.com/package/@typespec/json-schema
- TypeSpec InfoQ Analysis: https://www.infoq.com/news/2024/05/typespec/

### JSON Schema
- JSON Schema Spec: https://json-schema.org/
- Ajv Validator: https://ajv.js.org/
- JSON Schema Advanced Patterns: https://jsonconsole.com/blog/json-schema-validation-advanced-patterns-best-practices-enterprise-applications

### Zod
- Zod Documentation: https://zod.dev/
- Zod GitHub: https://github.com/colinhacks/zod
- Zod + TypeScript Production Guide: https://superjson.ai/blog/2025-08-25-json-schema-validation-typescript-zod-guide/

### XState
- XState Documentation: https://stately.ai/docs/xstate
- XState GitHub: https://github.com/statelyai/xstate
- Agentic State Machines: https://deepwiki.com/adamterlson/AgenticStateMachines/3.1-xstate-integration

### MCP / Copilot Agent Mode
- MCP Server Guide (VS Code): https://code.visualstudio.com/docs/copilot/customization/mcp-servers
- Building MCP Servers (GitHub Blog): https://github.blog/ai-and-ml/github-copilot/building-your-first-mcp-server-how-to-extend-ai-tools-with-custom-capabilities/
- Agent Hooks (VS Code): https://code.visualstudio.com/docs/copilot/customization/hooks
- Copilot Coding Agent Environment: https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/customize-the-agent-environment
- MCP Workflow Library: https://github.com/P0u4a/mcp-workflow

### Multi-Agent Reliability
- GitHub Blog — Multi-Agent Failures: https://github.blog/ai-and-ml/generative-ai/multi-agent-workflows-often-fail-heres-how-to-engineer-ones-that-dont/
- Multi-Agent Failure Modes (Academic): https://www.marktechpost.com/2025/03/25/understanding-and-mitigating-failure-modes-in-llm-based-multi-agent-systems/

### SpecKit
- SpecKit Official: https://speckit.org/
- SpecKit GitHub: https://github.com/github/spec-kit
- SpecKit Deep Dive: https://blog.lpains.net/posts/2025-12-07-deep-dive-into-speckit/
- SpecKit Workflow Discussion: https://github.com/github/spec-kit/discussions/468

---

## Related

- [ADR-0001: Workon Prompt Rewrite](../adr/0001-workon-prompt-rewrite-phase-loss-mitigation.md)
- [Workon Orchestrator Research Spike](../prompt-craft/workon-orchestrator-research-spike.md)
- [Workon Phase Loss Lessons Learned](../prompt-craft/workon-phase-loss-lessons-learned.md)
- [workon.myspec prompt](../../prompts/workon.myspec.prompt.md)
- [workon.myidea prompt](../../prompts/workon.myidea.prompt.md)
