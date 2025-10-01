const { logger } = require('../../utils/logger');
const { getDatabase } = require('../../db/database');

class TimerService {
  constructor() {
    this.activeTimers = new Map();
    this.activeSecondaryTimers = new Map();
    this.triggeredActions = new Map();
  }

  /**
   * Initialize timer for a room
   */
  initializeTimer(roomId, duration, type = 'main') {
    const timersMap = type === 'main' ? this.activeTimers : this.activeSecondaryTimers;

    if (!timersMap.has(roomId)) {
      timersMap.set(roomId, {
        duration: duration || 300, // Default 5 minutes
        remaining: duration || 300,
        interval: null,
        enabled: true
      });

      logger.debug(`Timer initialized for room ${roomId}`, { type, duration });
    }

    return timersMap.get(roomId);
  }

  /**
   * Start timer for a room
   */
  startTimer(roomId, type = 'main', io) {
    const timersMap = type === 'main' ? this.activeTimers : this.activeSecondaryTimers;
    const timer = timersMap.get(roomId);

    if (!timer || timer.interval) {
      return false;
    }

    timer.startTime = Date.now() - (timer.duration - timer.remaining) * 1000;
    timer.interval = setInterval(async () => {
      const elapsed = Math.floor((Date.now() - timer.startTime) / 1000);
      timer.remaining = Math.max(timer.duration - elapsed, 0);

      const eventName = type === 'main' ? 'timer_update' : 'secondary_timer_update';
      const updateData = {
        remaining: timer.remaining,
        duration: timer.duration,
        running: true
      };

      if (type === 'secondary') {
        updateData.enabled = timer.enabled;
      }

      io.to(roomId).emit(eventName, updateData);

      // Update timer variables and check triggers
      await this.updateTimerVariables(roomId, type, timer.remaining, timer.duration, io);

      if (type === 'secondary') {
        this.checkSecondaryTimerTriggers(roomId, timer.remaining, io);
      }

      if (timer.remaining <= 0) {
        this.stopTimer(roomId, type, io);
        const completeEvent = type === 'main' ? 'timer_complete' : 'secondary_timer_complete';
        io.to(roomId).emit(completeEvent);

        if (type === 'secondary') {
          this.checkSecondaryTimerTriggers(roomId, 0, io);
        }
      }
    }, 1000);

    logger.info(`Timer started for room ${roomId}`, { type, remaining: timer.remaining });
    return true;
  }

  /**
   * Pause timer for a room
   */
  pauseTimer(roomId, type = 'main', io) {
    const timersMap = type === 'main' ? this.activeTimers : this.activeSecondaryTimers;
    const timer = timersMap.get(roomId);

    if (!timer || !timer.interval) {
      return false;
    }

    clearInterval(timer.interval);
    timer.interval = null;

    const eventName = type === 'main' ? 'timer_update' : 'secondary_timer_update';
    const updateData = {
      remaining: timer.remaining,
      duration: timer.duration,
      running: false
    };

    if (type === 'secondary') {
      updateData.enabled = timer.enabled;
    }

    io.to(roomId).emit(eventName, updateData);

    logger.info(`Timer paused for room ${roomId}`, { type, remaining: timer.remaining });
    return true;
  }

  /**
   * Stop and reset timer for a room
   */
  stopTimer(roomId, type = 'main', io) {
    const timersMap = type === 'main' ? this.activeTimers : this.activeSecondaryTimers;
    const timer = timersMap.get(roomId);

    if (!timer) {
      return false;
    }

    if (timer.interval) {
      clearInterval(timer.interval);
      timer.interval = null;
    }

    timer.remaining = timer.duration;

    const eventName = type === 'main' ? 'timer_update' : 'secondary_timer_update';
    const updateData = {
      remaining: timer.remaining,
      duration: timer.duration,
      running: false
    };

    if (type === 'secondary') {
      updateData.enabled = timer.enabled;
    }

    if (io) {
      io.to(roomId).emit(eventName, updateData);
    }

    logger.info(`Timer stopped for room ${roomId}`, { type });
    return true;
  }

  /**
   * Adjust timer duration
   */
  adjustTimer(roomId, amount, type = 'main', io) {
    const timersMap = type === 'main' ? this.activeTimers : this.activeSecondaryTimers;
    const timer = timersMap.get(roomId);

    if (!timer) {
      return false;
    }

    const newDuration = timer.duration + amount;
    if (newDuration <= 0) {
      return false;
    }

    timer.duration = newDuration;
    if (!timer.interval) {
      timer.remaining = timer.duration;
    }

    const eventName = type === 'main' ? 'timer_update' : 'secondary_timer_update';
    const updateData = {
      remaining: timer.remaining,
      duration: timer.duration,
      running: !!timer.interval
    };

    if (type === 'secondary') {
      updateData.enabled = timer.enabled;
    }

    io.to(roomId).emit(eventName, updateData);

    logger.info(`Timer adjusted for room ${roomId}`, { type, amount, newDuration });
    return true;
  }

  /**
   * Reset timer with new duration
   */
  resetTimer(roomId, newDuration, type = 'main', io) {
    const timersMap = type === 'main' ? this.activeTimers : this.activeSecondaryTimers;
    const timer = timersMap.get(roomId);

    if (!timer) {
      return false;
    }

    // Stop the timer if running
    if (timer.interval) {
      clearInterval(timer.interval);
      timer.interval = null;
    }

    // Reset to the specified duration
    if (newDuration && newDuration > 0) {
      timer.duration = newDuration;
      timer.remaining = newDuration;
    } else {
      timer.remaining = timer.duration;
    }

    const eventName = type === 'main' ? 'timer_update' : 'secondary_timer_update';
    const updateData = {
      remaining: timer.remaining,
      duration: timer.duration,
      running: false
    };

    if (type === 'secondary') {
      updateData.enabled = timer.enabled;
    }

    io.to(roomId).emit(eventName, updateData);

    logger.info(`Timer reset for room ${roomId}`, { type, newDuration });
    return true;
  }

  /**
   * Get timer state
   */
  getTimerState(roomId, type = 'main') {
    const timersMap = type === 'main' ? this.activeTimers : this.activeSecondaryTimers;
    const timer = timersMap.get(roomId);

    if (!timer) {
      return null;
    }

    const state = {
      remaining: timer.remaining,
      duration: timer.duration,
      running: !!timer.interval
    };

    if (type === 'secondary') {
      state.enabled = timer.enabled;
    }

    return state;
  }

  /**
   * Update timer variables in database and check triggers
   */
  async updateTimerVariables(roomId, timerType, remaining, duration, io) {
    try {
      const db = getDatabase();
      const room = db.prepare('SELECT api_variables FROM rooms WHERE id = ?').get(roomId);
      if (!room) return;

      let apiVariables = {};
      try {
        apiVariables = JSON.parse(room.api_variables || '{}');
      } catch (e) {
        logger.error('Error parsing api_variables', { roomId, error: e.message });
        return;
      }

      // Update timer variables
      const timerVariableName = timerType === 'main' ? 'timer_main' : 'timer_secondary';
      const remainingVariableName = timerType === 'main' ? 'timer_main_remaining' : 'timer_secondary_remaining';

      const elapsed = duration - remaining;

      apiVariables[timerVariableName] = { type: 'number', value: elapsed, system: true };
      apiVariables[remainingVariableName] = { type: 'number', value: remaining, system: true };

      // Save updated variables to database
      const updateStmt = db.prepare('UPDATE rooms SET api_variables = ? WHERE id = ?');
      updateStmt.run(JSON.stringify(apiVariables), roomId);

      // Check for triggers on the timer variables
      const { checkAndExecuteTriggers } = require('../../routes/api');
      await checkAndExecuteTriggers(roomId, timerVariableName, elapsed, io);
      await checkAndExecuteTriggers(roomId, remainingVariableName, remaining, io);

    } catch (error) {
      logger.error('Error updating timer variables', { roomId, timerType, error: error.message });
    }
  }

  /**
   * Check secondary timer triggers
   */
  checkSecondaryTimerTriggers(roomId, remainingSeconds, io) {
    try {
      const db = getDatabase();
      const room = db.prepare('SELECT config FROM rooms WHERE id = ?').get(roomId);

      if (!room) return;

      let config = {};
      try {
        config = JSON.parse(room.config || '{}');
      } catch (error) {
        logger.warn('Failed to parse room config for triggers', { roomId, error: error.message });
        return;
      }

      if (config.secondaryTimerTriggers && Array.isArray(config.secondaryTimerTriggers)) {
        const roomTriggers = this.triggeredActions.get(roomId) || new Set();

        config.secondaryTimerTriggers.forEach(trigger => {
          if (trigger.timeSeconds === remainingSeconds) {
            const triggerKey = `${roomId}_${trigger.timeSeconds}_${trigger.action}`;

            if (!roomTriggers.has(triggerKey)) {
              roomTriggers.add(triggerKey);
              this.triggeredActions.set(roomId, roomTriggers);

              logger.info(`Triggering secondary timer action for room ${roomId}`, {
                remainingSeconds,
                trigger
              });

              this.executeTimerTriggerAction(roomId, trigger, remainingSeconds, io);
            }
          }
        });
      }
    } catch (error) {
      logger.error('Error checking secondary timer triggers', { roomId, error: error.message });
    }
  }

  /**
   * Execute timer trigger actions
   */
  executeTimerTriggerAction(roomId, trigger, remainingSeconds, io) {
    try {
      switch (trigger.action) {
        case 'show_media':
          if (trigger.mediaId || trigger.headline) {
            io.to(roomId).emit('show_lightbox', {
              mediaId: trigger.mediaId || null,
              headline: trigger.headline || `Timer trigger at ${remainingSeconds}s`,
              autoCloseEnabled: trigger.autoClose !== false,
              autoCloseSeconds: trigger.autoCloseSeconds || 5
            });
          }
          break;

        case 'update_variable':
          if (trigger.variableName && trigger.variableValue !== undefined) {
            io.to(roomId).emit('variableUpdate', {
              name: trigger.variableName,
              value: trigger.variableValue,
              type: typeof trigger.variableValue,
              source: 'secondary_timer'
            });
          }
          break;

        case 'send_hint':
          if (trigger.message) {
            io.to(roomId).emit('hintReceived', {
              message: trigger.message,
              timestamp: new Date().toISOString(),
              source: 'secondary_timer'
            });
          }
          break;

        case 'play_sound':
          if (trigger.soundId) {
            io.to(roomId).emit('play_sound', {
              soundId: trigger.soundId,
              volume: trigger.volume || 1.0
            });
          }
          break;

        default:
          logger.warn('Unknown timer trigger action', { action: trigger.action, roomId });
      }
    } catch (error) {
      logger.error('Error executing timer trigger action', { roomId, trigger, error: error.message });
    }
  }

  /**
   * Clear all timers for a room (cleanup)
   */
  clearRoomTimers(roomId) {
    this.stopTimer(roomId, 'main');
    this.stopTimer(roomId, 'secondary');
    this.activeTimers.delete(roomId);
    this.activeSecondaryTimers.delete(roomId);
    this.triggeredActions.delete(roomId);

    logger.debug(`Cleared all timers for room ${roomId}`);
  }

  /**
   * Clear all timers (server shutdown)
   */
  clearAllTimers() {
    for (const [roomId] of this.activeTimers) {
      this.clearRoomTimers(roomId);
    }

    logger.info('All timers cleared');
  }
}

module.exports = TimerService;