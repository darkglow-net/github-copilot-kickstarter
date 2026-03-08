import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import type { Database as DatabaseSchema } from './schema.ts';

export function createDatabase(dbPath: string): Kysely<DatabaseSchema> {
  const sqliteDb = new Database(dbPath);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('foreign_keys = ON');

  const dialect = new SqliteDialect({ database: sqliteDb });
  return new Kysely<DatabaseSchema>({ dialect });
}

export function createInMemoryDatabase(): Kysely<DatabaseSchema> {
  const sqliteDb = new Database(':memory:');
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('foreign_keys = ON');

  const dialect = new SqliteDialect({ database: sqliteDb });
  return new Kysely<DatabaseSchema>({ dialect });
}
