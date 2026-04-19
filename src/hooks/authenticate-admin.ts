import type { FastifyRequest, FastifyReply } from 'fastify';
import { getUserById } from '../users/service.js';

/**
 * Fastify preHandler hook that authenticates admin users.
 * Reads x-user-id from headers, looks up the user in DB,
 * and verifies the role is admin.
 */
export async function authenticateAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const userId = request.headers['x-user-id'];

  if (!userId || typeof userId !== 'string') {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Missing x-user-id header',
    });
  }

  const user = await getUserById(userId);

  if (!user) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'User not found',
    });
  }

  if (user.role !== 'admin') {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Admin access required',
    });
  }
}
