import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // enum for campaign status
  await db.schema
    .createType('campaign_status')
    .asEnum(['available', 'not_available'])
    .execute();

  await db.schema
    .createTable('campaigns')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('status', sql`campaign_status`, (col) => col.notNull())
    .addColumn('start_timestamp', 'timestamptz', (col) => col.notNull())
    .addColumn('end_timestamp', 'timestamptz')
    .addColumn('max_redemptions', 'integer')
    .addColumn('redemptions_count', 'integer', (col) =>
      col.notNull().defaultTo(0)
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`NOW()`)
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`NOW()`)
    )
    .execute();

  // Index on campaign start_timestamp for ordering
  await db.schema
    .createIndex('idx_campaigns_start_timestamp')
    .on('campaigns')
    .columns(['start_timestamp'])
    .execute();

  await sql`
    CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('campaigns').execute();
  await db.schema.dropType('campaign_status').execute();
}
