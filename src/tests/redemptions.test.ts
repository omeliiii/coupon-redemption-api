import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { createTestDb, migrateTestDb, cleanTestDb } from './setup.js';
import { seedRegularUser, seedCampaign, seedCoupon } from './helpers.js';
import { db } from '../db/database.js';

describe('Redemption API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const testDb = createTestDb();

  beforeAll(async () => {
    await migrateTestDb(testDb);
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    await testDb.destroy();
    await db.destroy();
  });

  beforeEach(async () => {
    await cleanTestDb(testDb);
  });

  it('should redeem a coupon successfully (happy path)', async () => {
    const user = await seedRegularUser(testDb);
    const campaign = await seedCampaign(testDb);
    const coupon = await seedCoupon(testDb, campaign.id, { code: 'HAPPY20' });

    const response = await app.inject({
      method: 'POST',
      url: '/coupons/HAPPY20/redeem',
      headers: {
        'x-user-id': user.id,
      },
    });

    // Verify redemption

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data).toHaveProperty('id');
    expect(body.data.user_id).toBe(user.id);
    expect(body.data.coupon_id).toBe(coupon.id);

    // Verify counters

    const updatedCoupon = await testDb
      .selectFrom('coupons')
      .select('redemptions_count')
      .where('id', '=', coupon.id)
      .executeTakeFirstOrThrow();

    const updatedCampaign = await testDb
      .selectFrom('campaigns')
      .select('redemptions_count')
      .where('id', '=', campaign.id)
      .executeTakeFirstOrThrow();

    expect(updatedCoupon.redemptions_count).toBe(coupon.redemptions_count + 1);
  });

  it('should return 409 if a user tries to redeem the same coupon twice', async () => {
    const user = await seedRegularUser(testDb);
    const campaign = await seedCampaign(testDb);
    const coupon = await seedCoupon(testDb, campaign.id, { code: 'EEHVOLEVI' });

    // First redemption should succeed
    const firstResponse = await app.inject({
      method: 'POST',
      url: '/coupons/EEHVOLEVI/redeem',
      headers: {
        'x-user-id': user.id,
      },
    });

    expect(firstResponse.statusCode, `First redemption failed with: ${firstResponse.body}`).toBe(201);

    // Second redemption should return 409
    const secondResponse = await app.inject({
      method: 'POST',
      url: '/coupons/EEHVOLEVI/redeem',
      headers: {
        'x-user-id': user.id,
      },
    });

    expect(secondResponse.statusCode).toBe(409);
    expect(secondResponse.json().error).toBe('AlreadyRedeemedError');
  });

  it('should return 409 if the coupon is expired', async () => {
    const user = await seedRegularUser(testDb);
    const campaign = await seedCampaign(testDb);

    // Create an expired coupon (yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const coupon = await seedCoupon(testDb, campaign.id, {
      code: 'TOOLATE',
      expirationTimestamp: yesterday,
    });

    const response = await app.inject({
      method: 'POST',
      url: `/coupons/${coupon.code}/redeem`,
      headers: {
        'x-user-id': user.id,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe('CouponExpiredError');
  });

  it('should return 409 if the campaign is expired', async () => {
    const user = await seedRegularUser(testDb);

    // Create an expired campaign (yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const campaign = await seedCampaign(testDb, {
      endTimestamp: yesterday,
    });
    const coupon = await seedCoupon(testDb, campaign.id, { code: 'MAYBENEXTTIME' });

    const response = await app.inject({
      method: 'POST',
      url: `/coupons/${coupon.code}/redeem`,
      headers: {
        'x-user-id': user.id,
      },
    });

  });

  it('should return 409 if the coupon max redemptions limit is reached', async () => {
    const user1 = await seedRegularUser(testDb, 'user1@test.com');
    const user2 = await seedRegularUser(testDb, 'user2@test.com');
    const campaign = await seedCampaign(testDb);
    const coupon = await seedCoupon(testDb, campaign.id, {
      code: 'ONLYONE',
      maxRedemptions: 1
    });

    // User 1 redeems successfully
    const response1 = await app.inject({
      method: 'POST',
      url: `/coupons/${coupon.code}/redeem`,
      headers: { 'x-user-id': user1.id },
    });
    expect(response1.statusCode).toBe(201);

    // User 2 can't redeem
    const response2 = await app.inject({
      method: 'POST',
      url: `/coupons/${coupon.code}/redeem`,
      headers: { 'x-user-id': user2.id },
    });
    expect(response2.statusCode).toBe(409);
    expect(response2.json().error).toBe('CouponRedemptionLimitReachedError');
  });

  it('should return 409 if the campaign max redemptions limit is reached', async () => {
    const user1 = await seedRegularUser(testDb, 'user1@test.com');
    const user2 = await seedRegularUser(testDb, 'user2@test.com');
    const campaign = await seedCampaign(testDb, { maxRedemptions: 1 });

    const coupon1 = await seedCoupon(testDb, campaign.id, { code: 'FIRST' });
    const coupon2 = await seedCoupon(testDb, campaign.id, { code: 'SECOND' });

    // User 1 redeems coupon 1 successfully
    const response1 = await app.inject({
      method: 'POST',
      url: `/coupons/${coupon1.code}/redeem`,
      headers: { 'x-user-id': user1.id },
    });
    expect(response1.statusCode).toBe(201);

    // User 2 can't redeem
    const response2 = await app.inject({
      method: 'POST',
      url: `/coupons/${coupon2.code}/redeem`,
      headers: { 'x-user-id': user2.id },
    });

    expect(response2.statusCode).toBe(409);
    expect(response2.json().error).toBe('CampaignRedemptionLimitReachedError');
  });

  it('should handle concurrent redemptions safely preventing race conditions', async () => {
    // Coupon with max 1 redemptions
    // We try to redeem it concurrently 20 times with 20 different users
    // Only 1 should succeed, exactly 19 should fail, and the counter should be exactly 1
    const limit = 1;
    const concurrentRequests = 20;

    const campaign = await seedCampaign(testDb);
    const coupon = await seedCoupon(testDb, campaign.id, {
      code: 'CONCURRENCY_TEST',
      maxRedemptions: limit,
    });

    // Create 20 different users
    const users = await Promise.all(
      Array.from({ length: concurrentRequests }).map((_, i) =>
        seedRegularUser(testDb, `concurrent_user_${i}@test.com`)
      )
    );

    // Fire all requests concurrently
    const responses = await Promise.all(
      users.map((user) =>
        app.inject({
          method: 'POST',
          url: `/coupons/${coupon.code}/redeem`,
          headers: { 'x-user-id': user.id },
        })
      )
    );

    const successfulResponses = responses.filter((r) => r.statusCode === 201);
    const conflictResponses = responses.filter((r) => r.statusCode === 409);

    // Exactly 1 should succeed, 19 should fail
    expect(successfulResponses.length).toBe(limit);
    expect(conflictResponses.length).toBe(concurrentRequests - limit);

    // Verify redemptions count
    const updatedCoupon = await testDb
      .selectFrom('coupons')
      .select('redemptions_count')
      .where('id', '=', coupon.id)
      .executeTakeFirstOrThrow();

    expect(updatedCoupon.redemptions_count).toBe(limit);
  });

  it('should return 409 if the campaign has not started yet', async () => {
    const user = await seedRegularUser(testDb, 'user_not_started@test.com');

    // Create a campaign starting tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const campaign = await seedCampaign(testDb, {
      startTimestamp: tomorrow,
    });
    const coupon = await seedCoupon(testDb, campaign.id, { code: 'NOT_STARTED_CAMP' });

    const response = await app.inject({
      method: 'POST',
      url: `/coupons/${coupon.code}/redeem`,
      headers: { 'x-user-id': user.id },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe('CampaignNotStartedError');
  });

  it('should return 409 if the coupon status is not_available', async () => {
    const user = await seedRegularUser(testDb, 'user_coupon_na@test.com');
    const campaign = await seedCampaign(testDb);
    const coupon = await seedCoupon(testDb, campaign.id, {
      code: 'NA_COUPON',
      status: 'not_available',
    });

    const response = await app.inject({
      method: 'POST',
      url: `/coupons/${coupon.code}/redeem`,
      headers: { 'x-user-id': user.id },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe('CouponNotAvailableError');
  });

  it('should return 409 if the campaign status is not_available', async () => {
    const user = await seedRegularUser(testDb, 'user_camp_na@test.com');
    const campaign = await seedCampaign(testDb, { status: 'not_available' });
    const coupon = await seedCoupon(testDb, campaign.id, { code: 'NA_CAMPAIGN' });

    const response = await app.inject({
      method: 'POST',
      url: `/coupons/${coupon.code}/redeem`,
      headers: { 'x-user-id': user.id },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe('CampaignNotAvailableError');
  });
});
