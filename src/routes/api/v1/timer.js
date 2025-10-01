const express = require('express');
const { logger } = require('../../../../utils/logger');
const { getDatabase } = require('../../../../db/database');

const router = express.Router();
const timerLogger = logger.child({ module: 'api-timer' });

/**
 * Get timer configuration for a room
 */
router.get('/rooms/:id/timer', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      timerLogger.warn('Timer config request for non-existent room', { roomId: id, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    const timerConfig = {
      duration: room.timer_duration,
      secondary_timer_enabled: room.secondary_timer_enabled,
      secondary_timer_duration: room.secondary_timer_duration
    };

    timerLogger.info('Timer configuration retrieved', {
      roomId: id,
      duration: room.timer_duration,
      secondaryEnabled: room.secondary_timer_enabled,
      ip: req.ip
    });

    res.json({ success: true, data: timerConfig });
  } catch (error) {
    timerLogger.error('Error retrieving timer configuration', {
      roomId: req.params.id,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update timer configuration for a room
 */
router.put('/rooms/:id/timer', (req, res) => {
  try {
    const { id } = req.params;
    const { duration, secondary_timer_enabled, secondary_timer_duration } = req.body;

    // Validate primary timer duration
    if (duration !== undefined && (duration < 0 || isNaN(duration))) {
      timerLogger.warn('Timer update failed - invalid duration', {
        roomId: id,
        duration,
        ip: req.ip
      });
      return res.status(400).json({
        success: false,
        error: 'Valid timer duration is required (must be >= 0)'
      });
    }

    // Validate secondary timer duration if provided
    if (secondary_timer_duration !== undefined && (secondary_timer_duration < 0 || isNaN(secondary_timer_duration))) {
      timerLogger.warn('Timer update failed - invalid secondary timer duration', {
        roomId: id,
        secondary_timer_duration,
        ip: req.ip
      });
      return res.status(400).json({
        success: false,
        error: 'Valid secondary timer duration is required (must be >= 0)'
      });
    }

    const db = getDatabase();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      timerLogger.warn('Timer update failed - room not found', { roomId: id, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Build update query dynamically based on provided fields
    const updateFields = [];
    const updateValues = [];

    if (duration !== undefined) {
      updateFields.push('timer_duration = ?');
      updateValues.push(duration);
    }
    if (secondary_timer_enabled !== undefined) {
      updateFields.push('secondary_timer_enabled = ?');
      updateValues.push(secondary_timer_enabled ? 1 : 0);
    }
    if (secondary_timer_duration !== undefined) {
      updateFields.push('secondary_timer_duration = ?');
      updateValues.push(secondary_timer_duration);
    }

    if (updateFields.length === 0) {
      timerLogger.warn('Timer update failed - no fields to update', { roomId: id, ip: req.ip });
      return res.status(400).json({
        success: false,
        error: 'No timer fields provided for update'
      });
    }

    // Add room ID to end of values array
    updateValues.push(id);

    const updateStmt = db.prepare(`UPDATE rooms SET ${updateFields.join(', ')} WHERE id = ?`);
    const result = updateStmt.run(...updateValues);

    if (result.changes === 0) {
      timerLogger.warn('Timer update failed - no changes made', { roomId: id, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Get updated timer configuration
    const updatedRoom = db.prepare('SELECT timer_duration, secondary_timer_enabled, secondary_timer_duration FROM rooms WHERE id = ?').get(id);
    const timerConfig = {
      duration: updatedRoom.timer_duration,
      secondary_timer_enabled: updatedRoom.secondary_timer_enabled,
      secondary_timer_duration: updatedRoom.secondary_timer_duration
    };

    timerLogger.info('Timer configuration updated', {
      roomId: id,
      updatedFields: updateFields.length,
      newDuration: updatedRoom.timer_duration,
      secondaryEnabled: updatedRoom.secondary_timer_enabled,
      ip: req.ip
    });

    res.json({ success: true, data: timerConfig });
  } catch (error) {
    timerLogger.error('Error updating timer configuration', {
      roomId: req.params.id,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;