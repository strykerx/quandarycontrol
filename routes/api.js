const express = require('express');
const { nanoid } = require('nanoid');
const { getDatabase } = require('../db/database');

const path = require('path');
const fs = require('fs');
const multer = require('multer');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
try { fs.mkdirSync(uploadDir, { recursive: true }); } catch (_) {}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname || '');
    const base = nanoid(8);
    cb(null, `${Date.now()}_${base}${ext}`);
  }
});
const upload = multer({ storage });

const router = express.Router();

// Generate unique shortcode (4-6 characters)
function generateShortcode(db) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let shortcode;
  let attempts = 0;

  do {
    // Start with 4 chars, increase if conflicts
    const length = 4 + Math.floor(attempts / 26);
    shortcode = '';
    for (let i = 0; i < length; i++) {
      shortcode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    attempts++;
  } while (attempts < 1000 && findRoomByShortcode(db, shortcode)); // Check uniqueness

  if (attempts >= 1000) {
    throw new Error('Unable to generate unique shortcode');
  }

  return shortcode;
}

// Helper function to find room by shortcode
function findRoomByShortcode(db, shortcode) {
  const stmt = db.prepare('SELECT id FROM rooms WHERE shortcode = ?');
  const result = stmt.get(shortcode);
  return result;
}

// Helper function to find room by shortcode (export for use)
function getRoomByShortcode(db, shortcode) {
  const stmt = db.prepare('SELECT * FROM rooms WHERE shortcode = ?');
  const result = stmt.get(shortcode);
  return result;
}

/**
 * Get all rooms
 */
router.get('/rooms', (req, res) => {
  try {
    const db = getDatabase();
    const rooms = db.prepare('SELECT * FROM rooms ORDER BY created_at DESC').all();
    res.json({ success: true, data: rooms });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get a specific room by ID
 */
router.get('/rooms/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);

    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    res.json({ success: true, data: room });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get a room by shortcode
 */
router.get('/shortcode/:shortcode', (req, res) => {
  try {
    const { shortcode } = req.params;
    const db = getDatabase();
    const room = getRoomByShortcode(db, shortcode.toUpperCase());

    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    res.json({ success: true, data: room });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create a new room
 */
router.post('/rooms', (req, res) => {
  try {
    const { name, config = {}, timer_duration = 0, api_variables = {}, hint_config = {} } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Room name is required' });
    }

    const db = getDatabase();
    const roomId = nanoid();
    const shortcode = generateShortcode(db);

    const insertStmt = db.prepare(`
      INSERT INTO rooms (id, shortcode, name, config, timer_duration, api_variables, hint_config)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      roomId,
      shortcode,
      name,
      JSON.stringify(config),
      timer_duration,
      JSON.stringify(api_variables),
      JSON.stringify(hint_config || {})
    );

    const newRoom = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
    res.status(201).json({ success: true, data: newRoom });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update a room
 */
router.put('/rooms/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, config, timer_duration, api_variables, hint_config } = req.body;
    
    const db = getDatabase();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    
    const updateFields = [];
    const updateValues = [];
    
    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (config !== undefined) {
      updateFields.push('config = ?');
      updateValues.push(JSON.stringify(config));
    }
    if (timer_duration !== undefined) {
      updateFields.push('timer_duration = ?');
      updateValues.push(timer_duration);
    }
    if (api_variables !== undefined) {
      updateFields.push('api_variables = ?');
      updateValues.push(JSON.stringify(api_variables));
    }
    if (hint_config !== undefined) {
      updateFields.push('hint_config = ?');
      updateValues.push(JSON.stringify(hint_config || {}));
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }
    
    updateValues.push(id);
    
    const updateStmt = db.prepare(`
      UPDATE rooms
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `);
    
    const result = updateStmt.run(...updateValues);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    
    const updatedRoom = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    res.json({ success: true, data: updatedRoom });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete a room
 */
router.delete('/rooms/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    
    const deleteStmt = db.prepare('DELETE FROM rooms WHERE id = ?');
    const result = deleteStmt.run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    
    res.json({ success: true, message: 'Room deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get variables for a room
 */
router.get('/rooms/:id/variables', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Parse api_variables JSON column
    let variables = {};
    try {
      variables = JSON.parse(room.api_variables || '{}');
    } catch (e) {
      console.warn(`Invalid JSON in api_variables for room ${id}:`, e);
      variables = {};
    }

    // Convert to array format similar to legacy endpoint
    const variablesArray = Object.entries(variables).map(([name, value], index) => ({
      id: index + 1, // Generate simple ID for compatibility
      room_id: id,
      name: name,
      type: Array.isArray(value) ? 'array' :
           typeof value === 'boolean' ? 'boolean' :
           typeof value === 'number' ? 'integer' : 'string',
      value: typeof value === 'string' ? value : JSON.stringify(value),
      // Include original value for advanced use cases
      parsed_value: value
    }));

    res.json({ success: true, data: variablesArray });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Add or update a variable in a room
 */
router.post('/rooms/:id/variables', (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, value } = req.body;

    if (!name || !type || value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Name, type, and value are required'
      });
    }

    // Support legacy types plus array/object for JSON compatibility
    const validTypes = ['boolean', 'integer', 'string', 'array', 'object'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Type must be one of: ${validTypes.join(', ')}`
      });
    }

    const db = getDatabase();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Parse current api_variables
    let variables = {};
    try {
      variables = JSON.parse(room.api_variables || '{}');
    } catch (e) {
      console.warn(`Invalid JSON in api_variables for room ${id}:`, e);
      variables = {};
    }

    // Process value based on type (maintain compatibility with legacy string-based approach)
    let processedValue;
    switch (type) {
      case 'boolean':
        processedValue = Boolean(value);
        break;
      case 'integer':
        processedValue = Number(value);
        if (isNaN(processedValue)) {
          return res.status(400).json({ success: false, error: 'Invalid integer value' });
        }
        break;
      case 'array':
      case 'object':
        try {
          processedValue = JSON.parse(value);
        } catch (e) {
          return res.status(400).json({ success: false, error: 'Invalid JSON value' });
        }
        break;
      default: // string
        processedValue = String(value);
    }

    // Add/update variable in the JSON object
    variables[name] = processedValue;

    // Update the api_variables column
    const updateStmt = db.prepare('UPDATE rooms SET api_variables = ? WHERE id = ?');
    updateStmt.run(JSON.stringify(variables), id);

    // Return in format compatible with legacy endpoint
    const variableResponse = {
      id: Date.now(), // Generate a fake ID for compatibility
      room_id: id,
      name: name,
      type: type,
      value: String(value),
      parsed_value: processedValue // Include original value for advanced use cases
    };

    res.status(201).json({ success: true, data: variableResponse });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update a specific variable in a room via URL parameters
 */
router.post('/rooms/:roomId/variables/:varName', (req, res) => {
  try {
    const { roomId, varName } = req.params;
    const { value, type = 'string' } = req.body;

    if (value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Value is required in request body'
      });
    }

    const db = getDatabase();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
    
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    let variables = {};
    try {
      variables = JSON.parse(room.api_variables || '{}');
    } catch (e) {
      console.warn(`Invalid JSON in api_variables for room ${roomId}:`, e);
      variables = {};
    }

    // Process value based on type
    let processedValue;
    switch (type) {
      case 'boolean':
        processedValue = Boolean(value);
        break;
      case 'integer':
        processedValue = Number(value);
        if (isNaN(processedValue)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid integer value'
          });
        }
        break;
      case 'array':
      case 'object':
        try {
          processedValue = JSON.parse(value);
        } catch (e) {
          return res.status(400).json({
            success: false,
            error: 'Invalid JSON value'
          });
        }
        break;
      default: // string
        processedValue = String(value);
    }

    variables[varName] = processedValue;

    const updateStmt = db.prepare('UPDATE rooms SET api_variables = ? WHERE id = ?');
    updateStmt.run(JSON.stringify(variables), roomId);

    // Broadcast update via Socket.IO
    const { io } = require('../server');
    io.to(roomId).emit('variable_updated', {
      var: varName,
      value: processedValue,
      timestamp: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      data: { [varName]: processedValue }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get rules for a room
 */
router.get('/rooms/:id/rules', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Fetch all media and filter to metadata.category === 'rules'
    const rows = db.prepare(`
      SELECT * FROM room_media
      WHERE room_id = ?
      ORDER BY order_index ASC, created_at ASC
    `).all(id);

    const rules = rows.filter(r => {
      try {
        const m = JSON.parse(r.metadata || '{}');
        return m.category === 'rules';
      } catch (_) { return false; }
    });

    const data = rules.map(rule => ({
      ...rule,
      metadata: JSON.parse(rule.metadata || '{}')
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Upload rules media for a room
 */
router.post('/rooms/:id/rules', upload.single('media'), (req, res) => {
  try {
    const { id } = req.params;

    const db = getDatabase();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Multipart upload path (file sent as "media")
    if (req.file) {
      const { filename, mimetype, originalname = '', size = 0 } = req.file;

      // Map to existing CHECK(type IN ('image','video','audio','other'))
      let assetType = 'other';
      if (mimetype && typeof mimetype === 'string') {
        if (mimetype.startsWith('image/')) assetType = 'image';
        else if (mimetype.startsWith('video/')) assetType = 'video';
        else if (mimetype.startsWith('audio/')) assetType = 'audio';
      }

      // Compute next order_index among only "rules" category items
      const allRows = db.prepare('SELECT id, metadata, order_index FROM room_media WHERE room_id = ?').all(id);
      let maxIdx = -1;
      for (const r of allRows) {
        try {
          const m = JSON.parse(r.metadata || '{}');
          if (m.category === 'rules' && typeof r.order_index === 'number') {
            if (r.order_index > maxIdx) maxIdx = r.order_index;
          }
        } catch (_) {}
      }
      const indexToUse = maxIdx + 1;

      const mediaId = nanoid();
      const url = `/uploads/${filename}`;
      const title = (req.body && req.body.title) ? req.body.title : (originalname || '');
      const thumbnail_url = '';
      const meta = {
        originalname,
        mimetype,
        size,
        uploaded_at: new Date().toISOString(),
        category: 'rules'
      };

      db.prepare(`
        INSERT INTO room_media (id, room_id, type, title, url, thumbnail_url, metadata, order_index)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        mediaId,
        id,
        assetType,
        title,
        url,
        thumbnail_url,
        JSON.stringify(meta),
        indexToUse
      );

      const created = db.prepare('SELECT * FROM room_media WHERE id = ?').get(mediaId);
      const data = {
        ...created,
        metadata: JSON.parse(created.metadata || '{}')
      };
      
      return res.status(201).json({ success: true, data });
    }

    return res.status(400).json({ success: false, error: 'No file uploaded' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete a rule
 */
router.delete('/rooms/:id/rules/:ruleId', (req, res) => {
  try {
    const { id, ruleId } = req.params;
    const db = getDatabase();

    const existing = db.prepare('SELECT * FROM room_media WHERE id = ? AND room_id = ?').get(ruleId, id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }
    // Ensure this media item is a "rules" item
    let metaOk = false;
    try {
      const m = JSON.parse(existing.metadata || '{}');
      metaOk = m.category === 'rules';
    } catch (_) { metaOk = false; }
    if (!metaOk) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    const result = db.prepare('DELETE FROM room_media WHERE id = ? AND room_id = ?').run(ruleId, id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    res.json({ success: true, message: 'Rule deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update rules order
 */
router.post('/rooms/:id/rules/order', (req, res) => {
  try {
    const { id } = req.params;
    const { ruleIds } = req.body;

    if (!Array.isArray(ruleIds)) {
      return res.status(400).json({ success: false, error: 'ruleIds must be an array' });
    }

    const db = getDatabase();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Verify all rule IDs belong to this room and are category 'rules'
    if (ruleIds.length > 0) {
      const placeholders = ruleIds.map(() => '?').join(',');
      const rows = db.prepare(`SELECT id, metadata FROM room_media WHERE room_id = ? AND id IN (${placeholders})`).all(id, ...ruleIds);
      if (rows.length !== ruleIds.length) {
        return res.status(400).json({ success: false, error: 'One or more items do not belong to the room' });
      }
      const allRules = rows.every(r => {
        try { return JSON.parse(r.metadata || '{}').category === 'rules'; } catch (_) { return false; }
      });
      if (!allRules) {
        return res.status(400).json({ success: false, error: 'One or more items are not rules media' });
      }
    }

    // Update order for each rule
    const tx = db.transaction((updates) => {
      const stmt = db.prepare('UPDATE room_media SET order_index = ? WHERE id = ?');
      updates.forEach((ruleId, index) => {
        stmt.run(index, ruleId);
      });
    });
    tx(ruleIds);

    // Return updated rules list
    const rowsAll = db.prepare(`
      SELECT * FROM room_media
      WHERE room_id = ?
      ORDER BY order_index ASC, created_at ASC
    `).all(id);

    const rules = rowsAll.filter(r => {
      try { return JSON.parse(r.metadata || '{}').category === 'rules'; } catch (_) { return false; }
    });

    const data = rules.map(rule => ({
      ...rule,
      metadata: JSON.parse(rule.metadata || '{}')
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get hints configuration for a room
 */
router.get('/rooms/:id/hints', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    let hints = {};
    try {
      hints = JSON.parse(room.hint_config || '{}');
    } catch (e) {
      console.warn(`Invalid JSON in hint_config for room ${id}:`, e);
      hints = {};
    }

    res.json({ success: true, data: hints });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update hints configuration for a room
 */
router.put('/rooms/:id/hints', (req, res) => {
  try {
    const { id } = req.params;
    const { hints } = req.body;

    if (hints !== null && typeof hints !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Hints configuration must be an object or null'
      });
    }

    const db = getDatabase();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    const updateStmt = db.prepare('UPDATE rooms SET hint_config = ? WHERE id = ?');
    updateStmt.run(JSON.stringify(hints || {}), id);

    res.json({ success: true, data: hints || {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get timer configuration for a room
 */
router.get('/rooms/:id/timer', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    const timerConfig = {
      duration: room.timer_duration,
      // Could be extended with additional JSON-based timer config if needed
    };

    res.json({ success: true, data: timerConfig });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update timer configuration for a room
 */
router.put('/rooms/:id/timer', (req, res) => {
  try {
    const { id } = req.params;
    const { duration } = req.body;

    if (duration === undefined || duration < 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid timer duration is required'
      });
    }

    const db = getDatabase();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    const updateStmt = db.prepare('UPDATE rooms SET timer_duration = ? WHERE id = ?');
    updateStmt.run(duration, id);

    const timerConfig = {
      duration: duration
    };

    res.json({ success: true, data: timerConfig });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Media Storage + Lightbox API (for player lightbox feature)
 * - Tables: room_media, lightbox_sequences (see db/init.sql)
 * - Endpoints cover CRUD and reordering
 */

// Helpers (scoped to this router file)
function parseJsonSafe(str, fallback) {
  try { return JSON.parse(str || (typeof fallback === 'string' ? fallback : JSON.stringify(fallback || {}))); }
  catch (_) { return fallback; }
}
function isValidMediaType(t) {
  return ['image','video','audio','other'].includes(t);
}
function toMediaDTO(row) {
  return {
    ...row,
    metadata: parseJsonSafe(row.metadata, {})
  };
}
function toSequenceDTO(row) {
  return {
    ...row,
    items: parseJsonSafe(row.items, []),
    settings: parseJsonSafe(row.settings, {})
  };
}

/**
 * List media items for a room
 */
router.get('/rooms/:id/media', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(id);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });

    const rows = db.prepare(`
      SELECT * FROM room_media
      WHERE room_id = ?
      ORDER BY order_index ASC, created_at ASC
    `).all(id);

    const data = rows.map(toMediaDTO);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create media item for a room
 * Body: { type: 'image'|'video'|'audio'|'other', title?, url, thumbnail_url?, metadata?, order_index? }
 */
router.post('/rooms/:id/media', upload.single('media'), (req, res) => {
  try {
    const { id } = req.params;

    const db = getDatabase();
    const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(id);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });

    // Multipart upload path (file sent as "media")
    if (req.file) {
      const { filename, mimetype, originalname = '', size = 0 } = req.file;

      let derivedType = 'other';
      if (mimetype && typeof mimetype === 'string') {
        if (mimetype.startsWith('image/')) derivedType = 'image';
        else if (mimetype.startsWith('video/')) derivedType = 'video';
        else if (mimetype.startsWith('audio/')) derivedType = 'audio';
      }

      const indexRow = db.prepare('SELECT COALESCE(MAX(order_index), -1) AS max_idx FROM room_media WHERE room_id = ?').get(id);
      const indexToUse = (indexRow?.max_idx ?? -1) + 1;

      const mediaId = nanoid();
      const url = `/uploads/${filename}`;
      const title = (req.body && req.body.title) ? req.body.title : (originalname || '');
      const thumbnail_url = '';
      const meta = {
        originalname,
        mimetype,
        size,
        uploaded_at: new Date().toISOString()
      };

      db.prepare(`
        INSERT INTO room_media (id, room_id, type, title, url, thumbnail_url, metadata, order_index)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        mediaId,
        id,
        derivedType,
        title,
        url,
        thumbnail_url,
        JSON.stringify(meta),
        indexToUse
      );

      const created = db.prepare('SELECT * FROM room_media WHERE id = ?').get(mediaId);
      return res.status(201).json({ success: true, data: toMediaDTO(created) });
    }

    // JSON payload path (external URL added without file upload)
    const { type, title = '', url, thumbnail_url = '', metadata = {}, order_index } = req.body || {};

    if (!type || !isValidMediaType(type)) {
      return res.status(400).json({ success: false, error: 'Invalid or missing media type' });
    }
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'Media url is required' });
    }

    let indexToUse = order_index;
    if (indexToUse === undefined || indexToUse === null) {
      const row = db.prepare('SELECT COALESCE(MAX(order_index), -1) AS max_idx FROM room_media WHERE room_id = ?').get(id);
      indexToUse = (row?.max_idx ?? -1) + 1;
    }

    const mediaId = nanoid();
    db.prepare(`
      INSERT INTO room_media (id, room_id, type, title, url, thumbnail_url, metadata, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      mediaId,
      id,
      type,
      title,
      url,
      thumbnail_url,
      JSON.stringify(metadata || {}),
      indexToUse
    );

    const created = db.prepare('SELECT * FROM room_media WHERE id = ?').get(mediaId);
    res.status(201).json({ success: true, data: toMediaDTO(created) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update media item (by media id)
 * Body: any of { type, title, url, thumbnail_url, metadata, order_index }
 */
router.put('/media/:mediaId', (req, res) => {
  try {
    const { mediaId } = req.params;
    const { type, title, url, thumbnail_url, metadata, order_index } = req.body || {};

    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM room_media WHERE id = ?').get(mediaId);
    if (!existing) return res.status(404).json({ success: false, error: 'Media not found' });

    const fields = [];
    const values = [];

    if (type !== undefined) {
      if (!isValidMediaType(type)) {
        return res.status(400).json({ success: false, error: 'Invalid media type' });
      }
      fields.push('type = ?'); values.push(type);
    }
    if (title !== undefined) { fields.push('title = ?'); values.push(title); }
    if (url !== undefined) {
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ success: false, error: 'Invalid url' });
      }
      fields.push('url = ?'); values.push(url);
    }
    if (thumbnail_url !== undefined) { fields.push('thumbnail_url = ?'); values.push(thumbnail_url); }
    if (metadata !== undefined) { fields.push('metadata = ?'); values.push(JSON.stringify(metadata || {})); }
    if (order_index !== undefined) {
      if (typeof order_index !== 'number' || order_index < 0) {
        return res.status(400).json({ success: false, error: 'Invalid order_index' });
      }
      fields.push('order_index = ?'); values.push(order_index);
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    values.push(mediaId);
    const result = db.prepare(`UPDATE room_media SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Media not found' });
    }

    const updated = db.prepare('SELECT * FROM room_media WHERE id = ?').get(mediaId);
    res.json({ success: true, data: toMediaDTO(updated) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete media item
 */
router.delete('/media/:mediaId', (req, res) => {
  try {
    const { mediaId } = req.params;
    const db = getDatabase();

    const existing = db.prepare('SELECT id FROM room_media WHERE id = ?').get(mediaId);
    if (!existing) return res.status(404).json({ success: false, error: 'Media not found' });

    const result = db.prepare('DELETE FROM room_media WHERE id = ?').run(mediaId);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Media not found' });
    }

    res.json({ success: true, message: 'Media deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
/**
 * Get a single media item by ID (for player lightbox)
 */
router.get('/media/:mediaId', (req, res) => {
  try {
    const { mediaId } = req.params;
    console.log('[API] GET /api/media/:mediaId', { mediaId });

    const db = getDatabase();
    const row = db.prepare('SELECT * FROM room_media WHERE id = ?').get(mediaId);

    if (!row) {
      console.warn('[API] Media not found', { mediaId });
      return res.status(404).json({ success: false, error: 'Media not found' });
    }

    console.log('[API] Media found', { mediaId, type: row.type, url: row.url });
    return res.json({ success: true, data: toMediaDTO(row) });
  } catch (error) {
    console.error('[API] Error fetching media', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Reorder media items in a room
 * Body: { items: [{ id: string, order_index: number }, ...] }
 */
router.patch('/rooms/:id/media/reorder', (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'items array is required' });
    }

    const db = getDatabase();
    const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(id);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });

    const ids = items.map(i => i.id);
    const placeholders = ids.map(() => '?').join(',');
    const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM room_media WHERE room_id = ? AND id IN (${placeholders})`).get(id, ...ids);
    if ((countRow?.cnt || 0) !== ids.length) {
      return res.status(400).json({ success: false, error: 'One or more media items do not belong to the room' });
    }

    const tx = db.transaction((updates) => {
      const stmt = db.prepare('UPDATE room_media SET order_index = ? WHERE id = ?');
      updates.forEach(u => {
        if (typeof u.order_index !== 'number' || u.order_index < 0) {
          throw new Error('Invalid order_index in updates');
        }
        stmt.run(u.order_index, u.id);
      });
    });

    tx(items);

    const rows = db.prepare(`
      SELECT * FROM room_media
      WHERE room_id = ?
      ORDER BY order_index ASC, created_at ASC
    `).all(id);

    res.json({ success: true, data: rows.map(toMediaDTO) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * List lightbox sequences for a room
 */
router.get('/rooms/:id/lightbox', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(id);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });

    const rows = db.prepare(`
      SELECT * FROM lightbox_sequences
      WHERE room_id = ?
      ORDER BY created_at ASC
    `).all(id);

    res.json({ success: true, data: rows.map(toSequenceDTO) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create a lightbox sequence for a room
 * Body: { name: string, items?: any[], settings?: object }
 */
router.post('/rooms/:id/lightbox', (req, res) => {
  try {
    const { id } = req.params;
    const { name, items = [], settings = {} } = req.body || {};

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: 'Sequence name is required' });
    }
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'items must be an array' });
    }

    const db = getDatabase();
    const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(id);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });

    const seqId = nanoid();
    db.prepare(`
      INSERT INTO lightbox_sequences (id, room_id, name, items, settings)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      seqId,
      id,
      name,
      JSON.stringify(items),
      JSON.stringify(settings || {})
    );

    const created = db.prepare('SELECT * FROM lightbox_sequences WHERE id = ?').get(seqId);
    res.status(201).json({ success: true, data: toSequenceDTO(created) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get a specific lightbox sequence
 */
router.get('/lightbox/:sequenceId', (req, res) => {
  try {
    const { sequenceId } = req.params;
    const db = getDatabase();

    const seq = db.prepare('SELECT * FROM lightbox_sequences WHERE id = ?').get(sequenceId);
    if (!seq) return res.status(404).json({ success: false, error: 'Lightbox sequence not found' });

    res.json({ success: true, data: toSequenceDTO(seq) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update a lightbox sequence
 * Body: any of { name, items, settings }
 */
router.put('/lightbox/:sequenceId', (req, res) => {
  try {
    const { sequenceId } = req.params;
    const { name, items, settings } = req.body || {};

    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM lightbox_sequences WHERE id = ?').get(sequenceId);
    if (!existing) return res.status(404).json({ success: false, error: 'Lightbox sequence not found' });

    const fields = [];
    const values = [];

    if (name !== undefined) {
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ success: false, error: 'Invalid name' });
      }
      fields.push('name = ?'); values.push(name);
    }
    if (items !== undefined) {
      if (!Array.isArray(items)) {
        return res.status(400).json({ success: false, error: 'items must be an array' });
      }
      fields.push('items = ?'); values.push(JSON.stringify(items));
    }
    if (settings !== undefined) {
      if (settings !== null && typeof settings !== 'object') {
        return res.status(400).json({ success: false, error: 'settings must be an object or null' });
      }
      fields.push('settings = ?'); values.push(JSON.stringify(settings || {}));
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    values.push(sequenceId);
    db.prepare(`UPDATE lightbox_sequences SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM lightbox_sequences WHERE id = ?').get(sequenceId);
    res.json({ success: true, data: toSequenceDTO(updated) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete a lightbox sequence
 */
router.delete('/lightbox/:sequenceId', (req, res) => {
  try {
    const { sequenceId } = req.params;
    const db = getDatabase();

    const existing = db.prepare('SELECT id FROM lightbox_sequences WHERE id = ?').get(sequenceId);
    if (!existing) return res.status(404).json({ success: false, error: 'Lightbox sequence not found' });

    const result = db.prepare('DELETE FROM lightbox_sequences WHERE id = ?').run(sequenceId);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Lightbox sequence not found' });
    }

    res.json({ success: true, message: 'Lightbox sequence deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Layout Configuration API Endpoints
 */

/**
 * Get layout configuration for a room
 */
router.get('/rooms/:id/layout', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    let layoutConfig = {};
    try {
      const config = JSON.parse(room.config || '{}');
      layoutConfig = config.layout || {};
    } catch (e) {
      console.warn(`Invalid JSON in config for room ${id}:`, e);
      layoutConfig = {};
    }

    res.json({ success: true, data: layoutConfig });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update layout configuration for a room
 */
router.put('/rooms/:id/layout', (req, res) => {
  try {
    const { id } = req.params;
    const { layout } = req.body;

    if (!layout || typeof layout !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Layout configuration must be an object'
      });
    }

    const db = getDatabase();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Parse current config and update layout
    let config = {};
    try {
      config = JSON.parse(room.config || '{}');
    } catch (e) {
      console.warn(`Invalid JSON in config for room ${id}:`, e);
      config = {};
    }

    config.layout = layout;

    const updateStmt = db.prepare('UPDATE rooms SET config = ? WHERE id = ?');
    updateStmt.run(JSON.stringify(config), id);

    // Broadcast layout update via Socket.IO if available
    try {
      const { io } = require('../server');
      io.to(id).emit('layout_updated', {
        layout: layout,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Socket.IO not available for layout broadcast');
    }

    res.json({ success: true, data: layout });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Validate layout configuration against schema
 */
router.post('/layout/validate', (req, res) => {
  try {
    const { layout } = req.body;

    if (!layout) {
      return res.status(400).json({
        success: false,
        error: 'Layout configuration is required'
      });
    }

    // Basic validation - in a real implementation, this would use the layout validator
    const result = {
      valid: true,
      errors: []
    };

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

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get layout presets
 */
router.get('/layout/presets', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Load presets from layout-config.json
    const configPath = path.join(__dirname, '..', 'config', 'layout-config.json');
    
    if (!fs.existsSync(configPath)) {
      return res.json({ success: true, data: {} });
    }

    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    res.json({ success: true, data: config.presets || {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;