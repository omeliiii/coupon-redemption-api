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
});
