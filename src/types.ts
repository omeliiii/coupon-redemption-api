import { FastifyInstance, FastifyBaseLogger, RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';

export type FastifyZodInstance = FastifyInstance<
    RawServerDefault,
    RawRequestDefaultExpression<RawServerDefault>,
    RawReplyDefaultExpression<RawServerDefault>,
    FastifyBaseLogger,
    ZodTypeProvider
>;