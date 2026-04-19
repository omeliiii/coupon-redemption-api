import { z } from 'zod';
import type { FastifyZodInstance } from '../types.js';
import { redeemCoupon } from './service.js';

const redeemParamsSchema = z.object({
  code: z.string().min(1),
});

const redeemHeadersSchema = z.object({
  'x-user-id': z.string().uuid(),
});

export async function redemptionRoutes(app: FastifyZodInstance) {
  app.post('/coupons/:code/redeem', {
    schema: {
      params: redeemParamsSchema,
      headers: redeemHeadersSchema,
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
