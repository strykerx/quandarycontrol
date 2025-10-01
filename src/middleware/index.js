const express = require('express');
const { requestLogging, errorLogging } = require('./logging');
const {
  errorHandler,
  notFoundHandler,
  setupGlobalErrorHandlers
} = require('./error-handling');
const { logger } = require('../../utils/logger');

const middlewareLogger = logger.child({ module: 'middleware-main' });

/**
 * Initialize all middleware
 */
function initializeMiddleware(app) {
  middlewareLogger.info('Initializing middleware modules');

  // Basic middleware
  app.use(express.json());

  // Request logging middleware (before routes)
  app.use(requestLogging);

  // Security middleware (could be expanded)
  app.use((req, res, next) => {
    // Basic security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  middlewareLogger.info('Core middleware initialized');
}

/**
 * Initialize error handling middleware (should be called after routes)
 */
function initializeErrorHandling(app) {
  middlewareLogger.info('Initializing comprehensive error handling middleware');

  // Set up global error handlers for uncaught exceptions
  setupGlobalErrorHandlers();

  // 404 handler for unmatched routes
  app.use(notFoundHandler);

  // Error logging middleware
  app.use(errorLogging);

  // Comprehensive error handler
  app.use(errorHandler);

  middlewareLogger.info('Comprehensive error handling middleware initialized');
}

module.exports = {
  initializeMiddleware,
  initializeErrorHandling
};