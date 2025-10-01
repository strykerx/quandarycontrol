const express = require('express');
const { nanoid } = require('nanoid');
const { logger } = require('../../../../utils/logger');
const { getDatabase } = require('../../../../db/database');

const router = express.Router();
const layoutLogger = logger.child({ module: 'api-layout' });

/**
 * Get layout for a room
 */
router.get('/rooms/:id/layout', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      layoutLogger.warn('Layout request for non-existent room', { roomId: id, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    let layout = {};
    try {
      const config = JSON.parse(room.config || '{}');
      layout = config.layout || {};
    } catch (e) {
      layoutLogger.warn('Invalid JSON in room config for layout', {
        roomId: id,
        error: e.message,
        ip: req.ip
      });
      layout = {};
    }

    layoutLogger.info('Layout retrieved', {
      roomId: id,
      hasLayout: Object.keys(layout).length > 0,
      ip: req.ip
    });

    res.json({ success: true, data: layout });
  } catch (error) {
    layoutLogger.error('Error retrieving layout', {
      roomId: req.params.id,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update layout for a room
 */
router.put('/rooms/:id/layout', (req, res) => {
  try {
    const { id } = req.params;
    const { layout } = req.body;

    if (!layout || typeof layout !== 'object') {
      layoutLogger.warn('Layout update failed - invalid layout data', {
        roomId: id,
        layoutType: typeof layout,
        ip: req.ip
      });
      return res.status(400).json({
        success: false,
        error: 'Valid layout object is required'
      });
    }

    const db = getDatabase();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      layoutLogger.warn('Layout update failed - room not found', { roomId: id, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Parse current config
    let config = {};
    try {
      config = JSON.parse(room.config || '{}');
    } catch (e) {
      layoutLogger.warn('Invalid JSON in room config during layout update', {
        roomId: id,
        error: e.message,
        ip: req.ip
      });
      config = {};
    }

    // Update layout
    config.layout = layout;

    // Update room config
    const updateStmt = db.prepare('UPDATE rooms SET config = ? WHERE id = ?');
    updateStmt.run(JSON.stringify(config), id);

    layoutLogger.info('Layout updated successfully', {
      roomId: id,
      layoutKeys: Object.keys(layout).length,
      ip: req.ip
    });

    res.json({ success: true, data: layout });
  } catch (error) {
    layoutLogger.error('Error updating layout', {
      roomId: req.params.id,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Validate layout JSON
 */
router.post('/layout/validate', (req, res) => {
  try {
    const { layout } = req.body;

    if (!layout) {
      layoutLogger.warn('Layout validation failed - no layout provided', { ip: req.ip });
      return res.status(400).json({
        success: false,
        error: 'Layout is required for validation'
      });
    }

    // Basic validation - check required structure
    const errors = [];
    const warnings = [];

    // Check if layout has layouts object
    if (!layout.layouts || typeof layout.layouts !== 'object') {
      errors.push('Layout must contain a "layouts" object');
    } else {
      // Check for default layout
      if (!layout.layouts.default) {
        warnings.push('No default layout defined');
      }

      // Validate each layout
      Object.entries(layout.layouts).forEach(([name, layoutConfig]) => {
        if (!layoutConfig || typeof layoutConfig !== 'object') {
          errors.push(`Layout "${name}" must be an object`);
        }
      });
    }

    const isValid = errors.length === 0;

    layoutLogger.info('Layout validation completed', {
      isValid,
      errorCount: errors.length,
      warningCount: warnings.length,
      ip: req.ip
    });

    res.json({
      success: true,
      data: {
        valid: isValid,
        errors,
        warnings
      }
    });
  } catch (error) {
    layoutLogger.error('Error validating layout', {
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get layout presets
 */
router.get('/layout/presets', (req, res) => {
  try {
    // Predefined layout presets
    const presets = {
      'single-column': {
        name: 'Single Column',
        description: 'Simple single column layout',
        layout: {
          layouts: {
            default: {
              grid: {
                template: '1fr',
                gap: '20px'
              }
            }
          }
        }
      },
      'two-column': {
        name: 'Two Column',
        description: 'Two column layout with equal widths',
        layout: {
          layouts: {
            default: {
              grid: {
                template: '1fr 1fr',
                gap: '20px'
              }
            }
          }
        }
      },
      'sidebar-main': {
        name: 'Sidebar + Main',
        description: 'Sidebar with main content area',
        layout: {
          layouts: {
            default: {
              grid: {
                template: '300px 1fr',
                gap: '20px'
              }
            }
          }
        }
      },
      'three-column': {
        name: 'Three Column',
        description: 'Three column layout',
        layout: {
          layouts: {
            default: {
              grid: {
                template: '1fr 2fr 1fr',
                gap: '15px'
              }
            }
          }
        }
      }
    };

    layoutLogger.info('Layout presets retrieved', {
      presetCount: Object.keys(presets).length,
      ip: req.ip
    });

    res.json({ success: true, data: presets });
  } catch (error) {
    layoutLogger.error('Error retrieving layout presets', {
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get all layout templates
 */
router.get('/layout-templates', (req, res) => {
  try {
    const db = getDatabase();

    // For now, return empty array as we don't have a templates table
    // In a full implementation, this would query a layout_templates table
    const templates = [];

    layoutLogger.info('Layout templates retrieved', {
      templateCount: templates.length,
      ip: req.ip
    });

    res.json({ success: true, data: templates });
  } catch (error) {
    layoutLogger.error('Error retrieving layout templates', {
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get a specific layout template
 */
router.get('/layout-templates/:id', (req, res) => {
  try {
    const { id } = req.params;

    layoutLogger.warn('Layout template not found', { templateId: id, ip: req.ip });

    // For now, always return not found
    // In a full implementation, this would query a layout_templates table
    res.status(404).json({ success: false, error: 'Layout template not found' });
  } catch (error) {
    layoutLogger.error('Error retrieving layout template', {
      templateId: req.params.id,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create a new layout template
 */
router.post('/layout-templates', (req, res) => {
  try {
    const { name, description, layout } = req.body;

    if (!name || !layout) {
      layoutLogger.warn('Layout template creation failed - missing required fields', {
        hasName: !!name,
        hasLayout: !!layout,
        ip: req.ip
      });
      return res.status(400).json({
        success: false,
        error: 'Name and layout are required'
      });
    }

    // For now, return a mock response
    // In a full implementation, this would save to a layout_templates table
    const template = {
      id: nanoid(),
      name,
      description: description || '',
      layout,
      created_at: new Date().toISOString()
    };

    layoutLogger.info('Layout template creation simulated', {
      templateId: template.id,
      name: template.name,
      ip: req.ip
    });

    res.status(501).json({
      success: false,
      error: 'Layout template creation not implemented yet',
      data: template
    });
  } catch (error) {
    layoutLogger.error('Error creating layout template', {
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Apply layout template to room
 */
router.post('/rooms/:roomId/apply-template/:templateId', (req, res) => {
  try {
    const { roomId, templateId } = req.params;

    layoutLogger.warn('Apply layout template not implemented', {
      roomId,
      templateId,
      ip: req.ip
    });

    // For now, return not implemented
    res.status(501).json({
      success: false,
      error: 'Apply layout template not implemented yet'
    });
  } catch (error) {
    layoutLogger.error('Error applying layout template', {
      roomId: req.params.roomId,
      templateId: req.params.templateId,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;