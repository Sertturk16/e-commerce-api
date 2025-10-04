import { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '../types/user';

export const requireSeller = async (request: FastifyRequest, reply: FastifyReply) => {
  if (!request.user) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  if (request.user.role !== UserRole.SELLER) {
    return reply.code(403).send({ error: 'Seller access required' });
  }
};
