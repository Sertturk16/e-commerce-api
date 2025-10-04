export const addToCartSchema = {
  description: 'Add product to cart',
  tags: ['Cart'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['product_id', 'quantity'],
    properties: {
      product_id: { type: 'string', format: 'uuid', description: 'Product ID' },
      quantity: { type: 'integer', minimum: 1, description: 'Quantity to add' }
    }
  },
  response: {
    201: {
      description: 'Product added to cart',
      type: 'object',
      properties: {
        message: { type: 'string' }
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

export const getCartSchema = {
  description: 'Get user cart with all items',
  tags: ['Cart'],
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      description: 'Cart details',
      type: 'object',
      properties: {
        cart: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            sellers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  seller_id: { type: 'string', format: 'uuid' },
                  seller_name: { type: 'string' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        product_id: { type: 'string', format: 'uuid' },
                        product_name: { type: 'string' },
                        price: { type: 'number' },
                        quantity: { type: 'integer' },
                        stock: { type: 'integer' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

export const updateCartSchema = {
  description: 'Update cart item quantity',
  tags: ['Cart'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['product_id', 'quantity'],
    properties: {
      product_id: { type: 'string', format: 'uuid', description: 'Product ID' },
      quantity: { type: 'integer', minimum: 1, description: 'New quantity' }
    }
  },
  response: {
    200: {
      description: 'Cart updated',
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    }
  }
};

export const removeFromCartSchema = {
  description: 'Remove product from cart',
  tags: ['Cart'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['product_id'],
    properties: {
      product_id: { type: 'string', format: 'uuid', description: 'Product ID' }
    }
  },
  response: {
    200: {
      description: 'Product removed from cart',
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    }
  }
};
