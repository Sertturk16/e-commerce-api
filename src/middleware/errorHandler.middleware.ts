import { FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import { logger } from '../config/logger';

export async function errorHandler(
  error: FastifyError,
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
    code: error.code,
    validation: error.validation,
  };

  // Fastify validation errors
  if (error.validation) {
    logger.warn('Validation error', errorLog);

    // Format validation error message
    const validationError = error.validation[0];
    let errorMessage = error.message;

    if (validationError) {
      // Safely extract field name
      let field = 'body';
      if (validationError.instancePath && typeof validationError.instancePath === 'string') {
        field = validationError.instancePath.replace('/', '');
      } else if (validationError.params && typeof (validationError.params as any).missingProperty === 'string') {
        field = (validationError.params as any).missingProperty;
      }

      // Custom messages for common validation errors
      if (validationError.keyword === 'minimum' || validationError.message?.includes('>=')) {
        errorMessage = `${field.charAt(0).toUpperCase() + field.slice(1)} cannot be negative`;
      } else if (validationError.keyword === 'required') {
        errorMessage = `${field} is required`;
      } else if (validationError.keyword === 'type') {
        const type = (validationError.params as any)?.type || 'valid';
        errorMessage = `${field} must be a ${type}`;
      } else {
        errorMessage = validationError.message || error.message;
      }
    }

    return reply.status(400).send({
      error: errorMessage,
    });
  }

  // Log errors based on status code
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
