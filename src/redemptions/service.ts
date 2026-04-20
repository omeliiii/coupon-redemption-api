import {
  db,
  findCouponWithCampaignForUpdate,
  findExistingRedemption,
  insertRedemption,
  incrementCouponRedemptionsCount,
  incrementCampaignRedemptionsCount,
} from './repository.js';

export interface RedeemCouponInput {
  userId: string;
  code: string;
}

/**
 * Redeem a coupon in a concurrency-safe way.
 * (SELECT FOR UPDATE and UNIQUE(user_id, coupon_id) constraint
 */
export async function redeemCoupon({ userId, code }: RedeemCouponInput) {
  return db.transaction().execute(async (trx) => {
    // Lock coupon and campaign rows
    const row = await findCouponWithCampaignForUpdate(trx, code);

    if (!row) {
      throw new CouponNotFoundError(code);
    }

    // Validate coupon status
    if (row.couponStatus !== 'available') {
      throw new CouponNotAvailableError(code);
    }

    // Validate coupon expiration
    if (row.couponExpirationTimestamp && new Date(row.couponExpirationTimestamp) <= new Date()) {
      throw new CouponExpiredError(code);
    }

    // Validate campaign status
    if (row.campaignStatus !== 'available') {
      throw new CampaignNotAvailableError(row.campaignId);
    }

    // Validate campaign start
    if (row.campaignStartTimestamp && new Date(row.campaignStartTimestamp) > new Date()) {
      throw new CampaignNotStartedError(row.campaignId);
    }

    // Validate campaign expiration
    if (row.campaignEndTimestamp && new Date(row.campaignEndTimestamp) <= new Date()) {
      throw new CampaignExpiredForRedemptionError(row.campaignId);
    }

    // Check double redemption
    const existingRedemption = await findExistingRedemption(trx, userId, row.couponId);
    if (existingRedemption) {
      throw new AlreadyRedeemedError(userId, code);
    }

    // Check coupon redemption limit
    if (row.couponMaxRedemptions !== null && row.couponRedemptionsCount >= row.couponMaxRedemptions) {
      throw new CouponRedemptionLimitReachedError(code);
    }

    // Check campaign redemption limit
    if (row.campaignMaxRedemptions !== null && row.campaignRedemptionsCount >= row.campaignMaxRedemptions) {
      throw new CampaignRedemptionLimitReachedError(row.campaignId);
    }

    // Create redemption record
    const redemption = await insertRedemption(trx, userId, row.couponId);

    // Update counters
    await incrementCouponRedemptionsCount(trx, row.couponId);
    await incrementCampaignRedemptionsCount(trx, row.campaignId);

    return redemption;
  });
}

export class CouponNotFoundError extends Error {
  constructor(code: string) {
    super(`Coupon not found: ${code}`);
    this.name = 'CouponNotFoundError';
  }
}

export class CouponNotAvailableError extends Error {
  constructor(code: string) {
    super(`Coupon is not available: ${code}`);
    this.name = 'CouponNotAvailableError';
  }
}

export class CouponExpiredError extends Error {
  constructor(code: string) {
    super(`Coupon is expired: ${code}`);
    this.name = 'CouponExpiredError';
  }
}

export class CampaignNotAvailableError extends Error {
  constructor(campaignId: string) {
    super(`Campaign is not available: ${campaignId}`);
    this.name = 'CampaignNotAvailableError';
  }
}

export class CampaignExpiredForRedemptionError extends Error {
  constructor(campaignId: string) {
    super(`Campaign is expired: ${campaignId}`);
    this.name = 'CampaignExpiredForRedemptionError';
  }
}

export class AlreadyRedeemedError extends Error {
  constructor(userId: string, code: string) {
    super(`User ${userId} already redeemed coupon ${code}`);
    this.name = 'AlreadyRedeemedError';
  }
}

export class CouponRedemptionLimitReachedError extends Error {
  constructor(code: string) {
    super(`Coupon redemption limit reached: ${code}`);
    this.name = 'CouponRedemptionLimitReachedError';
  }
}

export class CampaignRedemptionLimitReachedError extends Error {
  constructor(campaignId: string) {
    super(`Campaign redemption limit reached: ${campaignId}`);
    this.name = 'CampaignRedemptionLimitReachedError';
  }
}

export class CampaignNotStartedError extends Error {
  constructor(campaignId: string) {
    super(`Campaign has not started yet: ${campaignId}`);
    this.name = 'CampaignNotStartedError';
  }
}
