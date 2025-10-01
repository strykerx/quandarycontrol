const express = require('express');
const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');
const { logger } = require('../../../../utils/logger');
const { getDatabase } = require('../../../../db/database');

const router = express.Router();
const themesLogger = logger.child({ module: 'api-themes' });

/**
 * Get all available themes
 */
router.get('/themes', (req, res) => {
  try {
    const themesPath = path.join(__dirname, '../../../../../themes');
    let themes = [];

    if (fs.existsSync(themesPath)) {
      const themeDirs = fs.readdirSync(themesPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .filter(name => !name.startsWith('.'));

      themes = themeDirs.map(themeName => {
        const themePath = path.join(themesPath, themeName);
        const indexPath = path.join(themePath, 'index.html');
        const configPath = path.join(themePath, 'theme.json');

        let config = {};
        try {
          if (fs.existsSync(configPath)) {
            config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          }
        } catch (e) {
          themesLogger.warn('Invalid theme config', { themeName, error: e.message });
        }

        return {
          id: themeName,
          name: config.name || themeName,
          description: config.description || '',
          version: config.version || '1.0.0',
          author: config.author || 'Unknown',
          hasIndex: fs.existsSync(indexPath),
          path: `/themes/${themeName}`
        };
      });
    }

    themesLogger.info('Themes list retrieved', {
      themesCount: themes.length,
      ip: req.ip
    });

    res.json({ success: true, data: themes });
  } catch (error) {
    themesLogger.error('Error retrieving themes', {
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get a specific theme
 */
router.get('/themes/:id', (req, res) => {
  try {
    const { id } = req.params;
    const themePath = path.join(__dirname, '../../../../../themes', id);

    if (!fs.existsSync(themePath)) {
      themesLogger.warn('Theme not found', { themeId: id, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Theme not found' });
    }

    const configPath = path.join(themePath, 'theme.json');
    const indexPath = path.join(themePath, 'index.html');

    let config = {};
    try {
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
    } catch (e) {
      themesLogger.warn('Invalid theme config', { themeId: id, error: e.message });
    }

    const theme = {
      id,
      name: config.name || id,
      description: config.description || '',
      version: config.version || '1.0.0',
      author: config.author || 'Unknown',
      hasIndex: fs.existsSync(indexPath),
      path: `/themes/${id}`,
      config
    };

    themesLogger.info('Theme retrieved', { themeId: id, ip: req.ip });
    res.json({ success: true, data: theme });
  } catch (error) {
    themesLogger.error('Error retrieving theme', {
      themeId: req.params.id,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create a new theme
 */
router.post('/themes', (req, res) => {
  try {
    const { name, description, author, files = {} } = req.body;

    if (!name) {
      themesLogger.warn('Theme creation failed - name required', { ip: req.ip });
      return res.status(400).json({ success: false, error: 'Theme name is required' });
    }

    const themeId = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const themePath = path.join(__dirname, '../../../../../themes', themeId);

    if (fs.existsSync(themePath)) {
      themesLogger.warn('Theme creation failed - already exists', { themeId, ip: req.ip });
      return res.status(400).json({ success: false, error: 'Theme already exists' });
    }

    // Create theme directory
    fs.mkdirSync(themePath, { recursive: true });

    // Create theme.json config
    const config = {
      name,
      description: description || '',
      author: author || 'Unknown',
      version: '1.0.0',
      created_at: new Date().toISOString()
    };

    fs.writeFileSync(
      path.join(themePath, 'theme.json'),
      JSON.stringify(config, null, 2)
    );

    // Create basic index.html if not provided
    if (!files['index.html']) {
      const basicHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${name}</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <h1>${name}</h1>
        <p>${description || 'Custom theme'}</p>
    </div>
</body>
</html>`;
      fs.writeFileSync(path.join(themePath, 'index.html'), basicHtml);
    }

    // Create basic CSS if not provided
    if (!files['style.css']) {
      const basicCss = `/* ${name} Theme */
.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    font-family: Arial, sans-serif;
}

h1 {
    color: #333;
    text-align: center;
}

p {
    color: #666;
    text-align: center;
}`;
      fs.writeFileSync(path.join(themePath, 'style.css'), basicCss);
    }

    // Write any additional files
    Object.entries(files).forEach(([filename, content]) => {
      fs.writeFileSync(path.join(themePath, filename), content);
    });

    themesLogger.info('Theme created successfully', {
      themeId,
      name,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      data: {
        id: themeId,
        name,
        description,
        author,
        path: `/themes/${themeId}`
      }
    });
  } catch (error) {
    themesLogger.error('Error creating theme', {
      themeName: req.body.name,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update a theme
 */
router.put('/themes/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, author, files = {} } = req.body;

    const themePath = path.join(__dirname, '../../../../../themes', id);
    if (!fs.existsSync(themePath)) {
      themesLogger.warn('Theme update failed - not found', { themeId: id, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Theme not found' });
    }

    // Update theme.json config
    const configPath = path.join(themePath, 'theme.json');
    let config = {};
    try {
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
    } catch (e) {
      themesLogger.warn('Invalid existing theme config', { themeId: id, error: e.message });
    }

    if (name) config.name = name;
    if (description !== undefined) config.description = description;
    if (author) config.author = author;
    config.updated_at = new Date().toISOString();

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Update files
    Object.entries(files).forEach(([filename, content]) => {
      fs.writeFileSync(path.join(themePath, filename), content);
    });

    themesLogger.info('Theme updated successfully', {
      themeId: id,
      filesUpdated: Object.keys(files).length,
      ip: req.ip
    });

    res.json({ success: true, data: config });
  } catch (error) {
    themesLogger.error('Error updating theme', {
      themeId: req.params.id,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete a theme
 */
router.delete('/themes/:id', (req, res) => {
  try {
    const { id } = req.params;
    const themePath = path.join(__dirname, '../../../../../themes', id);

    if (!fs.existsSync(themePath)) {
      themesLogger.warn('Theme deletion failed - not found', { themeId: id, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Theme not found' });
    }

    // Prevent deletion of system themes
    const systemThemes = ['example-theme', 'boilerplate'];
    if (systemThemes.includes(id)) {
      themesLogger.warn('Theme deletion failed - system theme', { themeId: id, ip: req.ip });
      return res.status(400).json({ success: false, error: 'Cannot delete system theme' });
    }

    // Delete theme directory recursively
    fs.rmSync(themePath, { recursive: true, force: true });

    themesLogger.info('Theme deleted successfully', { themeId: id, ip: req.ip });
    res.json({ success: true, message: 'Theme deleted successfully' });
  } catch (error) {
    themesLogger.error('Error deleting theme', {
      themeId: req.params.id,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Apply theme to room
 */
router.post('/rooms/:roomId/theme', (req, res) => {
  try {
    const { roomId } = req.params;
    const { themeId } = req.body;

    if (!themeId) {
      themesLogger.warn('Apply theme failed - theme ID required', { roomId, ip: req.ip });
      return res.status(400).json({ success: false, error: 'Theme ID is required' });
    }

    // Check if theme exists
    const themePath = path.join(__dirname, '../../../../../themes', themeId);
    if (!fs.existsSync(themePath)) {
      themesLogger.warn('Apply theme failed - theme not found', { roomId, themeId, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Theme not found' });
    }

    const db = getDatabase();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
    if (!room) {
      themesLogger.warn('Apply theme failed - room not found', { roomId, themeId, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Update room config with theme
    let config = {};
    try {
      config = JSON.parse(room.config || '{}');
    } catch (e) {
      themesLogger.warn('Invalid room config during theme apply', {
        roomId,
        error: e.message,
        ip: req.ip
      });
      config = {};
    }

    config.theme = themeId;

    const updateStmt = db.prepare('UPDATE rooms SET config = ? WHERE id = ?');
    updateStmt.run(JSON.stringify(config), roomId);

    themesLogger.info('Theme applied to room successfully', {
      roomId,
      themeId,
      ip: req.ip
    });

    res.json({ success: true, data: { theme: themeId } });
  } catch (error) {
    themesLogger.error('Error applying theme to room', {
      roomId: req.params.roomId,
      themeId: req.body.themeId,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get theme assets
 */
router.get('/themes/:themeId/assets', (req, res) => {
  try {
    const { themeId } = req.params;
    const themePath = path.join(__dirname, '../../../../../themes', themeId);

    if (!fs.existsSync(themePath)) {
      themesLogger.warn('Theme assets request - theme not found', { themeId, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Theme not found' });
    }

    const assets = [];
    const files = fs.readdirSync(themePath, { withFileTypes: true });

    files.forEach(file => {
      if (file.isFile()) {
        const filePath = path.join(themePath, file.name);
        const stats = fs.statSync(filePath);
        assets.push({
          name: file.name,
          size: stats.size,
          modified: stats.mtime,
          path: `/themes/${themeId}/${file.name}`
        });
      }
    });

    themesLogger.info('Theme assets retrieved', {
      themeId,
      assetCount: assets.length,
      ip: req.ip
    });

    res.json({ success: true, data: assets });
  } catch (error) {
    themesLogger.error('Error retrieving theme assets', {
      themeId: req.params.themeId,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update theme by name (legacy endpoint)
 */
router.put('/themes/:themeName', (req, res) => {
  try {
    // Redirect to the standard update endpoint
    const { themeName } = req.params;
    themesLogger.debug('Legacy theme update endpoint used', { themeName, ip: req.ip });

    // Forward to the standard PUT /themes/:id endpoint
    req.params.id = themeName;
    return router.handle(req, res);
  } catch (error) {
    themesLogger.error('Error in legacy theme update', {
      themeName: req.params.themeName,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;