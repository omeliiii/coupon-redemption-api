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

    // Campaign A: Infinite usage
    const campaignA = await db
      .insertInto('campaigns')
      .values({
        name: 'Summer Sale 2026',
        description: 'Global summer discount campaign',
        status: 'available',
        start_timestamp: new Date('2026-01-01'), // already started
        max_redemptions: null, // infinite
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Campaign B: Limited usage (max 10)
    const campaignB = await db
      .insertInto('campaigns')
      .values({
        name: 'Limited Flash Sale',
        description: 'Only 10 redemptions allowed across all coupons',
        status: 'available',
        start_timestamp: new Date(),
        max_redemptions: 10,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Campaign C: Expired
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

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

    // 4. Create Coupons
    console.log('Creating coupons...');

    // Coupons for Campaign A
    await db.insertInto('coupons').values([
      { code: 'SUMMER_10', campaign_id: campaignA.id, status: 'available' },
      { code: 'SUMMER_20', campaign_id: campaignA.id, status: 'available' },
      // Unavailable coupon
      { code: 'SUMMER_HIDDEN', campaign_id: campaignA.id, status: 'not_available' },
      // Expired coupon within active campaign
      { code: 'SUMMER_EXPIRED', campaign_id: campaignA.id, status: 'available', expiration_timestamp: yesterday },
    ]).execute();

    // Coupons for Campaign B
    await db.insertInto('coupons').values([
      { code: 'FLASH_50', campaign_id: campaignB.id, status: 'available', max_redemptions: 2 }, // Limits per coupon
      { code: 'FLASH_20', campaign_id: campaignB.id, status: 'available' },
    ]).execute();

    // Coupons for Campaign C
    await db.insertInto('coupons').values([
      { code: 'WINTER_50', campaign_id: campaignC.id, status: 'available' },
    ]).execute();

    console.log('Seed completed successfully!');
    console.log('----------------------------------------------------');
    console.log(`Admin User ID: ${admin.id}`);
    console.log(`Test User 1 ID: ${user1.id}`);
    console.log(`Test User 2 ID: ${user2.id}`);
    console.log('----------------------------------------------------');
    console.log('Active coupons you can test:');
    console.log('- SUMMER_10 (Infinite)');
    console.log('- SUMMER_20 (Infinite)');
    console.log('- FLASH_50 (Max 2 uses)');
    console.log('- FLASH_20 (Shared campaign limit of 10)');

  } catch (err) {
    console.error('Seeding failed', err);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

seed();
