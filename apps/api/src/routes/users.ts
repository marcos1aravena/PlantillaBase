import { Router } from 'express';
import type { UsersResponse, UserResponse } from '@base/contracts';
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth';
import { createUserSchema, updateUserSchema, validate } from '../validation';
import * as users from '../services/users';

export const userRoutes = Router();
userRoutes.use(authenticate, requireAdmin);
userRoutes.get('/', async (_req, res) => { res.json({ users: await users.listUsers() } satisfies UsersResponse); });
userRoutes.post('/', async (req, res) => {
  res.status(201).json({ user: await users.createUser((req as AuthRequest).user!.role, validate(createUserSchema, req.body)) } satisfies UserResponse);
});
userRoutes.patch('/:id', async (req, res) => {
  res.json({ user: await users.updateUser((req as AuthRequest).user!.role, String(req.params.id), validate(updateUserSchema, req.body)) } satisfies UserResponse);
});
userRoutes.delete('/:id', async (req, res) => {
  await users.deleteUser((req as AuthRequest).user!.role, String(req.params.id));
  res.status(204).end();
});
