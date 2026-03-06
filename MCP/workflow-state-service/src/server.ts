import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createDatabase } from './db/connection.ts';
import { runMigrations } from './db/migrator.ts';
import { startRetentionSchedule } from './services/retention.ts';
import { registerLifecycleTools } from './tools/lifecycle.ts';
import { registerTransitionTools } from './tools/transitions.ts';
import { registerStateMutationTools } from './tools/state-mutation.ts';
import { registerEventTools } from './tools/events.ts';
import { registerEvidenceTools } from './tools/evidence.ts';
import { registerContextTools } from './tools/context.ts';
import { registerValidationTools } from './tools/validation.ts';
import { registerSubagentTools } from './tools/subagent.ts';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const DB_PATH = process.env.DB_PATH ?? '/data/workflow-state.db';
const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';
const ORPHAN_TTL_DAYS = parseInt(process.env.ORPHAN_TTL_DAYS ?? '7', 10);

function log(level: string, message: string, data?: Record<string, unknown>): void {
  const levels = ['error', 'warn', 'info', 'debug'];
  if (levels.indexOf(level) > levels.indexOf(LOG_LEVEL)) return;
  const entry = { timestamp: new Date().toISOString(), level, message, ...data };
  process.stdout.write(JSON.stringify(entry) + '\n');
}

async function main(): Promise<void> {
  log('info', 'Starting Workflow State Service', { port: PORT, dbPath: DB_PATH });

  const db = createDatabase(DB_PATH);
  await runMigrations(db);
  log('info', 'Database migrations complete');

  const retentionHandle = startRetentionSchedule(db, ORPHAN_TTL_DAYS);
  log('info', 'Retention schedule started', { ttlDays: ORPHAN_TTL_DAYS });

  function createMcpServer(): McpServer {
    const server = new McpServer({
      name: 'workflow-state-service',
      version: '0.1.0',
    });

    registerLifecycleTools(server, db);
    registerTransitionTools(server, db);
    registerStateMutationTools(server, db);
    registerEventTools(server, db);
    registerEvidenceTools(server, db);
    registerContextTools(server, db);
    registerValidationTools(server, db);
    registerSubagentTools(server, db);

    return server;
  }

  const app = express();
  app.use(express.json());

  // Health endpoint (used by Docker HEALTHCHECK)
  app.get('/health', async (_req, res) => {
    try {
      const result = await db.selectFrom('workflows').select(db.fn.count('workflow_id').as('count')).executeTakeFirst();
      res.json({ status: 'ok', workflows: Number(result?.count ?? 0) });
    } catch {
      res.status(503).json({ status: 'error', message: 'Database unavailable' });
    }
  });

  // Session-tracked transports
  const transports = new Map<string, StreamableHTTPServerTransport>();

  // Streamable HTTP MCP endpoint
  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res, req.body);
      return;
    }

    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) transports.delete(sid);
    };

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

    if (transport.sessionId) {
      transports.set(transport.sessionId, transport);
    }
  });

  // GET for SSE stream (Streamable HTTP spec)
  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res);
      return;
    }
    res.status(400).json({ error: 'No active session. Send an initialize request first.' });
  });

  // DELETE for session termination
  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res);
      transports.delete(sessionId);
      return;
    }
    res.status(400).json({ error: 'No active session found.' });
  });

  const server = app.listen(PORT, '127.0.0.1', () => {
    log('info', `MCP server listening on http://127.0.0.1:${PORT}`);
  });

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    log('info', 'Shutting down...');
    retentionHandle.stop();
    for (const transport of transports.values()) {
      transport.close();
    }
    transports.clear();
    server.close();
    await db.destroy();
    log('info', 'Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  log('error', 'Fatal startup error', { error: String(err) });
  process.exit(1);
});
