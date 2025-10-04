import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { prisma } from '../src/config/database';
import { createTestUser, createTestToken, clearDatabase } from './utils/test-helpers';

describe('Auth Integration Tests', () => {
  let app: FastifyInstance;
  let validToken: string;
  let testUserEmail: string;
  let testUserPassword: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    console.log('🔧 Test setup completed');
  });


  afterAll(async () => {
    await clearDatabase(prisma);
    await prisma.$disconnect();
    await app.close();
    console.log('🧹 Test cleanup completed');
  });

  describe('POST /auth/register', () => {
    it('should register a new user and return token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'customer1@test.com',
          password: 'password123',
          name: 'Customer One',
          phone: '1234567890',
          address_title: 'Home',
          address_country: 'Turkey',
          address_city: 'Istanbul',
          address_postal_code: '34000',
          address_line: '123 Test Street'
        }
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      expect(data.token).toBeDefined();
      expect(data.user.email).toBe('customer1@test.com');
      expect(data.user.name).toBe('Customer One');
      expect(data.user.role).toBe('CUSTOMER');
    });

    it('should fail with invalid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'invalid-email',
          password: 'password123',
          name: 'Test User',
          address_title: 'Home',
          address_country: 'Turkey',
          address_city: 'Istanbul',
          address_postal_code: '34000',
          address_line: '123 Test Street'
        }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBeDefined();
    });

    it('should fail with short password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'test@test.com',
          password: '123',
          name: 'Test User',
          address_title: 'Home',
          address_country: 'Turkey',
          address_city: 'Istanbul',
          address_postal_code: '34000',
          address_line: '123 Test Street'
        }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBeDefined();
    });

    it('should fail with duplicate email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'customer1@test.com',
          password: 'password123',
          name: 'Duplicate User',
          address_title: 'Home',
          address_country: 'Turkey',
          address_city: 'Istanbul',
          address_postal_code: '34000',
          address_line: '123 Test Street'
        }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('User already exists');
    });

    it('should register a seller with SELLER role', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'seller1@test.com',
          password: 'password123',
          name: 'Seller One',
          role: 'SELLER',
          address_title: 'Office',
          address_country: 'Turkey',
          address_city: 'Ankara',
          address_postal_code: '06000',
          address_line: '456 Business Ave'
        }
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      expect(data.user.role).toBe('SELLER');
    });

    it('should fail with invalid role', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'invalid@test.com',
          password: 'password123',
          name: 'Invalid Role User',
          role: 'ADMIN',
          address_title: 'Home',
          address_country: 'Turkey',
          address_city: 'Istanbul',
          address_postal_code: '34000',
          address_line: '123 Test Street'
        }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBeDefined();
    });

    it('should fail without required address fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'noaddress@test.com',
          password: 'password123',
          name: 'No Address User'
        }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBeDefined();
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      // Create a test user first
      const user = await createTestUser(app, 'CUSTOMER');
      testUserEmail = user.email;
      testUserPassword = user.password;

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: user.email,
          password: user.password
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.token).toBeDefined();
      expect(data.user.email).toBe(user.email);
      expect(data.cart).toBeDefined();

      validToken = data.token;
    });

    it('should fail with invalid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'nonexistent@test.com',
          password: 'password123'
        }
      });

      expect(response.statusCode).toBe(401);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Invalid credentials');
    });

    it('should fail with invalid password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'customer1@test.com',
          password: 'wrongpassword'
        }
      });

      expect(response.statusCode).toBe(401);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Invalid credentials');
    });

    it('should fail with missing credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'customer1@test.com'
        }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBeDefined();
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout successfully with valid token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: {
          authorization: `Bearer ${validToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.message).toBe('Logged out successfully');
    });

    it('should fail without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/logout'
      });

      expect(response.statusCode).toBe(401);
      const data = JSON.parse(response.body);
      expect(data.error).toBeDefined();
    });

    it('should fail with invalid token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: {
          authorization: 'Bearer invalid-token-here'
        }
      });

      expect(response.statusCode).toBe(401);
      const data = JSON.parse(response.body);
      expect(data.error).toBeDefined();
    });

    it('should not allow using blacklisted token', async () => {
      // Try to use the token that was just blacklisted in logout test
      const response = await app.inject({
        method: 'GET',
        url: '/cart',
        headers: {
          authorization: `Bearer ${validToken}`
        }
      });

      // Cart endpoint returns 400 for invalid session, but 401 would also be acceptable
      expect([400, 401]).toContain(response.statusCode);
      const data = JSON.parse(response.body);
      expect(data.error).toBeDefined();
    });
  });

  describe('PUT /auth/profile', () => {
    let profileTestUser: { email: string; password: string };

    it('setup: create user for profile tests', async () => {
      const user = await createTestUser(app, 'CUSTOMER');
      profileTestUser = { email: user.email, password: user.password };
      expect(profileTestUser.email).toBeDefined();
    });

    async function getToken() {
      return await createTestToken(app, profileTestUser.email, profileTestUser.password);
    }

    it('should fail without token', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/auth/profile',
        payload: {
          phone: '5555555555'
        }
      });

      expect(response.statusCode).toBe(401);
      const data = JSON.parse(response.body);
      expect(data.error).toBeDefined();
    });

    it('should fail with invalid token', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/auth/profile',
        headers: {
          authorization: 'Bearer invalid-token'
        },
        payload: {
          phone: '5555555555'
        }
      });

      expect(response.statusCode).toBe(401);
      const data = JSON.parse(response.body);
      expect(data.error).toBeDefined();
    });

    it('should allow updating with empty payload', async () => {
      const token = await getToken();

      const response = await app.inject({
        method: 'PUT',
        url: '/auth/profile',
        headers: {
          authorization: `Bearer ${token}`
        },
        payload: {}
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.user).toBeDefined();
    });

    it('should update phone successfully', async () => {
      const token = await getToken();

      const response = await app.inject({
        method: 'PUT',
        url: '/auth/profile',
        headers: {
          authorization: `Bearer ${token}`
        },
        payload: {
          phone: '9876543210'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.user.phone).toBe('9876543210');
    });

    it('should update phone again', async () => {
      const token = await getToken();

      const response = await app.inject({
        method: 'PUT',
        url: '/auth/profile',
        headers: {
          authorization: `Bearer ${token}`
        },
        payload: {
          phone: '1111111111'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.user.phone).toBe('1111111111');
    });
  });
});
