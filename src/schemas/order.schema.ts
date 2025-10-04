export const createOrderSchema = {
  description: 'Create order from cart',
  tags: ['Orders'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['address_id', 'payment_method'],
    properties: {
      address_id: { type: 'string', format: 'uuid', description: 'Delivery address ID' },
      payment_method: {
        type: 'string',
        enum: ['CREDIT_CARD', 'PAYPAL', 'CASH_ON_DELIVERY'],
        description: 'Payment method'
      }
    }
  },
  response: {
    201: {
      description: 'Order created successfully',
      type: 'object',
      properties: {
        message: { type: 'string' },
        order: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            total_amount: { type: 'number' },
            status: { type: 'string' }
          }
        }
      }
    },
    400: {
      description: 'Bad request',
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    }
  }
};

export const getOrdersSchema = {
  description: 'Get all user orders',
  tags: ['Orders'],
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      description: 'List of orders',
      type: 'object',
      properties: {
        orders: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              total_amount: { type: 'number' },
              status: { type: 'string' },
              payment_method: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' }
            }
          }
        }
      }
    }
  }
};

export const getOrderByIdSchema = {
  description: 'Get order details by ID',
  tags: ['Orders'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Order ID' }
    }
  },
  response: {
    200: {
      description: 'Order details',
      type: 'object',
      properties: {
        order: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            total_amount: { type: 'number' },
            status: { type: 'string' },
            payment_method: { type: 'string' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  product_name: { type: 'string' },
                  quantity: { type: 'integer' },
                  price: { type: 'number' }
                }
              }
            },
            address: { type: 'object' }
          }
        }
      }
    },
    404: {
      description: 'Order not found',
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    }
  }
};

export const cancelOrderSchema = {
  description: 'Cancel order (only PENDING orders)',
  tags: ['Orders'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Order ID' }
    }
  },
  response: {
    200: {
      description: 'Order cancelled',
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    },
    400: {
      description: 'Cannot cancel order',
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    }
  }
};

export const getSellerOrdersSchema = {
  description: 'Get all orders for seller products',
  tags: ['Orders'],
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      description: 'Seller orders',
      type: 'object',
      properties: {
        orders: { type: 'array' }
      }
    }
  }
};

export const updateOrderStatusSchema = {
  description: 'Update order status (seller only)',
  tags: ['Orders'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Order ID' }
    }
  },
  body: {
    type: 'object',
    required: ['status'],
    properties: {
      status: {
        type: 'string',
        enum: ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
        description: 'New order status'
      }
    }
  },
  response: {
    200: {
      description: 'Status updated',
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    }
  }
};
