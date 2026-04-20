import { z } from 'zod';
import { getAvailableCoupons, createCouponWithCampaign } from './service.js';
import { config } from '../config.js';
import type { FastifyZodInstance } from '../types.js';
import { authenticateAdmin } from '../hooks/authenticate-admin.js';

const listCouponsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).describe('The page number for pagination'),
  pageSize: z.coerce.number().int().min(config.apis.minPageSize).max(config.apis.maxPageSize).default(config.apis.defaultPageSize).describe('Number of items per page'),
});

const campaignSchema = z.object({
  name: z.string().min(1).max(255).describe('Name of the campaign'),
  description: z.string().nullish().describe('Detailed description of the campaign'),
  status: z.enum(['available', 'not_available']).describe('Availability status of the campaign'),
  startTimestamp: z.string().datetime().describe('Start timestamp of the campaign (ISO 8601)'),
  endTimestamp: z.string().datetime().nullish().describe('End timestamp of the campaign (ISO 8601)'),
  maxRedemptions: z.number().int().positive().nullish().describe('Maximum number of redemptions allowed for the campaign'),
}).describe('Campaign data object');

const couponSchema = z.object({
  code: z.string().min(1).max(255).describe('The unique alphanumeric code for the coupon'),
  status: z.enum(['available', 'not_available']).describe('Availability status of the coupon'),
  expirationTimestamp: z.string().datetime().nullish().describe('Expiration timestamp of the coupon (ISO 8601)'),
  maxRedemptions: z.number().int().positive().nullish().describe('Maximum number of redemptions for this specific coupon'),
}).describe('Coupon data object');

const createCouponBodySchema = z.union([
  z.object({
    coupon: couponSchema,
    campaignId: z.string().uuid().describe('ID of an existing campaign to link to'),
    campaign: z.never().optional(),
  }),
  z.object({
    coupon: couponSchema,
    campaignId: z.never().optional(),
    campaign: campaignSchema,
  }),
]).describe('Coupon creation payload. Must provide either an existing campaignId or a new campaign object.');

export async function couponRoutes(app: FastifyZodInstance) {
  app.get('/coupons', {
    schema: {
      tags: ['Admin'],
      security: [{ UserIdHeader: [] }],
      summary: 'List available coupons',
      description: 'Returns a paginated list of all active coupons along with their associated campaign details. Only available to admins.',
      querystring: listCouponsQuerySchema,
      response: {
        200: z.object({
          data: z.array(z.record(z.any())).describe('List of coupons'),
          meta: z.object({ page: z.number(), pageSize: z.number() }).describe('Pagination metadata')
        }).describe('Successful response containing paginated coupons')
      }
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
      tags: ['Admin'],
      security: [{ UserIdHeader: [] }],
      summary: 'Create a new coupon',
      description: 'Creates a new coupon and optionally a new campaign if provided inline. Only available to admins.',
      body: createCouponBodySchema,
      response: {
        201: z.object({
          data: z.record(z.any()).describe('The newly created coupon object')
        }).describe('Coupon successfully created')
      }
    },
    preHandler: [authenticateAdmin],
  }, async (request, reply) => {
    const created = await createCouponWithCampaign(request.body);

    return reply.status(201).send({ data: created });
  });
}
