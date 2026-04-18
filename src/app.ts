import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { config } from './config.js';
import { couponRoutes } from './coupons/routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.server.logLevel,
    },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.timeWindow,
  });

  await app.register(couponRoutes);

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  return app;
}

