import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('workflows')
    .addColumn('workflow_id', 'text', (col) => col.primaryKey())
    .addColumn('feature_name', 'text', (col) => col.notNull())
    .addColumn('branch_name', 'text')
    .addColumn('spec_dir', 'text')
    .addColumn('phase_config_json', 'text', (col) => col.notNull())
    .addColumn('created_at', 'text', (col) => col.notNull())
    .addColumn('updated_at', 'text', (col) => col.notNull())
    .addColumn('closed_at', 'text')
    .execute();

  await db.schema
    .createIndex('idx_workflows_updated')
    .on('workflows')
    .column('updated_at')
    .execute();

  await db.schema
    .createTable('workflow_state')
    .addColumn('workflow_id', 'text', (col) =>
      col.primaryKey().references('workflows.workflow_id').onDelete('cascade'),
    )
    .addColumn('progress_state_json', 'text', (col) => col.notNull())
    .addColumn('current_phase_key', 'text')
    .addColumn('state_version', 'integer', (col) => col.notNull().defaultTo(1))
    .execute();

  await db.schema
    .createTable('workflow_events')
    .addColumn('event_id', 'text', (col) => col.primaryKey())
    .addColumn('workflow_id', 'text', (col) =>
      col.notNull().references('workflows.workflow_id').onDelete('cascade'),
    )
    .addColumn('seq', 'integer', (col) => col.notNull())
    .addColumn('timestamp', 'text', (col) => col.notNull())
    .addColumn('actor_kind', 'text', (col) => col.notNull())
    .addColumn('actor_name', 'text', (col) => col.notNull())
    .addColumn('actor_run_id', 'text')
    .addColumn('phase_key', 'text')
    .addColumn('event_type', 'text', (col) => col.notNull())
    .addColumn('payload_json', 'text', (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex('idx_events_workflow_seq')
    .on('workflow_events')
    .columns(['workflow_id', 'seq'])
    .execute();

  await db.schema
    .createIndex('idx_events_workflow_type')
    .on('workflow_events')
    .columns(['workflow_id', 'event_type'])
    .execute();

  await db.schema
    .createTable('workflow_evidence')
    .addColumn('evidence_id', 'text', (col) => col.primaryKey())
    .addColumn('workflow_id', 'text', (col) =>
      col.notNull().references('workflows.workflow_id').onDelete('cascade'),
    )
    .addColumn('phase_key', 'text', (col) => col.notNull())
    .addColumn('category', 'text', (col) => col.notNull())
    .addColumn('data_json', 'text', (col) => col.notNull())
    .addColumn('gate_result', 'text', (col) => col.notNull())
    .addColumn('submitted_by', 'text', (col) => col.notNull())
    .addColumn('submitted_at', 'text', (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex('idx_evidence_workflow_phase_cat')
    .on('workflow_evidence')
    .columns(['workflow_id', 'phase_key', 'category'])
    .execute();

  await db.schema
    .createIndex('idx_evidence_workflow')
    .on('workflow_evidence')
    .column('workflow_id')
    .execute();

  await db.schema
    .createTable('workflow_context')
    .addColumn('workflow_id', 'text', (col) =>
      col.notNull().references('workflows.workflow_id').onDelete('cascade'),
    )
    .addColumn('category', 'text', (col) => col.notNull())
    .addColumn('key', 'text', (col) => col.notNull())
    .addColumn('value', 'text', (col) => col.notNull())
    .addColumn('authored_by', 'text', (col) => col.notNull())
    .addColumn('created_at', 'text', (col) => col.notNull())
    .addColumn('updated_at', 'text', (col) => col.notNull())
    .execute();

  // Composite primary key via raw SQL (Kysely createTable doesn't support composite PKs directly)
  await sql`CREATE UNIQUE INDEX idx_context_pk ON workflow_context(workflow_id, category, key)`.execute(db);

  await db.schema
    .createIndex('idx_context_workflow_cat')
    .on('workflow_context')
    .columns(['workflow_id', 'category'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('workflow_context').ifExists().execute();
  await db.schema.dropTable('workflow_evidence').ifExists().execute();
  await db.schema.dropTable('workflow_events').ifExists().execute();
  await db.schema.dropTable('workflow_state').ifExists().execute();
  await db.schema.dropTable('workflows').ifExists().execute();
}
