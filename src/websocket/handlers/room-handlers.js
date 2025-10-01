const { logger } = require('../../../utils/logger');
const { getDatabase } = require('../../../db/database');

/**
 * Room connection and management handlers for WebSocket connections
 */
function setupRoomHandlers(socket, io, timerService) {
  const roomLogger = logger.child({ module: 'room-websocket' });

  // Join room and track connection type (GM/player)
  socket.on('join_room', ({ roomId, clientType }) => {
    if (!roomId || !['gm', 'player'].includes(clientType)) {
      roomLogger.warn('Invalid join parameters', { roomId, clientType, socketId: socket.id });
      return socket.emit('error', 'Invalid join parameters');
    }

    socket.join(roomId);
    socket.roomId = roomId;
    socket.clientType = clientType;

    roomLogger.info(`Client joined room`, {
      roomId,
      clientType,
      socketId: socket.id,
      totalRoomClients: io.sockets.adapter.rooms.get(roomId)?.size || 0
    });

    // Initialize timers for room if they don't exist
    try {
      const db = getDatabase();
      const room = db.prepare('SELECT timer_duration, secondary_timer_enabled, secondary_timer_duration FROM rooms WHERE id = ?').get(roomId);

      if (room) {
        // Initialize primary timer
        const defaultDuration = room.timer_duration > 0 ? room.timer_duration : 300;
        const timer = timerService.initializeTimer(roomId, defaultDuration, 'main');

        // Send current timer state to the client
        socket.emit('timer_update', timerService.getTimerState(roomId, 'main'));

        // Initialize secondary timer if enabled
        if (room.secondary_timer_enabled) {
          const secondaryDuration = room.secondary_timer_duration > 0 ? room.secondary_timer_duration : 300;
          timerService.initializeTimer(roomId, secondaryDuration, 'secondary');

          // Send secondary timer state if enabled
          const secondaryState = timerService.getTimerState(roomId, 'secondary');
          if (secondaryState) {
            socket.emit('secondary_timer_update', secondaryState);
          }
        }

        roomLogger.debug(`Timers initialized for room`, {
          roomId,
          primaryDuration: defaultDuration,
          secondaryEnabled: room.secondary_timer_enabled,
          secondaryDuration: room.secondary_timer_duration
        });
      } else {
        roomLogger.warn('Room not found in database', { roomId, socketId: socket.id });
        socket.emit('error', 'Room not found');
      }
    } catch (error) {
      roomLogger.error('Error initializing room timers', {
        roomId,
        socketId: socket.id,
        error: error.message
      });
      socket.emit('error', 'Failed to initialize room');
    }
  });

  // Admin-specific room joining for layout management
  socket.on('join_admin', ({ roomId }) => {
    if (!roomId) {
      roomLogger.warn('Invalid admin join parameters', { roomId, socketId: socket.id });
      return socket.emit('error', 'Invalid admin join parameters');
    }

    socket.join(`admin_${roomId}`);
    socket.adminRoomId = roomId;

    roomLogger.info(`Admin joined room for management`, {
      roomId,
      socketId: socket.id
    });

    // Send current room configuration to admin
    try {
      const db = getDatabase();
      const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);

      if (room) {
        let config = {};
        try {
          config = JSON.parse(room.config || '{}');
        } catch (e) {
          config = {};
          roomLogger.warn('Failed to parse room config', { roomId, error: e.message });
        }

        socket.emit('room_config', {
          roomId,
          config,
          layout: config.layout || {}
        });

        roomLogger.debug('Room config sent to admin', { roomId, socketId: socket.id });
      } else {
        roomLogger.warn('Room not found for admin join', { roomId, socketId: socket.id });
        socket.emit('error', 'Room not found');
      }
    } catch (error) {
      roomLogger.error('Error sending room config to admin', {
        roomId,
        socketId: socket.id,
        error: error.message
      });
      socket.emit('error', 'Failed to load room configuration');
    }
  });

  // Handle client disconnect
  socket.on('disconnect', () => {
    const disconnectInfo = {
      socketId: socket.id,
      roomId: socket.roomId,
      clientType: socket.clientType,
      adminRoomId: socket.adminRoomId
    };

    roomLogger.info('Client disconnected', disconnectInfo);

    // Clean up any room-specific resources if needed
    // Note: We don't clear timers on disconnect as other clients may still be connected
  });
}

module.exports = { setupRoomHandlers };