import { Kysely, PostgresDialect, FileMigrationProvider, Migrator } from 'kysely';
import pg from 'pg';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { DB } from '../db/generated.js';

const TEST_DATABASE_URL = process.env.DATABASE_URL
  ?? 'postgres://coupon_user:coupon_pass@localhost:5432/coupon_db_test';

export function createTestDb() {
  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({
        connectionString: TEST_DATABASE_URL,
      }),
    }),
  });
}

export async function migrateTestDb(db: Kysely<DB>) {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, '../db/migrations'),
    }),
  });

  const { error } = await migrator.migrateToLatest();
  if (error) {
    throw new Error(`Test migration failed: ${error}`);
  }
}

export async function cleanTestDb(db: Kysely<DB>) {
  await db.deleteFrom('redemptions').execute();
  await db.deleteFrom('coupons').execute();
  await db.deleteFrom('campaigns').execute();
  await db.deleteFrom('users').execute();
}
