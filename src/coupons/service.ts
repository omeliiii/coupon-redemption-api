import { listAvailableCoupons, insertCoupon, type ListCouponsParams } from './repository.js';
import { getValidCampaignOrThrow, createCampaign, CampaignExpiredError, type CreateCampaignInput } from '../campaigns/service.js';
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
  const result = await listAvailableCoupons(params);

  const data = result.items.map((row) => ({
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

  return {
    data,
    meta: {
      ...result.meta,
      page: params.page,
      pageSize: params.pageSize,
    },
  };
}

/**
 * Create a coupon, optionally creating a new campaign.
 * - If campaignId is provided: validate the existing campaign, create only the coupon.
 * - If campaign data is provided: create the campaign first, then the coupon.
 */
export async function createCouponWithCampaign(input: CreateCouponWithCampaignInput) {
  let campaign;

  if ('campaignId' in input && input.campaignId !== undefined) {
    campaign = await getValidCampaignOrThrow(input.campaignId);
  } else if ('campaign' in input && input.campaign !== undefined) {
    campaign = await createCampaign(input.campaign);
  } else {
    throw new Error('Either campaignId or campaign data must be provided');
  }

  // You can't create a coupon for an expired campaign
  if (campaign.end_timestamp && new Date(campaign.end_timestamp) <= new Date()) {
    throw new CampaignExpiredError(campaign.id);
  }

  const coupon = await insertCoupon({
    code: input.coupon.code,
    status: input.coupon.status,
    expiration_timestamp: input.coupon.expirationTimestamp ?? null,
    max_redemptions: input.coupon.maxRedemptions ?? null,
    campaign_id: campaign.id,
  });

  return coupon;
}

