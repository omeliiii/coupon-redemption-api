import { sql } from 'kysely';
import { db } from '../db/database.js';
import type { Insertable } from 'kysely';
import type { Campaigns } from '../db/generated.js';

export async function findCampaignById(id: string) {
  return db
    .selectFrom('campaigns')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
}

export async function insertCampaign(data: Insertable<Campaigns>) {
  return db
    .insertInto('campaigns')
    .values(data)
    .returningAll()
    .executeTakeFirstOrThrow();
}
