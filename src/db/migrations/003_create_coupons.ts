import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // enum for coupon status
  await db.schema
    .createType('coupon_status')
    .asEnum(['available', 'not_available'])
    .execute();

  await db.schema
    .createTable('coupons')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('code', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('status', sql`coupon_status`, (col) => col.notNull())
    .addColumn('expiration_timestamp', 'timestamptz')
    .addColumn('max_redemptions', 'integer')
    .addColumn('redemptions_count', 'integer', (col) =>
      col.notNull().defaultTo(0)
    )
    .addColumn('campaign_id', 'uuid', (col) =>
      col.notNull().references('campaigns.id').onDelete('restrict')
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`NOW()`)
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`NOW()`)
    )
    .execute();

  // Index on campaign_id foreign key
  await db.schema
    .createIndex('idx_coupons_campaign_id')
    .on('coupons')
    .column('campaign_id')
    .execute();

  await sql`
    CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON coupons
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('coupons').execute();
  await db.schema.dropType('coupon_status').execute();
}
