export const getCategoriesSchema = {
  description: 'Get all product categories',
  tags: ['Products'],
  response: {
    200: {
      description: 'List of categories',
      type: 'object',
      properties: {
        categories: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    }
  }
};

export const getProductsSchema = {
  description: 'Get all active products with optional filters',
  tags: ['Products'],
  querystring: {
    type: 'object',
    properties: {
      category: { type: 'string', description: 'Filter by category' },
      min_price: { type: 'number', description: 'Minimum price filter' },
      max_price: { type: 'number', description: 'Maximum price filter' },
      search: { type: 'string', description: 'Search in product name/description' },
      seller_id: { type: 'string', format: 'uuid', description: 'Filter by seller ID' }
    }
  },
  response: {
    200: {
      description: 'List of products',
      type: 'object',
      properties: {
        products: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              description: { type: 'string' },
              price: { type: 'number' },
              stock: { type: 'integer' },
              category: { type: 'string' },
              images: { type: 'string' },
              seller_id: { type: 'string', format: 'uuid' },
              created_at: { type: 'string', format: 'date-time' }
            }
          }
        }
      }
    }
  }
};

export const getProductByIdSchema = {
  description: 'Get product details by ID',
  tags: ['Products'],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Product ID' }
    }
  },
  response: {
    200: {
      description: 'Product details',
      type: 'object',
      properties: {
        product: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            price: { type: 'number' },
            stock: { type: 'integer' },
            category: { type: 'string' },
            images: { type: 'string' },
            seller_id: { type: 'string', format: 'uuid' },
            seller: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                email: { type: 'string' }
              }
            },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        }
      }
    },
    404: {
      description: 'Product not found',
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    }
  }
};
