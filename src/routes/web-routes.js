const express = require('express');
const path = require('path');
const { logger } = require('../../utils/logger');
const { getDatabase } = require('../../db/database');
const ShortcodeParser = require('../../utils/shortcode-parser');

const router = express.Router();
const webLogger = logger.child({ module: 'web-routes' });

// Serve admin interface at root
router.get('/', (req, res) => {
  webLogger.debug('Admin interface requested', { ip: req.ip });
  res.sendFile(path.join(__dirname, '../../public/admin.html'));
});

// Android TV Portal route
router.get('/tv', (req, res) => {
  webLogger.debug('Android TV interface requested', { ip: req.ip });
  res.sendFile(path.join(__dirname, '../../public/androidtv.html'));
});

// Dynamic room player routes
router.get('/room/:roomId/player', (req, res) => {
  try {
    const { roomId } = req.params;
    const db = getDatabase();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);

    if (!room) {
      webLogger.warn('Room not found for player route', { roomId, ip: req.ip });
      return res.status(404).send('Room not found');
    }

    webLogger.info('Player interface requested', { roomId, roomName: room.name, ip: req.ip });

    // Parse room config to get theme
    let config = {};
    try {
      config = JSON.parse(room.config || '{}');
    } catch (error) {
      webLogger.warn('Failed to parse room config', { roomId, error: error.message });
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
      webLogger.debug('Themed player interface served', { roomId, theme: themeName });
    } catch (error) {
      webLogger.error('Error loading theme', { roomId, theme: themeName, error: error.message });
      // Fallback to default player.html
      res.sendFile(path.join(__dirname, '../../public/player.html'));
    }
  } catch (error) {
    webLogger.error('Error in player route', {
      roomId: req.params.roomId,
      error: error.message,
      ip: req.ip
    });
    res.status(500).send('Server error');
  }
});

// Barebones player route (template-driven)
router.get('/room/:roomId/player-bare', (req, res) => {
  const { roomId } = req.params;
  webLogger.debug('Bare player interface requested', { roomId, ip: req.ip });
  res.sendFile(path.join(__dirname, '../../public/player-bare.html'));
});

// Shortcode-based player access route
router.get('/p/:shortcode', (req, res) => {
  try {
    const { shortcode } = req.params;
    const db = getDatabase();

    webLogger.debug('Shortcode access requested', { shortcode, ip: req.ip });

    // Check if shortcode is already a room ID (legacy support)
    let room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(shortcode);

    if (!room) {
      // Try to find by shortcode
      room = db.prepare('SELECT * FROM rooms WHERE shortcode = ?').get(shortcode.toUpperCase());
    }

    if (!room) {
      webLogger.warn('Room not found for shortcode', { shortcode, ip: req.ip });
      return res.status(404).sendFile(path.join(__dirname, '../../public/player-not-found.html'));
    }

    webLogger.info('Shortcode resolved', {
      shortcode,
      roomId: room.id,
      roomName: room.name,
      ip: req.ip
    });

    // Redirect to room view with resolved room ID
    res.redirect(`/room/${room.id}/player`);
  } catch (error) {
    webLogger.error('Error handling shortcode route', {
      shortcode: req.params.shortcode,
      error: error.message,
      ip: req.ip
    });
    res.status(500).send('Server error');
  }
});

// Game Master interface
router.get('/room/:roomId/gm', (req, res) => {
  const { roomId } = req.params;
  webLogger.debug('GM interface requested', { roomId, ip: req.ip });
  res.sendFile(path.join(__dirname, '../../public/gm.html'));
});

// Rules editor route
router.get('/room/:roomId/rules-editor', (req, res) => {
  const { roomId } = req.params;
  webLogger.debug('Rules editor requested', { roomId, ip: req.ip });
  res.sendFile(path.join(__dirname, '../../public/rules-editor.html'));
});

// Rules slideshow route
router.get('/room/:roomId/rules-slideshow', (req, res) => {
  const { roomId } = req.params;
  webLogger.debug('Rules slideshow requested', { roomId, ip: req.ip });
  res.sendFile(path.join(__dirname, '../../public/rules-slideshow.html'));
});

module.exports = router;