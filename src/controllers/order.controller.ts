import { FastifyRequest, FastifyReply } from 'fastify';
import { orderService } from '../services/order.service';
import { createOrderSchema } from '../types/order';
import { logError, logInfo } from '../middleware/errorHandler.middleware';

export async function createOrder(request: FastifyRequest, reply: FastifyReply) {
  const validation = createOrderSchema.safeParse(request.body);
  if (!validation.success) {
    return reply.code(400).send({ error: validation.error.errors[0].message });
  }

  try {
    const order = await orderService.createOrder(
      request.user!.id,
      validation.data.address_id,
      validation.data.payment_method
    );
    logInfo('Order created successfully', {
      userId: request.user!.id,
      orderId: order.id
    });
    return reply.code(201).send({ order });
  } catch (error: any) {
    logError('Failed to create order', error, {
      userId: request.user!.id,
      addressId: validation.data.address_id
    });
    return reply.code(400).send({ error: error.message });
  }
}

export async function getUserOrders(request: FastifyRequest, reply: FastifyReply) {
  try {
    const orders = await orderService.getUserOrders(request.user!.id);
    return reply.code(200).send({ orders });
  } catch (error: any) {
    logError('Failed to get user orders', error, {
      userId: request.user!.id
    });
    return reply.code(400).send({ error: error.message });
  }
}

export async function getOrderById(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };

  try {
    const order = await orderService.getOrderById(request.user!.id, id);
    return reply.code(200).send({ order });
  } catch (error: any) {
    logError('Failed to get order by ID', error, {
      userId: request.user!.id,
      orderId: id
    });
    return reply.code(404).send({ error: error.message });
  }
}

export async function cancelOrder(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };

  try {
    const order = await orderService.cancelOrder(request.user!.id, id);
    logInfo('Order cancelled', {
      userId: request.user!.id,
      orderId: id
    });
    return reply.code(200).send({ order });
  } catch (error: any) {
    logError('Failed to cancel order', error, {
      userId: request.user!.id,
      orderId: id
    });
    return reply.code(400).send({ error: error.message });
  }
}
