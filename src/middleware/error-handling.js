const { logger } = require('../../utils/logger');

const errorLogger = logger.child({ module: 'error-handling' });

/**
 * Custom error classes for better error categorization
 */
class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.details = details;
  }
}

class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
  }
}

class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
    this.statusCode = 401;
  }
}

class DatabaseError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'DatabaseError';
    this.statusCode = 500;
    this.originalError = originalError;
  }
}

/**
 * Async error handler wrapper
 * Catches async errors and passes them to Express error handler
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Rate limiting error handler
 */
function rateLimitHandler(req, res, next, options) {
  return res.status(429).json({
    success: false,
    error: 'Too many requests',
    message: 'Please slow down your requests',
    retryAfter: options.windowMs / 1000
  });
}

/**
 * Database error handler
 * Converts SQLite errors to user-friendly messages
 */
function handleDatabaseError(error) {
  errorLogger.error('Database error occurred', {
    error: error.message,
    code: error.code,
    stack: error.stack
  });

  // Handle specific SQLite errors
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return new ConflictError('Resource already exists with that identifier');
  }

  if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return new ValidationError('Invalid reference to related resource');
  }

  if (error.code === 'SQLITE_CONSTRAINT_CHECK') {
    return new ValidationError('Data does not meet constraints');
  }

  if (error.code === 'SQLITE_READONLY') {
    return new DatabaseError('Database is in read-only mode', error);
  }

  if (error.code === 'SQLITE_BUSY') {
    return new DatabaseError('Database is busy, please try again', error);
  }

  // Generic database error
  return new DatabaseError('Database operation failed', error);
}

/**
 * Main error handling middleware
 * Should be the last middleware in the chain
 */
function errorHandler(error, req, res, next) {
  let processedError = error;

  // Handle database errors
  if (error.code && error.code.startsWith('SQLITE')) {
    processedError = handleDatabaseError(error);
  }

  // Handle multer file upload errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    processedError = new ValidationError('File too large');
  }

  if (error.code === 'LIMIT_FILE_COUNT') {
    processedError = new ValidationError('Too many files uploaded');
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    processedError = new ValidationError('Unexpected file field');
  }

  // Handle JSON parsing errors
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    processedError = new ValidationError('Invalid JSON in request body');
  }

  // Set default status code and message
  const statusCode = processedError.statusCode || 500;
  const message = processedError.message || 'Internal server error';

  // Log error with context
  const errorContext = {
    error: message,
    statusCode,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  };

  // Add stack trace for 500 errors
  if (statusCode >= 500) {
    errorContext.stack = processedError.stack;
    errorLogger.error('Internal server error', errorContext);
  } else if (statusCode >= 400) {
    errorLogger.warn('Client error', errorContext);
  }

  // Prepare error response
  const errorResponse = {
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  };

  // Add additional details for validation errors
  if (processedError instanceof ValidationError && processedError.details) {
    errorResponse.details = processedError.details;
  }

  // In production, don't expose internal error details
  if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
    errorResponse.error = 'Internal server error';
    delete errorResponse.details;
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * 404 handler for unmatched routes
 */
function notFoundHandler(req, res, next) {
  const error = new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`);

  errorLogger.warn('Route not found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  next(error);
}

/**
 * Handle uncaught exceptions and unhandled rejections
 */
function setupGlobalErrorHandlers() {
  process.on('uncaughtException', (error) => {
    errorLogger.fatal('Uncaught exception', {
      error: error.message,
      stack: error.stack
    });

    // Give time for logs to flush
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  process.on('unhandledRejection', (reason, promise) => {
    errorLogger.error('Unhandled promise rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise.toString()
    });
  });
}

module.exports = {
  // Error classes
  ValidationError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  DatabaseError,

  // Middleware
  asyncHandler,
  errorHandler,
  notFoundHandler,
  rateLimitHandler,

  // Utilities
  handleDatabaseError,
  setupGlobalErrorHandlers
};