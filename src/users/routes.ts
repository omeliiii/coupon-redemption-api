import { z } from 'zod';
import type { FastifyZodInstance } from '../types.js';
import { createUser } from './service.js';
import { authenticateAdmin } from '../hooks/authenticate-admin.js';

const createUserBodySchema = z.object({
  email: z.string().email().describe('Email address of the user'),
  role: z.enum(['user', 'admin']).optional().describe('Role of the user (defaults to strict "user" if omitted)'),
});

export async function userRoutes(app: FastifyZodInstance) {
  app.post('/users', {
    schema: {
      tags: ['Admin'],
      security: [{ UserIdHeader: [] }],
      summary: 'Create a new user',
      description: 'Creates a new user account with a specified role. Used for seeding admins or registering identities.',
      body: createUserBodySchema,
      response: {
        201: z.object({
          data: z.record(z.any()).describe('The newly created user record')
        }).describe('User successfully created')
      }
    },
    preHandler: [authenticateAdmin],
  }, async (request, reply) => {
    const user = await createUser(request.body);

    return reply.status(201).send({ data: user });
  });
}
