import { findCampaignById, insertCampaign } from './repository.js';
import type { CampaignStatus } from '../db/types.js';

export interface CreateCampaignInput {
  name: string;
  description?: string | null;
  status: CampaignStatus;
  startTimestamp: string;
  endTimestamp?: string | null;
  maxRedemptions?: number | null;
}

/**
 * Find an existing campaign by ID.
 * Validates that it's not expired (endTimestamp is null or in the future).
 * Returns the campaign or throws if not found / expired.
 */
export async function getValidCampaignOrThrow(campaignId: string) {
  const campaign = await findCampaignById(campaignId);

  if (!campaign) {
    throw new CampaignNotFoundError(campaignId);
  }

  if (campaign.end_timestamp && new Date(campaign.end_timestamp) <= new Date()) {
    throw new CampaignExpiredError(campaignId);
  }

  return campaign;
}

/**
 * Create a new campaign from the provided input.
 */
export async function createCampaign(input: CreateCampaignInput) {
  return insertCampaign({
    name: input.name,
    description: input.description ?? null,
    status: input.status,
    start_timestamp: input.startTimestamp,
    end_timestamp: input.endTimestamp ?? null,
    max_redemptions: input.maxRedemptions ?? null,
  });
}

export class CampaignNotFoundError extends Error {
  constructor(campaignId: string) {
    super(`Campaign not found: ${campaignId}`);
    this.name = 'CampaignNotFoundError';
  }
}

export class CampaignExpiredError extends Error {
  constructor(campaignId: string) {
    super(`Campaign is expired: ${campaignId}`);
    this.name = 'CampaignExpiredError';
  }
}
