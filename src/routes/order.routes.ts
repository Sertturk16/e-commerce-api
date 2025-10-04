import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as orderController from '../controllers/order.controller';
import { authenticate } from '../middleware/auth.middleware';
import { createOrderSchema, getOrdersSchema, getOrderByIdSchema, cancelOrderSchema } from '../schemas/order.schema';

export default async function orderRoutes(app: FastifyInstance) {
  // Create order from cart
  app.post('/orders', {
    schema: createOrderSchema,
    preHandler: authenticate
  },
    async (request: FastifyRequest, reply: FastifyReply) => orderController.createOrder(request, reply)
  );

  // Get all user orders
  app.get('/orders', {
    schema: getOrdersSchema,
    preHandler: authenticate
  },
    async (request: FastifyRequest, reply: FastifyReply) => orderController.getUserOrders(request, reply)
  );

  // Get order by ID
  app.get('/orders/:id', {
    schema: getOrderByIdSchema,
    preHandler: authenticate
  },
    async (request: FastifyRequest, reply: FastifyReply) => orderController.getOrderById(request, reply)
  );

  // Cancel order
  app.put('/orders/:id/cancel', {
    schema: cancelOrderSchema,
    preHandler: authenticate
  },
    async (request: FastifyRequest, reply: FastifyReply) => orderController.cancelOrder(request, reply)
  );
}
