import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { createTestDb, migrateTestDb, cleanTestDb } from './setup.js';
import { seedAdminUser, seedCampaign, seedCoupon } from './helpers.js';
import { db } from '../db/database.js';

describe('Coupons API', () => {
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

  describe('GET /coupons', () => {
    it('should paginate results correctly', async () => {
      const admin = await seedAdminUser(testDb);
      const campaign = await seedCampaign(testDb);

      // 15 coupons
      for (let i = 0; i < 15; i++) {
        await seedCoupon(testDb, campaign.id, { code: `PAGINATION_TEST_${i}` });
      }

      // Page 1 with size 10
      const resPage1 = await app.inject({
        method: 'GET',
        url: '/coupons?page=1&pageSize=10',
        headers: { 'x-user-id': admin.id },
      });

      expect(resPage1.statusCode).toBe(200);
      const body1 = resPage1.json();
      expect(body1.data.length).toBe(10);
      expect(body1.meta.page).toBe(1);
      expect(body1.meta.pageSize).toBe(10);

      // Page 2 with size 10
      const resPage2 = await app.inject({
        method: 'GET',
        url: '/coupons?page=2&pageSize=10',
        headers: { 'x-user-id': admin.id },
      });

      expect(resPage2.statusCode).toBe(200);
      const body2 = resPage2.json();
      expect(body2.data.length).toBe(5);
      expect(body2.meta.page).toBe(2);
    });

    it('should include coupons with a future startTimestamp', async () => {
      const admin = await seedAdminUser(testDb);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const campaign = await seedCampaign(testDb, { startTimestamp: tomorrow });
      const coupon = await seedCoupon(testDb, campaign.id, { code: 'NEXTWEEK' });

      const res = await app.inject({
        method: 'GET',
        url: '/coupons',
        headers: { 'x-user-id': admin.id },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      const returnedCodes = body.data.map((c: any) => c.code);
      expect(returnedCodes).toContain(coupon.code);
    });

    it('should exclude coupons and campaigns with not_available status', async () => {
      const admin = await seedAdminUser(testDb);

      // Campaign available, coupon not available
      const campaign1 = await seedCampaign(testDb, { status: 'available' });
      const coupon1 = await seedCoupon(testDb, campaign1.id, { code: 'NOTAVAILABLE', status: 'not_available' });

      // Campaign not available, coupon available
      const campaign2 = await seedCampaign(testDb, { status: 'not_available' });
      const coupon2 = await seedCoupon(testDb, campaign2.id, { code: 'AVAILABLE1', status: 'available' });

      // Campaign available, coupon available (should be returned)
      const campaign3 = await seedCampaign(testDb, { status: 'available' });
      const coupon3 = await seedCoupon(testDb, campaign3.id, { code: 'AVAILABLE2', status: 'available' });

      const res = await app.inject({
        method: 'GET',
        url: '/coupons',
        headers: { 'x-user-id': admin.id },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      const returnedCodes = body.data.map((c: any) => c.code);

      expect(returnedCodes).not.toContain(coupon1.code);
      expect(returnedCodes).not.toContain(coupon2.code);
      expect(returnedCodes).toContain(coupon3.code);
    });
  });

  describe('POST /coupons', () => {
    it('should create a coupon for an existing campaign', async () => {
      const admin = await seedAdminUser(testDb);
      const campaign = await seedCampaign(testDb);

      const res = await app.inject({
        method: 'POST',
        url: '/coupons',
        headers: { 'x-user-id': admin.id },
        payload: {
          coupon: {
            code: 'HAPPY_PATH_EXISTING',
            status: 'available',
          },
          campaignId: campaign.id,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.data.code).toBe('HAPPY_PATH_EXISTING');
      expect(body.data.campaign_id).toBe(campaign.id);
    });

    it('should create a coupon with an inline campaign', async () => {
      const admin = await seedAdminUser(testDb);

      const res = await app.inject({
        method: 'POST',
        url: '/coupons',
        headers: { 'x-user-id': admin.id },
        payload: {
          coupon: {
            code: 'HAPPY_PATH_INLINE',
            status: 'available',
          },
          campaign: {
            name: 'Inline Campaign',
            status: 'available',
            startTimestamp: new Date().toISOString(),
          },
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.data.code).toBe('HAPPY_PATH_INLINE');
      expect(body.data.campaign_id).toBeDefined();

      // Verify the campaign was actually created in the database
      const createdCampaign = await testDb
        .selectFrom('campaigns')
        .where('id', '=', body.data.campaign_id)
        .selectAll()
        .executeTakeFirst();

      expect(createdCampaign).toBeDefined();
      expect(createdCampaign!.name).toBe('Inline Campaign');
    });

    it('should fail if the existing campaign is expired', async () => {
      const admin = await seedAdminUser(testDb);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const campaign = await seedCampaign(testDb, { endTimestamp: yesterday });

      const res = await app.inject({
        method: 'POST',
        url: '/coupons',
        headers: { 'x-user-id': admin.id },
        payload: {
          coupon: {
            code: 'NEW_COUPON_ON_EXPIRED_CAMP',
            status: 'available',
          },
          campaignId: campaign.id,
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error).toBe('CampaignExpiredError');
    });
  });
});
