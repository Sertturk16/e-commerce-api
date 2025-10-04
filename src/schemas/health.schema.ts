export const healthCheckSchema = {
  description: 'Health check endpoint - checks Redis and Database',
  tags: ['Health'],
  response: {
    200: {
      description: 'Service is healthy',
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok', 'degraded'] },
        timestamp: { type: 'string', format: 'date-time' },
        uptime: { type: 'number', description: 'Process uptime in seconds' },
        services: {
          type: 'object',
          properties: {
            redis: { type: 'string', enum: ['ok', 'error', 'unknown'], description: 'Redis status' },
            database: { type: 'string', enum: ['ok', 'error', 'unknown'], description: 'Database status' },
          }
        }
      }
    },
    503: {
      description: 'Service is degraded',
      type: 'object',
      properties: {
        status: { type: 'string' },
        timestamp: { type: 'string' },
        uptime: { type: 'number' },
        services: { type: 'object' }
      }
    }
  }
};
