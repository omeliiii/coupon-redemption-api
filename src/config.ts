export const config = {
  database: {
    url: process.env.DATABASE_URL ?? 'postgres://coupon_user:coupon_pass@localhost:5432/coupon_db',
  },
  server: {
    host: process.env.HOST ?? '0.0.0.0',
    port: Number(process.env.PORT) || 3000,
    logLevel: process.env.LOG_LEVEL ?? 'info',
  },
  rateLimit: {
    max: Number(process.env.RATE_LIMIT_MAX) || 100,
    timeWindow: process.env.RATE_LIMIT_TIME_WINDOW || '1 minute',
  },
  apis: {
    defaultPageSize: Number(process.env.DEFAULT_PAGE_SIZE) || 10,
    minPageSize: Number(process.env.MIN_PAGE_SIZE) || 5,
    maxPageSize: Number(process.env.MAX_PAGE_SIZE) || 100,
  }
} as const;
