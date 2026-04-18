import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import { config } from '../config.js';
import type { DB } from './generated.js';

const dialect = new PostgresDialect({
  pool: new pg.Pool({
    connectionString: config.database.url,
  }),
});

export const db = new Kysely<DB>({
  dialect,
});
