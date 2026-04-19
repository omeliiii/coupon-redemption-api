import { z } from 'zod';
import type { FastifyZodInstance } from '../types.js';
import { createUser } from './service.js';
import { authenticateAdmin } from '../hooks/authenticate-admin.js';

const createUserBodySchema = z.object({
  email: z.string().email(),
  role: z.enum(['user', 'admin']).optional(),
});

export async function userRoutes(app: FastifyZodInstance) {
  app.post('/users', {
    schema: {
      body: createUserBodySchema,
    },
    preHandler: [authenticateAdmin],
  }, async (request, reply) => {
    const user = await createUser(request.body);

    return reply.status(201).send({ data: user });
  });
}
