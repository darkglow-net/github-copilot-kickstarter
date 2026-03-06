# Quickstart: Workflow State Service

**Feature**: Workflow State Service
**Date**: 2026-03-06

---

## Prerequisites

- Docker Desktop installed and running
- VS Code with MCP support
- Git (for branch management)

No local Node.js installation required — all development happens inside Docker.

---

## 1. Start the Service

```bash
cd MCP/workflow-state-service
docker compose up --build -d
```

The service starts on `http://127.0.0.1:3001/mcp`. Verify:

```bash
curl http://127.0.0.1:3001/health
# → {"status":"ok","database":"connected"}
```

## 2. Configure VS Code

Add to `.vscode/mcp.json`:

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

Reload VS Code. The service tools appear as `mcp_workflow-state-service_*`.

## 3. Basic Usage Flow

### Create a workflow

```
Tool: create-workflow
Input: {
  "featureName": "Add Authentication",
  "branchName": "feat/add-auth",
  "phaseConfig": {
    "phases": [
      { "key": "research", "label": "Research", "ordinal": 1 },
      { "key": "implement", "label": "Implement", "ordinal": 2 },
      { "key": "review", "label": "Review", "ordinal": 3 }
    ],
    "transitions": [
      { "from": "research", "to": "implement", "gateRules": [] },
      { "from": "implement", "to": "review", "gateRules": [
        { "evidenceCategory": "test-results", "condition": "must-pass", "description": "Tests pass" }
      ]},
      { "from": "review", "to": "_close", "gateRules": [] }
    ]
  }
}
```

### Submit evidence and transition

```
Tool: submit-evidence
Input: { "workflowId": "<id>", "phaseKey": "implement", "category": "test-results",
         "data": { "passed": 10, "failed": 0, "total": 10 }, "submittedBy": "coordinator" }

Tool: transition-phase
Input: { "workflowId": "<id>", "from": "implement", "to": "review",
         "summary": "All tasks done", "actorKind": "coordinator" }
```

### Recovery after compaction

```
Tool: list-active
Input: { "branchName": "feat/add-auth" }

Tool: get-briefing
Input: { "workflowId": "<id>" }
```

## 4. Development Workflow

### Run tests (inside Docker)

```bash
docker compose exec workflow-state-service node --test test/**/*.test.ts
```

### View logs

```bash
docker compose logs -f workflow-state-service
```

### Reset database

```bash
docker compose down -v   # removes the data volume
docker compose up -d     # fresh start
```

### Stop the service

```bash
docker compose down
```

## 5. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP listen port |
| `LOG_LEVEL` | `info` | Log level: `error`, `warn`, `info`, `debug` |
| `DB_PATH` | `/data/workflow-state.db` | SQLite database path |
| `ORPHAN_TTL_DAYS` | `7` | Days before orphaned workflows are purged |

## 6. Project Structure

```
MCP/workflow-state-service/
├── package.json
├── tsconfig.json
├── Dockerfile
├── compose.yaml
├── .env.example
├── src/
│   ├── server.ts              # MCP server setup + transport + health endpoint
│   ├── tools/                 # Tool registrations (one file per group)
│   │   ├── lifecycle.ts       # create, list, get, export, close
│   │   ├── transitions.ts     # transition-phase
│   │   ├── state-mutation.ts  # update-state, halt, resume
│   │   ├── events.ts          # append-event, get-events
│   │   ├── evidence.ts        # submit-evidence, get-evidence
│   │   ├── context.ts         # store-context, get-context, get-briefing
│   │   ├── validation.ts      # validate-state, check-caps, allocate-task-id
│   │   └── subagent.ts        # report-done
│   ├── db/
│   │   ├── schema.ts          # Kysely interface definitions
│   │   ├── connection.ts      # Database connection + WAL + foreign keys
│   │   └── migrations/
│   │       └── 001-initial.ts # All 5 tables + indexes
│   ├── schemas/               # Zod v4 schemas
│   │   ├── phase-config.ts
│   │   ├── progress-state.ts
│   │   ├── events.ts
│   │   ├── evidence.ts
│   │   └── context.ts
│   ├── services/              # Business logic
│   │   ├── workflow.ts
│   │   ├── transition.ts
│   │   ├── evidence.ts
│   │   ├── retention.ts
│   │   └── export.ts
│   └── types.ts               # Shared TypeScript types
└── test/
    ├── tools/
    ├── services/
    └── fixtures/
```
