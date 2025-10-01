const multer = require('multer');
const path = require('path');
const { nanoid } = require('nanoid');
const { logger } = require('../../../../../utils/logger');

const uploadLogger = logger.child({ module: 'api-upload' });

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../../../../public/uploads');
    uploadLogger.debug('Upload destination set', { uploadPath });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and nanoid
    const timestamp = Date.now();
    const uniqueId = nanoid(8);
    const extension = path.extname(file.originalname);
    const filename = `${timestamp}_${uniqueId}${extension}`;

    uploadLogger.info('File upload started', {
      originalName: file.originalname,
      filename,
      mimetype: file.mimetype,
      size: file.size
    });

    cb(null, filename);
  }
});

// File filter for security
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/ogg',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'application/pdf'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    uploadLogger.debug('File type allowed', { mimetype: file.mimetype });
    cb(null, true);
  } else {
    uploadLogger.warn('File type rejected', { mimetype: file.mimetype });
    cb(new Error(`File type ${file.mimetype} not allowed`), false);
  }
};

// Create multer upload instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1 // Single file upload
  }
});

// Error handling middleware for multer
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    uploadLogger.error('Multer upload error', {
      code: error.code,
      message: error.message,
      field: error.field
    });

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          error: 'File too large. Maximum size is 50MB.'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          error: 'Too many files. Only one file allowed per upload.'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          error: 'Unexpected file field.'
        });
      default:
        return res.status(400).json({
          success: false,
          error: `Upload error: ${error.message}`
        });
    }
  } else if (error) {
    uploadLogger.error('File upload error', { error: error.message });
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }

  next();
};

module.exports = {
  upload,
  handleUploadError
};