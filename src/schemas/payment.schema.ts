export const processPaymentSchema = {
  description: 'Process payment for an order',
  tags: ['Payment'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['order_id', 'payment_method'],
    properties: {
      order_id: { type: 'string', format: 'uuid', description: 'Order ID' },
      payment_method: {
        type: 'string',
        enum: ['CREDIT_CARD', 'PAYPAL', 'CASH_ON_DELIVERY'],
        description: 'Payment method'
      },
      card_number: { type: 'string', description: 'Credit card number (if CREDIT_CARD)' },
      card_holder: { type: 'string', description: 'Card holder name' },
      cvv: { type: 'string', description: 'CVV code' },
      expiry_date: { type: 'string', description: 'Expiry date (MM/YY)' },
      paypal_email: { type: 'string', format: 'email', description: 'PayPal email (if PAYPAL)' }
    }
  },
  response: {
    200: {
      description: 'Payment processed',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        transaction_id: { type: 'string' },
        status: { type: 'string' }
      }
    },
    400: {
      description: 'Payment failed',
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    }
  }
};

export const getPaymentStatusSchema = {
  description: 'Get payment status for an order',
  tags: ['Payment'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['order_id'],
    properties: {
      order_id: { type: 'string', format: 'uuid', description: 'Order ID' }
    }
  },
  response: {
    200: {
      description: 'Payment status',
      type: 'object',
      properties: {
        order_id: { type: 'string' },
        status: { type: 'string', enum: ['PENDING', 'PAID', 'FAILED'] },
        payment_method: { type: 'string' }
      }
    }
  }
};

export const refundPaymentSchema = {
  description: 'Refund payment for cancelled order',
  tags: ['Payment'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['order_id'],
    properties: {
      order_id: { type: 'string', format: 'uuid', description: 'Order ID' }
    }
  },
  response: {
    200: {
      description: 'Refund processed',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        refund_amount: { type: 'number' }
      }
    }
  }
};
