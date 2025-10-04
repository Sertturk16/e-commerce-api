import { FastifyRequest, FastifyReply } from 'fastify';
import { favoriteService } from '../services/favorite.service';

export async function addFavorite(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { productId } = request.params as { productId: string };
    const userId = request.user!.id;

    const favorite = await favoriteService.addFavorite(userId, productId);
    return reply.code(201).send({ favorite });
  } catch (error: any) {
    if (error.message === 'Product not found') {
      return reply.code(404).send({ error: error.message });
    }
    if (error.message === 'Product already in favorites') {
      return reply.code(400).send({ error: error.message });
    }
    return reply.code(500).send({ error: 'Internal server error' });
  }
}

export async function removeFavorite(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { productId } = request.params as { productId: string };
    const userId = request.user!.id;

    const result = await favoriteService.removeFavorite(userId, productId);
    return reply.code(200).send(result);
  } catch (error: any) {
    if (error.message === 'Favorite not found') {
      return reply.code(404).send({ error: error.message });
    }
    return reply.code(500).send({ error: 'Internal server error' });
  }
}

export async function getUserFavorites(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user!.id;
    const favorites = await favoriteService.getUserFavorites(userId);
    return reply.code(200).send({ favorites });
  } catch (error: any) {
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
