import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // trigger function for auto-updating updated_at field
  await sql`
    CREATE OR REPLACE FUNCTION trigger_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  // enum for user roles
  await db.schema
    .createType('user_role')
    .asEnum(['user', 'admin'])
    .execute();

  await db.schema
    .createTable('users')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('email', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('role', sql`user_role`, (col) =>
      col.notNull().defaultTo('user')
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`NOW()`)
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`NOW()`)
    )
    .execute();

  await sql`
    CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('users').execute();
  await db.schema.dropType('user_role').execute();
  await sql`DROP FUNCTION IF EXISTS trigger_set_updated_at() CASCADE`.execute(db);
}
