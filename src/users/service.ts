import { findUserById, insertUser } from './repository.js';
import type { UserRole } from '../db/types.js';

export interface CreateUserInput {
  email: string;
  role?: UserRole;
}

export async function createUser(input: CreateUserInput) {
  return insertUser({
    email: input.email,
    role: input.role ?? 'user',
  });
}

export async function getUserById(id: string) {
  return findUserById(id);
}

export class UserNotFoundError extends Error {
  constructor(userId: string) {
    super(`User not found: ${userId}`);
    this.name = 'UserNotFoundError';
  }
}
