const express = require('express');
const fs = require('fs');
const path = require('path');
const { logger } = require('../../../../utils/logger');
const { getDatabase } = require('../../../../db/database');
const { upload } = require('./shared/upload');

const router = express.Router();
const notificationsLogger = logger.child({ module: 'api-notifications' });

/**
 * Upload notification audio file
 */
router.post('/rooms/:id/notifications/audio', upload.single('audio'), (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!req.file) {
      notificationsLogger.warn('Audio upload failed - no file provided', {
        roomId: id,
        ip: req.ip
      });
      return res.status(400).json({ success: false, error: 'No audio file uploaded' });
    }

    // Validate audio file type
    const allowedAudioTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg'];
    if (!allowedAudioTypes.includes(req.file.mimetype)) {
      notificationsLogger.warn('Audio upload failed - invalid file type', {
        roomId: id,
        mimetype: req.file.mimetype,
        ip: req.ip
      });
      return res.status(400).json({
        success: false,
        error: 'Invalid audio file type. Allowed: MP3, WAV, OGG'
      });
    }

    const db = getDatabase();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      notificationsLogger.warn('Audio upload failed - room not found', { roomId: id, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    const audioInfo = {
      id: req.file.filename,
      room_id: id,
      name: name || req.file.originalname,
      description: description || '',
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: `/uploads/${req.file.filename}`,
      uploaded_at: new Date().toISOString()
    };

    notificationsLogger.info('Notification audio uploaded successfully', {
      roomId: id,
      audioId: audioInfo.id,
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      ip: req.ip
    });

    res.status(201).json({ success: true, data: audioInfo });
  } catch (error) {
    notificationsLogger.error('Error uploading notification audio', {
      roomId: req.params.id,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get notification audio files for a room
 */
router.get('/rooms/:id/notifications/audio', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      notificationsLogger.warn('Audio files request for non-existent room', { roomId: id, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Get audio files from uploads directory
    const uploadsPath = path.join(__dirname, '../../../../../public/uploads');
    let audioFiles = [];

    try {
      if (fs.existsSync(uploadsPath)) {
        const files = fs.readdirSync(uploadsPath);
        audioFiles = files
          .filter(file => {
            const filePath = path.join(uploadsPath, file);
            const stats = fs.statSync(filePath);
            const ext = path.extname(file).toLowerCase();
            return stats.isFile() && ['.mp3', '.wav', '.ogg'].includes(ext);
          })
          .map(file => {
            const filePath = path.join(uploadsPath, file);
            const stats = fs.statSync(filePath);
            return {
              id: file,
              filename: file,
              path: `/uploads/${file}`,
              size: stats.size,
              created_at: stats.birthtime,
              modified_at: stats.mtime
            };
          })
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }
    } catch (error) {
      notificationsLogger.warn('Error reading audio files directory', {
        roomId: id,
        error: error.message,
        ip: req.ip
      });
    }

    notificationsLogger.info('Notification audio files retrieved', {
      roomId: id,
      audioCount: audioFiles.length,
      ip: req.ip
    });

    res.json({ success: true, data: audioFiles });
  } catch (error) {
    notificationsLogger.error('Error retrieving notification audio files', {
      roomId: req.params.id,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete notification audio file
 */
router.delete('/rooms/:id/notifications/audio/:audioId', (req, res) => {
  try {
    const { id, audioId } = req.params;

    const db = getDatabase();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      notificationsLogger.warn('Audio deletion failed - room not found', { roomId: id, audioId, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    const audioPath = path.join(__dirname, '../../../../../public/uploads', audioId);
    if (!fs.existsSync(audioPath)) {
      notificationsLogger.warn('Audio deletion failed - file not found', { roomId: id, audioId, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Audio file not found' });
    }

    // Delete the audio file
    fs.unlinkSync(audioPath);

    notificationsLogger.info('Notification audio deleted successfully', {
      roomId: id,
      audioId,
      ip: req.ip
    });

    res.json({ success: true, message: 'Audio file deleted successfully' });
  } catch (error) {
    notificationsLogger.error('Error deleting notification audio', {
      roomId: req.params.id,
      audioId: req.params.audioId,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get notification settings for a room
 */
router.get('/rooms/:id/notifications/settings', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      notificationsLogger.warn('Notification settings request for non-existent room', { roomId: id, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Parse notification settings from room config
    let settings = {
      enabled: true,
      volume: 50,
      hintSound: null,
      successSound: null,
      errorSound: null,
      timerSound: null
    };

    try {
      const config = JSON.parse(room.config || '{}');
      if (config.notifications) {
        settings = { ...settings, ...config.notifications };
      }
    } catch (e) {
      notificationsLogger.warn('Invalid JSON in room config for notifications', {
        roomId: id,
        error: e.message,
        ip: req.ip
      });
    }

    notificationsLogger.info('Notification settings retrieved', {
      roomId: id,
      enabled: settings.enabled,
      volume: settings.volume,
      ip: req.ip
    });

    res.json({ success: true, data: settings });
  } catch (error) {
    notificationsLogger.error('Error retrieving notification settings', {
      roomId: req.params.id,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update notification settings for a room
 */
router.put('/rooms/:id/notifications/settings', (req, res) => {
  try {
    const { id } = req.params;
    const { enabled, volume, hintSound, successSound, errorSound, timerSound } = req.body;

    const db = getDatabase();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      notificationsLogger.warn('Notification settings update failed - room not found', { roomId: id, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Validate volume if provided
    if (volume !== undefined && (volume < 0 || volume > 100 || isNaN(volume))) {
      notificationsLogger.warn('Notification settings update failed - invalid volume', {
        roomId: id,
        volume,
        ip: req.ip
      });
      return res.status(400).json({
        success: false,
        error: 'Volume must be a number between 0 and 100'
      });
    }

    // Parse current config
    let config = {};
    try {
      config = JSON.parse(room.config || '{}');
    } catch (e) {
      notificationsLogger.warn('Invalid JSON in room config during notification settings update', {
        roomId: id,
        error: e.message,
        ip: req.ip
      });
      config = {};
    }

    if (!config.notifications) {
      config.notifications = {};
    }

    // Update notification settings
    if (enabled !== undefined) config.notifications.enabled = Boolean(enabled);
    if (volume !== undefined) config.notifications.volume = Number(volume);
    if (hintSound !== undefined) config.notifications.hintSound = hintSound;
    if (successSound !== undefined) config.notifications.successSound = successSound;
    if (errorSound !== undefined) config.notifications.errorSound = errorSound;
    if (timerSound !== undefined) config.notifications.timerSound = timerSound;

    // Update room config
    const updateStmt = db.prepare('UPDATE rooms SET config = ? WHERE id = ?');
    updateStmt.run(JSON.stringify(config), id);

    notificationsLogger.info('Notification settings updated successfully', {
      roomId: id,
      enabled: config.notifications.enabled,
      volume: config.notifications.volume,
      ip: req.ip
    });

    res.json({ success: true, data: config.notifications });
  } catch (error) {
    notificationsLogger.error('Error updating notification settings', {
      roomId: req.params.id,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;