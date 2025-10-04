import { FastifyInstance } from 'fastify';
import * as sellerController from '../controllers/seller.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireSeller } from '../middleware/seller.middleware';
import { createProductSchema, updateProductSchema, updateStockSchema, getSellerProductsSchema } from '../schemas/seller.schema';
import { getSellerOrdersSchema, updateOrderStatusSchema, cancelOrderSchema } from '../schemas/order.schema';

export async function sellerRoutes(app: FastifyInstance) {
  // Create Product
  app.post('/seller/products', {
    schema: createProductSchema,
    preHandler: [authenticate, requireSeller]
  },
    sellerController.createProduct
  );

  // Update Product
  app.put('/seller/products/:id', {
    schema: updateProductSchema,
    preHandler: [authenticate, requireSeller]
  },
    sellerController.updateProduct
  );

  // Get Seller Products
  app.get('/seller/products', {
    schema: getSellerProductsSchema,
    preHandler: [authenticate, requireSeller]
  },
    sellerController.getSellerProducts
  );

  // Update Stock
  app.put('/seller/products/:id/stock', {
    schema: updateStockSchema,
    preHandler: [authenticate, requireSeller]
  },
    sellerController.updateStock
  );

  // Get Seller Orders
  app.get('/seller/orders', {
    schema: getSellerOrdersSchema,
    preHandler: [authenticate, requireSeller]
  },
    sellerController.getSellerOrders
  );

  // Update Order Item Status
  app.put('/seller/orders/:id/status', {
    schema: updateOrderStatusSchema,
    preHandler: [authenticate, requireSeller]
  },
    sellerController.updateOrderItemStatus
  );

  // Cancel Sub-Order (Partial Cancel)
  app.put('/seller/orders/:id/cancel', {
    schema: cancelOrderSchema,
    preHandler: [authenticate, requireSeller]
  },
    sellerController.cancelSubOrder
  );
}
