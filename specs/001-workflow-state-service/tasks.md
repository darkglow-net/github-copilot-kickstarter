# Tasks: Workflow State Service

**Input**: Design documents from `/specs/001-workflow-state-service/`
**Prerequisites**: plan.md, spec.md, data-model.md, research.md, quickstart.md
**Target Directory**: `MCP/workflow-state-service/`

**Tests**: MANDATORY — test-first (test tasks precede implementation tasks).

**Organization**: Tasks follow the 5-phase implementation plan (A: Foundation, B: Services, C: Tools, D: Server+Docker, E: Testing+Polish). Within Phases B–D, tests are written before their corresponding implementations.

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- Include exact file paths relative to `MCP/workflow-state-service/`

---

## Phase 1: Setup (Project Scaffolding)

**Purpose**: Create project structure, configure tooling, install dependencies.

- [X] T001 Create project directory structure per spec Section 9 in MCP/workflow-state-service/ (src/tools/, src/db/migrations/, src/schemas/, src/services/, test/tools/, test/services/, test/fixtures/, test/edge-cases/, docs/)
- [X] T002 Create package.json with all runtime deps (@modelcontextprotocol/server, @modelcontextprotocol/express, @modelcontextprotocol/node, zod, better-sqlite3, kysely, express) and dev deps (typescript, @types/better-sqlite3, @types/express, @modelcontextprotocol/client) per spec Section 13; scripts: build, start, dev, test, lint per spec Section 8.4
- [X] T003 [P] Create tsconfig.json targeting ES2024, NodeNext module resolution, strict mode, outDir dist/, include src/**/*.ts
- [X] T004 [P] Create .env.example documenting PORT, LOG_LEVEL, DB_PATH, ORPHAN_TTL_DAYS per quickstart.md Section 5

**Checkpoint**: `npm install` succeeds. `npx tsc --noEmit` runs (may error on missing source files — that's expected).

---

## Phase 2: Foundation (Phase A — Types, Schemas, Database)

**Purpose**: Establish all type definitions, Zod v4 schemas, Kysely database interface, connection factory, and initial migration. All schema and database infrastructure that later phases depend on.

**⚠ BLOCKING**: No service or tool work can begin until this phase is complete.

### Types and Schemas

- [X] T005 [P] Define all TypeScript interfaces in src/types.ts: ProgressState, PhaseState, PhaseConfig, PhaseDefinition, TransitionRule, GateRule, Task, FixTask, ContextEntry, EvidenceRecord, WorkflowEvent, ToolError — per spec Sections 5.2–5.9
- [X] T006 [P] Create Zod v4 schema for PhaseConfig in src/schemas/phase-config.ts with semantic validation: unique phase keys, unique ordinals, valid transition references, _close pseudo-phase rules, at least one phase and one transition — per spec Section 5.3
- [X] T007 [P] Create Zod v4 schemas for ProgressState, PhaseState, Task, FixTask in src/schemas/progress-state.ts — per spec Section 5.2
- [X] T008 [P] Create Zod v4 schemas for all 6 evidence categories (test-results, error-diagnostic, checklist, agent-completion, code-review, custom) with computeGateResult() functions per category rules in src/schemas/evidence.ts — per spec Section 5.5
- [X] T009 [P] Create Zod v4 schemas for 18 event types with discriminated union on eventType, common envelope schema (eventId, workflowId, seq, timestamp, actorKind, actorName, actorRunId, phaseKey, eventType, payload) in src/schemas/events.ts — per spec Section 5.4
- [X] T010 [P] Create Zod v4 schema for context entry categories (briefing, delegation, decision) and ContextEntry validation in src/schemas/context.ts — per spec Section 5.6

### Database Layer

- [X] T011 Create Kysely Database interface with table type definitions for all 5 tables (workflows, workflow_state, workflow_events, workflow_evidence, workflow_context) in src/db/schema.ts — per data-model.md
- [X] T012 Create database connection factory in src/db/connection.ts: accepts dbPath, creates better-sqlite3 instance, sets PRAGMA journal_mode=WAL and PRAGMA foreign_keys=ON, returns Kysely<Database> — per research.md Section 5
- [X] T013 Create initial migration in src/db/migrations/001-initial.ts: all 5 tables with columns, constraints, foreign keys (ON DELETE CASCADE), composite PK on workflow_context, and all indexes (idx_workflows_updated, idx_events_workflow_seq, idx_events_workflow_type, idx_evidence_workflow_phase_cat, idx_evidence_workflow, idx_context_workflow_cat) — per data-model.md

### Foundation Tests

- [X] T014 [P] Create test fixture: two phase config presets (6-phase myidea, 9-phase myspec) in test/fixtures/phase-configs.ts — per spec Section 10.2
- [X] T015 [P] Create test fixture: sample ProgressState objects, sample evidence data, sample events in test/fixtures/sample-states.ts
- [X] T016 Write tests for PhaseConfig schema validation (valid configs, duplicate keys, duplicate ordinals, invalid transition refs, missing _close rules, empty phases/transitions) in test/schemas/phase-config.test.ts
- [X] T017 [P] Write tests for evidence category schemas (valid/invalid data for each of 6 categories, gateResult computation) in test/schemas/evidence.test.ts
- [X] T018 [P] Write tests for event type schemas (valid/invalid payloads for all 18 event types, discriminated union) in test/schemas/events.test.ts
- [X] T019 Write tests for database connection factory and migration (creates all 5 tables, indexes exist, foreign keys enforced, WAL mode active) using in-memory SQLite in test/db/connection.test.ts

**Checkpoint**: All schemas compile. `node --test test/schemas/*.test.ts test/db/*.test.ts` passes. Migration creates all 5 tables in in-memory SQLite.

---

## Phase 3: Services (Phase B — Business Logic, Test-First)

**Purpose**: Implement all business logic as testable service functions operating on the database via Kysely. Each service gets tests FIRST, then implementation.

### Workflow Service (CRUD, state, events, validation helpers)

- [X] T020 Write tests for workflow service in test/services/workflow.test.ts: createWorkflow (UUID generation, phase config validation, initial ProgressState with first phase in-progress, workflow-created event), getState (returns ProgressState + stateVersion + PhaseConfig), listActive (filters by active/blocked/completed-but-open, branchName filter), updateState (patches tasks/fixTasks/context/phaseMetadata, increments version), haltWorkflow (sets haltReason, blocks current phase, emits workflow-halted), resumeWorkflow (clears halt, unblocks phase, emits phase-started), appendEvent (validates eventType + payload schema, assigns seq atomically), getEvents (cursor-based pagination, eventType filter, limit), validateState (structural integrity per spec Section 6.5), checkCaps (cycle counting from events per spec Section 6.5), allocateTaskId (next sequential ID, minimum 100 rule)
- [X] T021 Implement workflow service in src/services/workflow.ts: createWorkflow, getState, listActive, updateState, haltWorkflow, resumeWorkflow, appendEvent, getEvents, validateState, checkCaps, allocateTaskId — per plan Phase B deliverables 1, 6, 8

### Evidence Service

- [X] T022 Write tests for evidence service in test/services/evidence.test.ts: submitEvidence (validates category schema, computes gateResult per category rules, stores record, emits evidence-submitted event), getEvidence (filtered by workflowId, phaseKey, category), computeGateResult for all 6 categories
- [X] T023 Implement evidence service in src/services/evidence.ts: submitEvidence, getEvidence, computeGateResult — per plan Phase B deliverable 3

### Transition Service

- [X] T024 Write tests for transition service in test/services/transition.test.ts: transitionPhase (validates actorKind=coordinator, verifies from matches current phase, checks transition legality, evaluates must-pass gates, warns on should-pass, executes transition on success, rejects with unmetGates on failure), back-edge re-entry (clears completedAt/summary), _close pseudo-phase handling (sets current_phase_key to null), emits transition-requested + transition-approved/rejected events
- [X] T025 Implement transition service in src/services/transition.ts: transitionPhase with gate evaluation — per plan Phase B deliverable 2

### Context Service

- [X] T026 Write tests for context service in test/services/context.test.ts: storeContext (upserts entry, emits context-stored event, returns created boolean), getContext (no filter, category filter, category+key filter), getBriefing (compiles recovery summary with identity, phases summary, context entries grouped by category, status, haltReason)
- [X] T027 Implement context service in src/services/context.ts: storeContext, getContext, getBriefing — per plan Phase B deliverable 7

### Export Service

- [X] T028 Write tests for export service in test/services/export.test.ts: exportWorkflow (returns full ProgressState + events + evidence + context), closeWorkflow (returns export data, emits workflow-closed event, deletes workflow row triggering cascade purge, returns purged: true)
- [X] T029 Implement export service in src/services/export.ts: exportWorkflow, closeWorkflow — per plan Phase B deliverable 4

### Retention Service

- [X] T030 Write tests for retention service in test/services/retention.test.ts: purgeOrphans (finds workflows with updated_at older than TTL, deletes them, logs warnings), startRetentionSchedule (runs purge on startup + setInterval 24h)
- [X] T031 Implement retention service in src/services/retention.ts: purgeOrphans, startRetentionSchedule — per plan Phase B deliverable 5

**Checkpoint**: `node --test test/services/*.test.ts` passes. All service functions tested with in-memory SQLite. Gate rejection, halt/resume, and evidence validation all verified.

---

## Phase 4: MCP Tools (Phase C — Tool Surface, Test-First)

**Purpose**: Register all 20 MCP tools with Zod v4 input/output schemas, tool annotations, and dual content + structuredContent responses. Each tool group gets tests FIRST, then registration.

Tool tests are integration tests that create an McpServer instance, register tools, and invoke them programmatically (no HTTP transport needed for tool-level tests).

### Lifecycle Tools (5 tools: create-workflow, list-active, get-state, export-workflow, close-workflow)

- [X] T032 Write integration tests for lifecycle tools in test/tools/lifecycle.test.ts: create-workflow (valid config → returns workflowId + state; invalid config → isError), list-active (returns active/blocked/completed workflows, branchName filter), get-state (returns state + version + config; unknown ID → WORKFLOW_NOT_FOUND), export-workflow (returns full data), close-workflow (returns export + purged, subsequent get-state fails)
- [X] T033 Implement lifecycle tool registrations in src/tools/lifecycle.ts: registerTool for each with inputSchema, outputSchema, annotations (readOnlyHint, destructiveHint, idempotentHint per spec Section 7), handlers calling service layer — per spec Section 6.1

### Transition Tool (1 tool: transition-phase)

- [X] T034 Write integration tests for transition tool in test/tools/transitions.test.ts: successful transition with evidence, rejected transition without must-pass evidence, actorKind guard (non-coordinator rejected), transition to _close, back-edge transition re-entry
- [X] T035 Implement transition tool registration in src/tools/transitions.ts — per spec Section 6.2

### State Mutation Tools (3 tools: update-state, halt-workflow, resume-workflow)

- [X] T036 Write integration tests for state mutation tools in test/tools/state-mutation.test.ts: update-state (patch tasks, fixTasks, context, phaseMetadata, complexityScore; at least one field required), halt-workflow (blocks current phase, sets haltReason), resume-workflow (clears halt, restores in-progress; reject if not halted)
- [X] T037 Implement state mutation tool registrations in src/tools/state-mutation.ts — per spec Section 6.6

### Event Tools (2 tools: append-event, get-events)

- [X] T038 Write integration tests for event tools in test/tools/events.test.ts: append-event (valid event type + payload → returns eventId + seq; invalid type → error; invalid payload → VALIDATION_FAILED), get-events (cursor pagination, eventType filter, limit, returns nextCursor)
- [X] T039 Implement event tool registrations in src/tools/events.ts — per spec Section 6.3

### Evidence Tools (2 tools: submit-evidence, get-evidence)

- [X] T040 Write integration tests for evidence tools in test/tools/evidence.test.ts: submit-evidence (valid category → returns evidenceId + gateResult; invalid category → INVALID_CATEGORY; invalid data → VALIDATION_FAILED), get-evidence (filter by phase, category, both, neither)
- [X] T041 Implement evidence tool registrations in src/tools/evidence.ts — per spec Section 6.4

### Context Tools (3 tools: store-context, get-context, get-briefing)

- [X] T042 Write integration tests for context tools in test/tools/context.test.ts: store-context (create new → created:true, update existing → created:false, invalid category → INVALID_CATEGORY), get-context (no filter, category, category+key), get-briefing (returns compiled recovery summary with all sections)
- [X] T043 Implement context tool registrations in src/tools/context.ts — per spec Section 6.8

### Validation Tools (3 tools: validate-state, check-caps, allocate-task-id)

- [X] T044 Write integration tests for validation tools in test/tools/validation.test.ts: validate-state (returns valid:true for good state, returns errors for inconsistencies), check-caps (computes rubricAttempts, reviewAttempts, totalCycles, exceeded), allocate-task-id (returns ≥100, increments sequentially for both task and fixTask types)
- [X] T045 Implement validation tool registrations in src/tools/validation.ts — per spec Section 6.5

### Subagent Tool (1 tool: report-done)

- [X] T046 Write integration tests for report-done in test/tools/subagent.test.ts: creates agent-completion evidence record AND subagent-completed event (or subagent-failed when status=failed), returns evidenceId + eventId, defaults phaseKey to current_phase_key
- [X] T047 Implement report-done tool registration in src/tools/subagent.ts — per spec Section 6.6 (report-done)

**Checkpoint**: `node --test test/tools/*.test.ts` passes. All 20 tools registered with correct annotations. ToolError responses have correct error codes. Dual content + structuredContent responses verified.

---

## Phase 5: Server Bootstrap + Docker (Phase D)

**Purpose**: Wire MCP server with Express, session management, health endpoint, client notifications, and Docker packaging.

- [X] T048 Write tests for server bootstrap in test/server.test.ts: health endpoint returns 200 + {status:"ok", database:"connected"}, MCP session creation via POST /mcp with Initialize request, tool listing via connected client returns all 20 tools, active workflow notification on client connect (NFR-007)
- [X] T049 Implement server entrypoint in src/server.ts: create Kysely connection, run migrations on startup, run orphan purge on startup, createMcpExpressApp(), add /health GET endpoint, session-based MCP transport (POST/GET/DELETE /mcp) with sessionIdGenerator, per-session McpServer with all 20 tools registered, on-connect notification if active workflows exist, listen on PORT (default 3001) bound to 127.0.0.1, graceful shutdown (close DB, clear retention interval) — per plan Phase D and research.md Section 2
- [X] T050 [P] Create Dockerfile with multi-stage build (node:24-alpine builder + runtime, npm ci, tsc, non-root user, HEALTHCHECK, VOLUME /data) in MCP/workflow-state-service/Dockerfile — per spec Section 8.2
- [X] T051 [P] Create compose.yaml with wss-data volume, port 127.0.0.1:3001:3001, healthcheck, restart unless-stopped, environment variables in MCP/workflow-state-service/compose.yaml — per spec Section 8.3

**Checkpoint**: `docker compose up --build` starts cleanly. `curl http://127.0.0.1:3001/health` returns 200. MCP client can connect and list all 20 tools.

---

## Phase 6: Testing + Polish (Phase E — Edge Cases, Documentation)

**Purpose**: Comprehensive edge case testing and developer documentation. All edge case tests can run in parallel.

### Edge Case Tests

- [X] T052 [P] Write edge case tests for concurrent workflow isolation (two workflows created, mutations on one don't affect the other, list returns both) in test/edge-cases/concurrency.test.ts
- [X] T053 [P] Write edge case tests for gate rejection scenarios (missing must-pass evidence, failed evidence gateResult, should-pass warning but allowed) in test/edge-cases/gate-rejection.test.ts
- [X] T054 [P] Write edge case tests for back-edge transitions (review→implement re-entry clears completedAt/summary, preserves metadata, fresh evidence required for re-exit) in test/edge-cases/back-edge.test.ts
- [X] T055 [P] Write edge case tests for halt/resume cycles (halt blocks phase, mutations rejected while halted, resume restores in-progress, multiple halt/resume cycles) in test/edge-cases/halt-resume.test.ts
- [X] T056 [P] Write edge case tests for retention and close (close-workflow returns complete export before purge, orphan TTL purge deletes stale workflows, cascade deletes all child rows) in test/edge-cases/retention.test.ts
- [X] T057 [P] Write edge case tests for validation edge cases (invalid phase config at creation, _close pseudo-phase handling, _close not in phases array, context upsert create+update, get-context with no results) in test/edge-cases/validation-edge.test.ts
- [X] T058 [P] Write edge case tests for helper edge cases (allocate-task-id minimum 100 rule with empty/populated task lists, check-caps cycle counting from transition-rejected and review→implement events, get-briefing after storing context entries in all 3 categories) in test/edge-cases/helpers.test.ts
- [X] T058a [P] Write edge case test for corrupt/missing database startup behavior (NFR-004): server starts cleanly with missing DB file (auto-creates), server logs error and offers reset path with corrupt DB file, in test/edge-cases/corrupt-db.test.ts

### Documentation

- [X] T059 Create developer guide for prompt authors in MCP/workflow-state-service/docs/developer-guide.md: tool catalog with input/output summaries, evidence category reference, phase config authoring guide, recovery protocol (list-active → get-briefing), subagent integration patterns, recommended tool sets, Docker operations (start, stop, reset, logs, test)
- [X] T060 Run quickstart.md validation: docker compose up --build, verify health endpoint, verify tool listing via MCP Inspector or client, create a test workflow, submit evidence, transition phase, close workflow — per quickstart.md

**Checkpoint**: `node --test test/**/*.test.ts` passes (all unit, integration, and edge case tests). All spec Section 12.1 MVP success criteria satisfied.

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup ──────────────────────────────► no dependencies
    │
    ▼
Phase 2: Foundation (A) ────────────────────► depends on Phase 1
    │
    ▼
Phase 3: Services (B) ──────────────────────► depends on Phase 2 (all schemas + DB)
    │
    ▼
Phase 4: Tools (C) ─────────────────────────► depends on Phase 3 (all services)
    │
    ▼
Phase 5: Server + Docker (D) ───────────────► depends on Phase 4 (all tools)
    │
    ▼
Phase 6: Testing + Polish (E) ──────────────► depends on Phase 5 (running server)
```

### Within-Phase Dependencies

**Phase 2 (Foundation)**:
- T005–T010 (types + schemas): All independent, can run in parallel [P]
- T011 (db/schema.ts): Depends on T005 (types)
- T012 (db/connection.ts): Depends on T011
- T013 (migration): Depends on T011, T012
- T014–T015 (fixtures): Independent, can run in parallel [P], depend on T005–T010
- T016–T018 (schema tests): Depend on T006–T009
- T019 (db test): Depends on T012, T013

**Phase 3 (Services)**:
- T020–T021 (workflow): First — no service dependencies, only depends on Phase 2
- T022–T023 (evidence): Can start after Phase 2 (independent of workflow service for submission logic) [P with workflow]
- T024–T025 (transition): Depends on T021 (workflow) and T023 (evidence) — transition calls both
- T026–T027 (context): Can start after Phase 2 (independent of other services) [P with workflow/evidence]
- T028–T029 (export): Depends on T021 (workflow), T023 (evidence), T027 (context) — reads all data
- T030–T031 (retention): Can start after T021 (workflow) [P with evidence/context]

**Phase 4 (Tools)**:
- All tool groups depend on their corresponding service from Phase 3
- Tool groups are independent of each other — can run in parallel [P] within tool test/impl pairs

**Phase 5 (Server + Docker)**:
- T048–T049 (server): Depends on all Phase 4 tools
- T050–T051 (Docker): Can run in parallel with server tests [P]

**Phase 6 (Polish)**:
- T052–T058 (edge case tests): All independent, can run in parallel [P], depend on Phase 5
- T059 (docs): Can start after Phase 4
- T060 (quickstart validation): Depends on T050, T051 (Docker running)

### Parallel Opportunities

**Phase 2 — 6 schemas in parallel**:
```
T005 src/types.ts ──────┐
T006 schemas/phase-config.ts ──┤
T007 schemas/progress-state.ts ┤── all [P]
T008 schemas/evidence.ts ──────┤
T009 schemas/events.ts ────────┤
T010 schemas/context.ts ───────┘
```

**Phase 3 — 3 independent service streams**:
```
Stream A: T020→T021 (workflow)  ──┐
Stream B: T022→T023 (evidence) ──┼── [P] between streams
Stream C: T026→T027 (context)  ──┘
                                  │
Then: T024→T025 (transition) ─────┘ (needs workflow + evidence)
Then: T028→T029 (export) ────────── (needs workflow + evidence + context)
      T030→T031 (retention) ──────── [P] with export
```

**Phase 4 — all 8 tool groups in parallel**:
```
T032→T033 (lifecycle)     ──┐
T034→T035 (transitions)   ──┤
T036→T037 (state-mutation) ─┤
T038→T039 (events)        ──┤── all [P] between groups
T040→T041 (evidence)      ──┤
T042→T043 (context)       ──┤
T044→T045 (validation)   ──┤
T046→T047 (subagent)     ──┘
```

**Phase 6 — all edge case tests in parallel**:
```
T052–T058: all [P]
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1: Setup → project scaffolds
2. Complete Phase 2: Foundation → schemas compile, migration runs
3. Complete Phase 3: Services → all business logic tested
4. Complete Phase 4: Tools → all 20 MCP tools registered and tested
5. Complete Phase 5: Server + Docker → service runs in container
6. **STOP and VALIDATE**: All 20 tools functional via MCP client
7. Complete Phase 6: Edge cases + docs → production-ready

### Incremental Delivery

Each phase produces a testable increment:
- After Phase 2: Schema validation and database layer verified independently
- After Phase 3: All business logic verified with in-memory SQLite
- After Phase 4: All 20 tools verified via programmatic invocation
- After Phase 5: Full server running in Docker, accessible via HTTP
- After Phase 6: All edge cases covered, documentation complete

---

## Notes

- All file paths are relative to `MCP/workflow-state-service/`
- Use `import * as z from 'zod/v4'` (not `from 'zod'`)
- Use `crypto.randomUUID()` instead of `uuid` package (Node.js 24 built-in)
- Use `node --test` with `--experimental-strip-types` for TypeScript test files
- Tests use in-memory SQLite (`:memory:`) for isolation — no Docker needed for test execution
- Tool tests create McpServer instances programmatically — no HTTP transport needed
- Refer to spec.md for detailed tool signatures, error codes, and behavior specifications
- Refer to research.md for SDK patterns and API usage examples
- Refer to data-model.md for complete table definitions and cascade behavior
