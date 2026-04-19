import { listAvailableCoupons, insertCoupon, type ListCouponsParams } from './repository.js';
import { getValidCampaignOrThrow, createCampaign, type CreateCampaignInput } from '../campaigns/service.js';
import type { CouponStatus } from '../db/types.js';

export interface CreateCouponInput {
  code: string;
  status: CouponStatus;
  expirationTimestamp?: string | null;
  maxRedemptions?: number | null;
}

export type CreateCouponWithCampaignInput =
  | { coupon: CreateCouponInput; campaignId: string; campaign?: never }
  | { coupon: CreateCouponInput; campaignId?: never; campaign: CreateCampaignInput };

export async function getAvailableCoupons(params: ListCouponsParams) {
  const coupons = await listAvailableCoupons(params);

  return coupons.map((row) => ({
    id: row.id,
    code: row.code,
    status: row.couponStatus,
    expirationTimestamp: row.expirationTimestamp,
    maxRedemptions: row.couponMaxRedemptions,
    redemptionsCount: row.couponRedemptionsCount,
    createdAt: row.couponCreatedAt,
    campaign: {
      id: row.campaignId,
      name: row.campaignName,
      description: row.campaignDescription,
      status: row.campaignStatus,
      startTimestamp: row.campaignStartTimestamp,
      endTimestamp: row.campaignEndTimestamp,
      maxRedemptions: row.campaignMaxRedemptions,
      redemptionsCount: row.campaignRedemptionsCount,
    },
  }));
}

/**
 * Create a coupon, optionally creating a new campaign.
 * - If campaignId is provided: validate the existing campaign, create only the coupon.
 * - If campaign data is provided: create the campaign first, then the coupon.
 */
export async function createCouponWithCampaign(input: CreateCouponWithCampaignInput) {
  let campaignId: string;

  if ('campaignId' in input && input.campaignId !== undefined) {
    const campaign = await getValidCampaignOrThrow(input.campaignId);
    campaignId = campaign.id;
  } else if ('campaign' in input && input.campaign !== undefined) {
    const campaign = await createCampaign(input.campaign);
    campaignId = campaign.id;
  } else {
    throw new Error('Either campaignId or campaign data must be provided');
  }

  const coupon = await insertCoupon({
    code: input.coupon.code,
    status: input.coupon.status,
    expiration_timestamp: input.coupon.expirationTimestamp ?? null,
    max_redemptions: input.coupon.maxRedemptions ?? null,
    campaign_id: campaignId,
  });

  return coupon;
}

