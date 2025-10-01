const { logger } = require('../../../utils/logger');

/**
 * Chat and hint handlers for WebSocket connections
 */
function setupChatHandlers(socket, io) {
  const chatLogger = logger.child({ module: 'chat-websocket' });

  // Legacy hint broadcast (keeping for backward compatibility)
  socket.on('send_hint', ({ roomId, hint }) => {
    if (!roomId || typeof hint !== 'string' || hint.length === 0 || hint.length > 500) {
      chatLogger.warn('Invalid legacy hint format', { roomId, hintLength: hint?.length, socketId: socket.id });
      return socket.emit('error', 'Invalid hint format');
    }

    const sanitizedHint = hint.trim();

    chatLogger.info('Legacy hint sent', {
      roomId,
      hintLength: sanitizedHint.length,
      socketId: socket.id
    });

    // Legacy event (keeping for older clients)
    socket.to(roomId).emit('receive_hint', sanitizedHint);

    // New unified event
    io.to(roomId).emit('hintReceived', {
      message: sanitizedHint,
      timestamp: new Date().toISOString(),
      source: 'gm'
    });

    // Acknowledge to sender
    socket.emit('hintConfirmed', sanitizedHint);
  });

  // New GM hint broadcast (preferred)
  socket.on('sendHint', ({ roomId, message }) => {
    if (!roomId || typeof message !== 'string' || message.length === 0 || message.length > 500) {
      chatLogger.warn('Invalid hint format', { roomId, messageLength: message?.length, socketId: socket.id });
      return socket.emit('error', 'Invalid hint format');
    }

    const sanitizedMessage = message.trim();

    chatLogger.info('Hint sent', {
      roomId,
      messageLength: sanitizedMessage.length,
      socketId: socket.id
    });

    const hintData = {
      message: sanitizedMessage,
      timestamp: new Date().toISOString(),
      source: 'gm'
    };

    io.to(roomId).emit('hintReceived', hintData);

    // Keep legacy event for any older clients
    io.to(roomId).emit('receive_hint', sanitizedMessage);

    socket.emit('hintConfirmed', sanitizedMessage);
  });

  // Two-way chat between GM and Player
  socket.on('chat_message', ({ roomId, sender, message, timestamp }) => {
    if (!roomId || typeof message !== 'string' || message.trim() === '') {
      chatLogger.warn('Invalid chat message', { roomId, sender, messageLength: message?.length, socketId: socket.id });
      return socket.emit('error', 'Invalid chat message');
    }

    const safeSender = ['gm', 'player'].includes(sender) ? sender : 'unknown';
    const sanitizedMessage = message.slice(0, 500).trim(); // Limit message length
    const messageTimestamp = timestamp || new Date().toISOString();

    chatLogger.info('Chat message sent', {
      roomId,
      sender: safeSender,
      messageLength: sanitizedMessage.length,
      socketId: socket.id
    });

    const payload = {
      sender: safeSender,
      message: sanitizedMessage,
      timestamp: messageTimestamp
    };

    io.to(roomId).emit('chat_message', payload);
  });

  // Clear chat handler
  socket.on('clear_chat', ({ roomId }) => {
    if (!roomId) {
      chatLogger.warn('Invalid room ID for clear chat', { roomId, socketId: socket.id });
      return socket.emit('error', 'Invalid room ID');
    }

    chatLogger.info('Chat cleared for room', { roomId, socketId: socket.id });
    io.to(roomId).emit('clear_chat');
  });

  // Clear hints handler
  socket.on('clear_hints', ({ roomId }) => {
    if (!roomId) {
      chatLogger.warn('Invalid room ID for clear hints', { roomId, socketId: socket.id });
      return socket.emit('error', 'Invalid room ID');
    }

    chatLogger.info('Hints cleared for room', { roomId, socketId: socket.id });
    io.to(roomId).emit('clear_hints');
  });

  // Lightbox media display handler (supports text-only + autoclose settings)
  socket.on('show_lightbox', ({ roomId, mediaId, headline, autoCloseEnabled = true, autoCloseSeconds = 5 }) => {
    if (!roomId) {
      chatLogger.warn('Invalid lightbox parameters', { roomId, socketId: socket.id });
      return socket.emit('error', 'Invalid lightbox parameters');
    }

    chatLogger.info('Lightbox requested', {
      roomId,
      mediaId,
      headline: headline ? 'present' : 'none',
      autoCloseEnabled,
      autoCloseSeconds,
      socketId: socket.id
    });

    io.to(roomId).emit('show_lightbox', {
      mediaId: mediaId || null,
      headline: headline || '',
      autoCloseEnabled,
      autoCloseSeconds
    });
  });
}

module.exports = { setupChatHandlers };