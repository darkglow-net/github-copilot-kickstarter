import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Kysely } from 'kysely';
import type { Database } from '../../src/db/schema.ts';
import { createInMemoryDatabase } from '../../src/db/connection.ts';
import { runMigrations } from '../../src/db/migrator.ts';
import { registerLifecycleTools } from '../../src/tools/lifecycle.ts';
import { registerTransitionTools } from '../../src/tools/transitions.ts';
import { registerStateMutationTools } from '../../src/tools/state-mutation.ts';
import { registerEventTools } from '../../src/tools/events.ts';
import { registerEvidenceTools } from '../../src/tools/evidence.ts';
import { registerContextTools } from '../../src/tools/context.ts';
import { registerValidationTools } from '../../src/tools/validation.ts';
import { registerSubagentTools } from '../../src/tools/subagent.ts';

export interface TestHarness {
  db: Kysely<Database>;
  client: Client;
  server: McpServer;
  cleanup: () => Promise<void>;
}

export async function createTestHarness(): Promise<TestHarness> {
  const db = createInMemoryDatabase();
  await runMigrations(db);

  const server = new McpServer({ name: 'wss-test', version: '1.0.0' });

  registerLifecycleTools(server, db);
  registerTransitionTools(server, db);
  registerStateMutationTools(server, db);
  registerEventTools(server, db);
  registerEvidenceTools(server, db);
  registerContextTools(server, db);
  registerValidationTools(server, db);
  registerSubagentTools(server, db);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(clientTransport);

  return {
    db,
    client,
    server,
    cleanup: async () => {
      await client.close();
      await server.close();
      await db.destroy();
    },
  };
}
