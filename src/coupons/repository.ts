import { sql } from 'kysely';
import { db } from '../db/database.js';

export interface ListCouponsParams {
  page: number;
  pageSize: number;
}

export async function listAvailableCoupons({ page, pageSize }: ListCouponsParams) {
  const now = sql<Date>`NOW()`;
  const offset = (page - 1) * pageSize;

  const coupons = await db
    .selectFrom('coupons')
    .innerJoin('campaigns', 'campaigns.id', 'coupons.campaign_id')
    .select([
      'coupons.id',
      'coupons.code',
      'coupons.status as couponStatus',
      'coupons.expiration_timestamp as expirationTimestamp',
      'coupons.max_redemptions as couponMaxRedemptions',
      'coupons.redemptions_count as couponRedemptionsCount',
      'coupons.created_at as couponCreatedAt',
      'campaigns.id as campaignId',
      'campaigns.name as campaignName',
      'campaigns.description as campaignDescription',
      'campaigns.status as campaignStatus',
      'campaigns.start_timestamp as campaignStartTimestamp',
      'campaigns.end_timestamp as campaignEndTimestamp',
      'campaigns.max_redemptions as campaignMaxRedemptions',
      'campaigns.redemptions_count as campaignRedemptionsCount',
    ])
    // Campaign filters
    .where('campaigns.status', '=', 'available')
    .where((eb) =>
      eb.or([
        eb('campaigns.end_timestamp', 'is', null),
        eb('campaigns.end_timestamp', '>', now),
      ])
    )
    // Coupon filters
    .where('coupons.status', '=', 'available')
    .where((eb) =>
      eb.or([
        eb('coupons.expiration_timestamp', 'is', null),
        eb('coupons.expiration_timestamp', '>', now),
      ])
    )
    .orderBy('campaigns.start_timestamp', 'asc')
    .orderBy('coupons.code', 'asc')
    .limit(pageSize)
    .offset(offset)
    .execute();

  return coupons;
}
