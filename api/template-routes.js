const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const schema = require('../config/template-schema.json');

// Initialize AJV for JSON schema validation
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/templates');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `template-${uniqueSuffix}.json`);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/json') {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'), false);
    }
  },
  limits: {
    fileSize: 1024 * 1024 // 1MB limit
  }
});

// Database storage path
const TEMPLATES_DB_PATH = path.join(__dirname, '../data/templates.json');

// Helper functions
async function loadTemplates() {
  try {
    const data = await fs.readFile(TEMPLATES_DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Initialize with empty array if file doesn't exist
      await saveTemplates([]);
      return [];
    }
    throw error;
  }
}

async function saveTemplates(templates) {
  const dataDir = path.dirname(TEMPLATES_DB_PATH);
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(TEMPLATES_DB_PATH, JSON.stringify(templates, null, 2));
}

async function generateTemplateId() {
  const templates = await loadTemplates();
  let id;
  do {
    id = `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  } while (templates.some(t => t.id === id));
  return id;
}

// API Routes

// GET /api/templates - Get all templates
router.get('/', async (req, res) => {
  try {
    const templates = await loadTemplates();
    
    // Filter out sensitive information if needed
    const safeTemplates = templates.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      version: template.version,
      author: template.author,
      tags: template.tags,
      thumbnail: template.thumbnail,
      metadata: template.metadata,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt
    }));
    
    res.json({
      success: true,
      data: safeTemplates,
      count: safeTemplates.length
    });
  } catch (error) {
    console.error('Error loading templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load templates'
    });
  }
});

// GET /api/templates/:id - Get specific template
router.get('/:id', async (req, res) => {
  try {
    const templates = await loadTemplates();
    const template = templates.find(t => t.id === req.params.id);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }
    
    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error loading template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load template'
    });
  }
});

// POST /api/templates - Create new template
router.post('/', async (req, res) => {
  try {
    const templateData = req.body;
    
    // Validate against schema
    const valid = validate(templateData);
    if (!valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid template data',
        details: validate.errors
      });
    }
    
    // Generate ID if not provided
    if (!templateData.id) {
      templateData.id = await generateTemplateId();
    }
    
    // Check if template with same ID already exists
    const templates = await loadTemplates();
    if (templates.some(t => t.id === templateData.id)) {
      return res.status(409).json({
        success: false,
        error: 'Template with this ID already exists'
      });
    }
    
    // Add timestamps
    const now = new Date().toISOString();
    templateData.createdAt = now;
    templateData.updatedAt = now;
    
    // Save template
    templates.push(templateData);
    await saveTemplates(templates);
    
    res.status(201).json({
      success: true,
      data: templateData,
      message: 'Template created successfully'
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create template'
    });
  }
});

// PUT /api/templates/:id - Update template
router.put('/:id', async (req, res) => {
  try {
    const templateData = req.body;
    
    // Validate against schema
    const valid = validate(templateData);
    if (!valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid template data',
        details: validate.errors
      });
    }
    
    // Ensure ID matches
    if (templateData.id !== req.params.id) {
      return res.status(400).json({
        success: false,
        error: 'Template ID mismatch'
      });
    }
    
    const templates = await loadTemplates();
    const templateIndex = templates.findIndex(t => t.id === req.params.id);
    
    if (templateIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }
    
    // Update timestamp
    templateData.updatedAt = new Date().toISOString();
    
    // Update template
    templates[templateIndex] = templateData;
    await saveTemplates(templates);
    
    res.json({
      success: true,
      data: templateData,
      message: 'Template updated successfully'
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update template'
    });
  }
});

// DELETE /api/templates/:id - Delete template
router.delete('/:id', async (req, res) => {
  try {
    const templates = await loadTemplates();
    const templateIndex = templates.findIndex(t => t.id === req.params.id);
    
    if (templateIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }
    
    const deletedTemplate = templates.splice(templateIndex, 1)[0];
    await saveTemplates(templates);
    
    res.json({
      success: true,
      data: deletedTemplate,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete template'
    });
  }
});

// POST /api/templates/upload - Upload template file
router.post('/upload', upload.single('template'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }
    
    // Read uploaded file
    const fileContent = await fs.readFile(req.file.path, 'utf8');
    const templateData = JSON.parse(fileContent);
    
    // Validate against schema
    const valid = validate(templateData);
    if (!valid) {
      // Clean up uploaded file
      await fs.unlink(req.file.path);
      
      return res.status(400).json({
        success: false,
        error: 'Invalid template data',
        details: validate.errors
      });
    }
    
    // Generate new ID to avoid conflicts
    templateData.id = await generateTemplateId();
    
    // Add timestamps
    const now = new Date().toISOString();
    templateData.createdAt = now;
    templateData.updatedAt = now;
    
    // Save template
    const templates = await loadTemplates();
    templates.push(templateData);
    await saveTemplates(templates);
    
    // Clean up uploaded file
    await fs.unlink(req.file.path);
    
    res.status(201).json({
      success: true,
      data: templateData,
      message: 'Template uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading template:', error);
    
    // Clean up uploaded file if it exists
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up uploaded file:', cleanupError);
      }
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to upload template'
    });
  }
});

// GET /api/templates/:id/download - Download template file
router.get('/:id/download', async (req, res) => {
  try {
    const templates = await loadTemplates();
    const template = templates.find(t => t.id === req.params.id);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }
    
    // Set response headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${template.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${template.version}.json"`);
    
    res.json(template);
  } catch (error) {
    console.error('Error downloading template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download template'
    });
  }
});

// POST /api/templates/validate - Validate template without saving
router.post('/validate', (req, res) => {
  try {
    const templateData = req.body;
    
    // Validate against schema
    const valid = validate(templateData);
    
    res.json({
      success: true,
      data: {
        valid,
        errors: valid ? [] : validate.errors,
        warnings: [] // Could add additional validation warnings here
      }
    });
  } catch (error) {
    console.error('Error validating template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate template'
    });
  }
});

// GET /api/templates/categories - Get template categories
router.get('/meta/categories', (req, res) => {
  const categories = [
    { value: 'game', label: 'Game' },
    { value: 'presentation', label: 'Presentation' },
    { value: 'education', label: 'Education' },
    { value: 'business', label: 'Business' },
    { value: 'custom', label: 'Custom' }
  ];
  
  res.json({
    success: true,
    data: categories
  });
});

// GET /api/templates/complexity-levels - Get complexity levels
router.get('/meta/complexity-levels', (req, res) => {
  const complexityLevels = [
    { value: 'simple', label: 'Simple' },
    { value: 'medium', label: 'Medium' },
    { value: 'complex', label: 'Complex' }
  ];
  
  res.json({
    success: true,
    data: complexityLevels
  });
});

// Error handling middleware
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size too large. Maximum size is 1MB.'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Unexpected file field.'
      });
    }
  }
  
  if (error.message === 'Only JSON files are allowed') {
    return res.status(400).json({
      success: false,
      error: 'Only JSON files are allowed.'
    });
  }
  
  console.error('Template routes error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

module.exports = router;