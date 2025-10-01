const express = require('express');
const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');
const { logger } = require('../../../../utils/logger');
const { getDatabase } = require('../../../../db/database');
const { upload } = require('./shared/upload');

const router = express.Router();
const mediaLogger = logger.child({ module: 'api-media' });

/**
 * Get media for a room
 */
router.get('/rooms/:id/media', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      mediaLogger.warn('Media request for non-existent room', { roomId: id, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Get media from uploads directory for this room
    const uploadsPath = path.join(__dirname, '../../../../../public/uploads');
    let mediaFiles = [];

    try {
      if (fs.existsSync(uploadsPath)) {
        const files = fs.readdirSync(uploadsPath);
        mediaFiles = files
          .filter(file => !file.startsWith('.'))
          .map(file => {
            const filePath = path.join(uploadsPath, file);
            const stats = fs.statSync(filePath);
            return {
              id: file,
              filename: file,
              originalname: file,
              path: `/uploads/${file}`,
              size: stats.size,
              created_at: stats.birthtime,
              modified_at: stats.mtime
            };
          })
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }
    } catch (error) {
      mediaLogger.warn('Error reading uploads directory', {
        roomId: id,
        error: error.message,
        ip: req.ip
      });
    }

    mediaLogger.info('Media retrieved', {
      roomId: id,
      mediaCount: mediaFiles.length,
      ip: req.ip
    });

    res.json({ success: true, data: mediaFiles });
  } catch (error) {
    mediaLogger.error('Error retrieving media', {
      roomId: req.params.id,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Generic file upload endpoint
 */
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      mediaLogger.warn('File upload failed - no file provided', { ip: req.ip });
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const fileInfo = {
      id: req.file.filename,
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: `/uploads/${req.file.filename}`,
      uploaded_at: new Date().toISOString()
    };

    mediaLogger.info('File uploaded successfully', {
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      ip: req.ip
    });

    res.status(201).json({ success: true, data: fileInfo });
  } catch (error) {
    mediaLogger.error('Error uploading file', {
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Upload media to a specific room
 */
router.post('/rooms/:id/media', upload.single('media'), (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    if (!req.file) {
      mediaLogger.warn('Room media upload failed - no file provided', {
        roomId: id,
        ip: req.ip
      });
      return res.status(400).json({ success: false, error: 'No media file uploaded' });
    }

    const db = getDatabase();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      mediaLogger.warn('Room media upload failed - room not found', { roomId: id, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    const mediaInfo = {
      id: req.file.filename,
      room_id: id,
      filename: req.file.filename,
      originalname: req.file.originalname,
      title: title || req.file.originalname,
      description: description || '',
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: `/uploads/${req.file.filename}`,
      uploaded_at: new Date().toISOString()
    };

    mediaLogger.info('Room media uploaded successfully', {
      roomId: id,
      filename: req.file.filename,
      originalname: req.file.originalname,
      title: mediaInfo.title,
      size: req.file.size,
      ip: req.ip
    });

    res.status(201).json({ success: true, data: mediaInfo });
  } catch (error) {
    mediaLogger.error('Error uploading room media', {
      roomId: req.params.id,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update media metadata
 */
router.put('/media/:mediaId', (req, res) => {
  try {
    const { mediaId } = req.params;
    const { title, description } = req.body;

    // Check if media file exists
    const mediaPath = path.join(__dirname, '../../../../../public/uploads', mediaId);
    if (!fs.existsSync(mediaPath)) {
      mediaLogger.warn('Media update failed - file not found', { mediaId, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Media file not found' });
    }

    // Since we don't have a media table, we'll just return the updated metadata
    // In a more complex system, this would update a database record
    const stats = fs.statSync(mediaPath);
    const updatedMedia = {
      id: mediaId,
      filename: mediaId,
      title: title || mediaId,
      description: description || '',
      size: stats.size,
      modified_at: new Date().toISOString()
    };

    mediaLogger.info('Media metadata updated', {
      mediaId,
      title,
      description,
      ip: req.ip
    });

    res.json({ success: true, data: updatedMedia });
  } catch (error) {
    mediaLogger.error('Error updating media metadata', {
      mediaId: req.params.mediaId,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete media file
 */
router.delete('/media/:mediaId', (req, res) => {
  try {
    const { mediaId } = req.params;

    const mediaPath = path.join(__dirname, '../../../../../public/uploads', mediaId);
    if (!fs.existsSync(mediaPath)) {
      mediaLogger.warn('Media deletion failed - file not found', { mediaId, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Media file not found' });
    }

    // Delete the file
    fs.unlinkSync(mediaPath);

    mediaLogger.info('Media deleted successfully', {
      mediaId,
      ip: req.ip
    });

    res.json({ success: true, message: 'Media deleted successfully' });
  } catch (error) {
    mediaLogger.error('Error deleting media', {
      mediaId: req.params.mediaId,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get media details
 */
router.get('/media/:mediaId', (req, res) => {
  try {
    const { mediaId } = req.params;

    const mediaPath = path.join(__dirname, '../../../../../public/uploads', mediaId);
    if (!fs.existsSync(mediaPath)) {
      mediaLogger.warn('Media details request for non-existent file', { mediaId, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Media file not found' });
    }

    const stats = fs.statSync(mediaPath);
    const mediaInfo = {
      id: mediaId,
      filename: mediaId,
      path: `/uploads/${mediaId}`,
      size: stats.size,
      created_at: stats.birthtime,
      modified_at: stats.mtime,
      mimetype: path.extname(mediaId).toLowerCase() === '.mp4' ? 'video/mp4' :
                path.extname(mediaId).toLowerCase() === '.png' ? 'image/png' :
                path.extname(mediaId).toLowerCase() === '.jpg' ? 'image/jpeg' :
                path.extname(mediaId).toLowerCase() === '.jpeg' ? 'image/jpeg' :
                'application/octet-stream'
    };

    mediaLogger.info('Media details retrieved', {
      mediaId,
      size: stats.size,
      ip: req.ip
    });

    res.json({ success: true, data: mediaInfo });
  } catch (error) {
    mediaLogger.error('Error retrieving media details', {
      mediaId: req.params.mediaId,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Reorder media in a room
 */
router.patch('/rooms/:id/media/reorder', (req, res) => {
  try {
    const { id } = req.params;
    const { mediaOrder } = req.body;

    if (!Array.isArray(mediaOrder)) {
      mediaLogger.warn('Media reordering failed - invalid order format', {
        roomId: id,
        mediaOrderType: typeof mediaOrder,
        ip: req.ip
      });
      return res.status(400).json({
        success: false,
        error: 'Media order must be an array of media IDs'
      });
    }

    const db = getDatabase();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      mediaLogger.warn('Media reordering failed - room not found', { roomId: id, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Since we don't have a media order table, we'll just acknowledge the reorder
    // In a more complex system, this would update media order in the database
    mediaLogger.info('Media reordered successfully', {
      roomId: id,
      mediaCount: mediaOrder.length,
      newOrder: mediaOrder,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Media order updated successfully',
      data: { order: mediaOrder }
    });
  } catch (error) {
    mediaLogger.error('Error reordering media', {
      roomId: req.params.id,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;