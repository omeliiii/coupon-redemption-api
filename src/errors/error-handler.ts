import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod';

const domainErrorMap = new Map<string, number>([
  ['CouponNotFoundError', 404],
  ['CampaignNotFoundError', 404],
  ['CouponNotAvailableError', 409],
  ['CouponExpiredError', 409],
  ['CampaignNotAvailableError', 409],
  ['CampaignExpiredError', 409],
  ['CampaignExpiredForRedemptionError', 409],
  ['AlreadyRedeemedError', 409],
  ['CouponRedemptionLimitReachedError', 409],
  ['CampaignRedemptionLimitReachedError', 409],
]);

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // Data validation errors (body, querystring, params, headers)
  if (hasZodFastifySchemaValidationErrors(error)) {
    request.log.warn({ validation: error.validation }, 'Validation error');
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'Validation failed',
      details: error.validation,
    });
  }

  // Response serialization errors
  if (isResponseSerializationError(error)) {
    request.log.error({ cause: error.cause }, 'Response serialization error');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Response validation failed',
    });
  }

  // Domain errors
  const statusCode = domainErrorMap.get(error.name);
  if (statusCode) {
    request.log.warn({ errorName: error.name }, error.message);
    return reply.status(statusCode).send({
      error: error.name,
      message: error.message,
    });
  }

  // Postgres unique constraint violation (double redemption)
  if ('code' in error && error.code === '23505') {
    request.log.warn({ error }, 'Unique constraint violation');
    return reply.status(409).send({
      error: 'Conflict',
      message: 'Resource already exists',
    });
  }

  // Generic errors
  request.log.error(error, 'Unhandled error');
  return reply.status(500).send({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
  });
}
