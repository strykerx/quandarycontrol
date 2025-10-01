const express = require('express');
const { nanoid } = require('nanoid');
const { logger } = require('../../utils/logger');
const { getDatabase } = require('../../db/database');

const router = express.Router();
const layoutLogger = logger.child({ module: 'layout-routes' });

// Save layout configuration for a room
router.put('/rooms/:roomId/layout', (req, res) => {
  try {
    const { roomId } = req.params;
    const { layout } = req.body;

    if (!layout) {
      layoutLogger.warn('Layout data missing in request', { roomId, ip: req.ip });
      return res.status(400).json({
        success: false,
        error: 'Layout data is required'
      });
    }

    const db = getDatabase();

    // Check if room exists
    const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(roomId);
    if (!room) {
      layoutLogger.warn('Room not found for layout save', { roomId, ip: req.ip });
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
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

      layoutLogger.info('Layout updated for room', {
        roomId,
        layoutId: existingLayout.id,
        ip: req.ip
      });
    } else {
      // Create new layout
      const layoutId = nanoid();
      const insertStmt = db.prepare(`
        INSERT INTO room_layouts (id, room_id, layout, is_active)
        VALUES (?, ?, ?, TRUE)
      `);
      insertStmt.run(layoutId, roomId, JSON.stringify(layout));

      layoutLogger.info('New layout created for room', {
        roomId,
        layoutId,
        ip: req.ip
      });
    }

    const response = {
      success: true,
      message: 'Layout saved successfully'
    };

    // Emit layout update to all clients in the room
    if (req.app.get('io')) {
      req.app.get('io').to(roomId).emit('layout_updated', {
        layout,
        timestamp: new Date().toISOString()
      });
      layoutLogger.debug('Layout update emitted to room', { roomId });
    }

    layoutLogger.debug('Layout save response sent', { roomId, success: true });
    res.json(response);

  } catch (error) {
    layoutLogger.error('Error saving layout', {
      roomId: req.params.roomId,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get layout configuration for a room
router.get('/rooms/:roomId/layout', (req, res) => {
  try {
    const { roomId } = req.params;

    const db = getDatabase();

    // Check if room exists
    const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(roomId);
    if (!room) {
      layoutLogger.warn('Room not found for layout fetch', { roomId, ip: req.ip });
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }

    // Get active layout for this room
    const layout = db.prepare('SELECT layout FROM room_layouts WHERE room_id = ? AND is_active = TRUE').get(roomId);

    if (layout) {
      const parsedLayout = JSON.parse(layout.layout);
      layoutLogger.debug('Layout retrieved for room', {
        roomId,
        hasLayout: true,
        ip: req.ip
      });

      res.json({
        success: true,
        data: parsedLayout
      });
    } else {
      layoutLogger.debug('No layout found for room', { roomId, ip: req.ip });
      res.json({
        success: true,
        data: null
      });
    }
  } catch (error) {
    layoutLogger.error('Error loading layout', {
      roomId: req.params.roomId,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;