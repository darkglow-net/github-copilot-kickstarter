import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.ts';

function nowISO(): string {
  return new Date().toISOString();
}

export async function internalAppendEvent(
  db: Kysely<Database>,
  workflowId: string,
  params: {
    eventType: string;
    actorKind: string;
    actorName: string;
    actorRunId?: string;
    phaseKey?: string;
    payload: Record<string, unknown>;
  },
): Promise<{ eventId: string; seq: number }> {
  const eventId = crypto.randomUUID();

  return db.transaction().execute(async (trx) => {
    const maxSeqRow = await trx
      .selectFrom('workflow_events')
      .select(trx.fn.max('seq').as('max_seq'))
      .where('workflow_id', '=', workflowId)
      .executeTakeFirst();

    const seq = ((maxSeqRow?.max_seq as number | null) ?? 0) + 1;

    await trx.insertInto('workflow_events').values({
      event_id: eventId,
      workflow_id: workflowId,
      seq,
      timestamp: nowISO(),
      actor_kind: params.actorKind,
      actor_name: params.actorName,
      actor_run_id: params.actorRunId ?? null,
      phase_key: params.phaseKey ?? null,
      event_type: params.eventType,
      payload_json: JSON.stringify(params.payload),
    }).execute();

    return { eventId, seq };
  });
}
