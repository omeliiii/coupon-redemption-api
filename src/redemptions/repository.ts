import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { db } from '../db/database.js';
import type { DB } from '../db/generated.js';

/**
 * Lock the coupon row and its campaign row with SELECT FOR UPDATE.
 * Returns both in a single query to minimize round trips.
 */
export async function findCouponWithCampaignForUpdate(
  trx: Kysely<DB>,
  code: string,
) {
  return trx
    .selectFrom('coupons')
    .innerJoin('campaigns', 'campaigns.id', 'coupons.campaign_id')
    .select([
      'coupons.id as couponId',
      'coupons.code',
      'coupons.status as couponStatus',
      'coupons.expiration_timestamp as couponExpirationTimestamp',
      'coupons.max_redemptions as couponMaxRedemptions',
      'coupons.redemptions_count as couponRedemptionsCount',
      'campaigns.id as campaignId',
      'campaigns.status as campaignStatus',
      'campaigns.start_timestamp as campaignStartTimestamp',
      'campaigns.end_timestamp as campaignEndTimestamp',
      'campaigns.max_redemptions as campaignMaxRedemptions',
      'campaigns.redemptions_count as campaignRedemptionsCount',
    ])
    .where('coupons.code', '=', code)
    .forUpdate()
    .executeTakeFirst();
}

export async function findExistingRedemption(
  trx: Kysely<DB>,
  userId: string,
  couponId: string,
) {
  return trx
    .selectFrom('redemptions')
    .select('id')
    .where('user_id', '=', userId)
    .where('coupon_id', '=', couponId)
    .executeTakeFirst();
}

export async function insertRedemption(
  trx: Kysely<DB>,
  userId: string,
  couponId: string,
) {
  return trx
    .insertInto('redemptions')
    .values({
      user_id: userId,
      coupon_id: couponId,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function incrementCouponRedemptionsCount(
  trx: Kysely<DB>,
  couponId: string,
) {
  await trx
    .updateTable('coupons')
    .set({
      redemptions_count: sql`redemptions_count + 1`,
    })
    .where('id', '=', couponId)
    .execute();
}

export async function incrementCampaignRedemptionsCount(
  trx: Kysely<DB>,
  campaignId: string,
) {
  await trx
    .updateTable('campaigns')
    .set({
      redemptions_count: sql`redemptions_count + 1`,
    })
    .where('id', '=', campaignId)
    .execute();
}

export { db };
