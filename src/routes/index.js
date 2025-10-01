const express = require('express');
const webRoutes = require('./web-routes');
const layoutRoutes = require('./layout-routes');
const { logger } = require('../../utils/logger');

const routeLogger = logger.child({ module: 'routes-main' });

/**
 * Initialize all routes
 */
function initializeRoutes(app) {
  routeLogger.info('Initializing route modules');

  // Web routes (HTML pages)
  app.use('/', webRoutes);

  // Layout management routes
  app.use('/', layoutRoutes);

  // API v1 routes (new modular structure)
  const apiV1Router = require('./api/v1');
  app.use('/api/v1', apiV1Router);

  // Legacy API routes (for backward compatibility)
  const { router: apiRouter } = require('../../routes/api');
  app.use('/api', apiRouter);

  // Template routes
  app.use('/api/templates', require('../../api/template-routes'));

  // Serve theme assets
  app.use('/themes', express.static('themes'));

  // Static files should come after specific routes
  app.use(express.static('public'));

  routeLogger.info('All routes initialized successfully');
}

module.exports = { initializeRoutes };