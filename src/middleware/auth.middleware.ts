import { FastifyRequest, FastifyReply } from 'fastify';
import { isTokenBlacklisted } from '../utils/jwt';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: {
      id: string;
      email: string;
      role: string;
    };
  }
}

export const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    // Verify JWT
    await request.jwtVerify();

    // Get token from header
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return reply.code(401).send({ error: 'No token provided' });
    }

    const token = authHeader.replace('Bearer ', '');

    // Check if token is blacklisted
    const isBlacklisted = await isTokenBlacklisted(token);
    if (isBlacklisted) {
      return reply.code(401).send({ error: 'Token has been revoked' });
    }

    // User is already attached by jwtVerify()
  } catch (err) {
    return reply.code(401).send({ error: 'Invalid token' });
  }
};
