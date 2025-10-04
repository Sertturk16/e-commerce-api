import { FastifyInstance } from 'fastify';
import * as favoriteController from '../controllers/favorite.controller';
import { authenticate } from '../middleware/auth.middleware';
import { addFavoriteSchema, getFavoritesSchema, removeFavoriteSchema } from '../schemas/favorite.schema';

export async function favoriteRoutes(app: FastifyInstance) {
  // Add product to favorites
  app.post('/favorites/:productId', {
    schema: addFavoriteSchema,
    preHandler: authenticate
  },
    favoriteController.addFavorite
  );

  // Remove product from favorites
  app.delete('/favorites/:productId', {
    schema: removeFavoriteSchema,
    preHandler: authenticate
  },
    favoriteController.removeFavorite
  );

  // Get user's favorites
  app.get('/favorites', {
    schema: getFavoritesSchema,
    preHandler: authenticate
  },
    favoriteController.getUserFavorites
  );
}
