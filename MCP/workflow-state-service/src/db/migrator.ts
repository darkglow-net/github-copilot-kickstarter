import { Migrator, type Kysely, type Migration, type MigrationProvider } from 'kysely';
import * as migration001 from './migrations/001-initial.ts';
import type { Database } from './schema.ts';

const migrations: Record<string, Migration> = {
  '001-initial': migration001,
};

class ProgrammaticMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return migrations;
  }
}

export async function runMigrations(db: Kysely<Database>): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: new ProgrammaticMigrationProvider(),
  });

  const { error, results } = await migrator.migrateToLatest();

  if (results) {
    for (const result of results) {
      if (result.status === 'Success') {
        console.log(`Migration "${result.migrationName}" applied successfully`);
      } else if (result.status === 'Error') {
        console.error(`Migration "${result.migrationName}" failed`);
      }
    }
  }

  if (error) {
    throw error;
  }
}
