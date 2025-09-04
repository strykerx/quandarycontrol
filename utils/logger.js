// Comprehensive logging utility for application debugging and monitoring
const fs = require('fs');
const path = require('path');

class Logger {
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.filePath = options.filePath || path.join(__dirname, '../logs/app.log');
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 5;
    this.colors = {
      error: '\x1b[31m', // Red
      warn: '\x1b[33m',  // Yellow
      info: '\x1b[36m',  // Cyan
      debug: '\x1b[35m', // Magenta
      reset: '\x1b[0m'   // Reset
    };

    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };

    // Ensure log directory exists
    const logDir = path.dirname(this.filePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  /**
   * Format log message with timestamp and level
   */
  formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const color = this.colors[level] || this.colors.reset;
    const reset = this.colors.reset;

    // Format console output with colors
    const consoleMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    // Format file output without colors
    const fileMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    return { consoleMessage, fileMessage, color, reset };
  }

  /**
   * Write to log file with rotation
   */
  writeToFile(message) {
    try {
      // Check if file needs rotation
      if (fs.existsSync(this.filePath)) {
        const stats = fs.statSync(this.filePath);
        if (stats.size > this.maxFileSize) {
          this.rotateLogFiles();
        }
      }

      fs.appendFileSync(this.filePath, message + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  /**
   * Rotate log files
   */
  rotateLogFiles() {
    try {
      const basePath = this.filePath.replace('.log', '');
      const extension = path.extname(this.filePath);

      // Remove oldest file if it exists
      const oldestFile = `${basePath}.${this.maxFiles}${extension}`;
      if (fs.existsSync(oldestFile)) {
        fs.unlinkSync(oldestFile);
      }

      // Rotate existing files
      for (let i = this.maxFiles - 1; i >= 1; i--) {
        const currentFile = `${basePath}.${i}${extension}`;
        const nextFile = `${basePath}.${i + 1}${extension}`;

        if (fs.existsSync(currentFile)) {
          fs.renameSync(currentFile, nextFile);
        }
      }

      // Move current log file to .1
      const newFile = `${basePath}.1${extension}`;
      fs.renameSync(this.filePath, newFile);

    } catch (error) {
      console.error('Failed to rotate log files:', error.message);
    }
  }

  /**
   * Log message at specified level
   */
  log(level, message, ...args) {
    if (this.levels[level] > this.levels[this.level]) {
      return;
    }

    const { consoleMessage, fileMessage, color, reset } = this.formatMessage(level, message, ...args);

    // Console output with colors
    if (level === 'error') {
      console.error(`${color}${consoleMessage}${reset}`, ...args);
    } else if (level === 'warn') {
      console.warn(`${color}${consoleMessage}${reset}`, ...args);
    } else {
      console.log(`${color}${consoleMessage}${reset}`, ...args);
    }

    // File output without colors
    this.writeToFile(fileMessage + (args.length > 0 ? ' ' + JSON.stringify(args) : ''));
  }

  /**
   * Convenience methods for different log levels
   */
  error(message, ...args) {
    this.log('error', message, ...args);
  }

  warn(message, ...args) {
    this.log('warn', message, ...args);
  }

  info(message, ...args) {
    this.log('info', message, ...args);
  }

  debug(message, ...args) {
    this.log('debug', message, ...args);
  }

  /**
   * Log HTTP request details
   */
  logRequest(req, res, next) {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const level = res.statusCode >= 400 ? 'error' : res.statusCode >= 300 ? 'warn' : 'info';

      this.log(level, `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        referer: req.get('Referer')
      });
    });

    next();
  }

  /**
   * Log error with stack trace
   */
  logError(error, context = {}) {
    this.error('Application Error:', {
      message: error.message,
      stack: error.stack,
      ...context
    });
  }

  /**
   * Create child logger with context
   */
  child(context = {}) {
    const childLogger = Object.create(this);
    childLogger.context = { ...this.context, ...context };

    // Override log method to include context
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (level, message, ...args) => {
      const contextMessage = Object.keys(childLogger.context).length > 0
        ? `[${JSON.stringify(childLogger.context)}] ${message}`
        : message;
      originalLog(level, contextMessage, ...args);
    };

    return childLogger;
  }
}

// Create default logger instance
const logger = new Logger({
  level: process.env.LOG_LEVEL || 'info',
  filePath: process.env.LOG_FILE || path.join(__dirname, '../logs/app.log')
});

// Export singleton instance and class for custom instances
module.exports = { logger, Logger };