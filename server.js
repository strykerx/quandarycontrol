const express = require('express');
const { Server } = require('socket.io');
const { nanoid } = require('nanoid');
const { getDatabase } = require('./db/database');
const path = require('path');
const multer = require('multer');
const Ajv = require('ajv');
const ShortcodeParser = require('./utils/shortcode-parser');

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

/* Dynamic room routes */
app.get('/room/:roomId/player', (req, res) => {
  try {
    const { roomId } = req.params;
    const db = getDatabase();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
    
    if (!room) {
      return res.status(404).send('Room not found');
    }
    
    // Parse room config to get theme
    let config = {};
    try {
      config = JSON.parse(room.config || '{}');
    } catch (error) {
      console.warn('Failed to parse room config:', error);
    }
    
    const themeName = config.theme || 'example-theme';
    const parser = new ShortcodeParser();
    
    // Room data for shortcode rendering
    const roomData = {
      id: room.id,
      name: room.name,
      shortcode: room.shortcode,
      config: config
    };
    
    try {
      const themedHTML = parser.loadTheme(themeName, roomData);
      res.send(themedHTML);
    } catch (error) {
      console.error('Error loading theme:', error);
      // Fallback to default player.html
      res.sendFile(__dirname + '/public/player.html');
    }
  } catch (error) {
    console.error('Error in player route:', error);
    res.status(500).send('Server error');
  }
});

/* Barebones player route (template-driven) */
app.get('/room/:roomId/player-bare', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'player-bare.html'));
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

// Serve theme assets
app.use('/themes', express.static('themes'));

// Static files should come after specific routes
app.use(express.static('public'));

// API routes
const { router } = require('./routes/api');
app.use('/api', router);
app.use('/api/templates', require('./api/template-routes'));

// Layout endpoints
app.put('/rooms/:roomId/layout', (req, res) => {
  try {
    const { roomId } = req.params;
    const { layout } = req.body;
    
    if (!layout) {
      return res.status(400).json({ success: false, error: 'Layout data is required' });
    }
    
    const db = getDatabase();
    
    // Check if room exists
    const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    
    // Check if layout already exists for this room
    const existingLayout = db.prepare('SELECT id FROM room_layouts WHERE room_id = ? AND is_active = TRUE').get(roomId);
    
    if (existingLayout) {
      // Update existing layout
      const updateStmt = db.prepare(`
        UPDATE room_layouts
        SET layout = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      updateStmt.run(JSON.stringify(layout), existingLayout.id);
    } else {
      // Create new layout
      const layoutId = nanoid();
      const insertStmt = db.prepare(`
        INSERT INTO room_layouts (id, room_id, layout, is_active)
        VALUES (?, ?, ?, TRUE)
      `);
      insertStmt.run(layoutId, roomId, JSON.stringify(layout));
    }
    
    // Emit layout update to all clients in the room
    io.to(roomId).emit('layout_updated', {
      layout,
      timestamp: new Date().toISOString()
    });
    
    res.json({ success: true, message: 'Layout saved successfully' });
  } catch (error) {
    console.error('Error saving layout:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/rooms/:roomId/layout', (req, res) => {
  try {
    const { roomId } = req.params;
    
    const db = getDatabase();
    
    // Check if room exists
    const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    
    // Get active layout for this room
    const layout = db.prepare('SELECT layout FROM room_layouts WHERE room_id = ? AND is_active = TRUE').get(roomId);
    
    if (layout) {
      res.json({
        success: true,
        data: JSON.parse(layout.layout)
      });
    } else {
      res.json({
        success: true,
        data: null
      });
    }
  } catch (error) {
    console.error('Error loading layout:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Socket.io connection handler
// Track active timers per room
const activeTimers = new Map();
const activeSecondaryTimers = new Map();

// Track triggered timer actions to avoid duplicate triggers
const triggeredActions = new Map();

// Function to check secondary timer triggers
function checkSecondaryTimerTriggers(roomId, remainingSeconds) {
  try {
    const db = getDatabase();
    const room = db.prepare('SELECT config, api_variables FROM rooms WHERE id = ?').get(roomId);
    
    if (!room) return;
    
    let config = {};
    let variables = {};
    
    try {
      config = JSON.parse(room.config || '{}');
      variables = JSON.parse(room.api_variables || '{}');
    } catch (error) {
      console.warn('Failed to parse room config or variables:', error);
      return;
    }
    
    // Check for secondary timer triggers in config
    if (config.secondaryTimerTriggers && Array.isArray(config.secondaryTimerTriggers)) {
      const roomTriggers = triggeredActions.get(roomId) || new Set();
      
      config.secondaryTimerTriggers.forEach(trigger => {
        if (trigger.timeSeconds === remainingSeconds) {
          const triggerKey = `${roomId}_${trigger.timeSeconds}_${trigger.action}`;
          
          // Only trigger once per session
          if (!roomTriggers.has(triggerKey)) {
            roomTriggers.add(triggerKey);
            triggeredActions.set(roomId, roomTriggers);
            
            console.log(`Triggering secondary timer action for room ${roomId} at ${remainingSeconds}s:`, trigger);
            
            // Execute the trigger action
            executeTimerTriggerAction(roomId, trigger, remainingSeconds);
          }
        }
      });
    }
  } catch (error) {
    console.error('Error checking secondary timer triggers:', error);
  }
}

// Function to execute timer trigger actions
function executeTimerTriggerAction(roomId, trigger, remainingSeconds) {
  try {
    switch (trigger.action) {
      case 'show_media':
        if (trigger.mediaId || trigger.headline) {
          io.to(roomId).emit('show_lightbox', {
            mediaId: trigger.mediaId || null,
            headline: trigger.headline || `Timer trigger at ${remainingSeconds}s`,
            autoCloseEnabled: trigger.autoClose !== false,
            autoCloseSeconds: trigger.autoCloseSeconds || 5
          });
        }
        break;
        
      case 'update_variable':
        if (trigger.variableName && trigger.variableValue !== undefined) {
          io.to(roomId).emit('variableUpdate', {
            name: trigger.variableName,
            value: trigger.variableValue,
            type: typeof trigger.variableValue,
            source: 'secondary_timer'
          });
        }
        break;
        
      case 'send_hint':
        if (trigger.message) {
          io.to(roomId).emit('hintReceived', {
            message: trigger.message,
            timestamp: new Date().toISOString(),
            source: 'secondary_timer'
          });
        }
        break;
        
      case 'play_sound':
        if (trigger.soundId) {
          io.to(roomId).emit('play_sound', {
            soundId: trigger.soundId,
            volume: trigger.volume || 1.0
          });
        }
        break;
        
      default:
        console.warn('Unknown timer trigger action:', trigger.action);
    }
  } catch (error) {
    console.error('Error executing timer trigger action:', error);
  }
}

io.on('connection', (socket) => {
  console.log('New client connected');

  // Join room and track connection type (GM/player)
  socket.on('join_room', ({ roomId, clientType }) => {
    if (!roomId || !['gm', 'player'].includes(clientType)) {
      return socket.emit('error', 'Invalid join parameters');
    }

    socket.join(roomId);
    console.log(`Client (${clientType}) joined room ${roomId}`);
    
    // Initialize timers for every room and send current state to client
    const db = getDatabase();
    const room = db.prepare('SELECT timer_duration, secondary_timer_enabled, secondary_timer_duration FROM rooms WHERE id = ?').get(roomId);
    
    // Initialize primary timer
    if (!activeTimers.has(roomId)) {
      const defaultDuration = room?.timer_duration > 0 ? room.timer_duration : 300; // Default to 5 minutes
      activeTimers.set(roomId, {
        duration: defaultDuration,
        remaining: defaultDuration,
        interval: null
      });
    }
    
    // Initialize secondary timer if enabled
    if (room?.secondary_timer_enabled && !activeSecondaryTimers.has(roomId)) {
      const secondaryDuration = room?.secondary_timer_duration > 0 ? room.secondary_timer_duration : 300;
      activeSecondaryTimers.set(roomId, {
        duration: secondaryDuration,
        remaining: secondaryDuration,
        interval: null,
        enabled: true
      });
    }
    
    // Send current timer states to the client
    const timer = activeTimers.get(roomId);
    socket.emit('timer_update', {
      remaining: timer.remaining,
      duration: timer.duration,
      running: !!timer.interval
    });
    
    // Send secondary timer state if enabled
    const secondaryTimer = activeSecondaryTimers.get(roomId);
    if (secondaryTimer) {
      socket.emit('secondary_timer_update', {
        remaining: secondaryTimer.remaining,
        duration: secondaryTimer.duration,
        running: !!secondaryTimer.interval,
        enabled: secondaryTimer.enabled
      });
    }
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

  // Secondary timer control handler
  socket.on('secondary_timer_control', ({ roomId, action, amount }) => {
    console.log('Secondary timer control received:', { roomId, action, amount });
    
    if (!activeSecondaryTimers.has(roomId)) {
      console.log('No secondary timer found for room:', roomId);
      return;
    }

    const timer = activeSecondaryTimers.get(roomId);
    console.log('Secondary timer found:', timer);
    
    switch(action) {
      case 'start':
        if (!timer.interval) {
          timer.startTime = Date.now() - (timer.duration - timer.remaining) * 1000;
          timer.interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - timer.startTime) / 1000);
            timer.remaining = Math.max(timer.duration - elapsed, 0);
            
            io.to(roomId).emit('secondary_timer_update', {
              remaining: timer.remaining,
              duration: timer.duration,
              running: true,
              enabled: timer.enabled
            });

            // Check for variable triggers at specific time intervals
            checkSecondaryTimerTriggers(roomId, timer.remaining);

            if (timer.remaining <= 0) {
              clearInterval(timer.interval);
              timer.interval = null;
              io.to(roomId).emit('secondary_timer_complete');
              // Trigger any actions for timer completion
              checkSecondaryTimerTriggers(roomId, 0);
            }
          }, 1000);
        }
        break;

      case 'pause':
        if (timer.interval) {
          clearInterval(timer.interval);
          timer.interval = null;
          io.to(roomId).emit('secondary_timer_update', {
            remaining: timer.remaining,
            duration: timer.duration,
            running: false,
            enabled: timer.enabled
          });
        }
        break;

      case 'stop':
        clearInterval(timer.interval);
        timer.interval = null;
        timer.remaining = timer.duration;
        io.to(roomId).emit('secondary_timer_update', {
          remaining: timer.remaining,
          duration: timer.duration,
          running: false,
          enabled: timer.enabled
        });
        break;

      case 'adjust':
        const newDuration = timer.duration + amount;
        if (newDuration > 0) {
          timer.duration = newDuration;
          if (!timer.interval) {
            timer.remaining = timer.duration;
          }
          io.to(roomId).emit('secondary_timer_update', {
            remaining: timer.remaining,
            duration: timer.duration,
            running: !!timer.interval,
            enabled: timer.enabled
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
  socket.on('chat_message', ({ roomId, sender, message, timestamp }) => {
    if (!roomId || typeof message !== 'string' || message.trim() === '') {
      return socket.emit('error', 'Invalid chat message');
    }
    const safeSender = ['gm', 'player'].includes(sender) ? sender : 'unknown';
    const messageTimestamp = timestamp || new Date().toISOString();
    const payload = { sender: safeSender, message: message.slice(0, 500), timestamp: messageTimestamp };
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
  
  // Layout builder live preview
  socket.on('builder_preview', ({ roomId, layout }) => {
    if (!roomId || !layout) {
      return socket.emit('error', 'Invalid builder preview parameters');
    }

    console.log('Builder preview requested for room:', roomId);
    
    // Send preview to all clients in the room
    io.to(roomId).emit('builder_preview', {
      layout,
      source: 'builder',
      timestamp: new Date().toISOString()
    });
    
    // Confirm to sender
    socket.emit('preview_sent', { roomId });
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