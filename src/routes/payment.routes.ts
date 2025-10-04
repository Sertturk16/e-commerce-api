import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as paymentController from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { processPaymentSchema, getPaymentStatusSchema, refundPaymentSchema } from '../schemas/payment.schema';

export async function paymentRoutes(app: FastifyInstance) {
  // Process payment
  app.post('/payments/process', {
    schema: processPaymentSchema,
    preHandler: authenticate
  },
    async (request: FastifyRequest, reply: FastifyReply) => paymentController.processPayment(request, reply)
  );

  // Check payment status
  app.get('/payments/status/:order_id', {
    schema: getPaymentStatusSchema,
    preHandler: authenticate
  },
    paymentController.checkPaymentStatus
  );

  // Refund payment
  app.post('/payments/refund/:order_id', {
    schema: refundPaymentSchema,
    preHandler: authenticate
  },
    paymentController.refundPayment
  );
}
