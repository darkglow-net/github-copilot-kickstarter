import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.ts';

export async function purgeOrphans(
  db: Kysely<Database>,
  ttlDays: number,
): Promise<{ purgedCount: number; purgedIds: string[] }> {
  const cutoff = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000).toISOString();

  const staleRows = await db
    .selectFrom('workflows')
    .select('workflow_id')
    .where('updated_at', '<', cutoff)
    .where('closed_at', 'is', null)
    .execute();

  const purgedIds = staleRows.map((r) => r.workflow_id);

  if (purgedIds.length > 0) {
    await db
      .deleteFrom('workflows')
      .where('workflow_id', 'in', purgedIds)
      .execute();
  }

  return { purgedCount: purgedIds.length, purgedIds };
}

export function startRetentionSchedule(
  db: Kysely<Database>,
  ttlDays: number,
  intervalMs: number = 24 * 60 * 60 * 1000,
): { stop: () => void } {
  // Run immediately on startup
  purgeOrphans(db, ttlDays).catch(() => {});

  const timer = setInterval(() => {
    purgeOrphans(db, ttlDays).catch(() => {});
  }, intervalMs);

  return {
    stop: () => clearInterval(timer),
  };
}
