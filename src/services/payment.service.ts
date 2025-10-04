import { prisma } from '../config/database';

export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  PAYPAL = 'PAYPAL',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CASH_ON_DELIVERY = 'CASH_ON_DELIVERY',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

interface PaymentRequest {
  order_id: string;
  amount: number;
  payment_method: PaymentMethod;
  card_number?: string;
  card_holder?: string;
  cvv?: string;
  expiry_date?: string;
}

interface PaymentResponse {
  success: boolean;
  transaction_id: string;
  status: PaymentStatus;
  message: string;
  paid_at?: Date;
}

class PaymentService {
  // Simulated payment processing
  async processPayment(paymentRequest: PaymentRequest): Promise<PaymentResponse> {
    const { order_id, payment_method, card_number } = paymentRequest;

    // Validate order exists
    const order = await prisma.order.findUnique({ where: { id: order_id } });
    if (!order) {
      throw new Error('Order not found');
    }

    // Check if already paid
    if (order.payment_status === PaymentStatus.PAID) {
      return {
        success: true,
        transaction_id: `TXN-${order_id}`,
        status: PaymentStatus.PAID,
        message: 'Order already paid',
        paid_at: order.updated_at,
      };
    }

    // Update to processing
    await prisma.order.update({
      where: { id: order_id },
      data: { payment_status: PaymentStatus.PROCESSING },
    });

    // Simulate payment processing delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Simulate payment success/failure (90% success rate)
    const isSuccess = this.simulatePaymentGateway(payment_method, card_number);

    if (isSuccess) {
      // Check if this is a parent order with sub-orders
      const orderWithSubs = await prisma.order.findUnique({
        where: { id: order_id },
        include: { sub_orders: true },
      });

      // Update parent order, sub-orders, and all order items to confirmed
      await prisma.$transaction(async (tx) => {
        // Update parent order
        await tx.order.update({
          where: { id: order_id },
          data: {
            payment_status: PaymentStatus.PAID,
            status: 'CONFIRMED',
          },
        });

        if (orderWithSubs?.is_parent && orderWithSubs.sub_orders.length > 0) {
          // Update all sub-orders
          await tx.order.updateMany({
            where: { parent_order_id: order_id },
            data: {
              payment_status: PaymentStatus.PAID,
              status: 'CONFIRMED',
            },
          });

          // Update all order items in all sub-orders (single query)
          const subOrderIds = orderWithSubs.sub_orders.map(so => so.id);
          await tx.orderItem.updateMany({
            where: { order_id: { in: subOrderIds } },
            data: { status: 'CONFIRMED' },
          });
        } else {
          // Legacy: single order without sub-orders
          await tx.orderItem.updateMany({
            where: { order_id: order_id },
            data: { status: 'CONFIRMED' },
          });
        }
      });

      return {
        success: true,
        transaction_id: `TXN-${Date.now()}-${order_id.substring(0, 8)}`,
        status: PaymentStatus.PAID,
        message: 'Payment successful',
        paid_at: new Date(),
      };
    } else {
      // Update order to failed
      await prisma.order.update({
        where: { id: order_id },
        data: { payment_status: PaymentStatus.FAILED },
      });

      return {
        success: false,
        transaction_id: `TXN-FAILED-${Date.now()}`,
        status: PaymentStatus.FAILED,
        message: 'Payment failed. Please try again.',
      };
    }
  }

  // Simulate refund
  async refundPayment(order_id: string): Promise<PaymentResponse> {
    const order = await prisma.order.findUnique({ where: { id: order_id } });
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.payment_status !== PaymentStatus.PAID) {
      throw new Error('Cannot refund unpaid order');
    }

    // Update order to refunded
    await prisma.order.update({
      where: { id: order_id },
      data: {
        payment_status: PaymentStatus.REFUNDED,
        status: 'CANCELLED',
      },
    });

    return {
      success: true,
      transaction_id: `REFUND-${Date.now()}-${order_id.substring(0, 8)}`,
      status: PaymentStatus.REFUNDED,
      message: 'Refund processed successfully',
      paid_at: new Date(),
    };
  }

  // Check payment status
  async checkPaymentStatus(order_id: string): Promise<{ status: PaymentStatus; message: string }> {
    const order = await prisma.order.findUnique({ where: { id: order_id } });
    if (!order) {
      throw new Error('Order not found');
    }

    return {
      status: order.payment_status as PaymentStatus,
      message: this.getPaymentStatusMessage(order.payment_status as PaymentStatus),
    };
  }

  // Simulated payment gateway logic
  private simulatePaymentGateway(payment_method: PaymentMethod, card_number?: string): boolean {
    // Cash on delivery always succeeds
    if (payment_method === PaymentMethod.CASH_ON_DELIVERY) {
      return true;
    }

    // Simulate card validation
    if (payment_method === PaymentMethod.CREDIT_CARD || payment_method === PaymentMethod.DEBIT_CARD) {
      // Test card numbers
      if (card_number === '4111111111111111') return true; // Test success card
      if (card_number === '4000000000000002') return false; // Test failure card

      // Random success (90% success rate)
      return Math.random() > 0.1;
    }

    // PayPal and Bank Transfer - 95% success rate
    return Math.random() > 0.05;
  }

  private getPaymentStatusMessage(status: PaymentStatus): string {
    const messages: Record<PaymentStatus, string> = {
      [PaymentStatus.PENDING]: 'Payment is pending',
      [PaymentStatus.PROCESSING]: 'Payment is being processed',
      [PaymentStatus.PAID]: 'Payment completed successfully',
      [PaymentStatus.FAILED]: 'Payment failed',
      [PaymentStatus.REFUNDED]: 'Payment has been refunded',
    };
    return messages[status];
  }
}

export const paymentService = new PaymentService();
