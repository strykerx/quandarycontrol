const { validators } = require('../validation/schemas');
const { logger } = require('../../utils/logger');

const validationLogger = logger.child({ module: 'validation-middleware' });

/**
 * Create validation middleware for specific schema
 * @param {string} schemaName - Name of the schema to validate against
 * @param {string} source - Where to get data from ('body', 'params', 'query')
 * @returns {Function} Express middleware function
 */
function validateRequest(schemaName, source = 'body') {
  return (req, res, next) => {
    const validator = validators[schemaName];
    if (!validator) {
      validationLogger.error('Unknown validation schema', { schemaName, ip: req.ip });
      return res.status(500).json({
        success: false,
        error: 'Internal validation error'
      });
    }

    const data = req[source];
    const isValid = validator(data);

    if (!isValid) {
      const errors = validator.errors.map(error => ({
        field: error.instancePath || error.schemaPath,
        message: error.message,
        rejectedValue: error.data
      }));

      validationLogger.warn('Request validation failed', {
        schemaName,
        source,
        errors: errors.slice(0, 5), // Limit logged errors
        ip: req.ip,
        method: req.method,
        url: req.originalUrl
      });

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }

    validationLogger.debug('Request validation passed', {
      schemaName,
      source,
      ip: req.ip
    });

    next();
  };
}

/**
 * Validate room ID parameter
 */
function validateRoomId(req, res, next) {
  const { id } = req.params;

  if (!id || typeof id !== 'string' || id.length < 5 || id.length > 50) {
    validationLogger.warn('Invalid room ID parameter', { roomId: id, ip: req.ip });
    return res.status(400).json({
      success: false,
      error: 'Invalid room ID format'
    });
  }

  next();
}

/**
 * Validate shortcode parameter
 */
function validateShortcode(req, res, next) {
  const { shortcode } = req.params;

  if (!shortcode || typeof shortcode !== 'string' || !/^[A-Z0-9]{4}$/.test(shortcode)) {
    validationLogger.warn('Invalid shortcode parameter', { shortcode, ip: req.ip });
    return res.status(400).json({
      success: false,
      error: 'Invalid shortcode format. Must be 4 uppercase alphanumeric characters.'
    });
  }

  next();
}

/**
 * Validate variable name parameter
 */
function validateVariableName(req, res, next) {
  const { varName } = req.params;

  if (!varName || typeof varName !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varName)) {
    validationLogger.warn('Invalid variable name parameter', { varName, ip: req.ip });
    return res.status(400).json({
      success: false,
      error: 'Invalid variable name. Must start with letter/underscore and contain only alphanumeric characters and underscores.'
    });
  }

  next();
}

/**
 * Validate file upload based on allowed types
 * @param {Array} allowedTypes - Array of allowed MIME types
 * @param {number} maxSize - Maximum file size in bytes
 * @returns {Function} Express middleware function
 */
function validateFileUpload(allowedTypes = [], maxSize = 50 * 1024 * 1024) {
  return (req, res, next) => {
    if (!req.file) {
      validationLogger.warn('File upload validation - no file provided', { ip: req.ip });
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { mimetype, size, filename } = req.file;

    // Check file type
    if (allowedTypes.length > 0 && !allowedTypes.includes(mimetype)) {
      validationLogger.warn('File upload validation - invalid file type', {
        mimetype,
        allowedTypes,
        filename,
        ip: req.ip
      });
      return res.status(400).json({
        success: false,
        error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
      });
    }

    // Check file size
    if (size > maxSize) {
      validationLogger.warn('File upload validation - file too large', {
        size,
        maxSize,
        filename,
        ip: req.ip
      });
      return res.status(400).json({
        success: false,
        error: `File too large. Maximum size: ${Math.round(maxSize / 1024 / 1024)}MB`
      });
    }

    validationLogger.info('File upload validation passed', {
      mimetype,
      size,
      filename,
      ip: req.ip
    });

    next();
  };
}

/**
 * Sanitize HTML content to prevent XSS
 */
function sanitizeHtmlContent(req, res, next) {
  const dangerousFields = ['custom_html', 'content', 'description'];

  dangerousFields.forEach(field => {
    if (req.body[field] && typeof req.body[field] === 'string') {
      // Basic XSS prevention - remove script tags and javascript: protocols
      req.body[field] = req.body[field]
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, ''); // Remove onclick, onload, etc.
    }
  });

  next();
}

module.exports = {
  validateRequest,
  validateRoomId,
  validateShortcode,
  validateVariableName,
  validateFileUpload,
  sanitizeHtmlContent
};