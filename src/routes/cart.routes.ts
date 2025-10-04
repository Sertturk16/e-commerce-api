import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as cartController from '../controllers/cart.controller';
import { AddToCartInput, UpdateCartItemInput, RemoveFromCartInput } from '../types/cart';
import { addToCartSchema, getCartSchema, updateCartSchema, removeFromCartSchema } from '../schemas/cart.schema';

export async function cartRoutes(app: FastifyInstance) {
  // Add to cart (authenticated or anonymous)
  app.post('/cart/add', {
    schema: addToCartSchema
  },
    async (request: FastifyRequest<{ Body: AddToCartInput }>, reply: FastifyReply) =>
      cartController.addToCart(request, reply)
  );

  // Get cart (authenticated or anonymous)
  app.get('/cart', {
    schema: getCartSchema
  },
    async (request: FastifyRequest, reply: FastifyReply) => cartController.getCart(request, reply)
  );

  // Update cart item quantity (authenticated or anonymous)
  app.put('/cart/update', {
    schema: updateCartSchema
  },
    async (request: FastifyRequest<{ Body: UpdateCartItemInput }>, reply: FastifyReply) =>
      cartController.updateCartItem(request, reply)
  );

  // Remove item from cart (authenticated or anonymous)
  app.delete('/cart/remove', {
    schema: removeFromCartSchema
  },
    async (request: FastifyRequest<{ Body: RemoveFromCartInput }>, reply: FastifyReply) =>
      cartController.removeFromCart(request, reply)
  );
}
