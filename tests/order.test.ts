import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { prisma } from '../src/config/database';
import { createTestUser, clearDatabase } from './utils/test-helpers';

describe('Order Integration Tests', () => {
  let app: FastifyInstance;
  let customerToken: string;
  let customerId: string;
  let sellerToken: string;
  let sellerId: string;
  let addressId: string;
  let productId1: string;
  let productId2: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Create customer
    const customer = await createTestUser(app, 'CUSTOMER');
    customerToken = customer.token!;
    customerId = (await prisma.user.findUnique({ where: { email: customer.email } }))!.id;

    // Get customer's address
    const address = await prisma.address.findFirst({ where: { user_id: customerId } });
    addressId = address!.id;

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
        description: 'Test store'
      }
    });

    // Create products
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
    productId1 = JSON.parse(product1Response.body).product.id;

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

    console.log('🔧 Test setup completed');
  });

  afterAll(async () => {
    await clearDatabase(prisma);
    await prisma.$disconnect();
    await app.close();
    console.log('🧹 Test cleanup completed');
  });

  describe('POST /orders', () => {
    it('should create order from cart', async () => {
      // Add products to cart
      await app.inject({
        method: 'POST',
        url: '/cart/add',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: {
          product_id: productId1,
          quantity: 2
        }
      });

      await app.inject({
        method: 'POST',
        url: '/cart/add',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: {
          product_id: productId2,
          quantity: 1
        }
      });

      // Create order
      const response = await app.inject({
        method: 'POST',
        url: '/orders',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: {
          address_id: addressId,
          payment_method: 'CREDIT_CARD'
        }
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      expect(data.order).toBeDefined();
      expect(data.order.status).toBe('PENDING');
      expect(data.order.total_amount).toBe(400); // 100*2 + 200*1
      expect(data.order.items.length).toBe(2);

      // Verify cart is empty
      const cartResponse = await app.inject({
        method: 'GET',
        url: '/cart',
        headers: { authorization: `Bearer ${customerToken}` }
      });
      const cartData = JSON.parse(cartResponse.body);
      expect(cartData.cart.total_items).toBe(0);
    });

    it('should fail when cart is empty', async () => {
      const user = await createTestUser(app, 'CUSTOMER');
      const userId = (await prisma.user.findUnique({ where: { email: user.email } }))!.id;
      const userAddress = await prisma.address.findFirst({ where: { user_id: userId } });

      const response = await app.inject({
        method: 'POST',
        url: '/orders',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          address_id: userAddress!.id,
          payment_method: 'CREDIT_CARD'
        }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toContain('Cart is empty');
    });

    it('should fail when insufficient stock', async () => {
      const user = await createTestUser(app, 'CUSTOMER');

      // Create low stock product
      const lowStockResponse = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: {
          name: 'Low Stock Product',
          price: 100,
          stock: 1,
          category: 'electronics',
          images: []
        }
      });
      const lowStockProductId = JSON.parse(lowStockResponse.body).product.id;

      // Add to cart
      await app.inject({
        method: 'POST',
        url: '/cart/add',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          product_id: lowStockProductId,
          quantity: 1
        }
      });

      // Update stock to 0
      await prisma.product.update({
        where: { id: lowStockProductId },
        data: { stock: 0 }
      });

      const userId = (await prisma.user.findUnique({ where: { email: user.email } }))!.id;
      const userAddress = await prisma.address.findFirst({ where: { user_id: userId } });

      // Try to create order
      const response = await app.inject({
        method: 'POST',
        url: '/orders',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          address_id: userAddress!.id,
          payment_method: 'CREDIT_CARD'
        }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBeDefined();
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/orders',
        payload: {
          address_id: addressId,
          payment_method: 'CREDIT_CARD'
        }
      });

      expect(response.statusCode).toBe(401);
    });

    it('should accept any payment method string', async () => {
      const user = await createTestUser(app, 'CUSTOMER');

      // Add product to cart
      await app.inject({
        method: 'POST',
        url: '/cart/add',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          product_id: productId1,
          quantity: 1
        }
      });

      const userId = (await prisma.user.findUnique({ where: { email: user.email } }))!.id;
      const userAddress = await prisma.address.findFirst({ where: { user_id: userId } });

      // Payment method is optional string, so any value is accepted
      const response = await app.inject({
        method: 'POST',
        url: '/orders',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          address_id: userAddress!.id,
          payment_method: 'PAYPAL'
        }
      });

      expect(response.statusCode).toBe(201);
    });

    it('should fail with invalid address', async () => {
      const user = await createTestUser(app, 'CUSTOMER');

      // Add product to cart
      await app.inject({
        method: 'POST',
        url: '/cart/add',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          product_id: productId1,
          quantity: 1
        }
      });

      const response = await app.inject({
        method: 'POST',
        url: '/orders',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          address_id: '00000000-0000-0000-0000-000000000000',
          payment_method: 'CREDIT_CARD'
        }
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reduce stock after order creation', async () => {
      const user = await createTestUser(app, 'CUSTOMER');

      // Get initial stock
      const initialProduct = await prisma.product.findUnique({ where: { id: productId1 } });
      const initialStock = initialProduct!.stock;

      // Add to cart
      await app.inject({
        method: 'POST',
        url: '/cart/add',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          product_id: productId1,
          quantity: 3
        }
      });

      const userId = (await prisma.user.findUnique({ where: { email: user.email } }))!.id;
      const userAddress = await prisma.address.findFirst({ where: { user_id: userId } });

      // Create order
      await app.inject({
        method: 'POST',
        url: '/orders',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          address_id: userAddress!.id,
          payment_method: 'CREDIT_CARD'
        }
      });

      // Check stock reduced
      const updatedProduct = await prisma.product.findUnique({ where: { id: productId1 } });
      expect(updatedProduct!.stock).toBe(initialStock - 3);
    });
  });

  describe('GET /orders', () => {
    let orderTestToken: string;
    let orderTestAddressId: string;

    beforeAll(async () => {
      const user = await createTestUser(app, 'CUSTOMER');
      orderTestToken = user.token!;

      const userId = (await prisma.user.findUnique({ where: { email: user.email } }))!.id;
      const address = await prisma.address.findFirst({ where: { user_id: userId } });
      orderTestAddressId = address!.id;

      // Create 2 orders
      for (let i = 0; i < 2; i++) {
        await app.inject({
          method: 'POST',
          url: '/cart/add',
          headers: { authorization: `Bearer ${orderTestToken}` },
          payload: {
            product_id: productId1,
            quantity: 1
          }
        });

        await app.inject({
          method: 'POST',
          url: '/orders',
          headers: { authorization: `Bearer ${orderTestToken}` },
          payload: {
            address_id: orderTestAddressId,
            payment_method: 'CREDIT_CARD'
          }
        });
      }
    });

    it('should get all user orders', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/orders',
        headers: { authorization: `Bearer ${orderTestToken}` }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.orders).toBeDefined();
      expect(Array.isArray(data.orders)).toBe(true);
      expect(data.orders.length).toBeGreaterThanOrEqual(2);

      // Verify order structure
      const order = data.orders[0];
      expect(order.id).toBeDefined();
      expect(order.status).toBeDefined();
      expect(order.total_amount).toBeDefined();
      expect(order.items).toBeDefined();
    });

    it('should return empty array when no orders', async () => {
      const newUser = await createTestUser(app, 'CUSTOMER');

      const response = await app.inject({
        method: 'GET',
        url: '/orders',
        headers: { authorization: `Bearer ${newUser.token}` }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.orders).toEqual([]);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/orders'
      });

      expect(response.statusCode).toBe(401);
    });

    it('should order by creation date (newest first)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/orders',
        headers: { authorization: `Bearer ${orderTestToken}` }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);

      if (data.orders.length >= 2) {
        const firstDate = new Date(data.orders[0].created_at);
        const secondDate = new Date(data.orders[1].created_at);
        expect(firstDate.getTime()).toBeGreaterThanOrEqual(secondDate.getTime());
      }
    });
  });

  describe('GET /orders/:id', () => {
    let getOrderToken: string;
    let testOrderId: string;

    beforeAll(async () => {
      const user = await createTestUser(app, 'CUSTOMER');
      getOrderToken = user.token!;

      const userId = (await prisma.user.findUnique({ where: { email: user.email } }))!.id;
      const address = await prisma.address.findFirst({ where: { user_id: userId } });

      // Add to cart and create order
      await app.inject({
        method: 'POST',
        url: '/cart/add',
        headers: { authorization: `Bearer ${getOrderToken}` },
        payload: {
          product_id: productId1,
          quantity: 1
        }
      });

      const orderResponse = await app.inject({
        method: 'POST',
        url: '/orders',
        headers: { authorization: `Bearer ${getOrderToken}` },
        payload: {
          address_id: address!.id,
          payment_method: 'CREDIT_CARD'
        }
      });

      testOrderId = JSON.parse(orderResponse.body).order.id;
    });

    it('should get order by id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/orders/${testOrderId}`,
        headers: { authorization: `Bearer ${getOrderToken}` }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.order).toBeDefined();
      expect(data.order.id).toBe(testOrderId);
      expect(data.order.items).toBeDefined();
      expect(data.order.shipping_address).toBeDefined();
    });

    it('should fail when order not found', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/orders/00000000-0000-0000-0000-000000000000`,
        headers: { authorization: `Bearer ${getOrderToken}` }
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.body);
      expect(data.error).toBeDefined();
    });

    it('should fail when accessing another user order', async () => {
      const anotherUser = await createTestUser(app, 'CUSTOMER');

      const response = await app.inject({
        method: 'GET',
        url: `/orders/${testOrderId}`,
        headers: { authorization: `Bearer ${anotherUser.token}` }
      });

      expect(response.statusCode).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/orders/${testOrderId}`
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('PUT /orders/:id/cancel', () => {
    it('should cancel order and restore stock', async () => {
      const user = await createTestUser(app, 'CUSTOMER');
      const userId = (await prisma.user.findUnique({ where: { email: user.email } }))!.id;
      const address = await prisma.address.findFirst({ where: { user_id: userId } });

      // Get initial stock
      const initialProduct = await prisma.product.findUnique({ where: { id: productId1 } });
      const initialStock = initialProduct!.stock;

      // Create order
      await app.inject({
        method: 'POST',
        url: '/cart/add',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          product_id: productId1,
          quantity: 2
        }
      });

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

      // Stock should be reduced
      const afterOrderProduct = await prisma.product.findUnique({ where: { id: productId1 } });
      expect(afterOrderProduct!.stock).toBe(initialStock - 2);

      // Cancel order
      const cancelResponse = await app.inject({
        method: 'PUT',
        url: `/orders/${orderId}/cancel`,
        headers: { authorization: `Bearer ${user.token}` }
      });

      expect(cancelResponse.statusCode).toBe(200);
      const cancelData = JSON.parse(cancelResponse.body);
      expect(cancelData.order.status).toBe('CANCELLED');

      // Stock should be restored
      const restoredProduct = await prisma.product.findUnique({ where: { id: productId1 } });
      expect(restoredProduct!.stock).toBe(initialStock);
    });

    it('should fail when order is not pending', async () => {
      const user = await createTestUser(app, 'CUSTOMER');
      const userId = (await prisma.user.findUnique({ where: { email: user.email } }))!.id;
      const address = await prisma.address.findFirst({ where: { user_id: userId } });

      // Create and cancel order
      await app.inject({
        method: 'POST',
        url: '/cart/add',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          product_id: productId1,
          quantity: 1
        }
      });

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

      // Cancel first time
      await app.inject({
        method: 'PUT',
        url: `/orders/${orderId}/cancel`,
        headers: { authorization: `Bearer ${user.token}` }
      });

      // Try to cancel again
      const response = await app.inject({
        method: 'PUT',
        url: `/orders/${orderId}/cancel`,
        headers: { authorization: `Bearer ${user.token}` }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toContain('Only pending orders can be cancelled');
    });

    it('should fail when order not found', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/orders/00000000-0000-0000-0000-000000000000/cancel`,
        headers: { authorization: `Bearer ${customerToken}` }
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/orders/some-id/cancel`
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /seller/orders', () => {
    let sellerOrdersToken: string;
    let sellerOrdersSellerId: string;

    beforeAll(async () => {
      const seller = await createTestUser(app, 'SELLER');
      sellerOrdersToken = seller.token!;
      sellerOrdersSellerId = (await prisma.user.findUnique({ where: { email: seller.email } }))!.id;

      // Create seller profile
      await app.inject({
        method: 'POST',
        url: '/seller',
        headers: { authorization: `Bearer ${sellerOrdersToken}` },
        payload: {
          name: 'Seller Orders Test',
          description: 'Test'
        }
      });

      // Create product for this seller
      const productResponse = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${sellerOrdersToken}` },
        payload: {
          name: 'Seller Test Product',
          price: 150,
          stock: 100,
          category: 'electronics',
          images: []
        }
      });
      const sellerProductId = JSON.parse(productResponse.body).product.id;

      // Create customer and order
      const customer = await createTestUser(app, 'CUSTOMER');
      const customerId = (await prisma.user.findUnique({ where: { email: customer.email } }))!.id;
      const customerAddress = await prisma.address.findFirst({ where: { user_id: customerId } });

      await app.inject({
        method: 'POST',
        url: '/cart/add',
        headers: { authorization: `Bearer ${customer.token}` },
        payload: {
          product_id: sellerProductId,
          quantity: 2
        }
      });

      await app.inject({
        method: 'POST',
        url: '/orders',
        headers: { authorization: `Bearer ${customer.token}` },
        payload: {
          address_id: customerAddress!.id,
          payment_method: 'CREDIT_CARD'
        }
      });
    });

    it('should get seller orders', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/seller/orders',
        headers: { authorization: `Bearer ${sellerOrdersToken}` }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.orders).toBeDefined();
      expect(Array.isArray(data.orders)).toBe(true);
      expect(data.orders.length).toBeGreaterThan(0);
    });

    it('should only show orders for seller products', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/seller/orders',
        headers: { authorization: `Bearer ${sellerOrdersToken}` }
      });

      const data = JSON.parse(response.body);

      // All order items should have product info and customer info
      data.orders.forEach((order: any) => {
        expect(order.product_id).toBeDefined();
        expect(order.product_name).toBeDefined();
        expect(order.customer_id).toBeDefined();
        expect(order.order_id).toBeDefined();
      });
    });

    it('should require seller role', async () => {
      const customer = await createTestUser(app, 'CUSTOMER');

      const response = await app.inject({
        method: 'GET',
        url: '/seller/orders',
        headers: { authorization: `Bearer ${customer.token}` }
      });

      expect(response.statusCode).toBe(403);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/seller/orders'
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('PUT /seller/orders/:id/status', () => {
    let statusTestSellerToken: string;
    let statusTestOrderItemId: string;

    beforeAll(async () => {
      const seller = await createTestUser(app, 'SELLER');
      statusTestSellerToken = seller.token!;

      // Create seller profile
      await app.inject({
        method: 'POST',
        url: '/seller',
        headers: { authorization: `Bearer ${statusTestSellerToken}` },
        payload: {
          name: 'Status Test Seller',
          description: 'Test'
        }
      });

      // Create product
      const productResponse = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${statusTestSellerToken}` },
        payload: {
          name: 'Status Test Product',
          price: 100,
          stock: 50,
          category: 'electronics',
          images: []
        }
      });
      const productId = JSON.parse(productResponse.body).product.id;

      // Create customer and order
      const customer = await createTestUser(app, 'CUSTOMER');
      const customerId = (await prisma.user.findUnique({ where: { email: customer.email } }))!.id;
      const customerAddress = await prisma.address.findFirst({ where: { user_id: customerId } });

      await app.inject({
        method: 'POST',
        url: '/cart/add',
        headers: { authorization: `Bearer ${customer.token}` },
        payload: {
          product_id: productId,
          quantity: 1
        }
      });

      const orderResponse = await app.inject({
        method: 'POST',
        url: '/orders',
        headers: { authorization: `Bearer ${customer.token}` },
        payload: {
          address_id: customerAddress!.id,
          payment_method: 'CREDIT_CARD'
        }
      });

      statusTestOrderItemId = JSON.parse(orderResponse.body).order.items[0].id;
    });

    it('should update order item status', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/seller/orders/${statusTestOrderItemId}/status`,
        headers: { authorization: `Bearer ${statusTestSellerToken}` },
        payload: {
          status: 'CONFIRMED'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.order_item).toBeDefined();
      expect(data.order_item.status).toBe('CONFIRMED');
    });

    it('should fail for invalid status transition', async () => {
      // Try to set back to PENDING after CONFIRMED (not allowed)
      const response = await app.inject({
        method: 'PUT',
        url: `/seller/orders/${statusTestOrderItemId}/status`,
        headers: { authorization: `Bearer ${statusTestSellerToken}` },
        payload: {
          status: 'PENDING'
        }
      });

      expect(response.statusCode).toBe(400);
    });

    it('should fail when order item not found', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/seller/orders/00000000-0000-0000-0000-000000000000/status`,
        headers: { authorization: `Bearer ${statusTestSellerToken}` },
        payload: {
          status: 'CONFIRMED'
        }
      });

      expect(response.statusCode).toBe(404);
    });

    it('should fail when not seller of product', async () => {
      const anotherSeller = await createTestUser(app, 'SELLER');

      const response = await app.inject({
        method: 'PUT',
        url: `/seller/orders/${statusTestOrderItemId}/status`,
        headers: { authorization: `Bearer ${anotherSeller.token}` },
        payload: {
          status: 'SHIPPED'
        }
      });

      expect(response.statusCode).toBe(404);
    });

    it('should require seller role', async () => {
      const customer = await createTestUser(app, 'CUSTOMER');

      const response = await app.inject({
        method: 'PUT',
        url: `/seller/orders/${statusTestOrderItemId}/status`,
        headers: { authorization: `Bearer ${customer.token}` },
        payload: {
          status: 'PROCESSING'
        }
      });

      expect(response.statusCode).toBe(403);
    });

    it('should allow valid status progression', async () => {
      // Create fresh order for testing progression
      const seller = await createTestUser(app, 'SELLER');
      await app.inject({
        method: 'POST',
        url: '/seller',
        headers: { authorization: `Bearer ${seller.token}` },
        payload: { name: 'Progression Test', description: 'Test' }
      });

      const prodResp = await app.inject({
        method: 'POST',
        url: '/seller/products',
        headers: { authorization: `Bearer ${seller.token}` },
        payload: {
          name: 'Progression Product',
          price: 100,
          stock: 50,
          category: 'electronics',
          images: []
        }
      });
      const prodId = JSON.parse(prodResp.body).product.id;

      const customer = await createTestUser(app, 'CUSTOMER');
      const custId = (await prisma.user.findUnique({ where: { email: customer.email } }))!.id;
      const custAddr = await prisma.address.findFirst({ where: { user_id: custId } });

      await app.inject({
        method: 'POST',
        url: '/cart/add',
        headers: { authorization: `Bearer ${customer.token}` },
        payload: { product_id: prodId, quantity: 1 }
      });

      const orderResp = await app.inject({
        method: 'POST',
        url: '/orders',
        headers: { authorization: `Bearer ${customer.token}` },
        payload: {
          address_id: custAddr!.id,
          payment_method: 'CREDIT_CARD'
        }
      });
      const itemId = JSON.parse(orderResp.body).order.items[0].id;

      // PENDING -> CONFIRMED
      let resp = await app.inject({
        method: 'PUT',
        url: `/seller/orders/${itemId}/status`,
        headers: { authorization: `Bearer ${seller.token}` },
        payload: { status: 'CONFIRMED' }
      });
      expect(resp.statusCode).toBe(200);

      // CONFIRMED -> SHIPPED
      resp = await app.inject({
        method: 'PUT',
        url: `/seller/orders/${itemId}/status`,
        headers: { authorization: `Bearer ${seller.token}` },
        payload: { status: 'SHIPPED' }
      });
      expect(resp.statusCode).toBe(200);

      // SHIPPED -> DELIVERED
      resp = await app.inject({
        method: 'PUT',
        url: `/seller/orders/${itemId}/status`,
        headers: { authorization: `Bearer ${seller.token}` },
        payload: { status: 'DELIVERED' }
      });
      expect(resp.statusCode).toBe(200);
    });
  });
});
