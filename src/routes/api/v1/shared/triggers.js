const { logger } = require('../../../../../utils/logger');
const { getDatabase } = require('../../../../../db/database');

const triggerLogger = logger.child({ module: 'api-triggers' });

/**
 * Check and execute triggers for a variable change
 */
function checkAndExecuteTriggers(roomId, variableName, newValue, io) {
  try {
    triggerLogger.debug('Checking triggers', { roomId, variableName, newValue });

    const db = getDatabase();
    const room = db.prepare('SELECT config FROM rooms WHERE id = ?').get(roomId);

    if (!room || !room.config) {
      triggerLogger.debug('No room or config found', { roomId });
      return;
    }

    let config = {};
    try {
      config = JSON.parse(room.config);
    } catch (e) {
      triggerLogger.warn('Invalid config JSON', { roomId, error: e.message });
      return;
    }

    const triggers = config.triggers || [];
    triggerLogger.debug('Found triggers', { roomId, triggerCount: triggers.length });

    triggers.forEach((trigger, index) => {
      triggerLogger.debug('Checking trigger', { roomId, triggerIndex: index, trigger });

      if (trigger.variable === variableName) {
        const conditionResult = evaluateCondition(trigger, newValue);
        triggerLogger.debug('Condition evaluation result', {
          roomId,
          triggerIndex: index,
          result: conditionResult
        });

        if (conditionResult) {
          triggerLogger.info('Executing trigger actions', {
            roomId,
            triggerIndex: index,
            actions: trigger.actions
          });
          executeTriggerActions(roomId, trigger.actions, io);
        }
      }
    });
  } catch (error) {
    triggerLogger.error('Error processing triggers', {
      roomId,
      variableName,
      error: error.message
    });
  }
}

/**
 * Evaluate trigger condition
 */
function evaluateCondition(trigger, value) {
  const { condition, value: triggerValue } = trigger;

  triggerLogger.debug('Evaluating condition', {
    condition,
    triggerValue,
    actualValue: value,
    triggerValueType: typeof triggerValue,
    actualValueType: typeof value
  });

  let result = false;

  switch (condition) {
    case 'equals':
      result = String(value) === String(triggerValue);
      break;
    case 'not_equals':
      result = String(value) !== String(triggerValue);
      break;
    case 'greater_than':
      result = Number(value) > Number(triggerValue);
      break;
    case 'less_than':
      result = Number(value) < Number(triggerValue);
      break;
    case 'contains':
      result = String(value).includes(String(triggerValue));
      break;
    case 'changes_to':
      result = String(value) === String(triggerValue);
      break;
    case 'changes_from':
      // This would require storing previous values, implement if needed
      result = false;
      triggerLogger.warn('changes_from condition not implemented');
      break;
    default:
      result = false;
      triggerLogger.warn('Unknown trigger condition', { condition });
  }

  triggerLogger.debug('Condition evaluation completed', { condition, result });
  return result;
}

/**
 * Execute trigger actions
 */
function executeTriggerActions(roomId, actions, io) {
  if (!Array.isArray(actions)) {
    triggerLogger.warn('Invalid actions array', { roomId, actions });
    return;
  }

  actions.forEach((action, index) => {
    try {
      triggerLogger.debug('Executing trigger action', { roomId, actionIndex: index, action });

      switch (action.type) {
        case 'play_sound':
          if (io) {
            io.to(roomId).emit('play_sound', {
              file: action.file,
              volume: action.volume || 50
            });
            triggerLogger.info('Play sound action executed', { roomId, file: action.file });
          }
          break;

        case 'show_message':
          if (io) {
            io.to(roomId).emit('show_message', {
              text: action.text,
              duration: action.duration || 5
            });
            triggerLogger.info('Show message action executed', { roomId, text: action.text });
          }
          break;

        case 'show_media':
          if (io) {
            io.to(roomId).emit('show_lightbox', {
              mediaId: action.file || action.mediaId,
              headline: action.headline || 'Trigger Action',
              autoCloseEnabled: action.duration ? true : false,
              autoCloseSeconds: action.duration || 5
            });
            triggerLogger.info('Show media action executed', { roomId, media: action.file });
          }
          break;

        case 'update_variable':
          if (action.variable && action.value !== undefined) {
            // This could cause recursive triggers, so we should be careful
            triggerLogger.info('Update variable action executed', {
              roomId,
              variable: action.variable,
              value: action.value
            });
            // Note: Implementation would go here to update the variable
          }
          break;

        case 'send_hint':
          if (io && action.message) {
            io.to(roomId).emit('hintReceived', {
              message: action.message,
              timestamp: new Date().toISOString(),
              source: 'trigger'
            });
            triggerLogger.info('Send hint action executed', { roomId, message: action.message });
          }
          break;

        default:
          triggerLogger.warn('Unknown trigger action type', { roomId, actionType: action.type });
      }
    } catch (error) {
      triggerLogger.error('Error executing trigger action', {
        roomId,
        actionIndex: index,
        action,
        error: error.message
      });
    }
  });
}

module.exports = {
  checkAndExecuteTriggers,
  evaluateCondition,
  executeTriggerActions
};