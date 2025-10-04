import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import { prisma } from '../src/config/database';
import { faker } from '@faker-js/faker';
import { createTestUser, clearDatabase } from './utils/test-helpers';

describe('Address Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await clearDatabase(prisma);
    await prisma.$disconnect();
  });

  describe('POST /addresses', () => {
    it('should create a new address', async () => {
      const user = await createTestUser(app, 'CUSTOMER');

      const addressData = {
        title: 'Work Office',
        full_name: faker.person.fullName(),
        phone: '1234567890',
        country: 'Turkey',
        city: faker.location.city(),
        district: faker.location.county(),
        postal_code: faker.location.zipCode(),
        address_line: faker.location.streetAddress(),
        is_default: false
      };

      const response = await app.inject({
        method: 'POST',
        url: '/addresses',
        headers: { authorization: `Bearer ${user.token}` },
        payload: addressData
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      expect(data.address.title).toBe(addressData.title);
      expect(data.address.full_name).toBe(addressData.full_name);
      expect(data.address.user_id).toBeDefined();
    });

    it('should create address as default', async () => {
      const user = await createTestUser(app, 'CUSTOMER');

      // First, set existing address to non-default
      const existingResponse = await app.inject({
        method: 'GET',
        url: '/addresses',
        headers: { authorization: `Bearer ${user.token}` }
      });

      const existingData = JSON.parse(existingResponse.body);
      const existingAddressId = existingData.addresses[0].id;

      await app.inject({
        method: 'PUT',
        url: `/addresses/${existingAddressId}`,
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          is_default: false
        }
      });

      // Now create new default address
      const addressData = {
        title: 'Work Office',
        full_name: faker.person.fullName(),
        phone: '1234567890',
        country: 'Turkey',
        city: faker.location.city(),
        postal_code: faker.location.zipCode(),
        address_line: faker.location.streetAddress(),
        is_default: true
      };

      const response = await app.inject({
        method: 'POST',
        url: '/addresses',
        headers: { authorization: `Bearer ${user.token}` },
        payload: addressData
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      expect(data.address.is_default).toBe(true);
    });

    it('should unset previous default when creating new default address', async () => {
      const user = await createTestUser(app, 'CUSTOMER');

      // Get existing address (from registration)
      const existingResponse = await app.inject({
        method: 'GET',
        url: '/addresses',
        headers: { authorization: `Bearer ${user.token}` }
      });

      const existingData = JSON.parse(existingResponse.body);
      const firstAddressId = existingData.addresses[0].id;

      // Create new default address
      const newAddress = {
        title: 'Work Address',
        full_name: faker.person.fullName(),
        phone: '1234567890',
        country: 'Turkey',
        city: faker.location.city(),
        postal_code: faker.location.zipCode(),
        address_line: faker.location.streetAddress(),
        is_default: true
      };

      await app.inject({
        method: 'POST',
        url: '/addresses',
        headers: { authorization: `Bearer ${user.token}` },
        payload: newAddress
      });

      // Check first address is no longer default
      const checkResponse = await app.inject({
        method: 'GET',
        url: `/addresses/${firstAddressId}`,
        headers: { authorization: `Bearer ${user.token}` }
      });

      const checkData = JSON.parse(checkResponse.body);
      expect(checkData.address.is_default).toBe(false);
    });

    it('should fail without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/addresses',
        payload: {
          title: 'Home',
          full_name: 'Test User',
          phone: '1234567890',
          country: 'Turkey',
          city: 'Istanbul',
          postal_code: '34000',
          address_line: 'Test Address'
        }
      });

      expect(response.statusCode).toBe(401);
    });

    it('should fail with missing required fields', async () => {
      const user = await createTestUser(app, 'CUSTOMER');

      const response = await app.inject({
        method: 'POST',
        url: '/addresses',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          title: 'Home'
          // Missing other required fields
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /addresses', () => {
    it('should get all user addresses', async () => {
      const user = await createTestUser(app, 'CUSTOMER');

      // User already has 1 address from registration, create one more
      const addressData = {
        title: 'Work Address 2',
        full_name: faker.person.fullName(),
        phone: '1234567890',
        country: 'Turkey',
        city: faker.location.city(),
        postal_code: faker.location.zipCode(),
        address_line: faker.location.streetAddress(),
        is_default: false
      };

      await app.inject({
        method: 'POST',
        url: '/addresses',
        headers: { authorization: `Bearer ${user.token}` },
        payload: addressData
      });

      const response = await app.inject({
        method: 'GET',
        url: '/addresses',
        headers: { authorization: `Bearer ${user.token}` }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.addresses.length).toBeGreaterThanOrEqual(2);
      // Default should be first
      expect(data.addresses[0].is_default).toBe(true);
    });

    it('should return empty array for user with no addresses', async () => {
      const user = await createTestUser(app, 'CUSTOMER');

      // Delete the default address created during registration
      const addressesResponse = await app.inject({
        method: 'GET',
        url: '/addresses',
        headers: { authorization: `Bearer ${user.token}` }
      });

      const addressesData = JSON.parse(addressesResponse.body);
      for (const address of addressesData.addresses) {
        await app.inject({
          method: 'DELETE',
          url: `/addresses/${address.id}`,
          headers: { authorization: `Bearer ${user.token}` }
        });
      }

      const response = await app.inject({
        method: 'GET',
        url: '/addresses',
        headers: { authorization: `Bearer ${user.token}` }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.addresses).toHaveLength(0);
    });

    it('should fail without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/addresses'
      });

      expect(response.statusCode).toBe(401);
    });

    it('should not return other users addresses', async () => {
      const user1 = await createTestUser(app, 'CUSTOMER');
      const user2 = await createTestUser(app, 'CUSTOMER');

      // Create address for user1
      await app.inject({
        method: 'POST',
        url: '/addresses',
        headers: { authorization: `Bearer ${user1.token}` },
        payload: {
          title: 'User1 Home',
          full_name: faker.person.fullName(),
          phone: '1234567890',
          country: 'Turkey',
          city: faker.location.city(),
          postal_code: faker.location.zipCode(),
          address_line: faker.location.streetAddress()
        }
      });

      // Get addresses for user2
      const response = await app.inject({
        method: 'GET',
        url: '/addresses',
        headers: { authorization: `Bearer ${user2.token}` }
      });

      const data = JSON.parse(response.body);
      // user2 should only see their own registration address
      expect(data.addresses.every((addr: any) => addr.title !== 'User1 Home')).toBe(true);
    });
  });

  describe('GET /addresses/:id', () => {
    it('should get address by id', async () => {
      const user = await createTestUser(app, 'CUSTOMER');

      // Get existing address (from registration)
      const addressesResponse = await app.inject({
        method: 'GET',
        url: '/addresses',
        headers: { authorization: `Bearer ${user.token}` }
      });

      const addressesData = JSON.parse(addressesResponse.body);
      const addressId = addressesData.addresses[0].id;

      const response = await app.inject({
        method: 'GET',
        url: `/addresses/${addressId}`,
        headers: { authorization: `Bearer ${user.token}` }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.address.id).toBe(addressId);
    });

    it('should fail when address not found', async () => {
      const user = await createTestUser(app, 'CUSTOMER');

      const response = await app.inject({
        method: 'GET',
        url: `/addresses/${faker.string.uuid()}`,
        headers: { authorization: `Bearer ${user.token}` }
      });

      expect(response.statusCode).toBe(404);
    });

    it('should fail when accessing another users address', async () => {
      const user1 = await createTestUser(app, 'CUSTOMER');
      const user2 = await createTestUser(app, 'CUSTOMER');

      // Get user1's existing address (from registration)
      const addressesResponse = await app.inject({
        method: 'GET',
        url: '/addresses',
        headers: { authorization: `Bearer ${user1.token}` }
      });

      const addressesData = JSON.parse(addressesResponse.body);
      const addressId = addressesData.addresses[0].id;

      // Try to access with user2
      const response = await app.inject({
        method: 'GET',
        url: `/addresses/${addressId}`,
        headers: { authorization: `Bearer ${user2.token}` }
      });

      expect(response.statusCode).toBe(404);
    });

    it('should fail without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/addresses/${faker.string.uuid()}`
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('PUT /addresses/:id', () => {
    it('should update address successfully', async () => {
      const user = await createTestUser(app, 'CUSTOMER');

      const createResponse = await app.inject({
        method: 'POST',
        url: '/addresses',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          title: 'Update Test Home',
          full_name: faker.person.fullName(),
          phone: '1234567890',
          country: 'Turkey',
          city: 'Istanbul',
          postal_code: faker.location.zipCode(),
          address_line: faker.location.streetAddress()
        }
      });

      const createData = JSON.parse(createResponse.body);
      const addressId = createData.address.id;

      const response = await app.inject({
        method: 'PUT',
        url: `/addresses/${addressId}`,
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          city: 'Ankara'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.address.city).toBe('Ankara');
    });

    it('should update only provided fields', async () => {
      const user = await createTestUser(app, 'CUSTOMER');

      // Get existing address and update it to have a known full_name
      const existingResponse = await app.inject({
        method: 'GET',
        url: '/addresses',
        headers: { authorization: `Bearer ${user.token}` }
      });

      const existingData = JSON.parse(existingResponse.body);
      const addressId = existingData.addresses[0].id;

      // First, set a known full_name
      await app.inject({
        method: 'PUT',
        url: `/addresses/${addressId}`,
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          full_name: 'Original Name'
        }
      });

      // Now update only the phone
      const response = await app.inject({
        method: 'PUT',
        url: `/addresses/${addressId}`,
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          phone: '9999999999'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.address.phone).toBe('9999999999');
      expect(data.address.full_name).toBe('Original Name'); // Should not change
    });

    it('should fail when address not found', async () => {
      const user = await createTestUser(app, 'CUSTOMER');

      const response = await app.inject({
        method: 'PUT',
        url: `/addresses/${faker.string.uuid()}`,
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          city: 'Ankara'
        }
      });

      expect(response.statusCode).toBe(404);
    });

    it('should fail when updating another users address', async () => {
      const user1 = await createTestUser(app, 'CUSTOMER');
      const user2 = await createTestUser(app, 'CUSTOMER');

      // Get user1's existing address (from registration)
      const addressesResponse = await app.inject({
        method: 'GET',
        url: '/addresses',
        headers: { authorization: `Bearer ${user1.token}` }
      });

      const addressesData = JSON.parse(addressesResponse.body);
      const addressId = addressesData.addresses[0].id;

      // Try to update with user2
      const response = await app.inject({
        method: 'PUT',
        url: `/addresses/${addressId}`,
        headers: { authorization: `Bearer ${user2.token}` },
        payload: {
          city: 'Hacked City'
        }
      });

      expect(response.statusCode).toBe(404);
    });

    it('should fail without authentication', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/addresses/${faker.string.uuid()}`,
        payload: {
          city: 'Ankara'
        }
      });

      expect(response.statusCode).toBe(401);
    });

    it('should prevent updating address with active orders (except is_default)', async () => {
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
      await app.inject({
        method: 'POST',
        url: '/orders',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          address_id: addressId,
          payment_method: 'CREDIT_CARD'
        }
      });

      // Try to update address details (should fail)
      const updateResponse = await app.inject({
        method: 'PUT',
        url: `/addresses/${addressId}`,
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          city: 'Ankara'
        }
      });

      expect(updateResponse.statusCode).toBe(400);
      const errorData = JSON.parse(updateResponse.body);
      expect(errorData.error).toContain('Cannot update address details while it has active orders');
    });

    it('should allow updating is_default flag even with active orders', async () => {
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
      await app.inject({
        method: 'POST',
        url: '/orders',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          address_id: addressId,
          payment_method: 'CREDIT_CARD'
        }
      });

      // Try to update is_default only (should succeed)
      const updateResponse = await app.inject({
        method: 'PUT',
        url: `/addresses/${addressId}`,
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          is_default: false
        }
      });

      expect(updateResponse.statusCode).toBe(200);
    });
  });

  describe('PUT /addresses/:id/default', () => {
    it('should set address as default', async () => {
      const user = await createTestUser(app, 'CUSTOMER');

      // Create a non-default address
      const createResponse = await app.inject({
        method: 'POST',
        url: '/addresses',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          title: 'Work Address',
          full_name: faker.person.fullName(),
          phone: '1234567890',
          country: 'Turkey',
          city: faker.location.city(),
          postal_code: faker.location.zipCode(),
          address_line: faker.location.streetAddress(),
          is_default: false
        }
      });

      expect(createResponse.statusCode).toBe(201);
      const createData = JSON.parse(createResponse.body);
      const addressId = createData.address.id;

      const response = await app.inject({
        method: 'PUT',
        url: `/addresses/${addressId}/default`,
        headers: { authorization: `Bearer ${user.token}` }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.address.is_default).toBe(true);
    });

    it('should unset previous default when setting new default', async () => {
      const user = await createTestUser(app, 'CUSTOMER');

      // Get existing address (from registration)
      const existingResponse = await app.inject({
        method: 'GET',
        url: '/addresses',
        headers: { authorization: `Bearer ${user.token}` }
      });

      const existingData = JSON.parse(existingResponse.body);
      const firstAddressId = existingData.addresses[0].id;

      // Create second address
      const secondResponse = await app.inject({
        method: 'POST',
        url: '/addresses',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          title: 'Work Office',
          full_name: faker.person.fullName(),
          phone: '1234567890',
          country: 'Turkey',
          city: faker.location.city(),
          postal_code: faker.location.zipCode(),
          address_line: faker.location.streetAddress(),
          is_default: false
        }
      });

      expect(secondResponse.statusCode).toBe(201);
      const secondData = JSON.parse(secondResponse.body);
      const secondAddressId = secondData.address.id;

      // Set second as default
      await app.inject({
        method: 'PUT',
        url: `/addresses/${secondAddressId}/default`,
        headers: { authorization: `Bearer ${user.token}` }
      });

      // Check first is no longer default
      const checkResponse = await app.inject({
        method: 'GET',
        url: `/addresses/${firstAddressId}`,
        headers: { authorization: `Bearer ${user.token}` }
      });

      const checkData = JSON.parse(checkResponse.body);
      expect(checkData.address.is_default).toBe(false);
    });

    it('should fail when address not found', async () => {
      const user = await createTestUser(app, 'CUSTOMER');

      const response = await app.inject({
        method: 'PUT',
        url: `/addresses/${faker.string.uuid()}/default`,
        headers: { authorization: `Bearer ${user.token}` }
      });

      expect(response.statusCode).toBe(404);
    });

    it('should fail when setting another users address as default', async () => {
      const user1 = await createTestUser(app, 'CUSTOMER');
      const user2 = await createTestUser(app, 'CUSTOMER');

      // Get user1's existing address (from registration)
      const addressesResponse = await app.inject({
        method: 'GET',
        url: '/addresses',
        headers: { authorization: `Bearer ${user1.token}` }
      });

      const addressesData = JSON.parse(addressesResponse.body);
      const addressId = addressesData.addresses[0].id;

      // Try to set as default with user2
      const response = await app.inject({
        method: 'PUT',
        url: `/addresses/${addressId}/default`,
        headers: { authorization: `Bearer ${user2.token}` }
      });

      expect(response.statusCode).toBe(404);
    });

    it('should fail without authentication', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/addresses/${faker.string.uuid()}/default`
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('DELETE /addresses/:id', () => {
    it('should delete address successfully', async () => {
      const user = await createTestUser(app, 'CUSTOMER');

      const createResponse = await app.inject({
        method: 'POST',
        url: '/addresses',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          title: 'Temporary Address',
          full_name: faker.person.fullName(),
          phone: '1234567890',
          country: 'Turkey',
          city: faker.location.city(),
          postal_code: faker.location.zipCode(),
          address_line: faker.location.streetAddress()
        }
      });

      expect(createResponse.statusCode).toBe(201);
      const createData = JSON.parse(createResponse.body);
      const addressId = createData.address.id;

      const response = await app.inject({
        method: 'DELETE',
        url: `/addresses/${addressId}`,
        headers: { authorization: `Bearer ${user.token}` }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.message).toBe('Address deleted successfully');

      // Verify deletion
      const getResponse = await app.inject({
        method: 'GET',
        url: `/addresses/${addressId}`,
        headers: { authorization: `Bearer ${user.token}` }
      });

      expect(getResponse.statusCode).toBe(404);
    });

    it('should fail when address not found', async () => {
      const user = await createTestUser(app, 'CUSTOMER');

      const response = await app.inject({
        method: 'DELETE',
        url: `/addresses/${faker.string.uuid()}`,
        headers: { authorization: `Bearer ${user.token}` }
      });

      expect(response.statusCode).toBe(404);
    });

    it('should fail when deleting another users address', async () => {
      const user1 = await createTestUser(app, 'CUSTOMER');
      const user2 = await createTestUser(app, 'CUSTOMER');

      // Get user1's existing address (from registration)
      const addressesResponse = await app.inject({
        method: 'GET',
        url: '/addresses',
        headers: { authorization: `Bearer ${user1.token}` }
      });

      const addressesData = JSON.parse(addressesResponse.body);
      const addressId = addressesData.addresses[0].id;

      // Try to delete with user2
      const response = await app.inject({
        method: 'DELETE',
        url: `/addresses/${addressId}`,
        headers: { authorization: `Bearer ${user2.token}` }
      });

      expect(response.statusCode).toBe(404);
    });

    it('should fail without authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/addresses/${faker.string.uuid()}`
      });

      expect(response.statusCode).toBe(401);
    });

    it('should prevent deleting address with active orders', async () => {
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
      await app.inject({
        method: 'POST',
        url: '/orders',
        headers: { authorization: `Bearer ${user.token}` },
        payload: {
          address_id: addressId,
          payment_method: 'CREDIT_CARD'
        }
      });

      // Try to delete address (should fail)
      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/addresses/${addressId}`,
        headers: { authorization: `Bearer ${user.token}` }
      });

      expect(deleteResponse.statusCode).toBe(400);
      const errorData = JSON.parse(deleteResponse.body);
      expect(errorData.error).toContain('Cannot delete address');
    });

    it('should prevent deleting address used in order history', async () => {
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

      // Cancel order (to remove from active orders)
      await app.inject({
        method: 'PUT',
        url: `/orders/${orderId}/cancel`,
        headers: { authorization: `Bearer ${user.token}` }
      });

      // Try to delete address (should still fail because it's in history)
      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/addresses/${addressId}`,
        headers: { authorization: `Bearer ${user.token}` }
      });

      expect(deleteResponse.statusCode).toBe(400);
      const errorData = JSON.parse(deleteResponse.body);
      expect(errorData.error).toContain('Cannot delete address that is used in order history');
    });
  });
});
