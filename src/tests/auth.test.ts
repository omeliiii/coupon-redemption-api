import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { createTestDb, migrateTestDb, cleanTestDb } from './setup.js';
import { seedAdminUser, seedRegularUser, seedCampaign } from './helpers.js';
import { db } from '../db/database.js';

describe('Admin Authentication', () => {
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

  const endpoints = [
    { method: 'GET' as const, url: '/coupons' },
    {
      method: 'POST' as const,
      url: '/coupons',
      payload: {
        coupon: { code: 'AUTH_TEST', status: 'available' },
        campaign: { name: 'Auth Test', status: 'available', startTimestamp: new Date().toISOString() },
      },
    },
    {
      method: 'POST' as const,
      url: '/users',
      payload: { email: 'new_user@test.com' },
    },
  ];

  for (const endpoint of endpoints) {
    describe(`${endpoint.method} ${endpoint.url}`, () => {
      it('should return 401 if x-user-id header is missing', async () => {
        const res = await app.inject({
          method: endpoint.method,
          url: endpoint.url,
          payload: endpoint.payload,
        });

        expect(res.statusCode).toBe(401);
        expect(res.json().message).toBe('Missing x-user-id header');
      });

      it('should return 401 if user does not exist', async () => {
        const dummyUuid = '00000000-0000-0000-0000-000000000000';
        const res = await app.inject({
          method: endpoint.method,
          url: endpoint.url,
          headers: { 'x-user-id': dummyUuid },
          payload: endpoint.payload,
        });

        expect(res.statusCode).toBe(401);
        expect(res.json().message).toBe('User not found');
      });

      it('should return 403 if user is not admin', async () => {
        const regularUser = await seedRegularUser(testDb);
        const res = await app.inject({
          method: endpoint.method,
          url: endpoint.url,
          headers: { 'x-user-id': regularUser.id },
          payload: endpoint.payload,
        });

        expect(res.statusCode).toBe(403);
        expect(res.json().message).toBe('Admin access required');
      });

      it('should pass auth if user is admin', async () => {
        const admin = await seedAdminUser(testDb);
        const res = await app.inject({
          method: endpoint.method,
          url: endpoint.url,
          headers: { 'x-user-id': admin.id },
          payload: endpoint.payload,
        });

        expect(res.statusCode).not.toBe(401);
        expect(res.statusCode).not.toBe(403);
      });
    });
  }
});
