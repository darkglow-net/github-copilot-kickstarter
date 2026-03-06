# Implementation Plan: Workflow State Service

**Feature**: Workflow State Service
**Spec**: [spec.md](spec.md)
**Branch**: `001-workflow-state-service`
**Complexity**: 11 (large greenfield)
**Date**: 2026-03-06

---

## Technical Context

| Area | Details |
|------|---------|
| **Runtime** | Node.js 24 (Docker-only, no local install) |
| **Language** | TypeScript 5.x, compiled via `tsc` |
| **MCP SDK** | v2 packages: `@modelcontextprotocol/server`, `@modelcontextprotocol/express`, `@modelcontextprotocol/node` |
| **Validation** | Zod v4 (`import * as z from 'zod/v4'`) |
| **Database** | SQLite 3.x via better-sqlite3 12.6.2, Kysely 0.28.x query builder |
| **Transport** | HTTP/SSE via `createMcpExpressApp()` + `NodeStreamableHTTPServerTransport` |
| **Container** | Single Docker container, `node:24-alpine`, multi-stage build |
| **Testing** | Node.js built-in test runner (`node --test`) |
| **Target directory** | `MCP/workflow-state-service/` |

### Dependencies Resolved

All technology decisions are documented in [research.md](research.md). Key findings:

- MCP SDK v2 uses separate packages (`@modelcontextprotocol/server`, `/express`, `/node`)
- `registerTool()` accepts Zod schemas directly — no JSON Schema conversion
- `createMcpExpressApp()` provides Express app with DNS rebinding protection
- Stateful sessions via `NodeStreamableHTTPServerTransport` with `sessionIdGenerator`
- Kysely `SqliteDialect` wraps better-sqlite3 synchronous driver
- `crypto.randomUUID()` replaces `uuid` package (Node.js 24 built-in)
- `node --test` with `--experimental-strip-types` for TypeScript test files

---

## Implementation Approach

### Architecture: Layered with Tool Surface

```
┌─────────────────────────────────────────────┐
│  MCP Tool Surface (20 tools)                │
│  src/tools/*.ts — registerTool() calls      │
│  Zod v4 input/output schemas                │
├─────────────────────────────────────────────┤
│  Service Layer                              │
│  src/services/*.ts — business logic         │
│  Transition enforcement, evidence gates,    │
│  export assembly, retention                 │
├─────────────────────────────────────────────┤
│  Database Layer                             │
│  src/db/ — Kysely + better-sqlite3          │
│  Type-safe queries, migrations, WAL mode    │
├─────────────────────────────────────────────┤
│  Schema Layer                               │
│  src/schemas/ — Zod v4 schemas              │
│  Phase config, evidence categories, events  │
└─────────────────────────────────────────────┘
```

### Implementation Order

Build bottom-up: schemas → database → services → tools → server bootstrap → Docker.

---

## Phase Breakdown

### Phase A: Foundation (schemas, database, types)

**Goal**: Establish all type definitions, Zod schemas, database schema, and connection setup.

**Deliverables**:
1. `src/types.ts` — TypeScript interfaces: `ProgressState`, `PhaseState`, `PhaseConfig`, `PhaseDefinition`, `TransitionRule`, `GateRule`, `Task`, `FixTask`, `ContextEntry`, `EvidenceRecord`, `WorkflowEvent`, `ToolError`
2. `src/schemas/phase-config.ts` — Zod schema for `PhaseConfig` with semantic validation (unique keys, unique ordinals, valid transition references, `_close` rules)
3. `src/schemas/progress-state.ts` — Zod schema for `ProgressState`, `PhaseState`, `Task`, `FixTask`
4. `src/schemas/evidence.ts` — Zod schemas for all 6 evidence categories (`test-results`, `error-diagnostic`, `checklist`, `agent-completion`, `code-review`, `custom`) with gate result computation functions
5. `src/schemas/events.ts` — Zod schemas for 18 event types with discriminated union on `eventType`
6. `src/schemas/context.ts` — Zod schema for context entry categories (`briefing`, `delegation`, `decision`)
7. `src/db/schema.ts` — Kysely `Database` interface with table definitions matching Section 5.1
8. `src/db/connection.ts` — Database connection factory: creates better-sqlite3 instance, sets `PRAGMA journal_mode=WAL`, `PRAGMA foreign_keys=ON`, returns `Kysely<Database>`
9. `src/db/migrations/001-initial.ts` — Creates all 5 tables with constraints, foreign keys, and indexes
10. `package.json` — Dependencies, scripts, TypeScript config
11. `tsconfig.json` — TypeScript configuration targeting ES2024, Node module resolution

**Validation**: All schemas compile. Migration creates tables successfully in an in-memory SQLite database.

### Phase B: Service Layer (business logic)

**Goal**: Implement all business logic as testable service functions that operate on the database via Kysely.

**Deliverables**:
1. `src/services/workflow.ts` — Workflow CRUD:
   - `createWorkflow(params)` → generates UUID, validates phase config, creates `workflows` + `workflow_state` rows, initializes `ProgressState` with first phase `in-progress`
   - `getState(workflowId)` → returns `ProgressState`, `stateVersion`, `PhaseConfig`
   - `listActive(branchName?)` → queries workflows with active/blocked/completed-but-open status
   - `updateState(workflowId, patch)` → patches tasks/fixTasks/context/metadata, increments version
   - `haltWorkflow(workflowId, reason)` → sets halt, blocks current phase
   - `resumeWorkflow(workflowId)` → clears halt, unblocks phase
2. `src/services/transition.ts` — Phase transition enforcement:
   - `transitionPhase(workflowId, from, to, summary)` → validates transition legality, evaluates gates, executes or rejects
   - Gate evaluation: queries latest evidence per `(phase_key, category)`, checks `must-pass` and `should-pass` rules
   - Phase re-entry handling: clears `completedAt`/`summary` on back-edge transitions
3. `src/services/evidence.ts` — Evidence management:
   - `submitEvidence(params)` → validates category schema, computes `gateResult`, stores record
   - `getEvidence(workflowId, phaseKey?, category?)` → filtered retrieval
   - `computeGateResult(category, data)` → applies per-category rules from spec Section 5.5
4. `src/services/export.ts` — Export and close:
   - `exportWorkflow(workflowId)` → reads all state, events, evidence, context
   - `closeWorkflow(workflowId)` → exports then deletes workflow row (cascade purges children)
5. `src/services/retention.ts` — Data retention:
   - `purgeOrphans(ttlDays)` → finds/deletes workflows where `updated_at < NOW - ttl`, logs warnings
   - `startRetentionSchedule(ttlDays)` → runs purge on startup + setInterval every 24h
6. Event helpers (integrated into workflow/transition services):
   - `appendEvent(params)` → validates event type + payload schema, assigns seq atomically
   - `getEvents(workflowId, sinceCursor?, eventType?, limit?)` → cursor-based pagination
7. Context helpers:
   - `storeContext(params)` → upserts entry, emits `context-stored` event
   - `getContext(workflowId, category?, key?)` → filtered retrieval
   - `getBriefing(workflowId)` → compiles recovery summary
8. Validation helpers:
   - `validateState(workflowId)` → structural integrity checks (spec Section 6.5)
   - `checkCaps(workflowId)` → counts rubric/review attempts from events
   - `allocateTaskId(workflowId, taskType)` → next sequential ID ≥ 100

**Validation**: Unit tests for each service function using in-memory SQLite. Test phase transitions with evidence gates. Test gate rejection scenarios.

### Phase C: MCP Tool Surface (20 tools)

**Goal**: Register all 20 MCP tools with Zod input/output schemas, tool annotations, and dual `content` + `structuredContent` responses.

**Deliverables** (one registration file per tool group, calling service layer):
1. `src/tools/lifecycle.ts` — 5 tools: `create-workflow`, `list-active`, `get-state`, `export-workflow`, `close-workflow`
2. `src/tools/transitions.ts` — 1 tool: `transition-phase` (with `actorKind` guard)
3. `src/tools/state-mutation.ts` — 3 tools: `update-state`, `halt-workflow`, `resume-workflow`
4. `src/tools/events.ts` — 2 tools: `append-event`, `get-events`
5. `src/tools/evidence.ts` — 2 tools: `submit-evidence`, `get-evidence`
6. `src/tools/context.ts` — 3 tools: `store-context`, `get-context`, `get-briefing`
7. `src/tools/validation.ts` — 3 tools: `validate-state`, `check-caps`, `allocate-task-id`
8. `src/tools/subagent.ts` — 1 tool: `report-done`

Each tool registration:
- Uses `server.registerTool(name, { title, description, inputSchema, outputSchema, annotations }, handler)`
- Returns `{ content: [{ type: 'text', text: humanReadable }], structuredContent: typedResult }`
- Returns `isError: true` with `ToolError` structure on failures
- Applies tool annotations from spec Section 7

**Validation**: Integration tests calling tools through the MCP server instance. Test error responses. Test tool annotations.

### Phase D: Server Bootstrap + Docker

**Goal**: Wire together the MCP server, Express app, health endpoint, session management, client notifications, and Docker packaging.

**Deliverables**:
1. `src/server.ts` — Server entrypoint:
   - Creates `Kysely` database connection
   - Runs migrations on startup
   - Runs orphan purge on startup
   - Creates `createMcpExpressApp()` Express app
   - Adds `/health` endpoint (GET, checks DB connectivity)
   - Sets up session-based MCP transport (POST/GET/DELETE `/mcp`)
   - For each new session: creates `McpServer`, registers all 20 tools, connects transport
   - On client connect: sends notification if active workflows exist (NFR-007)
   - Listens on `PORT` (default 3001), bound to `127.0.0.1`
   - Graceful shutdown: closes database, clears retention interval
2. `Dockerfile` — Multi-stage build (spec Section 8.2)
3. `compose.yaml` — Docker Compose with volume, healthcheck, restart policy (spec Section 8.3)
4. `.env.example` — Environment variable documentation

**Validation**: `docker compose up --build` starts cleanly. Health endpoint returns 200. MCP Inspector can connect and list tools. Two concurrent workflows don't collide.

### Phase E: Testing + Polish

**Goal**: Comprehensive test coverage, edge cases, and documentation.

**Deliverables**:
1. `test/services/*.test.ts` — Unit tests for all service functions
2. `test/tools/*.test.ts` — Integration tests for all 20 tools
3. `test/fixtures/*.ts` — Test phase configs (6-phase myidea, 9-phase myspec), sample states
4. Edge case tests:
   - Concurrent workflow isolation
   - Gate rejection with missing evidence
   - Gate rejection with failed evidence
   - Back-edge transition (review → implement) re-entry
   - Halt + resume cycle
   - Close returns complete export before purge
   - Orphan TTL purge
   - Invalid phase config at creation
   - `_close` pseudo-phase handling
   - Context upsert (create + update)
   - `get-briefing` after storing context entries
   - `allocate-task-id` minimum 100 rule
   - `check-caps` cycle counting from events
5. `docs/developer-guide.md` — Developer documentation for prompt authors

**Validation**: `node --test test/**/*.test.ts` passes. All spec Section 12.1 MVP criteria satisfied.

---

## Key Technical Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Replace `uuid` package with `crypto.randomUUID()` | Node.js 24 built-in; removes one runtime dependency |
| 2 | Programmatic migration provider (not `FileMigrationProvider`) | Avoids Node.js `fs` path resolution issues in Docker; migrations are type-checked |
| 3 | Stateful sessions (not stateless per-request) | Required for NFR-007 client notifications on connect; each session gets its own server instance |
| 4 | Bottom-up implementation order | Schemas → DB → Services → Tools → Server ensures each layer is tested before the next depends on it |
| 5 | Service functions accept `Kysely<Database>` via dependency injection | Enables unit testing with in-memory SQLite without Docker |
| 6 | Tool handlers are thin wrappers over service functions | Business logic is testable independently of MCP transport |
| 7 | `state_version` is audit-only, not OCC | SQLite WAL serializes writes; simpler API without optimistic concurrency headers |
| 8 | Evidence gate evaluation uses latest submission per `(phase, category)` | Allows re-submission on phase re-entry without clearing history |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| MCP SDK v2 API instability (pre-alpha) | Pin exact versions in package.json. Research confirms current API shape. Wrapper functions isolate SDK calls. |
| better-sqlite3 native binding issues in Docker | Alpine prebuilds available for Node 24. Fallback: add `python3`, `make`, `g++` to builder stage. |
| `createMcpExpressApp()` API changes | Isolated in `src/server.ts`. If API changes, only one file needs updating. |
| No local Node.js for development | All dev/test commands run inside Docker via `docker compose exec`. Docker Compose provides the dev loop. |
| Concurrent write safety | SQLite WAL mode + Kysely transactions. Test with parallel tool calls against two workflows. |

---

## File Manifest

| File | Phase | Purpose |
|------|-------|---------|
| `package.json` | A | Dependencies and scripts |
| `tsconfig.json` | A | TypeScript configuration |
| `src/types.ts` | A | Shared TypeScript interfaces |
| `src/schemas/phase-config.ts` | A | Phase configuration Zod schema |
| `src/schemas/progress-state.ts` | A | ProgressState Zod schema |
| `src/schemas/evidence.ts` | A | Evidence category Zod schemas + gate rules |
| `src/schemas/events.ts` | A | Event type Zod schemas |
| `src/schemas/context.ts` | A | Context entry Zod schema |
| `src/db/schema.ts` | A | Kysely database interface |
| `src/db/connection.ts` | A | Database connection factory |
| `src/db/migrations/001-initial.ts` | A | Initial schema migration |
| `src/services/workflow.ts` | B | Workflow CRUD + state management |
| `src/services/transition.ts` | B | Phase transition enforcement |
| `src/services/evidence.ts` | B | Evidence validation + gate evaluation |
| `src/services/export.ts` | B | Export data assembly |
| `src/services/retention.ts` | B | Orphan purge + TTL |
| `src/tools/lifecycle.ts` | C | Lifecycle MCP tools (5) |
| `src/tools/transitions.ts` | C | Transition MCP tool (1) |
| `src/tools/state-mutation.ts` | C | State mutation MCP tools (3) |
| `src/tools/events.ts` | C | Event MCP tools (2) |
| `src/tools/evidence.ts` | C | Evidence MCP tools (2) |
| `src/tools/context.ts` | C | Context memory MCP tools (3) |
| `src/tools/validation.ts` | C | Validation MCP tools (3) |
| `src/tools/subagent.ts` | C | Subagent MCP tool (1) |
| `src/server.ts` | D | Server entrypoint |
| `Dockerfile` | D | Multi-stage Docker build |
| `compose.yaml` | D | Docker Compose config |
| `.env.example` | D | Environment variable docs |
| `test/services/*.test.ts` | E | Service unit tests |
| `test/tools/*.test.ts` | E | Tool integration tests |
| `test/fixtures/*.ts` | E | Test data |
| `docs/developer-guide.md` | E | Developer documentation |

---

## Success Criteria Mapping

Mapping spec Section 12.1 MVP criteria to plan phases:

| Criterion | Plan Phase | Verification |
|-----------|-----------|--------------|
| All 20 MCP tools registered and functional | C | Tool integration tests |
| Tool I/O validated by Zod schemas | A, C | Schema tests + tool error response tests |
| Phase transitions enforce gate rules | B | Transition service tests with evidence |
| Event log append-only with cursor pagination | B | Event service tests |
| Evidence categories validate + compute gateResult | A, B | Evidence schema tests |
| Data retention: close purges, orphan TTL | B, D | Retention service tests |
| Docker single-container build and run | D | `docker compose up --build` |
| All tests pass with Node.js built-in test runner | E | `node --test` |
| Two concurrent workflows don't collide | E | Parallel workflow test |

---

## Related Documents

- [spec.md](spec.md) — Full specification (1475 lines)
- [research.md](research.md) — Technology research and decisions
- [data-model.md](data-model.md) — Entity relationships and schemas
- [quickstart.md](quickstart.md) — Getting started guide
- [checklists/requirements.md](checklists/requirements.md) — Specification quality checklist
