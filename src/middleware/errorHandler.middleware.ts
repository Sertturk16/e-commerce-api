import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger';

export async function errorHandler(
  error: Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  const errorLog = {
    error: error.message,
    stack: error.stack,
    method: request.method,
    url: request.url,
    ip: request.ip,
    userId: (request.user as any)?.id,
  };

  if (reply.statusCode >= 500) {
    logger.error('Internal server error', errorLog);
  } else if (reply.statusCode >= 400) {
    logger.warn('Client error', errorLog);
  }

  return reply.send({
    error: error.message || 'Internal server error',
  });
}

export function logError(
  message: string,
  error: any,
  context?: Record<string, any>
) {
  logger.error(message, {
    error: error.message,
    stack: error.stack,
    ...context,
  });
}

export function logWarn(message: string, context?: Record<string, any>) {
  logger.warn(message, context);
}

export function logInfo(message: string, context?: Record<string, any>) {
  logger.info(message, context);
}
