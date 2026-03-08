# Research: Workflow State Service

**Feature**: Workflow State Service
**Date**: 2026-03-06
**Status**: Complete — all unknowns resolved

---

## 1. MCP SDK v2 Package Structure

**Decision**: Use `@modelcontextprotocol/server`, `@modelcontextprotocol/express`, `@modelcontextprotocol/node`

**Rationale**: MCP SDK v2 reorganized into separate packages. The prior monolithic `@modelcontextprotocol/sdk` path is deprecated. The confirmed import structure:

```typescript
import { McpServer, isInitializeRequest } from '@modelcontextprotocol/server';
import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import * as z from 'zod/v4';
```

**Alternatives considered**:
- `@modelcontextprotocol/sdk` (v1 monolith) — deprecated, doesn't support `registerTool()` API
- `@modelcontextprotocol/node` standalone — requires manual Host header validation, body parsing; more boilerplate

---

## 2. Express Middleware (`createMcpExpressApp`)

**Decision**: Use `createMcpExpressApp()` which provides an Express app pre-configured with DNS rebinding protection, CORS headers, and JSON body parsing.

**Rationale**: Official SDK middleware eliminates boilerplate HTTP setup. Supports both stateless (one transport per request) and stateful (session-based) modes. The service needs stateful mode to support active workflow notifications on client connect.

**Setup pattern**:
```typescript
const app = createMcpExpressApp();
const transports: Record<string, NodeStreamableHTTPServerTransport> = {};

// Session-based: create server + transport per session
app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (sessionId && transports[sessionId]) {
    await transports[sessionId].handleRequest(req, res, req.body);
    return;
  }
  if (!sessionId && isInitializeRequest(req.body)) {
    const transport = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => { transports[sid] = transport; }
    });
    const server = createServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }
});
```

**Key detail**: Each session gets its own `McpServer` instance connected to a `NodeStreamableHTTPServerTransport`. The `/health` endpoint is added directly to the Express app outside MCP routing.

---

## 3. `registerTool()` API

**Decision**: Use `server.registerTool(name, metadata, handler)` with Zod v4 schemas for `inputSchema` and `outputSchema`.

**Rationale**: `registerTool()` is the recommended v2 API. It accepts Zod schemas directly (no JSON Schema conversion needed). Supports `title`, `description`, tool annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`), and structured output.

**Pattern**:
```typescript
server.registerTool('create-workflow', {
  title: 'Create Workflow',
  description: 'Creates a new workflow with caller-provided phase configuration',
  inputSchema: z.object({ featureName: z.string(), phaseConfig: PhaseConfigSchema }),
  outputSchema: z.object({ workflowId: z.string(), state: ProgressStateSchema }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
}, async (input, ctx) => {
  // implementation
  return { content: [{ type: 'text', text: '...' }], structuredContent: { ... } };
});
```

---

## 4. Zod v4 Import Path

**Decision**: Use `import * as z from 'zod/v4'`

**Rationale**: MCP SDK v2 internally depends on Zod v4. The `zod/v4` subpath import is the standard for Zod 4.x. Installing `zod@4` and importing from `zod/v4` ensures compatibility with the SDK's schema expectations. Zod v4 drops `z.infer<>` in favor of `z.output<>` and `z.input<>`, and uses `z.object()` with `.strict()` by default.

**Alternatives considered**:
- `zod@3` — incompatible with MCP SDK v2's internal Zod v4 usage; schema types won't align

---

## 5. Kysely with SQLite (better-sqlite3)

**Decision**: Use `Kysely<Database>` with `SqliteDialect` backed by `better-sqlite3`

**Rationale**: Kysely provides type-safe SQL query building with compile-time column validation. The `SqliteDialect` wraps `better-sqlite3` (synchronous driver). Migrations use `Migrator` with a programmatic provider.

**Setup pattern**:
```typescript
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';

const dialect = new SqliteDialect({
  database: new Database(dbPath)
});

const db = new Kysely<DatabaseSchema>({ dialect });
```

**Migration approach**: Use Kysely's `Migrator` with a programmatic migration provider (not `FileMigrationProvider` — avoids Node.js `fs` path issues in Docker). Each migration exports `up` and `down` functions.

```typescript
import { Kysely, Migration } from 'kysely';

export const migration001: Migration = {
  async up(db: Kysely<any>) {
    await db.schema.createTable('workflows')
      .addColumn('workflow_id', 'text', (col) => col.primaryKey())
      // ...
      .execute();
  },
  async down(db: Kysely<any>) {
    await db.schema.dropTable('workflows').execute();
  }
};
```

**WAL mode**: Set immediately after connection via `PRAGMA journal_mode=WAL`. Also set `PRAGMA foreign_keys=ON` (SQLite default is OFF).

---

## 6. better-sqlite3 Synchronous API

**Decision**: Use better-sqlite3 12.6.2 with Node.js 24 prebuilds

**Rationale**: better-sqlite3 is synchronous, meaning Kysely's async API wraps synchronous calls. Queries complete in < 1ms for small datasets. The synchronous nature simplifies transaction handling — no need for async transaction coordination. Node.js 24 Alpine prebuilds are available, so no native compilation needed in Docker.

**Key detail**: better-sqlite3 uses `node-addon-api` for native bindings. The Docker multi-stage build copies `node_modules` (including native bindings) from the builder stage.

---

## 7. Docker Build Strategy

**Decision**: Multi-stage build with `node:24-alpine`

**Rationale**: Alpine minimizes image size. Multi-stage separates build dependencies (TypeScript compiler) from runtime. better-sqlite3 prebuilds for Alpine/musl are available via `npm ci`.

**Build concerns**:
- better-sqlite3 needs native bindings compiled for the target architecture. Using `npm ci` in the builder stage with `node:24-alpine` automatically downloads the correct prebuilt binary.
- If prebuilds are unavailable (rare), fallback requires `python3`, `make`, `g++` in the builder stage.
- TypeScript is compiled to JavaScript in the builder stage; only `dist/` and `node_modules/` are copied to runtime.

---

## 8. Node.js 24 Built-in Test Runner

**Decision**: Use `node --test` with TypeScript via `--experimental-strip-types`

**Rationale**: Node.js 24 has stable built-in test runner. With `--experimental-strip-types` (or the stable type-stripping in Node 24), TypeScript files can be run directly without a separate compile step for tests.

**Test pattern**:
```typescript
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

describe('create-workflow', () => {
  it('should create a workflow with valid phase config', async () => {
    // arrange, act, assert
  });
});
```

**Test execution**: `node --test test/**/*.test.ts`

---

## 9. UUID Generation

**Decision**: Use Node.js built-in `crypto.randomUUID()`

**Rationale**: Node.js 24 has native `crypto.randomUUID()`. The spec lists `uuid` as a runtime dependency, but the built-in is preferred to avoid an extra dependency. If the `uuid` package is needed for specific v4 format guarantees, it can be added, but `crypto.randomUUID()` produces RFC 4122 v4 UUIDs.

**Update from spec**: The `uuid` package in Section 13 can be replaced with `import { randomUUID } from 'node:crypto'`. This removes one runtime dependency.

---

## 10. Structured Logging

**Decision**: Use `console.log(JSON.stringify({ level, message, ... }))` for structured JSON logging

**Rationale**: No external logging library needed. Node.js 24 supports structured console output. The MCP SDK provides `ctx.mcpReq.log()` for protocol-level logging. Application logging uses a simple JSON formatter writing to stdout, which Docker captures.

**Log levels**: `error`, `warn`, `info`, `debug` — controlled by `LOG_LEVEL` environment variable.

---

## 11. Health Endpoint

**Decision**: Add `/health` route to the Express app outside MCP routing

**Rationale**: Docker HEALTHCHECK requires an HTTP endpoint. The `/health` route checks database connectivity by executing `SELECT 1` and returns `{ status: "ok", database: "connected" }` or `{ status: "error", database: "disconnected" }`.

```typescript
app.get('/health', (req, res) => {
  try {
    db.raw('SELECT 1').execute(); // Kysely raw query
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});
```

---

## 12. Orphan TTL Purge Strategy

**Decision**: Run purge on startup + `setInterval` every 24 hours

**Rationale**: Simple interval-based approach. On server start, scan for workflows where `updated_at < NOW() - ORPHAN_TTL_DAYS`. Log a warning for each purged workflow. Repeat every 24 hours via `setInterval`. No cron library needed.

**Implementation note**: The purge deletes from `workflows` table; `ON DELETE CASCADE` removes all related rows. The purge operation is wrapped in a transaction.
