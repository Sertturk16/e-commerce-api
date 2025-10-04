import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { prisma } from '../src/config/database';
import { createTestUser, clearDatabase } from './utils/test-helpers';

describe('Seller Integration Tests', () => {
  let app: FastifyInstance;
  let sellerToken: string;
  let sellerId: string;
  let customerToken: string;
  let productId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Create seller
    const seller = await createTestUser(app, 'SELLER');
    sellerToken = seller.token!;
    sellerId = (await prisma.user.findUnique({ where: { email: seller.email } }))!.id;

    // Create seller profile
    await app.inject({
      method: 'POST',
      url: '/seller',
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: {
        name: 'Test Seller Store',
        description: 'Test store description'
      }
    });

    // Create customer
    const customer = await createTestUser(app, 'CUSTOMER');
    customerToken = customer.token!;

    console.log('🔧 Test setup completed');
  });

  afterAll(async () => {
    await clearDatabase(prisma);
    await prisma.$disconnect();
    await app.close();
    console.log('🧹 Test cleanup completed');
  });

  describe('POST /seller/products', () => {
    it('should create a product as seller', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: {
          name: 'Test Product',
          description: 'Test description',
          price: 99.99,
          stock: 100,
          category: 'electronics',
          images: ['image1.jpg', 'image2.jpg']
        }
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      expect(data.product).toBeDefined();
      expect(data.product.name).toBe('Test Product');
      expect(data.product.price).toBe(99.99);
      expect(data.product.stock).toBe(100);
      expect(data.product.category).toBe('electronics');
      expect(data.product.seller_id).toBe(sellerId);

      productId = data.product.id;
    });

    it('should fail with invalid price', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: {
          name: 'Invalid Price Product',
          price: -10,
          stock: 50,
          category: 'electronics',
          images: []
        }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBeDefined();
    });

    it('should fail with zero price', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: {
          name: 'Zero Price Product',
          price: 0,
          stock: 50,
          category: 'electronics',
          images: []
        }
      });

      expect(response.statusCode).toBe(400);
    });

    it('should fail with negative stock', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: {
          name: 'Negative Stock Product',
          price: 100,
          stock: -5,
          category: 'electronics',
          images: []
        }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBeDefined();
    });

    it('should allow zero stock', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: {
          name: 'Zero Stock Product',
          price: 100,
          stock: 0,
          category: 'electronics',
          images: []
        }
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      expect(data.product.stock).toBe(0);
    });

    it('should fail with invalid category', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: {
          name: 'Invalid Category Product',
          price: 100,
          stock: 50,
          category: 'invalid_category',
          images: []
        }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toContain('Invalid category');
    });

    it('should fail as customer', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: {
          name: 'Customer Product',
          price: 100,
          stock: 50,
          category: 'electronics',
          images: []
        }
      });

      expect(response.statusCode).toBe(403);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/seller/products',
        payload: {
          name: 'No Auth Product',
          price: 100,
          stock: 50,
          category: 'electronics',
          images: []
        }
      });

      expect(response.statusCode).toBe(401);
    });

    it('should fail with missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: {
          name: 'Incomplete Product',
          price: 100
          // Missing stock and category
        }
      });

      expect(response.statusCode).toBe(400);
    });

    it('should fail with name too short', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: {
          name: 'AB', // Less than 3 characters
          price: 100,
          stock: 50,
          category: 'electronics',
          images: []
        }
      });

      expect(response.statusCode).toBe(400);
    });

    it('should create product with optional fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: {
          name: 'Product with Optional Fields',
          price: 100,
          stock: 50,
          category: 'electronics',
          description: 'Detailed description',
          images: ['img1.jpg'],
          variants: [
            { name: 'Color', value: 'Red' },
            { name: 'Size', value: 'Large' }
          ]
        }
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      expect(data.product.description).toBe('Detailed description');
    });
  });

  describe('PUT /seller/products/:id', () => {
    let updateTestProductId: string;

    beforeAll(async () => {
      // Create product for update tests
      const response = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: {
          name: 'Update Test Product',
          price: 50,
          stock: 20,
          category: 'electronics',
          images: []
        }
      });
      updateTestProductId = JSON.parse(response.body).product.id;
    });

    it('should update product successfully', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/seller/products/${updateTestProductId}`,
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: {
          name: 'Updated Product Name',
          price: 75,
          stock: 30
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.product.name).toBe('Updated Product Name');
      expect(data.product.price).toBe(75);
      expect(data.product.stock).toBe(30);
    });

    it('should fail when updating another seller product', async () => {
      const anotherSeller = await createTestUser(app, 'SELLER');

      const response = await app.inject({
        method: 'PUT',
        url: `/seller/products/${updateTestProductId}`,
        headers: { authorization: `Bearer ${anotherSeller.token}` },
        payload: {
          name: 'Hacked Product'
        }
      });

      expect(response.statusCode).toBe(403);
      const data = JSON.parse(response.body);
      expect(data.error).toContain('Unauthorized');
    });

    it('should fail when product not found', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/seller/products/00000000-0000-0000-0000-000000000000`,
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: {
          name: 'Updated Name'
        }
      });

      expect(response.statusCode).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/seller/products/${updateTestProductId}`,
        payload: {
          name: 'No Auth Update'
        }
      });

      expect(response.statusCode).toBe(401);
    });

    it('should fail as customer', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/seller/products/${updateTestProductId}`,
        headers: { authorization: `Bearer ${customerToken}` },
        payload: {
          name: 'Customer Update'
        }
      });

      expect(response.statusCode).toBe(403);
    });

    it('should update only provided fields', async () => {
      // Get current product state
      const beforeUpdate = await prisma.product.findUnique({
        where: { id: updateTestProductId }
      });

      // Update only price
      const response = await app.inject({
        method: 'PUT',
        url: `/seller/products/${updateTestProductId}`,
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: {
          price: 99
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.product.price).toBe(99);
      expect(data.product.name).toBe(beforeUpdate!.name); // Name unchanged
    });

    it('should fail with invalid price in update', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/seller/products/${updateTestProductId}`,
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: {
          price: -50
        }
      });

      expect(response.statusCode).toBe(400);
    });

    it('should fail with invalid category in update', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/seller/products/${updateTestProductId}`,
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: {
          category: 'invalid_category'
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /seller/products', () => {
    beforeAll(async () => {
      // Create multiple products for this seller
      for (let i = 1; i <= 3; i++) {
        await app.inject({
          method: 'POST',
          url: '/seller/products',
          headers: { authorization: `Bearer ${sellerToken}` },
          payload: {
            name: `Product ${i}`,
            price: i * 10,
            stock: i * 5,
            category: 'electronics',
            images: []
          }
        });
      }
    });

    it('should get all seller products', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/seller/products',
        headers: { authorization: `Bearer ${sellerToken}` }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.products).toBeDefined();
      expect(Array.isArray(data.products)).toBe(true);
      expect(data.products.length).toBeGreaterThanOrEqual(3);

      // All products should belong to this seller
      data.products.forEach((product: any) => {
        expect(product.seller_id).toBe(sellerId);
      });
    });

    it('should fail as customer', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/seller/products',
        headers: { authorization: `Bearer ${customerToken}` }
      });

      expect(response.statusCode).toBe(403);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/seller/products'
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return empty array for new seller with no products', async () => {
      const newSeller = await createTestUser(app, 'SELLER');

      // Create seller profile
      await app.inject({
        method: 'POST',
        url: '/seller',
        headers: { authorization: `Bearer ${newSeller.token}` },
        payload: {
          name: 'New Seller',
          description: 'New'
        }
      });

      const response = await app.inject({
        method: 'GET',
        url: '/seller/products',
        headers: { authorization: `Bearer ${newSeller.token}` }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.products).toEqual([]);
    });
  });

  describe('PUT /seller/products/:id/stock', () => {
    let stockTestProductId: string;

    beforeAll(async () => {
      // Create product for stock update tests
      const response = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: {
          name: 'Stock Test Product',
          price: 100,
          stock: 50,
          category: 'electronics',
          images: []
        }
      });
      stockTestProductId = JSON.parse(response.body).product.id;
    });

    it('should update stock successfully', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/seller/products/${stockTestProductId}/stock`,
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: {
          stock: 100
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.product).toBeDefined();
      expect(data.product.stock).toBe(100);
    });

    it('should fail with negative stock', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/seller/products/${stockTestProductId}/stock`,
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: {
          stock: -10
        }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBeDefined();
    });

    it('should allow zero stock', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/seller/products/${stockTestProductId}/stock`,
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: {
          stock: 0
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.product.stock).toBe(0);
    });

    it('should fail when updating another seller product stock', async () => {
      const anotherSeller = await createTestUser(app, 'SELLER');

      const response = await app.inject({
        method: 'PUT',
        url: `/seller/products/${stockTestProductId}/stock`,
        headers: { authorization: `Bearer ${anotherSeller.token}` },
        payload: {
          stock: 200
        }
      });

      expect(response.statusCode).toBe(403);
    });

    it('should fail when product not found', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/seller/products/00000000-0000-0000-0000-000000000000/stock`,
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: {
          stock: 50
        }
      });

      expect(response.statusCode).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/seller/products/${stockTestProductId}/stock`,
        payload: {
          stock: 75
        }
      });

      expect(response.statusCode).toBe(401);
    });

    it('should fail as customer', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/seller/products/${stockTestProductId}/stock`,
        headers: { authorization: `Bearer ${customerToken}` },
        payload: {
          stock: 150
        }
      });

      expect(response.statusCode).toBe(403);
    });

    it('should update stock to large number', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/seller/products/${stockTestProductId}/stock`,
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: {
          stock: 999999
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.product.stock).toBe(999999);
    });
  });
});
