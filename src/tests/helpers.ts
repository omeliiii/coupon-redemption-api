import type { Kysely } from 'kysely';
import type { DB } from '../db/generated.js';

export async function seedAdminUser(db: Kysely<DB>) {
  const user = await db
    .insertInto('users')
    .values({ email: 'admin@test.com', role: 'admin' })
    .returningAll()
    .executeTakeFirstOrThrow();
  return user;
}

export async function seedRegularUser(db: Kysely<DB>, email: string = 'user@test.com') {
  const user = await db
    .insertInto('users')
    .values({ email, role: 'user' })
    .returningAll()
    .executeTakeFirstOrThrow();
  return user;
}

export async function seedCampaign(
  db: Kysely<DB>,
  overrides: Partial<{
    name: string;
    status: 'available' | 'not_available';
    startTimestamp: Date;
    endTimestamp: Date | null;
    maxRedemptions: number | null;
  }> = {},
) {
  const campaign = await db
    .insertInto('campaigns')
    .values({
      name: overrides.name ?? 'Test Campaign',
      status: overrides.status ?? 'available',
      start_timestamp: overrides.startTimestamp ?? new Date('2024-01-01'),
      end_timestamp: overrides.endTimestamp ?? null,
      max_redemptions: overrides.maxRedemptions ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return campaign;
}

export async function seedCoupon(
  db: Kysely<DB>,
  campaignId: string,
  overrides: Partial<{
    code: string;
    status: 'available' | 'not_available';
    expirationTimestamp: Date | null;
    maxRedemptions: number | null;
  }> = {},
) {
  const coupon = await db
    .insertInto('coupons')
    .values({
      code: overrides.code ?? 'TEST-CODE',
      status: overrides.status ?? 'available',
      expiration_timestamp: overrides.expirationTimestamp ?? null,
      max_redemptions: overrides.maxRedemptions ?? null,
      campaign_id: campaignId,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return coupon;
}
