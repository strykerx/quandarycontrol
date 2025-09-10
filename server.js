const express = require('express');
const { Server } = require('socket.io');
const { nanoid } = require('nanoid');
const { getDatabase } = require('./db/database');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
let db;
try {
  db = getDatabase();
} catch (err) {
  console.error('Failed to initialize database:', err);
  process.exit(1);
}

// Set up WebSocket server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
const io = new Server(server);

// Export app and server for testing
module.exports = { app, server, io };

// Basic middleware
app.use(express.json());

// Serve admin interface at root
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/admin.html');
});

// Dynamic room routes
app.get('/room/:roomId/player', (req, res) => {
  res.sendFile(__dirname + '/public/player.html');
});

// Shortcode-based player access route
app.get('/p/:shortcode', (req, res) => {
  try {
    // Import database functions to lookup room by shortcode
    const { getDatabase } = require('./db/database');

    const { shortcode } = req.params;
    const db = getDatabase();

    // Check if shortcode is already a room ID (legacy support)
    let room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(shortcode);

    if (!room) {
      // Try to find by shortcode
      room = db.prepare('SELECT * FROM rooms WHERE shortcode = ?').get(shortcode.toUpperCase());
    }

    if (!room) {
      return res.status(404).sendFile(__dirname + '/public/player-not-found.html');
    }

    // Redirect to room view with resolved room ID
    res.redirect(`/room/${room.id}/player`);
  } catch (error) {
    console.error('Error handling shortcode route:', error);
    res.status(500).send('Server error');
  }
});

app.get('/room/:roomId/gm', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'gm.html'));
});

// Rules editor route
app.get('/room/:roomId/rules-editor', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'rules-editor.html'));
});

// Rules slideshow route
app.get('/room/:roomId/rules-slideshow', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'rules-slideshow.html'));
});

// Static files should come after specific routes
app.use(express.static('public'));

// API routes
app.use('/api', require('./routes/api'));

// Socket.io connection handler
// Track active timers per room
const activeTimers = new Map();

io.on('connection', (socket) => {
  console.log('New client connected');

  // Join room and track connection type (GM/player)
  socket.on('join_room', ({ roomId, clientType }) => {
    if (!roomId || !['gm', 'player'].includes(clientType)) {
      return socket.emit('error', 'Invalid join parameters');
    }

    socket.join(roomId);
    console.log(`Client (${clientType}) joined room ${roomId}`);
    
    // Initialize timer for every room and send current state to client
    const db = getDatabase();
    const room = db.prepare('SELECT timer_duration FROM rooms WHERE id = ?').get(roomId);
    
    if (!activeTimers.has(roomId)) {
      const defaultDuration = room?.timer_duration > 0 ? room.timer_duration : 300; // Default to 5 minutes
      activeTimers.set(roomId, {
        duration: defaultDuration,
        remaining: defaultDuration,
        interval: null
      });
    }
    
    // Send current timer state to the client
    const timer = activeTimers.get(roomId);
    socket.emit('timer_update', {
      remaining: timer.remaining,
      duration: timer.duration,
      running: !!timer.interval
    });
  });

  // Timer control handlers
  // Unified timer control handler
  socket.on('timer_control', ({ roomId, action, amount }) => {
    console.log('Timer control received:', { roomId, action, amount });
    console.log('Active timers:', Array.from(activeTimers.keys()));
    
    if (!activeTimers.has(roomId)) {
      console.log('No timer found for room:', roomId);
      return;
    }

    const timer = activeTimers.get(roomId);
    console.log('Timer found:', timer);
    
    switch(action) {
      case 'start':
        if (!timer.interval) {
          timer.startTime = Date.now() - (timer.duration - timer.remaining) * 1000;
          timer.interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - timer.startTime) / 1000);
            timer.remaining = Math.max(timer.duration - elapsed, 0);
            
            io.to(roomId).emit('timer_update', {
              remaining: timer.remaining,
              duration: timer.duration,
              running: true
            });

            if (timer.remaining <= 0) {
              clearInterval(timer.interval);
              timer.interval = null;
              io.to(roomId).emit('timer_complete');
            }
          }, 1000);
        }
        break;

      case 'pause':
        if (timer.interval) {
          clearInterval(timer.interval);
          timer.interval = null;
          io.to(roomId).emit('timer_update', {
            remaining: timer.remaining,
            duration: timer.duration,
            running: false
          });
        }
        break;

      case 'stop':
        clearInterval(timer.interval);
        timer.interval = null;
        timer.remaining = timer.duration;
        io.to(roomId).emit('timer_update', {
          remaining: timer.remaining,
          duration: timer.duration,
          running: false
        });
        break;

      case 'adjust':
        const newDuration = timer.duration + amount;
        if (newDuration > 0) {
          timer.duration = newDuration;
          if (!timer.interval) {
            timer.remaining = timer.duration;
          }
          io.to(roomId).emit('timer_update', {
            remaining: timer.remaining,
            duration: timer.duration,
            running: !!timer.interval
          });
        }
        break;
    }
  });

  // Message broadcasting (legacy)
  socket.on('send_hint', ({ roomId, hint }) => {
    if (typeof hint !== 'string' || hint.length > 500) {
      return socket.emit('error', 'Invalid hint format');
    }
    // Legacy event
    socket.to(roomId).emit('receive_hint', hint);
    // New unified event
    io.to(roomId).emit('hintReceived', { message: hint, timestamp: new Date().toISOString() });
    // Acknowledge to sender
    socket.emit('hintConfirmed', hint);
  });

  // New: GM hint broadcast (preferred)
  socket.on('sendHint', ({ roomId, message }) => {
    if (typeof message !== 'string' || message.length === 0 || message.length > 500) {
      return socket.emit('error', 'Invalid hint format');
    }
    io.to(roomId).emit('hintReceived', { message, timestamp: new Date().toISOString() });
    // Keep legacy event for any older clients
    io.to(roomId).emit('receive_hint', message);
    socket.emit('hintConfirmed', message);
  });

  // New: Two-way chat between GM and Player
  socket.on('chat_message', ({ roomId, sender, message }) => {
    if (!roomId || typeof message !== 'string' || message.trim() === '') {
      return socket.emit('error', 'Invalid chat message');
    }
    const safeSender = ['gm', 'player'].includes(sender) ? sender : 'unknown';
    const payload = { sender: safeSender, message: message.slice(0, 500), timestamp: new Date().toISOString() };
    io.to(roomId).emit('chat_message', payload);
  });

  // Clear chat handler
  socket.on('clear_chat', ({ roomId }) => {
    if (!roomId) {
      return socket.emit('error', 'Invalid room ID');
    }
    console.log('Clear chat requested for room:', roomId);
    io.to(roomId).emit('clear_chat');
  });

  // Clear hints handler
  socket.on('clear_hints', ({ roomId }) => {
    if (!roomId) {
      return socket.emit('error', 'Invalid room ID');
    }
    console.log('Clear hints requested for room:', roomId);
    io.to(roomId).emit('clear_hints');
  });

  // Lightbox media display handler (supports text-only + autoclose settings)
  socket.on('show_lightbox', ({ roomId, mediaId, headline, autoCloseEnabled = true, autoCloseSeconds = 5 }) => {
    if (!roomId) {
      return socket.emit('error', 'Invalid lightbox parameters');
    }

    console.log('Show lightbox requested for room:', roomId, 'media:', mediaId);
    io.to(roomId).emit('show_lightbox', {
      mediaId: mediaId || null,
      headline: headline || '',
      autoCloseEnabled,
      autoCloseSeconds
    });
  });

  // Layout preview and configuration handlers
  socket.on('layout_preview', ({ roomId, layout, source }) => {
    if (!roomId || !layout) {
      return socket.emit('error', 'Invalid layout preview parameters');
    }

    console.log('Layout preview requested for room:', roomId, 'from:', source);
    
    // Broadcast layout preview to all clients in the room except sender
    socket.to(roomId).emit('layout_preview', {
      layout,
      source: source || 'admin',
      timestamp: new Date().toISOString()
    });
  });

  socket.on('apply_layout', ({ roomId, layout }) => {
    if (!roomId || !layout) {
      return socket.emit('error', 'Invalid layout application parameters');
    }

    console.log('Layout application requested for room:', roomId);
    
    // Broadcast layout update to all clients in the room
    io.to(roomId).emit('layout_updated', {
      layout,
      timestamp: new Date().toISOString()
    });
  });

  // Admin-specific room joining for layout management
  socket.on('join_admin', ({ roomId }) => {
    if (!roomId) {
      return socket.emit('error', 'Invalid admin join parameters');
    }

    socket.join(`admin_${roomId}`);
    console.log(`Admin joined room ${roomId} for management`);
    
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
        }
        
        socket.emit('room_config', {
          roomId,
          config,
          layout: config.layout || {}
        });
      }
    } catch (error) {
      console.error('Error sending room config to admin:', error);
    }
  });

  // Layout validation request
  socket.on('validate_layout', ({ layout }) => {
    if (!layout) {
      return socket.emit('error', 'Layout configuration required for validation');
    }

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

      socket.emit('layout_validation_result', result);
    } catch (error) {
      socket.emit('layout_validation_result', {
        valid: false,
        errors: [`Validation error: ${error.message}`]
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});