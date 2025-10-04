export const createProductSchema = {
  description: 'Create a new product (seller only)',
  tags: ['Seller'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['name', 'price', 'stock', 'category'],
    properties: {
      name: { type: 'string', description: 'Product name' },
      description: { type: 'string', description: 'Product description' },
      price: { type: 'number', minimum: 0, description: 'Product price' },
      stock: { type: 'integer', minimum: 0, description: 'Stock quantity' },
      category: { type: 'string', description: 'Product category' },
      images: {
        type: 'array',
        items: { type: 'string' },
        description: 'Product image URLs'
      },
      variants: { type: 'string', description: 'Product variants (JSON)' }
    }
  },
  response: {
    201: {
      description: 'Product created',
      type: 'object',
      properties: {
        message: { type: 'string' },
        product: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            price: { type: 'number' },
            stock: { type: 'integer' }
          }
        }
      }
    }
  }
};

export const updateProductSchema = {
  description: 'Update product details (seller only)',
  tags: ['Seller'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Product ID' }
    }
  },
  body: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      price: { type: 'number', minimum: 0 },
      category: { type: 'string' },
      images: { type: 'array', items: { type: 'string' } }
    }
  },
  response: {
    200: {
      description: 'Product updated',
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    }
  }
};

export const updateStockSchema = {
  description: 'Update product stock (seller only)',
  tags: ['Seller'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Product ID' }
    }
  },
  body: {
    type: 'object',
    required: ['stock'],
    properties: {
      stock: { type: 'integer', minimum: 0, description: 'New stock quantity' }
    }
  },
  response: {
    200: {
      description: 'Stock updated',
      type: 'object',
      properties: {
        message: { type: 'string' },
        product: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            stock: { type: 'integer' }
          }
        }
      }
    }
  }
};

export const deleteProductSchema = {
  description: 'Delete product (seller only)',
  tags: ['Seller'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Product ID' }
    }
  },
  response: {
    200: {
      description: 'Product deleted',
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    }
  }
};

export const getSellerProductsSchema = {
  description: 'Get all seller products',
  tags: ['Seller'],
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      description: 'List of seller products',
      type: 'object',
      properties: {
        products: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              price: { type: 'number' },
              stock: { type: 'integer' },
              category: { type: 'string' }
            }
          }
        }
      }
    }
  }
};
