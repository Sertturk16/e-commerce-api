import { FastifyRequest, FastifyReply } from 'fastify';
import { cartService } from '../services/cart.service';
import {
  addToCartSchema,
  AddToCartInput,
  updateCartItemSchema,
  UpdateCartItemInput,
  removeFromCartSchema,
  RemoveFromCartInput,
} from '../types/cart';
import { isTokenBlacklisted } from '../utils/jwt';

async function extractUserOrSession(request: FastifyRequest) {
  let userId: string | null = null;
  let sessionId: string | null = null;

  try {
    await request.jwtVerify();
    userId = request.user.id;

    const authHeader = request.headers.authorization;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const isBlacklisted = await isTokenBlacklisted(token);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }
    }
  } catch {
    sessionId = (request.headers['x-session-id'] as string) || null;
    if (!sessionId) {
      throw new Error('Session ID required for anonymous users (x-session-id header)');
    }
  }

  return { userId, sessionId };
}

export async function addToCart(request: FastifyRequest, reply: FastifyReply) {
  try {
    const validation = addToCartSchema.safeParse(request.body as AddToCartInput);
    if (!validation.success) {
      return reply.code(400).send({ error: validation.error.errors[0].message });
    }

    const { userId, sessionId } = await extractUserOrSession(request);
    const cart = await cartService.addToCart(userId, sessionId, validation.data);
    return reply.code(201).send({ cart });
  } catch (error: any) {
    if (error.message.includes('Session ID required')) {
      return reply.code(400).send({ error: error.message });
    }
    if (error.message.includes('Token has been revoked')) {
      return reply.code(401).send({ error: error.message });
    }
    if (error.message.includes('not found') || error.message.includes('Insufficient stock') || error.message.includes('not available')) {
      return reply.code(400).send({ error: error.message });
    }
    return reply.code(500).send({ error: 'Internal server error' });
  }
}

export async function getCart(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { userId, sessionId } = await extractUserOrSession(request);
    const cart = await cartService.getCart(userId, sessionId);
    return reply.code(200).send({ cart });
  } catch (error: any) {
    if (error.message.includes('Session ID required')) {
      return reply.code(400).send({ error: error.message });
    }
    if (error.message.includes('Token has been revoked')) {
      return reply.code(401).send({ error: error.message });
    }
    return reply.code(500).send({ error: 'Internal server error' });
  }
}

export async function updateCartItem(request: FastifyRequest, reply: FastifyReply) {
  try {
    const validation = updateCartItemSchema.safeParse(request.body as UpdateCartItemInput);
    if (!validation.success) {
      return reply.code(400).send({ error: validation.error.errors[0].message });
    }

    const { userId, sessionId } = await extractUserOrSession(request);
    const cart = await cartService.updateCartItem(
      userId,
      sessionId,
      validation.data.product_id,
      validation.data.quantity
    );
    return reply.code(200).send({ cart });
  } catch (error: any) {
    if (error.message.includes('Session ID required')) {
      return reply.code(400).send({ error: error.message });
    }
    if (error.message.includes('Token has been revoked')) {
      return reply.code(401).send({ error: error.message });
    }
    if (error.message.includes('not found') || error.message.includes('Insufficient stock') || error.message.includes('not available')) {
      return reply.code(400).send({ error: error.message });
    }
    return reply.code(500).send({ error: 'Internal server error' });
  }
}

export async function removeFromCart(request: FastifyRequest, reply: FastifyReply) {
  try {
    const validation = removeFromCartSchema.safeParse(request.body as RemoveFromCartInput);
    if (!validation.success) {
      return reply.code(400).send({ error: validation.error.errors[0].message });
    }

    const { userId, sessionId } = await extractUserOrSession(request);
    const cart = await cartService.removeFromCart(userId, sessionId, validation.data.product_id);
    return reply.code(200).send({ cart });
  } catch (error: any) {
    if (error.message.includes('Session ID required')) {
      return reply.code(400).send({ error: error.message });
    }
    if (error.message.includes('Token has been revoked')) {
      return reply.code(401).send({ error: error.message });
    }
    if (error.message.includes('not found')) {
      return reply.code(400).send({ error: error.message });
    }
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
