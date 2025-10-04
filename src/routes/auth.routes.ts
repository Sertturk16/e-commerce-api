import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { registerSchema, loginSchema, logoutSchema, updateProfileSchema } from '../schemas/auth.schema';

export async function authRoutes(app: FastifyInstance) {
  // Register
  app.post('/auth/register', {
    schema: registerSchema
  }, async (request: FastifyRequest, reply: FastifyReply) => authController.register(request, reply, app));

  // Login
  app.post('/auth/login', {
    schema: loginSchema
  }, async (request: FastifyRequest, reply: FastifyReply) => authController.login(request, reply, app));

  // Logout
  app.post('/auth/logout', {
    schema: logoutSchema,
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => authController.logout(request, reply));

  // Update Profile
  app.put('/auth/profile', {
    schema: updateProfileSchema,
    preHandler: authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => authController.updateProfile(request, reply));
}
