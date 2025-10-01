const express = require('express');
const { logger } = require('../../../../utils/logger');
const { getDatabase } = require('../../../../db/database');
const { checkAndExecuteTriggers } = require('./shared/triggers');

const router = express.Router();
const variableLogger = logger.child({ module: 'api-variables' });

/**
 * Process value based on type for consistency
 */
function processVariableValue(value, type) {
  switch (type) {
    case 'boolean':
      return Boolean(value);
    case 'integer':
      const numValue = Number(value);
      if (isNaN(numValue)) {
        throw new Error('Invalid integer value');
      }
      return numValue;
    case 'array':
    case 'object':
      if (typeof value === 'string') {
        return JSON.parse(value);
      }
      return value;
    default: // string
      return String(value);
  }
}

/**
 * Get variables for a room
 */
router.get('/rooms/:id/variables', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      variableLogger.warn('Variables request for non-existent room', { roomId: id, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Parse api_variables JSON column
    let variables = {};
    try {
      variables = JSON.parse(room.api_variables || '{}');
    } catch (e) {
      variableLogger.warn('Invalid JSON in api_variables', {
        roomId: id,
        error: e.message,
        ip: req.ip
      });
      variables = {};
    }

    // Convert to array format for compatibility with frontend
    const variablesArray = Object.entries(variables).map(([name, value], index) => ({
      id: index + 1, // Generate simple ID for compatibility
      room_id: id,
      name: name,
      type: Array.isArray(value) ? 'array' :
           typeof value === 'boolean' ? 'boolean' :
           typeof value === 'number' ? 'integer' : 'string',
      value: typeof value === 'string' ? value : JSON.stringify(value),
      // Include original value for advanced use cases
      parsed_value: value
    }));

    variableLogger.info('Variables retrieved', {
      roomId: id,
      variableCount: variablesArray.length,
      ip: req.ip
    });

    res.json({ success: true, data: variablesArray });
  } catch (error) {
    variableLogger.error('Error retrieving variables', {
      roomId: req.params.id,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Add or update a variable in a room
 */
router.post('/rooms/:id/variables', (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, value } = req.body;

    if (!name || !type || value === undefined) {
      variableLogger.warn('Variable creation failed - missing required fields', {
        roomId: id,
        hasName: !!name,
        hasType: !!type,
        hasValue: value !== undefined,
        ip: req.ip
      });
      return res.status(400).json({
        success: false,
        error: 'Name, type, and value are required'
      });
    }

    // Support legacy types plus array/object for JSON compatibility
    const validTypes = ['boolean', 'integer', 'string', 'array', 'object'];
    if (!validTypes.includes(type)) {
      variableLogger.warn('Variable creation failed - invalid type', {
        roomId: id,
        type,
        validTypes,
        ip: req.ip
      });
      return res.status(400).json({
        success: false,
        error: `Type must be one of: ${validTypes.join(', ')}`
      });
    }

    const db = getDatabase();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      variableLogger.warn('Variable creation failed - room not found', { roomId: id, ip: req.ip });
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Parse current api_variables
    let variables = {};
    try {
      variables = JSON.parse(room.api_variables || '{}');
    } catch (e) {
      variableLogger.warn('Invalid JSON in api_variables during variable creation', {
        roomId: id,
        error: e.message,
        ip: req.ip
      });
      variables = {};
    }

    // Process value based on type
    let processedValue;
    try {
      processedValue = processVariableValue(value, type);
    } catch (error) {
      variableLogger.warn('Variable creation failed - value processing error', {
        roomId: id,
        variableName: name,
        type,
        value,
        error: error.message,
        ip: req.ip
      });
      return res.status(400).json({ success: false, error: error.message });
    }

    // Add/update variable in the JSON object
    variables[name] = processedValue;

    // Update the api_variables column
    const updateStmt = db.prepare('UPDATE rooms SET api_variables = ? WHERE id = ?');
    updateStmt.run(JSON.stringify(variables), id);

    variableLogger.info('Variable created/updated', {
      roomId: id,
      variableName: name,
      type,
      ip: req.ip
    });

    // Return in format compatible with legacy endpoint
    const variableResponse = {
      id: Date.now(), // Generate a fake ID for compatibility
      room_id: id,
      name: name,
      type: type,
      value: String(value),
      parsed_value: processedValue // Include original value for advanced use cases
    };

    res.status(201).json({ success: true, data: variableResponse });
  } catch (error) {
    variableLogger.error('Error creating/updating variable', {
      roomId: req.params.id,
      variableName: req.body.name,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update a specific variable in a room via URL parameters
 * This endpoint also triggers WebSocket events and variable triggers
 */
router.post('/rooms/:roomId/variables/:varName', (req, res) => {
  try {
    const { roomId, varName } = req.params;
    const { value, type = 'string' } = req.body;

    variableLogger.debug('Variable update API called', {
      roomId,
      varName,
      type,
      hasValue: value !== undefined,
      ip: req.ip
    });

    if (value === undefined) {
      variableLogger.warn('Variable update failed - value required', {
        roomId,
        varName,
        ip: req.ip
      });
      return res.status(400).json({
        success: false,
        error: 'Value is required in request body'
      });
    }

    const db = getDatabase();
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);

    if (!room) {
      variableLogger.warn('Variable update failed - room not found', {
        roomId,
        varName,
        ip: req.ip
      });
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    let variables = {};
    try {
      variables = JSON.parse(room.api_variables || '{}');
    } catch (e) {
      variableLogger.warn('Invalid JSON in api_variables during variable update', {
        roomId,
        varName,
        error: e.message,
        ip: req.ip
      });
      variables = {};
    }

    // Process value based on type
    let processedValue;
    try {
      processedValue = processVariableValue(value, type);
    } catch (error) {
      variableLogger.warn('Variable update failed - value processing error', {
        roomId,
        varName,
        type,
        value,
        error: error.message,
        ip: req.ip
      });
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    variables[varName] = processedValue;

    const updateStmt = db.prepare('UPDATE rooms SET api_variables = ? WHERE id = ?');
    updateStmt.run(JSON.stringify(variables), roomId);

    // Broadcast update via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('variable_updated', {
        var: varName,
        value: processedValue,
        timestamp: new Date().toISOString()
      });

      variableLogger.debug('Variable update broadcasted via WebSocket', {
        roomId,
        varName,
        value: processedValue
      });
    }

    // Check and execute triggers
    try {
      checkAndExecuteTriggers(roomId, varName, processedValue, io);
    } catch (triggerError) {
      variableLogger.error('Error executing triggers after variable update', {
        roomId,
        varName,
        error: triggerError.message
      });
      // Don't fail the request if triggers fail, just log the error
    }

    variableLogger.info('Variable updated successfully', {
      roomId,
      varName,
      type,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      data: { [varName]: processedValue }
    });
  } catch (error) {
    variableLogger.error('Error updating variable', {
      roomId: req.params.roomId,
      varName: req.params.varName,
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;