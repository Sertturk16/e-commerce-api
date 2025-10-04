import { FastifyInstance } from 'fastify';
import { redis } from '../config/redis';
import { env } from '../config/env';

export const generateToken = async (app: FastifyInstance, userId: string, email: string, role: string) => {
  const token = app.jwt.sign(
    {
      id: userId,
      email,
      role,
    },
    {
      expiresIn: env.JWT_EXPIRES_IN,
    }
  );

  return token;
};

export const blacklistToken = async (token: string) => {
  // Store token in Redis with expiration
  const expiresIn = parseInt(env.JWT_EXPIRES_IN.replace('d', '')) * 24 * 60 * 60; // Convert days to seconds
  await redis.setex(`blacklist:${token}`, expiresIn, '1');
};

export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  const result = await redis.get(`blacklist:${token}`);
  return result !== null;
};
