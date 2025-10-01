const { logger } = require('../../../utils/logger');

/**
 * Layout management handlers for WebSocket connections
 */
function setupLayoutHandlers(socket, io) {
  const layoutLogger = logger.child({ module: 'layout-websocket' });

  // Layout preview handler
  socket.on('layout_preview', ({ roomId, layout, source }) => {
    if (!roomId || !layout) {
      layoutLogger.warn('Invalid layout preview parameters', { roomId, hasLayout: !!layout, socketId: socket.id });
      return socket.emit('error', 'Invalid layout preview parameters');
    }

    layoutLogger.info('Layout preview requested', {
      roomId,
      source: source || 'unknown',
      layoutKeys: Object.keys(layout).length,
      socketId: socket.id
    });

    // Broadcast layout preview to all clients in the room except sender
    socket.to(roomId).emit('layout_preview', {
      layout,
      source: source || 'admin',
      timestamp: new Date().toISOString()
    });
  });

  // Apply layout handler
  socket.on('apply_layout', ({ roomId, layout }) => {
    if (!roomId || !layout) {
      layoutLogger.warn('Invalid layout application parameters', { roomId, hasLayout: !!layout, socketId: socket.id });
      return socket.emit('error', 'Invalid layout application parameters');
    }

    layoutLogger.info('Layout application requested', {
      roomId,
      layoutKeys: Object.keys(layout).length,
      socketId: socket.id
    });

    // Broadcast layout update to all clients in the room
    io.to(roomId).emit('layout_updated', {
      layout,
      timestamp: new Date().toISOString()
    });
  });

  // Layout builder live preview
  socket.on('builder_preview', ({ roomId, layout }) => {
    if (!roomId || !layout) {
      layoutLogger.warn('Invalid builder preview parameters', { roomId, hasLayout: !!layout, socketId: socket.id });
      return socket.emit('error', 'Invalid builder preview parameters');
    }

    layoutLogger.debug('Builder preview requested', {
      roomId,
      layoutKeys: Object.keys(layout).length,
      socketId: socket.id
    });

    // Send preview to all clients in the room
    io.to(roomId).emit('builder_preview', {
      layout,
      source: 'builder',
      timestamp: new Date().toISOString()
    });

    // Confirm to sender
    socket.emit('preview_sent', { roomId });
  });

  // Layout validation request
  socket.on('validate_layout', ({ layout }) => {
    if (!layout) {
      layoutLogger.warn('Layout configuration required for validation', { socketId: socket.id });
      return socket.emit('error', 'Layout configuration required for validation');
    }

    layoutLogger.debug('Layout validation requested', {
      layoutKeys: Object.keys(layout).length,
      socketId: socket.id
    });

    // Basic validation - in production this would use the full schema validator
    const result = {
      valid: true,
      errors: []
    };

    try {
      // Check for required layouts object
      if (!layout.layouts || typeof layout.layouts !== 'object') {
        result.valid = false;
        result.errors.push('Layout configuration must contain a "layouts" object');
      }

      // Check for default layout
      if (layout.layouts && !layout.layouts.default) {
        result.valid = false;
        result.errors.push('Layout configuration must contain a "default" layout');
      }

      // Additional validation could be added here
      // - Check for valid breakpoints
      // - Validate component configurations
      // - Check for circular dependencies

      socket.emit('layout_validation_result', result);

      layoutLogger.debug('Layout validation completed', {
        valid: result.valid,
        errorCount: result.errors.length,
        socketId: socket.id
      });

    } catch (error) {
      layoutLogger.error('Layout validation error', {
        error: error.message,
        socketId: socket.id
      });

      socket.emit('layout_validation_result', {
        valid: false,
        errors: [`Validation error: ${error.message}`]
      });
    }
  });
}

module.exports = { setupLayoutHandlers };