import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';
import { couponRoutes } from './coupons/routes.js';
import { redemptionRoutes } from './redemptions/routes.js';
import { userRoutes } from './users/routes.js';
import { errorHandler } from './errors/error-handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.server.logLevel,
    },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);

  await app.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.timeWindow,
  });

  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Coupon Redemption API',
        description: 'REST API for a coupon redemption system',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          UserIdHeader: {
            type: 'apiKey',
            name: 'x-user-id',
            in: 'header',
            description: 'Provide an admin user ID for protected routes',
          },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false
    },
    uiHooks: {
      onRequest: function (request, reply, next) { next() },
      preHandler: function (request, reply, next) {
        if (request.url.includes('/static/')) {
          request.log.debug({ url: request.url, params: request.params }, 'SWAGGER UI REQUEST');
        }
        next()
      }
    },
    staticCSP: false, // necessary to make it work on Safari
    transformStaticCSP: (header) => header,
    transformSpecification: (swaggerObject, request, reply) => { return swaggerObject },
    transformSpecificationClone: true
  });

  // WORKAROUND: fastify 5 routing bug with nested fastify-static wildcards
  // Manually serve the swagger UI static files.
  app.get('/documentation/static/:file', { schema: { hide: true } }, (req, reply) => {
    const file = (req.params as any).file;
    const resolvedPath = path.join(__dirname, '../node_modules/@fastify/swagger-ui/static', file);
    const mimeMap: Record<string, string> = {
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.html': 'text/html; charset=utf-8',
      '.png': 'image/png',
      '.svg': 'image/svg+xml'
    };

    // Check if the file name is safe (no path traversal)
    if (file.includes('..') || file.includes('/')) {
      return reply.callNotFound();
    }

    if (!fs.existsSync(resolvedPath)) {
      return reply.callNotFound();
    }
    reply.type(mimeMap[path.extname(file)] || 'application/octet-stream');
    return reply.send(fs.createReadStream(resolvedPath));
  });

  await app.register(couponRoutes);
  await app.register(redemptionRoutes);
  await app.register(userRoutes);

  app.get('/health', { schema: { hide: true } }, async () => {
    return { status: 'ok' };
  });

  return app;
}

