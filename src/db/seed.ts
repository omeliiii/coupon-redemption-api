import { db } from './database.js';

async function seed() {
  console.log('Seeding development database...');

  try {
    console.log('Cleaning existing records...');
    await db.deleteFrom('redemptions').execute();
    await db.deleteFrom('coupons').execute();
    await db.deleteFrom('campaigns').execute();
    await db.deleteFrom('users').execute();

    // 2. Create Users
    console.log('Creating users...');
    const admin = await db
      .insertInto('users')
      .values({ email: 'admin@o2b.com', role: 'admin' })
      .returningAll()
      .executeTakeFirstOrThrow();

    const user1 = await db
      .insertInto('users')
      .values({ email: 'user1@o2b.com', role: 'user' })
      .returningAll()
      .executeTakeFirstOrThrow();

    const user2 = await db
      .insertInto('users')
      .values({ email: 'user2@o2b.com', role: 'user' })
      .returningAll()
      .executeTakeFirstOrThrow();

    // 3. Create Campaigns
    console.log('Creating campaigns...');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Campaign A: Infinite usage, No end (AVAILABLE)
    const campaignA = await db
      .insertInto('campaigns')
      .values({
        name: 'Summer Sale 2026',
        description: 'Global summer discount campaign (No end, No max redemptions)',
        status: 'available',
        start_timestamp: new Date('2026-01-01'),
        max_redemptions: null,
        end_timestamp: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Campaign B: Limited usage, With end (AVAILABLE)
    const campaignB = await db
      .insertInto('campaigns')
      .values({
        name: 'Limited Flash Sale',
        description: 'Only 10 redemptions allowed total (With end, With max redemptions)',
        status: 'available',
        start_timestamp: new Date(),
        max_redemptions: 10,
        end_timestamp: tomorrow,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Campaign C: Expired (AVAILABLE status, but passed end_timestamp)
    const campaignC = await db
      .insertInto('campaigns')
      .values({
        name: 'Expired Winter Sale',
        status: 'available',
        start_timestamp: new Date('2025-01-01'),
        end_timestamp: yesterday,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Campaign D: Not Available
    const campaignD = await db
      .insertInto('campaigns')
      .values({
        name: 'Maintenance Campaign',
        status: 'not_available',
        start_timestamp: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // 4. Create Coupons
    console.log('Creating coupons...');

    // Coupons for Campaign A (AVAILABLE Campaign)
    await db.insertInto('coupons').values([
      // No end, No max redemptions
      { code: 'SUMMER_10', campaign_id: campaignA.id, status: 'available', expiration_timestamp: null, max_redemptions: null },
      { code: 'SUMMER_20', campaign_id: campaignA.id, status: 'available' },
      // Coupon NOT AVAILABLE in AVAILABLE campaign
      { code: 'SUMMER_HIDDEN', campaign_id: campaignA.id, status: 'not_available' },
      // Coupon EXPIRED in AVAILABLE campaign
      { code: 'SUMMER_EXPIRED', campaign_id: campaignA.id, status: 'available', expiration_timestamp: yesterday },
    ]).execute();

    // Coupons for Campaign B (AVAILABLE Campaign with limits)
    await db.insertInto('coupons').values([
      // Coupon with max redemptions
      { code: 'FLASH_50', campaign_id: campaignB.id, status: 'available', max_redemptions: 2 },
      // Coupon WITHOUT max redemptions (but campaign has limits)
      { code: 'FLASH_20', campaign_id: campaignB.id, status: 'available', max_redemptions: null },
      // Coupon WITH end
      { code: 'FLASH_END', campaign_id: campaignB.id, status: 'available', expiration_timestamp: tomorrow },
    ]).execute();

    // Coupons for Campaign C (EXPIRED Campaign)
    await db.insertInto('coupons').values([
      // Coupon NOT EXPIRED in EXPIRED campaign
      { code: 'WINTER_50', campaign_id: campaignC.id, status: 'available', expiration_timestamp: tomorrow },
    ]).execute();

    // Coupons for Campaign D (NOT AVAILABLE Campaign)
    await db.insertInto('coupons').values([
      // Coupon AVAILABLE in NOT AVAILABLE campaign
      { code: 'D_AVAILABLE', campaign_id: campaignD.id, status: 'available' },
    ]).execute();

    console.log('Seed completed successfully!');
    console.log('----------------------------------------------------');
    console.log(`Admin User ID: ${admin.id}`);
    console.log(`Test User 1 ID: ${user1.id}`);
    console.log(`Test User 2 ID: ${user2.id}`);
    console.log('----------------------------------------------------');
    console.log('Covered Scenarios:');
    console.log('- coupon scaduto / campaign attiva: SUMMER_EXPIRED');
    console.log('- coupon attivo / campaign scaduta: WINTER_50');
    console.log('- coupon non disp. / campaign disp.: SUMMER_HIDDEN');
    console.log('- coupon disp. / campaign non disp.: D_AVAILABLE');
    console.log('- campaign senza end: Summer Sale 2026');
    console.log('- coupon senza end: SUMMER_10');
    console.log('- campaign con end: Limited Flash Sale / Expired Winter Sale');
    console.log('- coupon con end: FLASH_END / SUMMER_EXPIRED');
    console.log('- campaign con max redemptions: Limited Flash Sale');
    console.log('- campaign senza max redemptions: Summer Sale 2026');
    console.log('- coupon con max redemptions: FLASH_50');
    console.log('- coupon senza max redemptions: FLASH_20 / SUMMER_10');

  } catch (err) {
    console.error('Seeding failed', err);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}


seed();
