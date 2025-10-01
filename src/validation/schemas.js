const Ajv = require('ajv');
const addFormats = require('ajv-formats');

// Initialize AJV with formats
const ajv = new Ajv({ allErrors: true, removeAdditional: true });
addFormats(ajv);

// Room schemas
const roomSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 100
    },
    timer_duration: {
      type: 'integer',
      minimum: 60,
      maximum: 86400 // 24 hours max
    },
    secondary_timer_enabled: {
      type: 'boolean'
    },
    secondary_timer_duration: {
      type: 'integer',
      minimum: 30,
      maximum: 3600 // 1 hour max
    },
    config: {
      type: 'object',
      additionalProperties: true
    },
    custom_html: {
      type: 'string',
      maxLength: 50000
    },
    custom_css: {
      type: 'string',
      maxLength: 20000
    }
  },
  required: ['name'],
  additionalProperties: false
};

// Variable schemas
const variableSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$',
      minLength: 1,
      maxLength: 50
    },
    value: {
      oneOf: [
        { type: 'string', maxLength: 1000 },
        { type: 'number' },
        { type: 'boolean' },
        { type: 'null' }
      ]
    },
    type: {
      type: 'string',
      enum: ['string', 'number', 'boolean', 'null']
    }
  },
  required: ['name', 'value'],
  additionalProperties: false
};

// Timer schemas
const timerUpdateSchema = {
  type: 'object',
  properties: {
    duration: {
      type: 'integer',
      minimum: 60,
      maximum: 86400
    },
    secondary_enabled: {
      type: 'boolean'
    },
    secondary_duration: {
      type: 'integer',
      minimum: 30,
      maximum: 3600
    }
  },
  additionalProperties: false
};

// Hint schemas
const hintConfigSchema = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['broadcast', 'chat', 'disabled']
    },
    enabled: {
      type: 'boolean'
    },
    auto_hints: {
      type: 'boolean'
    },
    hint_interval: {
      type: 'integer',
      minimum: 60,
      maximum: 3600
    }
  },
  additionalProperties: false
};

// Layout schemas
const layoutSchema = {
  type: 'object',
  properties: {
    layouts: {
      type: 'object',
      patternProperties: {
        '^[a-zA-Z0-9_-]+$': {
          type: 'object',
          properties: {
            grid: {
              type: 'object',
              properties: {
                template: { type: 'string', minLength: 1 },
                gap: { type: 'string' },
                rows: { type: 'string' }
              },
              additionalProperties: true
            },
            components: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  position: { type: 'object' },
                  config: { type: 'object' }
                },
                additionalProperties: true
              }
            }
          },
          additionalProperties: true
        }
      },
      additionalProperties: false
    }
  },
  required: ['layouts'],
  additionalProperties: false
};

// Rule schemas
const ruleSchema = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      minLength: 1,
      maxLength: 100
    },
    content: {
      type: 'string',
      maxLength: 5000
    },
    order: {
      type: 'integer',
      minimum: 0
    },
    media_id: {
      type: 'string',
      maxLength: 100
    }
  },
  required: ['title', 'content'],
  additionalProperties: false
};

// Theme schemas
const themeSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 50
    },
    description: {
      type: 'string',
      maxLength: 200
    },
    author: {
      type: 'string',
      maxLength: 50
    },
    files: {
      type: 'object',
      patternProperties: {
        '^[a-zA-Z0-9._-]+$': {
          type: 'string',
          maxLength: 100000
        }
      },
      additionalProperties: false
    }
  },
  required: ['name'],
  additionalProperties: false
};

// Notification schemas
const notificationSettingsSchema = {
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean'
    },
    volume: {
      type: 'integer',
      minimum: 0,
      maximum: 100
    },
    hintSound: {
      oneOf: [
        { type: 'string', maxLength: 200 },
        { type: 'null' }
      ]
    },
    successSound: {
      oneOf: [
        { type: 'string', maxLength: 200 },
        { type: 'null' }
      ]
    },
    errorSound: {
      oneOf: [
        { type: 'string', maxLength: 200 },
        { type: 'null' }
      ]
    },
    timerSound: {
      oneOf: [
        { type: 'string', maxLength: 200 },
        { type: 'null' }
      ]
    }
  },
  additionalProperties: false
};

// GM Customization schemas
const gmCustomizationSchema = {
  type: 'object',
  properties: {
    layout: {
      type: 'object',
      properties: {
        showTimer: { type: 'boolean' },
        showVariables: { type: 'boolean' },
        showHints: { type: 'boolean' },
        showMedia: { type: 'boolean' },
        showRules: { type: 'boolean' },
        compactMode: { type: 'boolean' }
      },
      additionalProperties: false
    },
    controls: {
      type: 'object',
      properties: {
        allowTimerControl: { type: 'boolean' },
        allowVariableEdit: { type: 'boolean' },
        allowHintSend: { type: 'boolean' },
        allowMediaControl: { type: 'boolean' },
        quickActions: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 10
        }
      },
      additionalProperties: false
    },
    appearance: {
      type: 'object',
      properties: {
        theme: { type: 'string', maxLength: 50 },
        fontSize: {
          type: 'string',
          enum: ['small', 'medium', 'large']
        },
        highContrast: { type: 'boolean' },
        darkMode: { type: 'boolean' }
      },
      additionalProperties: false
    },
    notifications: {
      type: 'object',
      properties: {
        playAudioAlerts: { type: 'boolean' },
        showToastMessages: { type: 'boolean' },
        enableVibration: { type: 'boolean' }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
};

// Lightbox sequence schema
const lightboxSequenceSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 100
    },
    description: {
      type: 'string',
      maxLength: 500
    },
    auto_advance: {
      type: 'boolean'
    },
    advance_delay: {
      type: 'integer',
      minimum: 1000,
      maximum: 60000
    },
    loop: {
      type: 'boolean'
    },
    media_items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          media_id: { type: 'string', minLength: 1 },
          duration: { type: 'integer', minimum: 1000 },
          order: { type: 'integer', minimum: 0 }
        },
        required: ['media_id'],
        additionalProperties: false
      },
      minItems: 1,
      maxItems: 50
    }
  },
  required: ['name', 'media_items'],
  additionalProperties: false
};

// Compile schemas
const validators = {
  room: ajv.compile(roomSchema),
  variable: ajv.compile(variableSchema),
  timerUpdate: ajv.compile(timerUpdateSchema),
  hintConfig: ajv.compile(hintConfigSchema),
  layout: ajv.compile(layoutSchema),
  rule: ajv.compile(ruleSchema),
  theme: ajv.compile(themeSchema),
  notificationSettings: ajv.compile(notificationSettingsSchema),
  gmCustomization: ajv.compile(gmCustomizationSchema),
  lightboxSequence: ajv.compile(lightboxSequenceSchema)
};

module.exports = {
  validators,
  ajv
};