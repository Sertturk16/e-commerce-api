import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { authService } from '../services/auth.service';
import { cartService } from '../services/cart.service';
import { registerSchema, loginSchema, updateProfileSchema } from '../types/auth';
import { generateToken, blacklistToken } from '../utils/jwt';

export async function register(request: FastifyRequest, reply: FastifyReply, app: FastifyInstance) {
  try {
    // Validate input
    const data = registerSchema.parse(request.body);

    // Create user
    const user = await authService.register(data);

    // Generate JWT
    const token = await generateToken(app, user.id, user.email, user.role);

    return reply.code(201).send({
      token,
      user,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'User already exists') {
        return reply.code(400).send({ error: error.message });
      }
      // Zod validation error
      return reply.code(400).send({ error: error.message });
    }
    return reply.code(500).send({ error: 'Internal server error' });
  }
}

export async function login(request: FastifyRequest, reply: FastifyReply, app: FastifyInstance) {
  try {
    // Validate input
    const data = loginSchema.parse(request.body);

    // Authenticate user
    const user = await authService.login(data);

    // Generate JWT
    const token = await generateToken(app, user.id, user.email, user.role);

    // Merge anonymous cart if session ID provided
    const sessionId = request.headers['x-session-id'] as string;
    let cart;

    try {
      if (sessionId) {
        try {
          cart = await cartService.mergeAnonymousCart(user.id, sessionId);
        } catch (error) {
          // If merge fails, get user's existing cart
          console.error('Cart merge failed:', error);
          cart = await cartService.getCart(user.id, null);
        }
      } else {
        // If no session ID, get user's existing cart
        cart = await cartService.getCart(user.id, null);
      }
    } catch (error) {
      // If cart operations fail, just log and continue without cart
      console.error('Failed to get cart:', error);
      cart = undefined;
    }

    return reply.code(200).send({
      token,
      user,
      cart,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Invalid credentials') {
        return reply.code(401).send({ error: error.message });
      }
      // Zod validation error
      return reply.code(400).send({ error: error.message });
    }
    return reply.code(500).send({ error: 'Internal server error' });
  }
}

export async function logout(request: FastifyRequest, reply: FastifyReply) {
  try {
    // Get token from header
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return reply.code(401).send({ error: 'No token provided' });
    }

    const token = authHeader.replace('Bearer ', '');

    // Blacklist the token
    await blacklistToken(token);

    return reply.code(200).send({ message: 'Logged out successfully' });
  } catch (error) {
    return reply.code(500).send({ error: 'Internal server error' });
  }
}

export async function updateProfile(request: FastifyRequest, reply: FastifyReply) {
  try {
    // Validate input
    const data = updateProfileSchema.parse(request.body);

    // Update profile
    const user = await authService.updateProfile(request.user!.id, data);

    return reply.code(200).send({ user });
  } catch (error) {
    if (error instanceof Error) {
      return reply.code(400).send({ error: error.message });
    }
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
