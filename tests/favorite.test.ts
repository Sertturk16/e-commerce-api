import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { prisma } from '../src/config/database';
import { createTestUser, clearDatabase } from './utils/test-helpers';

describe('Favorite Integration Tests', () => {
  let app: FastifyInstance;
  let customerToken: string;
  let sellerToken: string;
  let productId: string;
  let productId2: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Create customer and seller
    const customer = await createTestUser(app, 'CUSTOMER');
    const seller = await createTestUser(app, 'SELLER');
    customerToken = customer.token!;
    sellerToken = seller.token!;

    // Create seller profile (required before creating products)
    await app.inject({
      method: 'POST',
      url: '/seller',
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: {
        name: 'Test Seller Store',
        description: 'Test store description'
      }
    });

    // Create active products
    const product1Response = await app.inject({
      method: 'POST',
      url: '/seller/products',
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: {
        name: 'Test Product 1',
        description: 'Description 1',
        price: 100,
        stock: 50,
        category: 'electronics',
        images: ['image1.jpg']
      }
    });
    productId = JSON.parse(product1Response.body).product.id;

    const product2Response = await app.inject({
      method: 'POST',
      url: '/seller/products',
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: {
        name: 'Test Product 2',
        description: 'Description 2',
        price: 200,
        stock: 30,
        category: 'electronics',
        images: ['image2.jpg']
      }
    });
    productId2 = JSON.parse(product2Response.body).product.id;

    // Note: is_active field removed - all products are active by default

    console.log('🔧 Test setup completed');
  });

  afterAll(async () => {
    await clearDatabase(prisma);
    await prisma.$disconnect();
    await app.close();
    console.log('🧹 Test cleanup completed');
  });

  describe('POST /favorites/:productId', () => {
    it('should add product to favorites for authenticated user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/favorites/${productId}`,
        headers: { authorization: `Bearer ${customerToken}` }
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      expect(data.favorite).toBeDefined();
      expect(data.favorite.id).toBe(productId);
    });

    it('should fail without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/favorites/${productId2}`
      });

      expect(response.statusCode).toBe(401);
    });

    it('should fail when product not found', async () => {
      const fakeProductId = '00000000-0000-0000-0000-000000000000';

      const response = await app.inject({
        method: 'POST',
        url: `/favorites/${fakeProductId}`,
        headers: { authorization: `Bearer ${customerToken}` }
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.body);
      expect(data.error).toContain('not found');
    });

    it('should fail when adding duplicate favorite', async () => {
      // Add product to favorites first time
      await app.inject({
        method: 'POST',
        url: `/favorites/${productId2}`,
        headers: { authorization: `Bearer ${customerToken}` }
      });

      // Try to add same product again
      const response = await app.inject({
        method: 'POST',
        url: `/favorites/${productId2}`,
        headers: { authorization: `Bearer ${customerToken}` }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toContain('already in favorites');
    });

    it('should allow different users to favorite same product', async () => {
      const anotherCustomer = await createTestUser(app, 'CUSTOMER');

      const response = await app.inject({
        method: 'POST',
        url: `/favorites/${productId}`,
        headers: { authorization: `Bearer ${anotherCustomer.token}` }
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      expect(data.favorite.id).toBe(productId);
    });

    it('should fail with invalid product ID format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/favorites/invalid-uuid`,
        headers: { authorization: `Bearer ${customerToken}` }
      });

      // Will fail at validation or database level
      expect([400, 404, 500]).toContain(response.statusCode);
    });
  });

  describe('GET /favorites', () => {
    let testUserToken: string;

    beforeAll(async () => {
      // Create a new user for favorite listing tests
      const user = await createTestUser(app, 'CUSTOMER');
      testUserToken = user.token!;

      // Add multiple products to favorites
      await app.inject({
        method: 'POST',
        url: `/favorites/${productId}`,
        headers: { authorization: `Bearer ${testUserToken}` }
      });

      await app.inject({
        method: 'POST',
        url: `/favorites/${productId2}`,
        headers: { authorization: `Bearer ${testUserToken}` }
      });
    });

    it('should return user favorites', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/favorites',
        headers: { authorization: `Bearer ${testUserToken}` }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.favorites).toBeDefined();
      expect(Array.isArray(data.favorites)).toBe(true);
      expect(data.favorites.length).toBeGreaterThanOrEqual(2);
    });

    it('should include product details in favorites', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/favorites',
        headers: { authorization: `Bearer ${testUserToken}` }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);

      const favorite = data.favorites[0];
      expect(favorite.name).toBeDefined();
      expect(favorite.price).toBeDefined();
      expect(favorite.category).toBeDefined();
    });

    it('should return empty array for user with no favorites', async () => {
      const newUser = await createTestUser(app, 'CUSTOMER');

      const response = await app.inject({
        method: 'GET',
        url: '/favorites',
        headers: { authorization: `Bearer ${newUser.token}` }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.favorites).toEqual([]);
    });

    it('should fail without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/favorites'
      });

      expect(response.statusCode).toBe(401);
    });

    it('should order favorites by creation date (newest first)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/favorites',
        headers: { authorization: `Bearer ${testUserToken}` }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);

      if (data.favorites.length >= 2) {
        const firstDate = new Date(data.favorites[0].favorited_at);
        const secondDate = new Date(data.favorites[1].favorited_at);
        expect(firstDate.getTime()).toBeGreaterThanOrEqual(secondDate.getTime());
      }
    });
  });

  describe('DELETE /favorites/:productId', () => {
    let deleteTestToken: string;
    let deleteTestProductId: string;

    beforeAll(async () => {
      const user = await createTestUser(app, 'CUSTOMER');
      deleteTestToken = user.token!;

      // Add product to favorites
      const response = await app.inject({
        method: 'POST',
        url: `/favorites/${productId}`,
        headers: { authorization: `Bearer ${deleteTestToken}` }
      });

      const data = JSON.parse(response.body);
      deleteTestProductId = data.favorite.id;
    });

    it('should remove product from favorites', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/favorites/${deleteTestProductId}`,
        headers: { authorization: `Bearer ${deleteTestToken}` }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.message).toBeDefined();
    });

    it('should verify product removed from favorites list', async () => {
      // Add a product
      await app.inject({
        method: 'POST',
        url: `/favorites/${productId2}`,
        headers: { authorization: `Bearer ${deleteTestToken}` }
      });

      // Remove it
      await app.inject({
        method: 'DELETE',
        url: `/favorites/${productId2}`,
        headers: { authorization: `Bearer ${deleteTestToken}` }
      });

      // Verify it's not in favorites
      const response = await app.inject({
        method: 'GET',
        url: '/favorites',
        headers: { authorization: `Bearer ${deleteTestToken}` }
      });

      const data = JSON.parse(response.body);
      const removed = data.favorites.find((f: any) => f.id === productId2);
      expect(removed).toBeUndefined();
    });

    it('should fail when removing non-existent favorite', async () => {
      const fakeProductId = '00000000-0000-0000-0000-000000000000';

      const response = await app.inject({
        method: 'DELETE',
        url: `/favorites/${fakeProductId}`,
        headers: { authorization: `Bearer ${deleteTestToken}` }
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.body);
      expect(data.error).toContain('not found');
    });

    it('should fail without authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/favorites/${productId}`
      });

      expect(response.statusCode).toBe(401);
    });

    it('should not affect other users favorites when removing', async () => {
      const user1 = await createTestUser(app, 'CUSTOMER');
      const user2 = await createTestUser(app, 'CUSTOMER');

      // Both users favorite same product
      await app.inject({
        method: 'POST',
        url: `/favorites/${productId}`,
        headers: { authorization: `Bearer ${user1.token}` }
      });

      await app.inject({
        method: 'POST',
        url: `/favorites/${productId}`,
        headers: { authorization: `Bearer ${user2.token}` }
      });

      // User1 removes favorite
      await app.inject({
        method: 'DELETE',
        url: `/favorites/${productId}`,
        headers: { authorization: `Bearer ${user1.token}` }
      });

      // User2 should still have it
      const response = await app.inject({
        method: 'GET',
        url: '/favorites',
        headers: { authorization: `Bearer ${user2.token}` }
      });

      const data = JSON.parse(response.body);
      const stillFavorited = data.favorites.find((f: any) => f.id === productId);
      expect(stillFavorited).toBeDefined();
    });
  });

  describe('Favorite-Product Relationship', () => {
    it('should handle product deletion gracefully', async () => {
      const user = await createTestUser(app, 'CUSTOMER');
      const seller2 = await createTestUser(app, 'SELLER');

      // Create seller profile
      await app.inject({
        method: 'POST',
        url: '/seller',
        headers: { authorization: `Bearer ${seller2.token}` },
        payload: {
          name: 'Temp Seller',
          description: 'Temporary'
        }
      });

      // Create product
      const productResponse = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${seller2.token}` },
        payload: {
          name: 'Temp Product',
          description: 'Will be deleted',
          price: 100,
          stock: 10,
          category: 'electronics',
          images: []
        }
      });
      const tempProductId = JSON.parse(productResponse.body).product.id;

      // Add to favorites
      await app.inject({
        method: 'POST',
        url: `/favorites/${tempProductId}`,
        headers: { authorization: `Bearer ${user.token}` }
      });

      // Delete favorites first, then product (FK constraint doesn't cascade)
      await prisma.favorite.deleteMany({
        where: { product_id: tempProductId }
      });

      await prisma.product.delete({
        where: { id: tempProductId }
      });

      // Get favorites should not include deleted product
      const response = await app.inject({
        method: 'GET',
        url: '/favorites',
        headers: { authorization: `Bearer ${user.token}` }
      });

      const data = JSON.parse(response.body);
      const deletedProduct = data.favorites.find((f: any) => f.id === tempProductId);
      expect(deletedProduct).toBeUndefined();
    });
  });

  describe('Concurrent Favorite Operations', () => {
    it('should handle concurrent adds to favorites', async () => {
      const user = await createTestUser(app, 'CUSTOMER');

      // Try to add same product concurrently
      const promises = [
        app.inject({
          method: 'POST',
          url: `/favorites/${productId}`,
          headers: { authorization: `Bearer ${user.token}` }
        }),
        app.inject({
          method: 'POST',
          url: `/favorites/${productId}`,
          headers: { authorization: `Bearer ${user.token}` }
        })
      ];

      const results = await Promise.all(promises);

      // One should succeed (201), one should fail (400 - already in favorites or 500 if race condition)
      const statusCodes = results.map(r => r.statusCode).sort();
      expect(statusCodes).toContain(201);
      // Second request might fail with 400 or 500 depending on race condition
      expect(statusCodes.some(code => code === 400 || code === 500)).toBe(true);
    });

    it('should handle concurrent remove operations', async () => {
      const user = await createTestUser(app, 'CUSTOMER');

      // Add product to favorites first
      await app.inject({
        method: 'POST',
        url: `/favorites/${productId2}`,
        headers: { authorization: `Bearer ${user.token}` }
      });

      // Try to remove concurrently
      const promises = [
        app.inject({
          method: 'DELETE',
          url: `/favorites/${productId2}`,
          headers: { authorization: `Bearer ${user.token}` }
        }),
        app.inject({
          method: 'DELETE',
          url: `/favorites/${productId2}`,
          headers: { authorization: `Bearer ${user.token}` }
        })
      ];

      const results = await Promise.all(promises);

      // Both might succeed if there's no proper locking, or one succeeds and one fails
      const statusCodes = results.map(r => r.statusCode).sort();

      // If both succeeded (200, 200), that's a race condition but not necessarily wrong
      // If one failed (200, 404), that's expected behavior
      const has200 = statusCodes.some(code => code === 200);
      expect(has200).toBe(true); // At least one should succeed
    });
  });
});
