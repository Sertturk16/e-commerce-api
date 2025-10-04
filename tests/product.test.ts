import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import { prisma } from '../src/config/database';
import { createTestUser, clearDatabase, createTestToken } from './utils/test-helpers';

describe('Product Integration Tests', () => {
  let app: FastifyInstance;
  let seller1Token: string;
  let seller2Token: string;
  let seller1Id: string;
  let seller2Id: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Create sellers and products for testing
    const seller1 = await createTestUser(app, 'SELLER');
    const seller2 = await createTestUser(app, 'SELLER');
    seller1Token = await createTestToken(app, seller1.email, seller1.password);
    seller2Token = await createTestToken(app, seller2.email, seller2.password);

    // Get seller IDs
    const seller1User = await prisma.user.findUnique({
      where: { email: seller1.email }
    });
    const seller2User = await prisma.user.findUnique({
      where: { email: seller2.email }
    });
    seller1Id = seller1User!.id;
    seller2Id = seller2User!.id;

    // Create test products for seller1
    await app.inject({
      method: 'POST',
      url: '/seller/products',
      headers: { authorization: `Bearer ${seller1Token}` },
      payload: {
        name: 'iPhone 14 Pro',
        description: 'Latest iPhone with A16 chip',
        price: 999.99,
        stock: 50,
        category: 'electronics',
        images: ['iphone1.jpg', 'iphone2.jpg']
      }
    });

    await app.inject({
      method: 'POST',
      url: '/seller/products',
      headers: { authorization: `Bearer ${seller1Token}` },
      payload: {
        name: 'Samsung Galaxy S23',
        description: 'Flagship Android phone',
        price: 799.99,
        stock: 30,
        category: 'electronics',
        images: ['samsung1.jpg']
      }
    });

    await app.inject({
      method: 'POST',
      url: '/seller/products',
      headers: { authorization: `Bearer ${seller1Token}` },
      payload: {
        name: 'Nike Air Max',
        description: 'Comfortable running shoes',
        price: 150.00,
        stock: 100,
        category: 'clothing',
        images: ['nike1.jpg']
      }
    });

    // Create test products for seller2
    await app.inject({
      method: 'POST',
      url: '/seller/products',
      headers: { authorization: `Bearer ${seller2Token}` },
      payload: {
        name: 'MacBook Pro',
        description: 'M2 chip laptop',
        price: 1999.99,
        stock: 20,
        category: 'electronics',
        images: ['macbook1.jpg']
      }
    });

    await app.inject({
      method: 'POST',
      url: '/seller/products',
      headers: { authorization: `Bearer ${seller2Token}` },
      payload: {
        name: 'The Great Gatsby',
        description: 'Classic novel by F. Scott Fitzgerald',
        price: 12.99,
        stock: 200,
        category: 'books',
        images: ['gatsby.jpg']
      }
    });
  });

  afterAll(async () => {
    await clearDatabase(prisma);
    await prisma.$disconnect();
    await app.close();
  });

  describe('GET /categories', () => {
    it('should return all categories', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/categories'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.categories).toBeDefined();
      expect(Array.isArray(data.categories)).toBe(true);
      expect(data.categories.length).toBeGreaterThan(0);

      // Should include our test categories
      expect(data.categories).toContain('electronics');
      expect(data.categories).toContain('clothing');
      expect(data.categories).toContain('books');
      expect(data.categories).toContain('home_kitchen');
      expect(data.categories).toContain('sports_outdoors');
    });
  });

  describe('GET /products', () => {
    it('should return all active products', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/products'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.products).toBeDefined();
      expect(Array.isArray(data.products)).toBe(true);
      expect(data.products.length).toBeGreaterThanOrEqual(5);
    });

    it('should filter products by category', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/products?category=electronics'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.products).toBeDefined();
      expect(data.products.length).toBeGreaterThanOrEqual(3);

      // All products should be electronics
      data.products.forEach((product: any) => {
        expect(product.category).toBe('electronics');
      });
    });

    it('should filter products by min_price', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/products?min_price=500'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.products).toBeDefined();

      // All products should have price >= 500
      data.products.forEach((product: any) => {
        expect(product.price).toBeGreaterThanOrEqual(500);
      });

      // Should include iPhone and MacBook, not Nike or Gatsby
      const productNames = data.products.map((p: any) => p.name);
      expect(productNames).toContain('iPhone 14 Pro');
      expect(productNames).toContain('MacBook Pro');
    });

    it('should filter products by max_price', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/products?max_price=200'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.products).toBeDefined();

      // All products should have price <= 200
      data.products.forEach((product: any) => {
        expect(product.price).toBeLessThanOrEqual(200);
      });

      // Should include Nike and Gatsby, not iPhone or MacBook
      const productNames = data.products.map((p: any) => p.name);
      expect(productNames).toContain('Nike Air Max');
      expect(productNames).toContain('The Great Gatsby');
    });

    it('should filter products by price range', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/products?min_price=100&max_price=1000'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.products).toBeDefined();

      // All products should have price between 100 and 1000
      data.products.forEach((product: any) => {
        expect(product.price).toBeGreaterThanOrEqual(100);
        expect(product.price).toBeLessThanOrEqual(1000);
      });

      // Should include iPhone, Samsung, Nike but not MacBook or Gatsby
      const productNames = data.products.map((p: any) => p.name);
      expect(productNames).toContain('iPhone 14 Pro');
      expect(productNames).toContain('Samsung Galaxy S23');
      expect(productNames).toContain('Nike Air Max');
    });

    it('should filter products by search term', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/products?search=iphone'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.products).toBeDefined();
      expect(data.products.length).toBeGreaterThanOrEqual(1);

      // Should find iPhone
      const productNames = data.products.map((p: any) => p.name.toLowerCase());
      expect(productNames.some((name: string) => name.includes('iphone'))).toBe(true);
    });

    it('should filter products by search term in description', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/products?search=flagship'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.products).toBeDefined();

      // Should find Samsung (has "Flagship Android phone" in description)
      const productNames = data.products.map((p: any) => p.name);
      expect(productNames).toContain('Samsung Galaxy S23');
    });

    it('should filter products by seller_id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/products?seller_id=${seller1Id}`
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.products).toBeDefined();
      expect(data.products.length).toBe(3); // iPhone, Samsung, Nike

      // All products should belong to seller1
      data.products.forEach((product: any) => {
        expect(product.seller_id).toBe(seller1Id);
      });

      const productNames = data.products.map((p: any) => p.name);
      expect(productNames).toContain('iPhone 14 Pro');
      expect(productNames).toContain('Samsung Galaxy S23');
      expect(productNames).toContain('Nike Air Max');
    });


    it('should combine multiple filters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/products?category=electronics&min_price=500&max_price=1500'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.products).toBeDefined();

      // All products should be electronics and in price range
      data.products.forEach((product: any) => {
        expect(product.category).toBe('electronics');
        expect(product.price).toBeGreaterThanOrEqual(500);
        expect(product.price).toBeLessThanOrEqual(1500);
      });

      // Should include iPhone and Samsung, not MacBook
      const productNames = data.products.map((p: any) => p.name);
      expect(productNames).toContain('iPhone 14 Pro');
      expect(productNames).toContain('Samsung Galaxy S23');
    });

    it('should return empty array when no products match filters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/products?category=nonexistent&min_price=99999'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.products).toBeDefined();
      expect(data.products.length).toBe(0);
    });
  });

  describe('GET /products/:id', () => {
    it('should return a product by id', async () => {
      // First get a product
      const listResponse = await app.inject({
        method: 'GET',
        url: '/products?limit=1'
      });

      const listData = JSON.parse(listResponse.body);
      const productId = listData.products[0].id;

      // Get product by ID
      const response = await app.inject({
        method: 'GET',
        url: `/products/${productId}`
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.product).toBeDefined();
      expect(data.product.id).toBe(productId);
      expect(data.product.name).toBeDefined();
      expect(data.product.price).toBeDefined();
      expect(data.product.category).toBeDefined();
      expect(data.product.seller_id).toBeDefined();
    });

    it('should return product with seller information', async () => {
      // Get a product
      const listResponse = await app.inject({
        method: 'GET',
        url: '/products?limit=1'
      });

      const listData = JSON.parse(listResponse.body);
      const productId = listData.products[0].id;

      // Get product by ID
      const response = await app.inject({
        method: 'GET',
        url: `/products/${productId}`
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.product.seller).toBeDefined();
      expect(data.product.seller.name).toBeDefined();
      expect(data.product.seller.email).toBeDefined();
    });

    it('should return 404 for non-existent product', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/products/00000000-0000-0000-0000-000000000000'
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.body);
      expect(data.error).toBeDefined();
    });

    it('should return 404 for invalid product id format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/products/invalid-uuid'
      });

      expect(response.statusCode).toBe(404);
    });

    it('should include product images', async () => {
      // Get a product with images
      const listResponse = await app.inject({
        method: 'GET',
        url: '/products?search=iphone'
      });

      const listData = JSON.parse(listResponse.body);
      const productId = listData.products[0].id;

      const response = await app.inject({
        method: 'GET',
        url: `/products/${productId}`
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.product.images).toBeDefined();
      // Images are stored as JSON string
      if (data.product.images) {
        const images = typeof data.product.images === 'string' ? JSON.parse(data.product.images) : data.product.images;
        expect(Array.isArray(images)).toBe(true);
      }
    });

    it('should show stock availability', async () => {
      // Get a product
      const listResponse = await app.inject({
        method: 'GET',
        url: '/products?limit=1'
      });

      const listData = JSON.parse(listResponse.body);
      const productId = listData.products[0].id;

      const response = await app.inject({
        method: 'GET',
        url: `/products/${productId}`
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.product.stock).toBeDefined();
      expect(typeof data.product.stock).toBe('number');
      expect(data.product.stock).toBeGreaterThanOrEqual(0);
    });
  });
});
