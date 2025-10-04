import { FastifyRequest, FastifyReply } from 'fastify';
import { paymentService } from '../services/payment.service';
import { processPaymentSchema, ProcessPaymentInput } from '../types/payment';
import { prisma } from '../config/database';

export async function processPayment(request: FastifyRequest, reply: FastifyReply) {
  try {
    const validation = processPaymentSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send({ error: validation.error.errors[0].message });
    }

    const data = validation.data as ProcessPaymentInput;

    // Verify order belongs to user
    const order = await prisma.order.findUnique({
      where: { id: data.order_id },
    });

    if (!order) {
      return reply.code(404).send({ error: 'Order not found' });
    }

    if (order.user_id !== request.user!.id) {
      return reply.code(403).send({ error: 'Unauthorized to pay for this order' });
    }

    const result = await paymentService.processPayment({
      order_id: data.order_id,
      amount: order.total_amount,
      payment_method: data.payment_method as any,
      card_number: data.card_number,
      card_holder: data.card_holder,
      cvv: data.cvv,
      expiry_date: data.expiry_date,
    });

    return reply.code(200).send(result);
  } catch (error: any) {
    return reply.code(400).send({ error: error.message });
  }
}

export async function checkPaymentStatus(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { order_id } = request.params as { order_id: string };

    // Verify order belongs to user
    const order = await prisma.order.findUnique({
      where: { id: order_id },
    });

    if (!order) {
      return reply.code(404).send({ error: 'Order not found' });
    }

    if (order.user_id !== request.user!.id) {
      return reply.code(403).send({ error: 'Unauthorized' });
    }

    const status = await paymentService.checkPaymentStatus(order_id);
    return reply.code(200).send(status);
  } catch (error: any) {
    return reply.code(400).send({ error: error.message });
  }
}

export async function refundPayment(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { order_id } = request.params as { order_id: string };

    // Verify order belongs to user
    const order = await prisma.order.findUnique({
      where: { id: order_id },
    });

    if (!order) {
      return reply.code(404).send({ error: 'Order not found' });
    }

    if (order.user_id !== request.user!.id) {
      return reply.code(403).send({ error: 'Unauthorized' });
    }

    const result = await paymentService.refundPayment(order_id);
    return reply.code(200).send(result);
  } catch (error: any) {
    return reply.code(400).send({ error: error.message });
  }
}
