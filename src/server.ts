import { buildApp } from './app';
import { env } from './config/env';

const start = async () => {
  try {
    const app = await buildApp();

    await app.listen({
      port: parseInt(env.PORT),
      host: '0.0.0.0',
    });

    console.log(`🚀 Server running on http://localhost:${env.PORT}`);
    console.log(`📊 Health check: http://localhost:${env.PORT}/health`);
    console.log(`📚 API Documentation: http://localhost:${env.PORT}/docs`);
  } catch (err) {
    console.error('❌ Error starting server:', err);
    process.exit(1);
  }
};

start();
