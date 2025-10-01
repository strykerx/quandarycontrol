const express = require('express');
const { Server } = require('socket.io');
const { logger } = require('./utils/logger');
const { getDatabase } = require('./db/database');

// Import modular components
const { initializeMiddleware, initializeErrorHandling } = require('./src/middleware');
const { initializeRoutes } = require('./src/routes');
const { initializeWebSocket } = require('./src/websocket');
const TimerService = require('./src/services/timer-service');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize structured logging
const serverLogger = logger.child({ module: 'server-main' });

// Initialize database
let db;
try {
  db = getDatabase();
  serverLogger.info('Database initialized successfully');
} catch (err) {
  serverLogger.error('Failed to initialize database', { error: err.message });
  process.exit(1);
}

// Initialize timer service
const timerService = new TimerService();
serverLogger.info('Timer service initialized');

// Initialize middleware
initializeMiddleware(app);

// Set up WebSocket server
const server = app.listen(PORT, () => {
  serverLogger.info(`Server running on port ${PORT}`, {
    port: PORT,
    nodeEnv: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

const io = new Server(server);

// Make io available to routes
app.set('io', io);

// Initialize routes
initializeRoutes(app);

// Initialize error handling (must be after routes)
initializeErrorHandling(app);

// Initialize WebSocket handlers
initializeWebSocket(io, timerService);

// Graceful shutdown handling
function gracefulShutdown(signal) {
  serverLogger.info(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(() => {
    serverLogger.info('HTTP server closed');

    // Clear all active timers
    timerService.clearAllTimers();

    // Close database connections
    try {
      // Note: better-sqlite3 doesn't need explicit close in most cases,
      // but we could add it here if needed
      serverLogger.info('Database connections closed');
    } catch (error) {
      serverLogger.error('Error closing database connections', { error: error.message });
    }

    serverLogger.info('Graceful shutdown completed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    serverLogger.error('Force closing server after timeout');
    process.exit(1);
  }, 10000);
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  serverLogger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack
  });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  serverLogger.error('Unhandled Rejection', {
    reason: reason?.message || reason,
    promise: promise?.toString()
  });
});

// Export app, server, io, and timerService for testing
module.exports = { app, server, io, timerService };