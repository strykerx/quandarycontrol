const express = require('express');
const { logger } = require('../../../../utils/logger');
const { getDatabase } = require('../../../../db/database');
const { upload } = require('./shared/upload');

const router = express.Router();
const rulesLogger = logger.child({ module: 'api-rules' });

/**
 * Get rules for a room
 */
router.get('/rooms/:id/rules', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      rulesLogger.warn('Rules request for non-existent room', { roomId: id, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    let rules = [];
    try {
      const rulesConfig = JSON.parse(room.rules_config || '{}');
      rules = rulesConfig.rules || [];
    } catch (e) {
      rulesLogger.warn('Invalid JSON in rules_config', {
        roomId: id,
        error: e.message,
        ip: req.ip
      });
      rules = [];
    }

    rulesLogger.info('Rules retrieved', {
      roomId: id,
      rulesCount: rules.length,
      ip: req.ip
    });

    res.json({ success: true, data: rules });
  } catch (error) {
    rulesLogger.error('Error retrieving rules', {
      roomId: req.params.id,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create a new rule for a room (with optional media upload)
 */
router.post('/rooms/:id/rules', upload.single('media'), (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, order = 0 } = req.body;

    if (!title || !content) {
      rulesLogger.warn('Rule creation failed - missing required fields', {
        roomId: id,
        hasTitle: !!title,
        hasContent: !!content,
        ip: req.ip
      });
      return res.status(400).json({
        success: false,
        error: 'Title and content are required'
      });
    }

    const db = getDatabase();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      rulesLogger.warn('Rule creation failed - room not found', { roomId: id, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Parse current rules
    let rulesConfig = {};
    try {
      rulesConfig = JSON.parse(room.rules_config || '{}');
    } catch (e) {
      rulesLogger.warn('Invalid JSON in rules_config during rule creation', {
        roomId: id,
        error: e.message,
        ip: req.ip
      });
      rulesConfig = {};
    }

    if (!rulesConfig.rules) {
      rulesConfig.rules = [];
    }

    // Create new rule
    const newRule = {
      id: Date.now().toString(),
      title,
      content,
      order: parseInt(order) || 0,
      created_at: new Date().toISOString()
    };

    // Add media if uploaded
    if (req.file) {
      newRule.media = {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: `/uploads/${req.file.filename}`
      };
      rulesLogger.debug('Media attached to rule', {
        roomId: id,
        ruleId: newRule.id,
        filename: req.file.filename,
        ip: req.ip
      });
    }

    rulesConfig.rules.push(newRule);

    // Sort rules by order
    rulesConfig.rules.sort((a, b) => (a.order || 0) - (b.order || 0));

    // Update database
    const updateStmt = db.prepare('UPDATE rooms SET rules_config = ? WHERE id = ?');
    updateStmt.run(JSON.stringify(rulesConfig), id);

    rulesLogger.info('Rule created successfully', {
      roomId: id,
      ruleId: newRule.id,
      title: newRule.title,
      hasMedia: !!req.file,
      ip: req.ip
    });

    res.status(201).json({ success: true, data: newRule });
  } catch (error) {
    rulesLogger.error('Error creating rule', {
      roomId: req.params.id,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete a rule from a room
 */
router.delete('/rooms/:id/rules/:ruleId', (req, res) => {
  try {
    const { id, ruleId } = req.params;
    const db = getDatabase();

    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      rulesLogger.warn('Rule deletion failed - room not found', { roomId: id, ruleId, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Parse current rules
    let rulesConfig = {};
    try {
      rulesConfig = JSON.parse(room.rules_config || '{}');
    } catch (e) {
      rulesLogger.warn('Invalid JSON in rules_config during rule deletion', {
        roomId: id,
        ruleId,
        error: e.message,
        ip: req.ip
      });
      return res.status(500).json({ success: false, error: 'Invalid rules configuration' });
    }

    if (!rulesConfig.rules) {
      rulesLogger.warn('Rule deletion failed - no rules found', { roomId: id, ruleId, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    // Find and remove rule
    const ruleIndex = rulesConfig.rules.findIndex(rule => rule.id === ruleId);
    if (ruleIndex === -1) {
      rulesLogger.warn('Rule deletion failed - rule not found', { roomId: id, ruleId, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    const deletedRule = rulesConfig.rules[ruleIndex];
    rulesConfig.rules.splice(ruleIndex, 1);

    // Update database
    const updateStmt = db.prepare('UPDATE rooms SET rules_config = ? WHERE id = ?');
    updateStmt.run(JSON.stringify(rulesConfig), id);

    rulesLogger.info('Rule deleted successfully', {
      roomId: id,
      ruleId,
      title: deletedRule.title,
      ip: req.ip
    });

    res.json({ success: true, message: 'Rule deleted successfully' });
  } catch (error) {
    rulesLogger.error('Error deleting rule', {
      roomId: req.params.id,
      ruleId: req.params.ruleId,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Reorder rules in a room
 */
router.post('/rooms/:id/rules/order', (req, res) => {
  try {
    const { id } = req.params;
    const { ruleOrder } = req.body;

    if (!Array.isArray(ruleOrder)) {
      rulesLogger.warn('Rule reordering failed - invalid rule order format', {
        roomId: id,
        ruleOrderType: typeof ruleOrder,
        ip: req.ip
      });
      return res.status(400).json({
        success: false,
        error: 'Rule order must be an array of rule IDs'
      });
    }

    const db = getDatabase();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      rulesLogger.warn('Rule reordering failed - room not found', { roomId: id, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Parse current rules
    let rulesConfig = {};
    try {
      rulesConfig = JSON.parse(room.rules_config || '{}');
    } catch (e) {
      rulesLogger.warn('Invalid JSON in rules_config during rule reordering', {
        roomId: id,
        error: e.message,
        ip: req.ip
      });
      return res.status(500).json({ success: false, error: 'Invalid rules configuration' });
    }

    if (!rulesConfig.rules) {
      rulesLogger.warn('Rule reordering failed - no rules found', { roomId: id, ip: req.ip });
      return res.status(404).json({ success: false, error: 'No rules found' });
    }

    // Apply new order
    ruleOrder.forEach((ruleId, index) => {
      const rule = rulesConfig.rules.find(r => r.id === ruleId);
      if (rule) {
        rule.order = index;
      }
    });

    // Sort rules by new order
    rulesConfig.rules.sort((a, b) => (a.order || 0) - (b.order || 0));

    // Update database
    const updateStmt = db.prepare('UPDATE rooms SET rules_config = ? WHERE id = ?');
    updateStmt.run(JSON.stringify(rulesConfig), id);

    rulesLogger.info('Rules reordered successfully', {
      roomId: id,
      rulesCount: rulesConfig.rules.length,
      newOrder: ruleOrder,
      ip: req.ip
    });

    res.json({ success: true, data: rulesConfig.rules });
  } catch (error) {
    rulesLogger.error('Error reordering rules', {
      roomId: req.params.id,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;