import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { env } from './config/env';
import { redis } from './config/redis';
import { prisma } from './config/database';
import { authRoutes } from './routes/auth.routes';
import { sellerRoutes } from './routes/seller.routes';
import { productRoutes } from './routes/product.routes';
import { cartRoutes } from './routes/cart.routes';
import orderRoutes from './routes/order.routes';
import { favoriteRoutes } from './routes/favorite.routes';
import { addressRoutes } from './routes/address.routes';
import { paymentRoutes } from './routes/payment.routes';
import { healthCheckSchema } from './schemas/health.schema';

export const buildApp = async () => {
  const app = Fastify({
    logger: env.NODE_ENV === 'production' ? true : {
      level: 'debug',
    },
  });

  // CORS
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // JWT
  await app.register(jwt, {
    secret: env.JWT_SECRET,
  });

  // Swagger Documentation
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'Sirius E-Commerce API',
        description: 'A comprehensive e-commerce backend API with user authentication, product management, shopping cart, orders, and more.',
        version: '1.0.0',
        contact: {
          name: 'API Support',
        },
      },
      servers: [
        {
          url: `http://localhost:${env.PORT}`,
          description: 'Development server',
        },
      ],
      tags: [
        { name: 'Auth', description: 'Authentication and user management endpoints' },
        { name: 'Products', description: 'Product browsing and search endpoints' },
        { name: 'Seller', description: 'Seller-only product and order management endpoints' },
        { name: 'Cart', description: 'Shopping cart management endpoints' },
        { name: 'Orders', description: 'Order management endpoints' },
        { name: 'Payment', description: 'Payment processing endpoints (simulated)' },
        { name: 'Favorites', description: 'Favorite products management endpoints' },
        { name: 'Addresses', description: 'User address management endpoints' },
        { name: 'Health', description: 'Health check endpoints' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  // Rate Limiting - Global (disabled in test environment)
  if (env.NODE_ENV !== 'test') {
    await app.register(rateLimit, {
      max: parseInt(env.RATE_LIMIT_MAX),
      timeWindow: parseInt(env.RATE_LIMIT_TIMEWINDOW),
    });
  }

  // Routes
  await app.register(authRoutes);
  await app.register(sellerRoutes);
  await app.register(productRoutes);
  await app.register(cartRoutes);
  await app.register(orderRoutes);
  await app.register(paymentRoutes);
  await app.register(favoriteRoutes);
  await app.register(addressRoutes);

  // Health endpoint
  app.get('/health', {
    schema: healthCheckSchema
  },
    async (_request, reply) => {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        redis: 'unknown',
        database: 'unknown',
      },
    };

    // Check Redis
    try {
      await redis.ping();
      health.services.redis = 'ok';
    } catch (error) {
      health.services.redis = 'error';
      health.status = 'degraded';
    }

    // Check Database
    try {
      await prisma.$queryRaw`SELECT 1`;
      health.services.database = 'ok';
    } catch (error) {
      health.services.database = 'error';
      health.status = 'degraded';
    }

    const statusCode = health.status === 'ok' ? 200 : 503;
    return reply.code(statusCode).send(health);
  });

  return app;
};
