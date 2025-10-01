const { logger } = require('../../utils/logger');
const { setupRoomHandlers } = require('./handlers/room-handlers');
const { setupTimerHandlers } = require('./handlers/timer-handlers');
const { setupChatHandlers } = require('./handlers/chat-handlers');
const { setupLayoutHandlers } = require('./handlers/layout-handlers');

/**
 * Initialize WebSocket server with all handlers
 */
function initializeWebSocket(io, timerService) {
  const wsLogger = logger.child({ module: 'websocket-main' });

  wsLogger.info('Initializing WebSocket server');

  io.on('connection', (socket) => {
    const connectionInfo = {
      socketId: socket.id,
      ip: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent']?.substring(0, 100)
    };

    wsLogger.info('New WebSocket connection', connectionInfo);

    // Set up all handler modules
    try {
      setupRoomHandlers(socket, io, timerService);
      setupTimerHandlers(socket, io, timerService);
      setupChatHandlers(socket, io);
      setupLayoutHandlers(socket, io);

      wsLogger.debug('WebSocket handlers initialized', { socketId: socket.id });
    } catch (error) {
      wsLogger.error('Error setting up WebSocket handlers', {
        socketId: socket.id,
        error: error.message,
        stack: error.stack
      });
    }

    // Handle connection errors
    socket.on('error', (error) => {
      wsLogger.error('WebSocket error', {
        socketId: socket.id,
        error: error.message,
        roomId: socket.roomId,
        clientType: socket.clientType
      });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      wsLogger.info('WebSocket disconnection', {
        socketId: socket.id,
        reason,
        roomId: socket.roomId,
        clientType: socket.clientType,
        duration: Date.now() - socket.handshake.time
      });
    });
  });

  // Handle server-level WebSocket errors
  io.engine.on('connection_error', (err) => {
    wsLogger.error('WebSocket connection error', {
      code: err.code,
      message: err.message,
      context: err.context
    });
  });

  wsLogger.info('WebSocket server initialized successfully');
  return io;
}

module.exports = { initializeWebSocket };