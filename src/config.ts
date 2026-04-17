export const config = {
  database: {
    url: process.env.DATABASE_URL ?? 'postgres://coupon_user:coupon_pass@localhost:5432/coupon_db',
  },
  server: {
    host: process.env.HOST ?? '0.0.0.0',
    port: Number(process.env.PORT) || 3000,
  },
} as const;
