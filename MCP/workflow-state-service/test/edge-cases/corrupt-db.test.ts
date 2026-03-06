import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryDatabase } from '../../src/db/connection.ts';
import { runMigrations } from '../../src/db/migrator.ts';

describe('corrupt/missing database startup behavior', () => {
  it('creates database successfully from scratch (simulates missing DB file)', async () => {
    // In-memory DB simulates auto-creation of a missing file
    const db = createInMemoryDatabase();
    await runMigrations(db);

    // Verify tables exist by running a query
    const result = await db
      .selectFrom('workflows')
      .selectAll()
      .execute();

    assert.ok(Array.isArray(result));
    assert.equal(result.length, 0);

    await db.destroy();
  });

  it('migrations are idempotent (can run twice without error)', async () => {
    const db = createInMemoryDatabase();
    await runMigrations(db);
    await runMigrations(db);

    const result = await db
      .selectFrom('workflows')
      .selectAll()
      .execute();

    assert.ok(Array.isArray(result));
    await db.destroy();
  });
});
