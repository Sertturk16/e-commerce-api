import { FastifyInstance } from 'fastify';
import { faker } from '@faker-js/faker';

import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import { baseDbUrl } from "../setup";

export interface TestUser {
  email: string;
  password: string;
  name: string;
  role: 'CUSTOMER' | 'SELLER';
  token?: string;
}

export async function createTestUser(
  app: FastifyInstance,
  role: 'CUSTOMER' | 'SELLER' = 'CUSTOMER'
): Promise<TestUser> {
  const user = {
    email: faker.internet.email().toLowerCase(),
    password: faker.internet.password({ length: 8 }),
    name: faker.person.fullName(),
    role,
    phone: faker.phone.number(),
    address_title: faker.location.streetAddress(),
    address_country: 'Turkey',
    address_city: faker.location.city(),
    address_postal_code: faker.location.zipCode(),
    address_line: faker.location.streetAddress()
  };

  const response = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: user
  });

  if (response.statusCode !== 201) {
    throw new Error(`Failed to create test user: ${response.body}`);
  }

  const data = JSON.parse(response.body);

  return {
    email: user.email,
    password: user.password,
    name: user.name,
    role: user.role,
    token: data.token
  };
}

export async function createTestToken(
  app: FastifyInstance,
  email: string,
  password: string
): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password }
  });

  if (response.statusCode !== 200) {
    throw new Error(`Failed to create test token: ${response.body}`);
  }

  const data = JSON.parse(response.body);
  return data.token;
}


export async function clearDatabase(prisma: PrismaClient) {
  // Sıralama önemli - foreign key constraints nedeniyle
  await prisma.cartItem.deleteMany({});
  await prisma.cart.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.favorite.deleteMany({});
  await prisma.address.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.user.deleteMany({});
}

export async function createIsolatedDb() {
  const dbName = `testdb_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  // tempdb üzerinden bağlan
  const tempPrisma = new PrismaClient({
    datasources: { db: { url: `${baseDbUrl};database=tempdb` } },
  });
  await tempPrisma.$executeRawUnsafe(
    `IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = '${dbName}') CREATE DATABASE ${dbName};`
  );
  await tempPrisma.$disconnect();

  // Yeni DB URL
  const dbUrl = `${baseDbUrl};database=${dbName}`;

  // Prisma migrate + generate
  execSync("npx prisma generate", { stdio: "inherit" });
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: dbUrl },
  });

  // Prisma client
  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });
  await prisma.$connect();

  return { prisma, dbUrl, dbName };
}
