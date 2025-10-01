const express = require('express');
const { nanoid } = require('nanoid');
const { logger } = require('../../../../utils/logger');
const { getDatabase } = require('../../../../db/database');

const router = express.Router();
const lightboxLogger = logger.child({ module: 'api-lightbox' });

/**
 * Get lightbox sequences for a room
 */
router.get('/rooms/:id/lightbox', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      lightboxLogger.warn('Lightbox request for non-existent room', { roomId: id, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Parse lightbox sequences from room config
    let sequences = [];
    try {
      const config = JSON.parse(room.config || '{}');
      sequences = config.lightbox_sequences || [];
    } catch (e) {
      lightboxLogger.warn('Invalid JSON in room config for lightbox', {
        roomId: id,
        error: e.message,
        ip: req.ip
      });
      sequences = [];
    }

    lightboxLogger.info('Lightbox sequences retrieved', {
      roomId: id,
      sequenceCount: sequences.length,
      ip: req.ip
    });

    res.json({ success: true, data: sequences });
  } catch (error) {
    lightboxLogger.error('Error retrieving lightbox sequences', {
      roomId: req.params.id,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create a new lightbox sequence
 */
router.post('/rooms/:id/lightbox', (req, res) => {
  try {
    const { id } = req.params;
    const { name, items, autoPlay = false, duration = 5000 } = req.body;

    if (!name || !Array.isArray(items)) {
      lightboxLogger.warn('Lightbox creation failed - invalid data', {
        roomId: id,
        hasName: !!name,
        hasItems: Array.isArray(items),
        ip: req.ip
      });
      return res.status(400).json({
        success: false,
        error: 'Name and items array are required'
      });
    }

    const db = getDatabase();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      lightboxLogger.warn('Lightbox creation failed - room not found', { roomId: id, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Parse current config
    let config = {};
    try {
      config = JSON.parse(room.config || '{}');
    } catch (e) {
      lightboxLogger.warn('Invalid JSON in room config during lightbox creation', {
        roomId: id,
        error: e.message,
        ip: req.ip
      });
      config = {};
    }

    if (!config.lightbox_sequences) {
      config.lightbox_sequences = [];
    }

    // Create new sequence
    const newSequence = {
      id: nanoid(),
      name,
      items,
      autoPlay,
      duration: parseInt(duration) || 5000,
      created_at: new Date().toISOString()
    };

    config.lightbox_sequences.push(newSequence);

    // Update room config
    const updateStmt = db.prepare('UPDATE rooms SET config = ? WHERE id = ?');
    updateStmt.run(JSON.stringify(config), id);

    lightboxLogger.info('Lightbox sequence created successfully', {
      roomId: id,
      sequenceId: newSequence.id,
      name: newSequence.name,
      itemCount: items.length,
      ip: req.ip
    });

    res.status(201).json({ success: true, data: newSequence });
  } catch (error) {
    lightboxLogger.error('Error creating lightbox sequence', {
      roomId: req.params.id,
      error: error.message,
      ip: req.ip
    });
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

    // Find the sequence across all rooms
    const rooms = db.prepare('SELECT * FROM rooms').all();
    let foundSequence = null;
    let foundRoomId = null;

    for (const room of rooms) {
      try {
        const config = JSON.parse(room.config || '{}');
        const sequences = config.lightbox_sequences || [];
        const sequence = sequences.find(seq => seq.id === sequenceId);
        if (sequence) {
          foundSequence = sequence;
          foundRoomId = room.id;
          break;
        }
      } catch (e) {
        // Skip rooms with invalid config
        continue;
      }
    }

    if (!foundSequence) {
      lightboxLogger.warn('Lightbox sequence not found', { sequenceId, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Lightbox sequence not found' });
    }

    lightboxLogger.info('Lightbox sequence retrieved', {
      sequenceId,
      roomId: foundRoomId,
      name: foundSequence.name,
      ip: req.ip
    });

    res.json({ success: true, data: foundSequence });
  } catch (error) {
    lightboxLogger.error('Error retrieving lightbox sequence', {
      sequenceId: req.params.sequenceId,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update a lightbox sequence
 */
router.put('/lightbox/:sequenceId', (req, res) => {
  try {
    const { sequenceId } = req.params;
    const { name, items, autoPlay, duration } = req.body;
    const db = getDatabase();

    // Find the sequence across all rooms
    const rooms = db.prepare('SELECT * FROM rooms').all();
    let foundRoom = null;
    let foundSequenceIndex = -1;

    for (const room of rooms) {
      try {
        const config = JSON.parse(room.config || '{}');
        const sequences = config.lightbox_sequences || [];
        const sequenceIndex = sequences.findIndex(seq => seq.id === sequenceId);
        if (sequenceIndex !== -1) {
          foundRoom = room;
          foundSequenceIndex = sequenceIndex;
          break;
        }
      } catch (e) {
        // Skip rooms with invalid config
        continue;
      }
    }

    if (!foundRoom || foundSequenceIndex === -1) {
      lightboxLogger.warn('Lightbox sequence update failed - not found', { sequenceId, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Lightbox sequence not found' });
    }

    // Update the sequence
    const config = JSON.parse(foundRoom.config || '{}');
    const sequence = config.lightbox_sequences[foundSequenceIndex];

    if (name !== undefined) sequence.name = name;
    if (items !== undefined) sequence.items = items;
    if (autoPlay !== undefined) sequence.autoPlay = autoPlay;
    if (duration !== undefined) sequence.duration = parseInt(duration) || 5000;
    sequence.updated_at = new Date().toISOString();

    // Update room config
    const updateStmt = db.prepare('UPDATE rooms SET config = ? WHERE id = ?');
    updateStmt.run(JSON.stringify(config), foundRoom.id);

    lightboxLogger.info('Lightbox sequence updated successfully', {
      sequenceId,
      roomId: foundRoom.id,
      name: sequence.name,
      ip: req.ip
    });

    res.json({ success: true, data: sequence });
  } catch (error) {
    lightboxLogger.error('Error updating lightbox sequence', {
      sequenceId: req.params.sequenceId,
      error: error.message,
      ip: req.ip
    });
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

    // Find the sequence across all rooms
    const rooms = db.prepare('SELECT * FROM rooms').all();
    let foundRoom = null;
    let foundSequenceIndex = -1;
    let sequenceName = '';

    for (const room of rooms) {
      try {
        const config = JSON.parse(room.config || '{}');
        const sequences = config.lightbox_sequences || [];
        const sequenceIndex = sequences.findIndex(seq => seq.id === sequenceId);
        if (sequenceIndex !== -1) {
          foundRoom = room;
          foundSequenceIndex = sequenceIndex;
          sequenceName = sequences[sequenceIndex].name;
          break;
        }
      } catch (e) {
        // Skip rooms with invalid config
        continue;
      }
    }

    if (!foundRoom || foundSequenceIndex === -1) {
      lightboxLogger.warn('Lightbox sequence deletion failed - not found', { sequenceId, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Lightbox sequence not found' });
    }

    // Remove the sequence
    const config = JSON.parse(foundRoom.config || '{}');
    config.lightbox_sequences.splice(foundSequenceIndex, 1);

    // Update room config
    const updateStmt = db.prepare('UPDATE rooms SET config = ? WHERE id = ?');
    updateStmt.run(JSON.stringify(config), foundRoom.id);

    lightboxLogger.info('Lightbox sequence deleted successfully', {
      sequenceId,
      roomId: foundRoom.id,
      name: sequenceName,
      ip: req.ip
    });

    res.json({ success: true, message: 'Lightbox sequence deleted successfully' });
  } catch (error) {
    lightboxLogger.error('Error deleting lightbox sequence', {
      sequenceId: req.params.sequenceId,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;