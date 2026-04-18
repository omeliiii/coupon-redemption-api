import { listAvailableCoupons, type ListCouponsParams } from './repository.js';

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
