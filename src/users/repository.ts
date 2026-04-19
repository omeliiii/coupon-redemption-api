import { db } from '../db/database.js';
import type { Insertable } from 'kysely';
import type { Users } from '../db/generated.js';

export async function findUserById(id: string) {
  return db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
}

export async function insertUser(data: Insertable<Users>) {
  return db
    .insertInto('users')
    .values(data)
    .returningAll()
    .executeTakeFirstOrThrow();
}
