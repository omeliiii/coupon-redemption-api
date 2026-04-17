import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import { config } from '../config.js';
import type { Database } from './types.js';

const dialect = new PostgresDialect({
  pool: new pg.Pool({
    connectionString: config.database.url,
  }),
});

export const db = new Kysely<Database>({
  dialect,
});
