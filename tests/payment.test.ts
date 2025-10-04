import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import { prisma } from '../src/config/database';
import { faker } from '@faker-js/faker';
import { createTestUser, clearDatabase } from './utils/test-helpers';

describe('Payment Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await clearDatabase(prisma);
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /payments/process', () => {
    it('should process payment successfully with valid credit card', async () => {
      const user = await createTestUser(app, 'CUSTOMER');
      const seller = await createTestUser(app, 'SELLER');

      // Create product
      const productResponse = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${seller.token}` },
        payload: {
          name: 'Test Product',
          price: 99.99,
          stock: 100,
          category: 'electronics',
          images: ['image1.jpg']
        }
      });

      const productData = JSON.parse(productResponse.body);
      const productId = productData.product.id;

      // Add to cart
      await app.inject({
        method: 'POST',
        url: '/cart/add',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          product_id: productId,
          quantity: 2
        }
      });

      // Get user's address
      const addressesResponse = await app.inject({
        method: 'GET',
        url: '/addresses',
        headers: { authorization: `Bearer ${user.token}` }
      });

      const addressesData = JSON.parse(addressesResponse.body);
      const addressId = addressesData.addresses[0].id;

      // Create order
      const orderResponse = await app.inject({
        method: 'POST',
        url: '/orders',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          address_id: addressId,
          payment_method: 'CREDIT_CARD'
        }
      });

      const orderData = JSON.parse(orderResponse.body);
      const orderId = orderData.order.id;

      // Process payment
      const paymentResponse = await app.inject({
        method: 'POST',
        url: '/payments/process',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          order_id: orderId,
          payment_method: 'CREDIT_CARD',
          card_number: '4111111111111111', // Test success card
          card_holder: 'John Doe',
          cvv: '123',
          expiry_date: '12/25'
        }
      });

      expect(paymentResponse.statusCode).toBe(200);
      const paymentData = JSON.parse(paymentResponse.body);
      expect(paymentData.success).toBe(true);
      expect(paymentData.transaction_id).toBeDefined();
      expect(paymentData.status).toBe('PAID');
      expect(paymentData.paid_at).toBeDefined();

      // Verify order payment status updated
      const updatedOrder = await prisma.order.findUnique({
        where: { id: orderId }
      });
      expect(updatedOrder!.payment_status).toBe('PAID');
    });

    it('should fail payment with invalid credit card', async () => {
      const user = await createTestUser(app, 'CUSTOMER');
      const seller = await createTestUser(app, 'SELLER');

      // Create product
      const productResponse = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${seller.token}` },
        payload: {
          name: 'Test Product',
          price: 99.99,
          stock: 100,
          category: 'electronics',
          images: ['image1.jpg']
        }
      });

      const productData = JSON.parse(productResponse.body);
      const productId = productData.product.id;

      // Add to cart
      await app.inject({
        method: 'POST',
        url: '/cart/add',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          product_id: productId,
          quantity: 1
        }
      });

      // Get user's address
      const addressesResponse = await app.inject({
        method: 'GET',
        url: '/addresses',
        headers: { authorization: `Bearer ${user.token}` }
      });

      const addressesData = JSON.parse(addressesResponse.body);
      const addressId = addressesData.addresses[0].id;

      // Create order
      const orderResponse = await app.inject({
        method: 'POST',
        url: '/orders',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          address_id: addressId,
          payment_method: 'CREDIT_CARD'
        }
      });

      const orderData = JSON.parse(orderResponse.body);
      const orderId = orderData.order.id;

      // Process payment with failing card
      const paymentResponse = await app.inject({
        method: 'POST',
        url: '/payments/process',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          order_id: orderId,
          payment_method: 'CREDIT_CARD',
          card_number: '4000000000000002', // Test fail card
          card_holder: 'John Doe',
          cvv: '123',
          expiry_date: '12/25'
        }
      });

      expect(paymentResponse.statusCode).toBe(200);
      const paymentData = JSON.parse(paymentResponse.body);
      expect(paymentData.success).toBe(false);
      expect(paymentData.status).toBe('FAILED');

      // Verify order payment status remains PENDING
      const updatedOrder = await prisma.order.findUnique({
        where: { id: orderId }
      });
      expect(updatedOrder!.payment_status).toBe('FAILED');
    });

    it('should process payment with PayPal', async () => {
      const user = await createTestUser(app, 'CUSTOMER');
      const seller = await createTestUser(app, 'SELLER');

      // Create product
      const productResponse = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${seller.token}` },
        payload: {
          name: 'Test Product',
          price: 50.00,
          stock: 50,
          category: 'books',
          images: ['image1.jpg']
        }
      });

      const productData = JSON.parse(productResponse.body);
      const productId = productData.product.id;

      // Add to cart
      await app.inject({
        method: 'POST',
        url: '/cart/add',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          product_id: productId,
          quantity: 1
        }
      });

      // Get user's address
      const addressesResponse = await app.inject({
        method: 'GET',
        url: '/addresses',
        headers: { authorization: `Bearer ${user.token}` }
      });

      const addressesData = JSON.parse(addressesResponse.body);
      const addressId = addressesData.addresses[0].id;

      // Create order
      const orderResponse = await app.inject({
        method: 'POST',
        url: '/orders',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          address_id: addressId,
          payment_method: 'PAYPAL'
        }
      });

      const orderData = JSON.parse(orderResponse.body);
      const orderId = orderData.order.id;

      // Process payment with PayPal
      const paymentResponse = await app.inject({
        method: 'POST',
        url: '/payments/process',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          order_id: orderId,
          payment_method: 'PAYPAL'
        }
      });

      expect(paymentResponse.statusCode).toBe(200);
      const paymentData = JSON.parse(paymentResponse.body);
      expect(paymentData.success).toBe(true);
      expect(paymentData.status).toBe('PAID');
    });

    it('should process payment with cash on delivery', async () => {
      const user = await createTestUser(app, 'CUSTOMER');
      const seller = await createTestUser(app, 'SELLER');

      // Create product
      const productResponse = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${seller.token}` },
        payload: {
          name: 'Test Product',
          price: 25.00,
          stock: 30,
          category: 'clothing',
          images: ['image1.jpg']
        }
      });

      const productData = JSON.parse(productResponse.body);
      const productId = productData.product.id;

      // Add to cart
      await app.inject({
        method: 'POST',
        url: '/cart/add',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          product_id: productId,
          quantity: 1
        }
      });

      // Get user's address
      const addressesResponse = await app.inject({
        method: 'GET',
        url: '/addresses',
        headers: { authorization: `Bearer ${user.token}` }
      });

      const addressesData = JSON.parse(addressesResponse.body);
      const addressId = addressesData.addresses[0].id;

      // Create order
      const orderResponse = await app.inject({
        method: 'POST',
        url: '/orders',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          address_id: addressId,
          payment_method: 'CASH_ON_DELIVERY'
        }
      });

      const orderData = JSON.parse(orderResponse.body);
      const orderId = orderData.order.id;

      // Process payment with COD
      const paymentResponse = await app.inject({
        method: 'POST',
        url: '/payments/process',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          order_id: orderId,
          payment_method: 'CASH_ON_DELIVERY'
        }
      });

      expect(paymentResponse.statusCode).toBe(200);
      const paymentData = JSON.parse(paymentResponse.body);
      expect(paymentData.success).toBe(true);
      expect(paymentData.status).toBe('PAID');
    });

    it('should fail when order not found', async () => {
      const user = await createTestUser(app, 'CUSTOMER');

      const paymentResponse = await app.inject({
        method: 'POST',
        url: '/payments/process',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          order_id: faker.string.uuid(),
          payment_method: 'CREDIT_CARD',
          card_number: '4111111111111111',
          card_holder: 'John Doe',
          cvv: '123',
          expiry_date: '12/25'
        }
      });

      expect(paymentResponse.statusCode).toBe(404);
    });

    it('should fail when paying for another users order', async () => {
      const user1 = await createTestUser(app, 'CUSTOMER');
      const user2 = await createTestUser(app, 'CUSTOMER');
      const seller = await createTestUser(app, 'SELLER');

      // Create product
      const productResponse = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${seller.token}` },
        payload: {
          name: 'Test Product',
          price: 99.99,
          stock: 100,
          category: 'electronics',
          images: ['image1.jpg']
        }
      });

      const productData = JSON.parse(productResponse.body);
      const productId = productData.product.id;

      // User1 adds to cart and creates order
      await app.inject({
        method: 'POST',
        url: '/cart/add',
        headers: { authorization: `Bearer ${user1.token}` },
        payload: {
          product_id: productId,
          quantity: 1
        }
      });

      const addressesResponse = await app.inject({
        method: 'GET',
        url: '/addresses',
        headers: { authorization: `Bearer ${user1.token}` }
      });

      const addressesData = JSON.parse(addressesResponse.body);
      const addressId = addressesData.addresses[0].id;

      const orderResponse = await app.inject({
        method: 'POST',
        url: '/orders',
        headers: { authorization: `Bearer ${user1.token}` },
        payload: {
          address_id: addressId,
          payment_method: 'CREDIT_CARD'
        }
      });

      const orderData = JSON.parse(orderResponse.body);
      const orderId = orderData.order.id;

      // User2 tries to pay for user1's order
      const paymentResponse = await app.inject({
        method: 'POST',
        url: '/payments/process',
        headers: { authorization: `Bearer ${user2.token}` },
        payload: {
          order_id: orderId,
          payment_method: 'CREDIT_CARD',
          card_number: '4111111111111111',
          card_holder: 'John Doe',
          cvv: '123',
          expiry_date: '12/25'
        }
      });

      expect(paymentResponse.statusCode).toBe(403);
    });

    it('should fail without authentication', async () => {
      const paymentResponse = await app.inject({
        method: 'POST',
        url: '/payments/process',
        payload: {
          order_id: faker.string.uuid(),
          payment_method: 'CREDIT_CARD',
          card_number: '4111111111111111',
          card_holder: 'John Doe',
          cvv: '123',
          expiry_date: '12/25'
        }
      });

      expect(paymentResponse.statusCode).toBe(401);
    });

    it('should fail with missing required fields', async () => {
      const user = await createTestUser(app, 'CUSTOMER');

      const paymentResponse = await app.inject({
        method: 'POST',
        url: '/payments/process',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          order_id: faker.string.uuid()
          // Missing payment_method
        }
      });

      expect(paymentResponse.statusCode).toBe(400);
    });

    it('should fail with invalid payment method', async () => {
      const user = await createTestUser(app, 'CUSTOMER');

      const paymentResponse = await app.inject({
        method: 'POST',
        url: '/payments/process',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          order_id: faker.string.uuid(),
          payment_method: 'INVALID_METHOD'
        }
      });

      expect(paymentResponse.statusCode).toBe(400);
    });
  });

  describe('GET /payments/status/:order_id', () => {
    it('should get payment status for paid order', async () => {
      const user = await createTestUser(app, 'CUSTOMER');
      const seller = await createTestUser(app, 'SELLER');

      // Create product and order
      const productResponse = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${seller.token}` },
        payload: {
          name: 'Test Product',
          price: 99.99,
          stock: 100,
          category: 'electronics',
          images: ['image1.jpg']
        }
      });

      const productData = JSON.parse(productResponse.body);
      const productId = productData.product.id;

      await app.inject({
        method: 'POST',
        url: '/cart/add',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          product_id: productId,
          quantity: 1
        }
      });

      const addressesResponse = await app.inject({
        method: 'GET',
        url: '/addresses',
        headers: { authorization: `Bearer ${user.token}` }
      });

      const addressesData = JSON.parse(addressesResponse.body);
      const addressId = addressesData.addresses[0].id;

      const orderResponse = await app.inject({
        method: 'POST',
        url: '/orders',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          address_id: addressId,
          payment_method: 'CREDIT_CARD'
        }
      });

      const orderData = JSON.parse(orderResponse.body);
      const orderId = orderData.order.id;

      // Process payment
      await app.inject({
        method: 'POST',
        url: '/payments/process',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          order_id: orderId,
          payment_method: 'CREDIT_CARD',
          card_number: '4111111111111111',
          card_holder: 'John Doe',
          cvv: '123',
          expiry_date: '12/25'
        }
      });

      // Check payment status
      const statusResponse = await app.inject({
        method: 'GET',
        url: `/payments/status/${orderId}`,
        headers: { authorization: `Bearer ${user.token}` }
      });

      expect(statusResponse.statusCode).toBe(200);
      const statusData = JSON.parse(statusResponse.body);
      expect(statusData.status).toBe('PAID');
    });

    it('should get payment status for pending order', async () => {
      const user = await createTestUser(app, 'CUSTOMER');
      const seller = await createTestUser(app, 'SELLER');

      // Create product and order
      const productResponse = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${seller.token}` },
        payload: {
          name: 'Test Product',
          price: 99.99,
          stock: 100,
          category: 'electronics',
          images: ['image1.jpg']
        }
      });

      const productData = JSON.parse(productResponse.body);
      const productId = productData.product.id;

      await app.inject({
        method: 'POST',
        url: '/cart/add',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          product_id: productId,
          quantity: 1
        }
      });

      const addressesResponse = await app.inject({
        method: 'GET',
        url: '/addresses',
        headers: { authorization: `Bearer ${user.token}` }
      });

      const addressesData = JSON.parse(addressesResponse.body);
      const addressId = addressesData.addresses[0].id;

      const orderResponse = await app.inject({
        method: 'POST',
        url: '/orders',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          address_id: addressId,
          payment_method: 'CREDIT_CARD'
        }
      });

      const orderData = JSON.parse(orderResponse.body);
      const orderId = orderData.order.id;

      // Check payment status without paying
      const statusResponse = await app.inject({
        method: 'GET',
        url: `/payments/status/${orderId}`,
        headers: { authorization: `Bearer ${user.token}` }
      });

      expect(statusResponse.statusCode).toBe(200);
      const statusData = JSON.parse(statusResponse.body);
      expect(statusData.status).toBe('PENDING');
    });

    it('should fail when checking status of another users order', async () => {
      const user1 = await createTestUser(app, 'CUSTOMER');
      const user2 = await createTestUser(app, 'CUSTOMER');
      const seller = await createTestUser(app, 'SELLER');

      // User1 creates order
      const productResponse = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${seller.token}` },
        payload: {
          name: 'Test Product',
          price: 99.99,
          stock: 100,
          category: 'electronics',
          images: ['image1.jpg']
        }
      });

      const productData = JSON.parse(productResponse.body);
      const productId = productData.product.id;

      await app.inject({
        method: 'POST',
        url: '/cart/add',
        headers: { authorization: `Bearer ${user1.token}` },
        payload: {
          product_id: productId,
          quantity: 1
        }
      });

      const addressesResponse = await app.inject({
        method: 'GET',
        url: '/addresses',
        headers: { authorization: `Bearer ${user1.token}` }
      });

      const addressesData = JSON.parse(addressesResponse.body);
      const addressId = addressesData.addresses[0].id;

      const orderResponse = await app.inject({
        method: 'POST',
        url: '/orders',
        headers: { authorization: `Bearer ${user1.token}` },
        payload: {
          address_id: addressId,
          payment_method: 'CREDIT_CARD'
        }
      });

      const orderData = JSON.parse(orderResponse.body);
      const orderId = orderData.order.id;

      // User2 tries to check status
      const statusResponse = await app.inject({
        method: 'GET',
        url: `/payments/status/${orderId}`,
        headers: { authorization: `Bearer ${user2.token}` }
      });

      expect(statusResponse.statusCode).toBe(403);
    });

    it('should fail when order not found', async () => {
      const user = await createTestUser(app, 'CUSTOMER');

      const statusResponse = await app.inject({
        method: 'GET',
        url: `/payments/status/${faker.string.uuid()}`,
        headers: { authorization: `Bearer ${user.token}` }
      });

      expect(statusResponse.statusCode).toBe(404);
    });

    it('should fail without authentication', async () => {
      const statusResponse = await app.inject({
        method: 'GET',
        url: `/payments/status/${faker.string.uuid()}`
      });

      expect(statusResponse.statusCode).toBe(401);
    });
  });

  describe('POST /payments/refund/:order_id', () => {
    it('should refund payment successfully', async () => {
      const user = await createTestUser(app, 'CUSTOMER');
      const seller = await createTestUser(app, 'SELLER');

      // Create product and order
      const productResponse = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${seller.token}` },
        payload: {
          name: 'Test Product',
          price: 99.99,
          stock: 100,
          category: 'electronics',
          images: ['image1.jpg']
        }
      });

      const productData = JSON.parse(productResponse.body);
      const productId = productData.product.id;

      await app.inject({
        method: 'POST',
        url: '/cart/add',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          product_id: productId,
          quantity: 1
        }
      });

      const addressesResponse = await app.inject({
        method: 'GET',
        url: '/addresses',
        headers: { authorization: `Bearer ${user.token}` }
      });

      const addressesData = JSON.parse(addressesResponse.body);
      const addressId = addressesData.addresses[0].id;

      const orderResponse = await app.inject({
        method: 'POST',
        url: '/orders',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          address_id: addressId,
          payment_method: 'CREDIT_CARD'
        }
      });

      const orderData = JSON.parse(orderResponse.body);
      const orderId = orderData.order.id;

      // Process payment
      await app.inject({
        method: 'POST',
        url: '/payments/process',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          order_id: orderId,
          payment_method: 'CREDIT_CARD',
          card_number: '4111111111111111',
          card_holder: 'John Doe',
          cvv: '123',
          expiry_date: '12/25'
        }
      });

      // Refund payment
      const refundResponse = await app.inject({
        method: 'POST',
        url: `/payments/refund/${orderId}`,
        headers: { authorization: `Bearer ${user.token}` }
      });

      expect(refundResponse.statusCode).toBe(200);
      const refundData = JSON.parse(refundResponse.body);
      expect(refundData.success).toBe(true);
      expect(refundData.status).toBe('REFUNDED');
      expect(refundData.transaction_id).toBeDefined();

      // Verify order payment status updated
      const updatedOrder = await prisma.order.findUnique({
        where: { id: orderId }
      });
      expect(updatedOrder!.payment_status).toBe('REFUNDED');
    });

    it('should fail refund for unpaid order', async () => {
      const user = await createTestUser(app, 'CUSTOMER');
      const seller = await createTestUser(app, 'SELLER');

      // Create product and order without payment
      const productResponse = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${seller.token}` },
        payload: {
          name: 'Test Product',
          price: 99.99,
          stock: 100,
          category: 'electronics',
          images: ['image1.jpg']
        }
      });

      const productData = JSON.parse(productResponse.body);
      const productId = productData.product.id;

      await app.inject({
        method: 'POST',
        url: '/cart/add',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          product_id: productId,
          quantity: 1
        }
      });

      const addressesResponse = await app.inject({
        method: 'GET',
        url: '/addresses',
        headers: { authorization: `Bearer ${user.token}` }
      });

      const addressesData = JSON.parse(addressesResponse.body);
      const addressId = addressesData.addresses[0].id;

      const orderResponse = await app.inject({
        method: 'POST',
        url: '/orders',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          address_id: addressId,
          payment_method: 'CREDIT_CARD'
        }
      });

      const orderData = JSON.parse(orderResponse.body);
      const orderId = orderData.order.id;

      // Try to refund without payment
      const refundResponse = await app.inject({
        method: 'POST',
        url: `/payments/refund/${orderId}`,
        headers: { authorization: `Bearer ${user.token}` }
      });

      expect(refundResponse.statusCode).toBe(400);
      const errorData = JSON.parse(refundResponse.body);
      expect(errorData.error).toContain('unpaid order');
    });

    it('should fail when refunding another users order', async () => {
      const user1 = await createTestUser(app, 'CUSTOMER');
      const user2 = await createTestUser(app, 'CUSTOMER');
      const seller = await createTestUser(app, 'SELLER');

      // User1 creates and pays for order
      const productResponse = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${seller.token}` },
        payload: {
          name: 'Test Product',
          price: 99.99,
          stock: 100,
          category: 'electronics',
          images: ['image1.jpg']
        }
      });

      const productData = JSON.parse(productResponse.body);
      const productId = productData.product.id;

      await app.inject({
        method: 'POST',
        url: '/cart/add',
        headers: { authorization: `Bearer ${user1.token}` },
        payload: {
          product_id: productId,
          quantity: 1
        }
      });

      const addressesResponse = await app.inject({
        method: 'GET',
        url: '/addresses',
        headers: { authorization: `Bearer ${user1.token}` }
      });

      const addressesData = JSON.parse(addressesResponse.body);
      const addressId = addressesData.addresses[0].id;

      const orderResponse = await app.inject({
        method: 'POST',
        url: '/orders',
        headers: { authorization: `Bearer ${user1.token}` },
        payload: {
          address_id: addressId,
          payment_method: 'CREDIT_CARD'
        }
      });

      const orderData = JSON.parse(orderResponse.body);
      const orderId = orderData.order.id;

      await app.inject({
        method: 'POST',
        url: '/payments/process',
        headers: { authorization: `Bearer ${user1.token}` },
        payload: {
          order_id: orderId,
          payment_method: 'CREDIT_CARD',
          card_number: '4111111111111111',
          card_holder: 'John Doe',
          cvv: '123',
          expiry_date: '12/25'
        }
      });

      // User2 tries to refund
      const refundResponse = await app.inject({
        method: 'POST',
        url: `/payments/refund/${orderId}`,
        headers: { authorization: `Bearer ${user2.token}` }
      });

      expect(refundResponse.statusCode).toBe(403);
    });

    it('should fail when order not found', async () => {
      const user = await createTestUser(app, 'CUSTOMER');

      const refundResponse = await app.inject({
        method: 'POST',
        url: `/payments/refund/${faker.string.uuid()}`,
        headers: { authorization: `Bearer ${user.token}` }
      });

      expect(refundResponse.statusCode).toBe(404);
    });

    it('should fail without authentication', async () => {
      const refundResponse = await app.inject({
        method: 'POST',
        url: `/payments/refund/${faker.string.uuid()}`
      });

      expect(refundResponse.statusCode).toBe(401);
    });
  });

  describe('Payment Failure Stock Handling', () => {
    it('should NOT release stock when payment succeeds', async () => {
      const user = await createTestUser(app, 'CUSTOMER');
      const seller = await createTestUser(app, 'SELLER');

      // Create product
      const productResponse = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${seller.token}` },
        payload: {
          name: 'Stock Test Product',
          price: 100,
          stock: 50,
          category: 'electronics',
          images: []
        }
      });
      const productId = JSON.parse(productResponse.body).product.id;

      // Get initial stock
      const initialProduct = await prisma.product.findUnique({ where: { id: productId } });
      const initialStock = initialProduct!.stock;

      // Add to cart and create order
      await app.inject({
        method: 'POST',
        url: '/cart/add',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          product_id: productId,
          quantity: 3
        }
      });

      const userId = (await prisma.user.findUnique({ where: { email: user.email } }))!.id;
      const address = await prisma.address.findFirst({ where: { user_id: userId } });

      const orderResponse = await app.inject({
        method: 'POST',
        url: '/orders',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          address_id: address!.id,
          payment_method: 'CREDIT_CARD'
        }
      });
      const orderId = JSON.parse(orderResponse.body).order.id;

      // Stock should be reduced after order
      const afterOrderProduct = await prisma.product.findUnique({ where: { id: productId } });
      expect(afterOrderProduct!.stock).toBe(initialStock - 3);

      // Process payment successfully
      await app.inject({
        method: 'POST',
        url: '/payments/process',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          order_id: orderId,
          payment_method: 'CREDIT_CARD',
          card_number: '4111111111111111', // Test success card
          card_holder: 'John Doe',
          cvv: '123',
          expiry_date: '12/25'
        }
      });

      // Stock should remain reduced (NOT released)
      const afterPaymentProduct = await prisma.product.findUnique({ where: { id: productId } });
      expect(afterPaymentProduct!.stock).toBe(initialStock - 3);
    });

    it('should keep stock reduced even when payment fails', async () => {
      const user = await createTestUser(app, 'CUSTOMER');
      const seller = await createTestUser(app, 'SELLER');

      // Create product
      const productResponse = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${seller.token}` },
        payload: {
          name: 'Payment Fail Product',
          price: 200,
          stock: 100,
          category: 'electronics',
          images: []
        }
      });
      const productId = JSON.parse(productResponse.body).product.id;

      // Get initial stock
      const initialProduct = await prisma.product.findUnique({ where: { id: productId } });
      const initialStock = initialProduct!.stock;

      // Add to cart and create order
      await app.inject({
        method: 'POST',
        url: '/cart/add',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          product_id: productId,
          quantity: 5
        }
      });

      const userId = (await prisma.user.findUnique({ where: { email: user.email } }))!.id;
      const address = await prisma.address.findFirst({ where: { user_id: userId } });

      const orderResponse = await app.inject({
        method: 'POST',
        url: '/orders',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          address_id: address!.id,
          payment_method: 'CREDIT_CARD'
        }
      });
      const orderId = JSON.parse(orderResponse.body).order.id;

      // Process payment with failure card (note: payment failure is random, so we just check stock behavior)
      await app.inject({
        method: 'POST',
        url: '/payments/process',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          order_id: orderId,
          payment_method: 'CREDIT_CARD',
          card_number: '4000000000000002', // Test failure card
          card_holder: 'John Doe',
          cvv: '123',
          expiry_date: '12/25'
        }
      });

      // Stock should remain reduced (order exists, just payment failed)
      const afterPaymentProduct = await prisma.product.findUnique({ where: { id: productId } });
      expect(afterPaymentProduct!.stock).toBe(initialStock - 5);
    });
  });
});
