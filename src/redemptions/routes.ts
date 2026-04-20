import { z } from 'zod';
import type { FastifyZodInstance } from '../types.js';
import { redeemCoupon } from './service.js';

const redeemParamsSchema = z.object({
  code: z.string().min(1).describe('The alphanumeric coupon code to redeem'),
});

const redeemHeadersSchema = z.object({
  'x-user-id': z.string().uuid().describe('The UUID of the user redeeming the coupon'),
});

export async function redemptionRoutes(app: FastifyZodInstance) {
  app.post('/coupons/:code/redeem', {
    schema: {
      tags: ['User'],
      security: [{ UserIdHeader: [] }],
      summary: 'Redeem a coupon',
      description: 'Allows a user to redeem a specified coupon code. Enforces campaign and coupon constraints such as limits and expiration dates.',
      params: redeemParamsSchema,
      headers: redeemHeadersSchema,
      response: {
        201: z.object({
          data: z.record(z.any()).describe('The generated redemption record detailing the transaction')
        }).describe('Successful coupon redemption response')
      }
    },
  }, async (request, reply) => {
    const { code } = request.params;
    const userId = request.headers['x-user-id'];

    request.log.info({ userId, code }, 'Redemption attempt');

    const redemption = await redeemCoupon({ userId, code });

    request.log.info({ userId, code, redemptionId: redemption.id }, 'Redemption successful');

    return reply.status(201).send({ data: redemption });
  });
}
