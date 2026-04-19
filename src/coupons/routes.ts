import { z } from 'zod';
import { getAvailableCoupons, createCouponWithCampaign } from './service.js';
import { config } from '../config.js';
import type { FastifyZodInstance } from '../types.js';
import { authenticateAdmin } from '../hooks/authenticate-admin.js';

const listCouponsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(config.apis.minPageSize).max(config.apis.maxPageSize).default(config.apis.defaultPageSize),
});

const campaignSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().nullish(),
  status: z.enum(['available', 'not_available']),
  startTimestamp: z.string().datetime(),
  endTimestamp: z.string().datetime().nullish(),
  maxRedemptions: z.number().int().positive().nullish(),
});

const couponSchema = z.object({
  code: z.string().min(1).max(255),
  status: z.enum(['available', 'not_available']),
  expirationTimestamp: z.string().datetime().nullish(),
  maxRedemptions: z.number().int().positive().nullish(),
});

const createCouponBodySchema = z.union([
  z.object({
    coupon: couponSchema,
    campaignId: z.string().uuid(),
    campaign: z.never().optional(),
  }),
  z.object({
    coupon: couponSchema,
    campaignId: z.never().optional(),
    campaign: campaignSchema,
  }),
]);

export async function couponRoutes(app: FastifyZodInstance) {
  app.get('/coupons', {
    schema: {
      querystring: listCouponsQuerySchema,
    },
    preHandler: [authenticateAdmin],
  }, async (request) => {
    const { page, pageSize } = request.query;
    const coupons = await getAvailableCoupons({ page, pageSize });

    return {
      data: coupons,
      meta: {
        page,
        pageSize,
      },
    };
  });

  app.post('/coupons', {
    schema: {
      body: createCouponBodySchema,
    },
    preHandler: [authenticateAdmin],
  }, async (request, reply) => {
    const created = await createCouponWithCampaign(request.body);

    return reply.status(201).send({ data: created });
  });
}
