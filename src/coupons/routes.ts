import { z } from 'zod';
import { getAvailableCoupons } from './service.js';
import { config } from '../config.js';
import { FastifyZodInstance } from '../types.js';

const listCouponsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(config.apis.minPageSize).max(config.apis.maxPageSize).default(config.apis.defaultPageSize),
});

export async function couponRoutes(app: FastifyZodInstance) {
  app.get('/coupons', {
    schema: {
      querystring: listCouponsQuerySchema,
    },
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
}
