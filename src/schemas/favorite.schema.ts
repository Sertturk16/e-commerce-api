export const addFavoriteSchema = {
  description: 'Add product to favorites',
  tags: ['Favorites'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['productId'],
    properties: {
      productId: { type: 'string', format: 'uuid', description: 'Product ID' }
    }
  },
  response: {
    201: {
      description: 'Product added to favorites',
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    },
    400: {
      description: 'Already in favorites',
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    }
  }
};

export const getFavoritesSchema = {
  description: 'Get all favorite products',
  tags: ['Favorites'],
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      description: 'List of favorite products',
      type: 'object',
      properties: {
        favorites: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              product: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  name: { type: 'string' },
                  price: { type: 'number' },
                  stock: { type: 'integer' },
                  images: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }
};

export const removeFavoriteSchema = {
  description: 'Remove product from favorites',
  tags: ['Favorites'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['productId'],
    properties: {
      productId: { type: 'string', format: 'uuid', description: 'Product ID' }
    }
  },
  response: {
    200: {
      description: 'Product removed from favorites',
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    }
  }
};
