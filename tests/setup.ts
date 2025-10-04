// tests/setup.ts
import { beforeAll, afterAll } from "vitest";
import { GenericContainer, StartedTestContainer } from "testcontainers";
import Redis from "ioredis";

export let mssqlContainer: StartedTestContainer;
export let redisContainer: StartedTestContainer;
export let baseDbUrl: string;
export let redisUrl: string;

beforeAll(async () => {
  // MSSQL container
  mssqlContainer = await new GenericContainer("mcr.microsoft.com/mssql/server:2022-latest")
    .withEnvironment({ ACCEPT_EULA: "Y", SA_PASSWORD: "TestDB@2024" })
    .withExposedPorts(1433)
    .start();

  const host = mssqlContainer.getHost();
  const port = mssqlContainer.getMappedPort(1433);

  baseDbUrl = `sqlserver://sa:TestDB@2024@${host}:${port};encrypt=true;trustServerCertificate=true`;

  // Redis container
  redisContainer = await new GenericContainer("redis:7-alpine")
    .withExposedPorts(6379)
    .start();

  const redisHost = redisContainer.getHost();
  const redisPort = redisContainer.getMappedPort(6379);

  redisUrl = `redis://${redisHost}:${redisPort}`;

  // Test için redis'i deneysel aç
  const testRedis = new Redis(redisUrl);
  await testRedis.set("ping", "pong");
  await testRedis.quit();

  console.log("🔧 Global containers started (MSSQL + Redis)");
}, 60000);

afterAll(async () => {
  if (mssqlContainer) await mssqlContainer.stop();
  if (redisContainer) await redisContainer.stop();
  console.log("🧹 Global containers stopped");
});
