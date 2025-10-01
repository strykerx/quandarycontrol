const express = require('express');
const { logger } = require('../../../../utils/logger');
const { getDatabase } = require('../../../../db/database');

const router = express.Router();
const gmLogger = logger.child({ module: 'api-gm-customization' });

/**
 * Get Game Master interface customization settings for a room
 */
router.get('/rooms/:id/gm-customization', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      gmLogger.warn('GM customization request for non-existent room', { roomId: id, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Parse GM customization settings from room config
    let gmCustomization = {
      layout: {
        showTimer: true,
        showVariables: true,
        showHints: true,
        showMedia: true,
        showRules: true,
        compactMode: false
      },
      controls: {
        allowTimerControl: true,
        allowVariableEdit: true,
        allowHintSend: true,
        allowMediaControl: true,
        quickActions: []
      },
      appearance: {
        theme: 'default',
        fontSize: 'medium',
        highContrast: false,
        darkMode: false
      },
      notifications: {
        playAudioAlerts: true,
        showToastMessages: true,
        enableVibration: false
      }
    };

    try {
      const config = JSON.parse(room.config || '{}');
      if (config.gmCustomization) {
        // Deep merge with defaults
        gmCustomization = {
          layout: { ...gmCustomization.layout, ...config.gmCustomization.layout },
          controls: { ...gmCustomization.controls, ...config.gmCustomization.controls },
          appearance: { ...gmCustomization.appearance, ...config.gmCustomization.appearance },
          notifications: { ...gmCustomization.notifications, ...config.gmCustomization.notifications }
        };
      }
    } catch (e) {
      gmLogger.warn('Invalid JSON in room config for GM customization', {
        roomId: id,
        error: e.message,
        ip: req.ip
      });
    }

    gmLogger.info('GM customization settings retrieved', {
      roomId: id,
      compactMode: gmCustomization.layout.compactMode,
      darkMode: gmCustomization.appearance.darkMode,
      ip: req.ip
    });

    res.json({ success: true, data: gmCustomization });
  } catch (error) {
    gmLogger.error('Error retrieving GM customization settings', {
      roomId: req.params.id,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update Game Master interface customization settings for a room
 */
router.put('/rooms/:id/gm-customization', (req, res) => {
  try {
    const { id } = req.params;
    const { layout, controls, appearance, notifications } = req.body;

    const db = getDatabase();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      gmLogger.warn('GM customization update failed - room not found', { roomId: id, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Parse current config
    let config = {};
    try {
      config = JSON.parse(room.config || '{}');
    } catch (e) {
      gmLogger.warn('Invalid JSON in room config during GM customization update', {
        roomId: id,
        error: e.message,
        ip: req.ip
      });
      config = {};
    }

    if (!config.gmCustomization) {
      config.gmCustomization = {};
    }

    // Update GM customization settings
    if (layout && typeof layout === 'object') {
      config.gmCustomization.layout = { ...config.gmCustomization.layout, ...layout };
    }

    if (controls && typeof controls === 'object') {
      config.gmCustomization.controls = { ...config.gmCustomization.controls, ...controls };
    }

    if (appearance && typeof appearance === 'object') {
      // Validate appearance settings
      if (appearance.fontSize && !['small', 'medium', 'large'].includes(appearance.fontSize)) {
        gmLogger.warn('GM customization update failed - invalid font size', {
          roomId: id,
          fontSize: appearance.fontSize,
          ip: req.ip
        });
        return res.status(400).json({
          success: false,
          error: 'Font size must be small, medium, or large'
        });
      }

      config.gmCustomization.appearance = { ...config.gmCustomization.appearance, ...appearance };
    }

    if (notifications && typeof notifications === 'object') {
      config.gmCustomization.notifications = { ...config.gmCustomization.notifications, ...notifications };
    }

    // Update room config
    const updateStmt = db.prepare('UPDATE rooms SET config = ? WHERE id = ?');
    updateStmt.run(JSON.stringify(config), id);

    gmLogger.info('GM customization settings updated successfully', {
      roomId: id,
      sectionsUpdated: [
        layout ? 'layout' : null,
        controls ? 'controls' : null,
        appearance ? 'appearance' : null,
        notifications ? 'notifications' : null
      ].filter(Boolean),
      ip: req.ip
    });

    res.json({ success: true, data: config.gmCustomization });
  } catch (error) {
    gmLogger.error('Error updating GM customization settings', {
      roomId: req.params.id,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;