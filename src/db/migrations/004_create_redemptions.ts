import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('redemptions')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('restrict')
    )
    .addColumn('coupon_id', 'uuid', (col) =>
      col.notNull().references('coupons.id').onDelete('restrict')
    )
    .addColumn('redeemed_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`NOW()`)
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`NOW()`)
    )
    .addUniqueConstraint('uq_redemptions_user_coupon', [
      'user_id',
      'coupon_id',
    ])
    .execute();

  // Index on user_id foreign key
  await db.schema
    .createIndex('idx_redemptions_user_id')
    .on('redemptions')
    .column('user_id')
    .execute();

  // Index on coupon_id foreign key
  await db.schema
    .createIndex('idx_redemptions_coupon_id')
    .on('redemptions')
    .column('coupon_id')
    .execute();

  await sql`
    CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON redemptions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('redemptions').execute();
}
