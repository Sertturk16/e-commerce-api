import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as productController from '../controllers/product.controller';
import { getCategoriesSchema, getProductsSchema, getProductByIdSchema } from '../schemas/product.schema';

export async function productRoutes(app: FastifyInstance) {
  // Get all categories
  app.get('/categories', {
    schema: getCategoriesSchema
  }, async (request: FastifyRequest, reply: FastifyReply) => productController.getCategories(request, reply));

  // Get all products with filters
  app.get('/products', {
    schema: getProductsSchema
  },
    async (request: FastifyRequest<{
      Querystring: {
        category?: string;
        min_price?: string;
        max_price?: string;
        search?: string;
        seller_id?: string;
      };
    }>, reply: FastifyReply) => productController.getProducts(request, reply)
  );

  // Get single product by ID
  app.get('/products/:id', {
    schema: getProductByIdSchema
  },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) =>
      productController.getProductById(request, reply)
  );
}
