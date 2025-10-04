import { FastifyRequest, FastifyReply } from 'fastify';
import { productService } from '../services/product.service';
import { orderService } from '../services/order.service';
import { createProductSchema, updateProductSchema, updateStockSchema } from '../types/product';
import { updateOrderStatusSchema } from '../types/order';

export async function createProduct(request: FastifyRequest, reply: FastifyReply) {
  try {
    const data = createProductSchema.parse(request.body);
    const product = await productService.createProduct(request.user!.id, data);
    return reply.code(201).send({ product });
  } catch (error) {
    if (error instanceof Error) {
      return reply.code(400).send({ error: error.message });
    }
    return reply.code(500).send({ error: 'Internal server error' });
  }
}

export async function updateProduct(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    const data = updateProductSchema.parse(request.body);
    const product = await productService.updateProduct(
      id,
      request.user!.id,
      data
    );
    return reply.code(200).send({ product });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Product not found') {
        return reply.code(404).send({ error: error.message });
      }
      if (error.message === 'Unauthorized') {
        return reply.code(403).send({ error: error.message });
      }
      return reply.code(400).send({ error: error.message });
    }
    return reply.code(500).send({ error: 'Internal server error' });
  }
}

export async function getSellerProducts(request: FastifyRequest, reply: FastifyReply) {
  try {
    const products = await productService.getSellerProducts(request.user!.id);
    return reply.code(200).send({ products });
  } catch (error) {
    return reply.code(500).send({ error: 'Internal server error' });
  }
}

export async function updateStock(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    const data = updateStockSchema.parse(request.body);
    const product = await productService.updateStock(
      id,
      request.user!.id,
      data
    );
    return reply.code(200).send({ product });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Product not found') {
        return reply.code(404).send({ error: error.message });
      }
      if (error.message === 'Unauthorized') {
        return reply.code(403).send({ error: error.message });
      }
      return reply.code(400).send({ error: error.message });
    }
    return reply.code(500).send({ error: 'Internal server error' });
  }
}

export async function getSellerOrders(request: FastifyRequest, reply: FastifyReply) {
  try {
    const orders = await orderService.getSellerOrders(request.user!.id);
    return reply.code(200).send({ orders });
  } catch (error) {
    return reply.code(500).send({ error: 'Internal server error' });
  }
}

export async function updateOrderItemStatus(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    const data = updateOrderStatusSchema.parse(request.body);
    const orderItem = await orderService.updateOrderItemStatus(
      request.user!.id,
      id,
      data.status
    );
    return reply.code(200).send({ order_item: orderItem });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Order item not found') {
        return reply.code(404).send({ error: error.message });
      }
      return reply.code(400).send({ error: error.message });
    }
    return reply.code(500).send({ error: 'Internal server error' });
  }
}

export async function cancelSubOrder(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    const order = await orderService.cancelSubOrder(
      request.user!.id,
      id
    );
    return reply.code(200).send({ order, message: 'Sub-order cancelled successfully' });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('does not belong')) {
        return reply.code(404).send({ error: error.message });
      }
      return reply.code(400).send({ error: error.message });
    }
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
