const express = require('express');
const { logger } = require('../../../../utils/logger');

// Import all API module routers
const roomsRouter = require('./rooms');
const variablesRouter = require('./variables');
const timerRouter = require('./timer');
const hintsRouter = require('./hints');
const rulesRouter = require('./rules');
const mediaRouter = require('./media');
const lightboxRouter = require('./lightbox');
const layoutRouter = require('./layout');
const themesRouter = require('./themes');
const notificationsRouter = require('./notifications');
const gmCustomizationRouter = require('./gm-customization');

const router = express.Router();
const apiLogger = logger.child({ module: 'api-v1' });

// Log API requests for debugging
router.use((req, res, next) => {
  apiLogger.debug('API v1 request', {
    method: req.method,
    path: req.path,
    params: req.params,
    query: req.query,
    ip: req.ip
  });
  next();
});

// Health check endpoint (must be before wildcard routes)
router.get('/health', (req, res) => {
  apiLogger.debug('Health check requested', { ip: req.ip });
  res.json({
    success: true,
    version: 'v1',
    timestamp: new Date().toISOString(),
    status: 'healthy'
  });
});

// API documentation endpoint
router.get('/docs', (req, res) => {
  const docs = {
    version: 'v1',
    description: 'Quandary Control API v1 - Modularized and structured API endpoints',
    endpoints: {
      rooms: {
        'GET /rooms': 'List all rooms',
        'GET /rooms/:id': 'Get specific room',
        'GET /rooms/shortcode/:shortcode': 'Get room by shortcode',
        'POST /rooms': 'Create new room',
        'PUT /rooms/:id': 'Update room',
        'DELETE /rooms/:id': 'Delete room'
      },
      variables: {
        'GET /rooms/:id/variables': 'Get room variables',
        'POST /rooms/:id/variables': 'Create/update variable',
        'POST /rooms/:roomId/variables/:varName': 'Update specific variable with triggers'
      },
      timer: {
        'GET /rooms/:id/timer': 'Get timer configuration',
        'PUT /rooms/:id/timer': 'Update timer configuration'
      },
      hints: {
        'GET /rooms/:id/hints': 'Get hints configuration',
        'PUT /rooms/:id/hints': 'Update hints configuration'
      },
      rules: {
        'GET /rooms/:id/rules': 'Get room rules',
        'POST /rooms/:id/rules': 'Create rule (with media upload)',
        'DELETE /rooms/:id/rules/:ruleId': 'Delete rule',
        'POST /rooms/:id/rules/order': 'Reorder rules'
      },
      media: {
        'GET /rooms/:id/media': 'Get room media',
        'POST /upload': 'Generic file upload',
        'POST /rooms/:id/media': 'Upload media to room',
        'PUT /media/:mediaId': 'Update media metadata',
        'DELETE /media/:mediaId': 'Delete media',
        'GET /media/:mediaId': 'Get media details',
        'PATCH /rooms/:id/media/reorder': 'Reorder media'
      },
      lightbox: {
        'GET /rooms/:id/lightbox': 'Get lightbox sequences',
        'POST /rooms/:id/lightbox': 'Create lightbox sequence',
        'GET /lightbox/:sequenceId': 'Get specific sequence',
        'PUT /lightbox/:sequenceId': 'Update sequence',
        'DELETE /lightbox/:sequenceId': 'Delete sequence'
      },
      layout: {
        'GET /rooms/:id/layout': 'Get room layout',
        'PUT /rooms/:id/layout': 'Update room layout',
        'POST /layout/validate': 'Validate layout JSON',
        'GET /layout/presets': 'Get layout presets',
        'GET /layout-templates': 'List layout templates',
        'POST /layout-templates': 'Create layout template',
        'POST /rooms/:roomId/apply-template/:templateId': 'Apply template to room'
      },
      themes: {
        'GET /themes': 'List all themes',
        'GET /themes/:id': 'Get specific theme',
        'POST /themes': 'Create new theme',
        'PUT /themes/:id': 'Update theme',
        'DELETE /themes/:id': 'Delete theme',
        'POST /rooms/:roomId/theme': 'Apply theme to room',
        'GET /themes/:themeId/assets': 'Get theme assets'
      },
      notifications: {
        'POST /rooms/:id/notifications/audio': 'Upload notification audio',
        'GET /rooms/:id/notifications/audio': 'Get notification audio files',
        'DELETE /rooms/:id/notifications/audio/:audioId': 'Delete audio file',
        'GET /rooms/:id/notifications/settings': 'Get notification settings',
        'PUT /rooms/:id/notifications/settings': 'Update notification settings'
      },
      gmCustomization: {
        'GET /rooms/:id/gm-customization': 'Get GM interface customization',
        'PUT /rooms/:id/gm-customization': 'Update GM interface customization'
      },
      system: {
        'GET /health': 'API health check',
        'GET /docs': 'API documentation'
      }
    },
    features: [
      'Structured logging with module context',
      'Consistent error handling',
      'Input validation',
      'WebSocket integration for real-time updates',
      'Trigger system for variable changes'
    ]
  };

  apiLogger.info('API documentation requested', { ip: req.ip });
  res.json(docs);
});

// Mount all API modules (after specific routes)
// Rooms endpoints: /api/v1/rooms/*
router.use('/rooms', roomsRouter);

// Variables endpoints: /api/v1/rooms/:id/variables/*
router.use('/', variablesRouter);

// Timer endpoints: /api/v1/rooms/:id/timer/*
router.use('/', timerRouter);

// Hints endpoints: /api/v1/rooms/:id/hints/*
router.use('/', hintsRouter);

// Rules endpoints: /api/v1/rooms/:id/rules/*
router.use('/', rulesRouter);

// Media endpoints: /api/v1/upload, /api/v1/rooms/:id/media/*, /api/v1/media/*
router.use('/', mediaRouter);

// Lightbox endpoints: /api/v1/rooms/:id/lightbox/*, /api/v1/lightbox/*
router.use('/', lightboxRouter);

// Layout endpoints: /api/v1/rooms/:id/layout/*, /api/v1/layout/*
router.use('/', layoutRouter);

// Themes endpoints: /api/v1/themes/*, /api/v1/rooms/:id/theme
router.use('/', themesRouter);

// Notifications endpoints: /api/v1/rooms/:id/notifications/*
router.use('/', notificationsRouter);

// GM Customization endpoints: /api/v1/rooms/:id/gm-customization
router.use('/', gmCustomizationRouter);

// 404 handler for unmatched API routes
router.use((req, res) => {
  apiLogger.warn('API endpoint not found', {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip
  });
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    method: req.method,
    path: req.originalUrl,
    version: 'v1'
  });
});

apiLogger.info('API v1 router initialized with modular endpoints');

module.exports = router;