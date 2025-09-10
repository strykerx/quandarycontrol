# Quandary Control System Documentation

## Overview

Quandary Control is a comprehensive room management system with advanced theme and layout customization capabilities. This documentation covers administration, configuration, and development aspects of the system.

## Table of Contents

1. [Theme & Layout Configuration Guide](#theme--layout-configuration-guide)
2. [Preset Management Tutorial](#preset-management-tutorial)
3. [Responsive Design Best Practices](#responsive-design-best-practices)
4. [API Endpoint Reference](#api-endpoint-reference)
5. [Troubleshooting](#troubleshooting)
6. [Search Index](#search-index)

---

## Theme & Layout Configuration Guide

### Theme System

The Quandary system uses CSS custom properties (variables) for theming, allowing dynamic color scheme changes without reloading the page.

#### Available Themes

- **Default Purple**: Original purple gradient theme (`#667eea` to `#764ba2`)
- **Ocean Blue**: Calming blue ocean theme (`#0077be` to `#00a8cc`)
- **Forest Green**: Natural green forest theme (`#2d6a4f` to `#40916c`)
- **Sunset Orange**: Warm sunset orange theme (`#f77f00` to `#fcbf49`)
- **Midnight Dark**: Dark midnight blue theme (`#7209b7` to `#3a0ca3`)

#### Theme Configuration File

Themes are defined in [`public/theme-config.json`](public/theme-config.json:1) with the following structure:

```json
{
  "themes": {
    "theme_id": {
      "name": "Theme Name",
      "description": "Theme description",
      "colors": {
        "primary-color": "#667eea",
        "primary-color-dark": "#5a67d8",
        "secondary-color": "#764ba2",
        "accent-color": "#ff6b6b",
        // ... more color variables
      },
      "gradients": {
        "player-primary": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        "player-secondary": "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
      }
    }
  },
  "settings": {
    "defaultTheme": "default",
    "enableThemeSwitching": true,
    "enableLivePreview": true,
    "persistThemeChoice": true,
    "fallbackSupport": true
  }
}
```

#### Applying Themes

Themes can be applied through the admin interface or programmatically:

```javascript
// Using the theme manager
window.themeManager.applyTheme('theme_id');
```

### Layout System

The layout system uses JSON configuration with grid and flexbox support for responsive component positioning.

#### Layout Configuration File

Layouts are defined in [`config/layout-config.json`](config/layout-config.json:1) with schema validation from [`config/layout-schema.json`](config/layout-schema.json:1).

#### Layout Types

1. **Grid Layout**: CSS Grid-based positioning
2. **Flex Layout**: Flexbox-based positioning
3. **Responsive Breakpoints**: Mobile, tablet, and desktop configurations

#### Example Layout Configuration

```json
{
  "type": "grid",
  "grid": {
    "columns": 12,
    "rows": 6,
    "gap": "1rem",
    "templateAreas": [
      "timer timer timer timer timer timer timer timer timer timer timer timer",
      "gameState gameState gameState gameState gameState gameState hints hints hints hints hints hints",
      "navigation navigation navigation navigation navigation navigation navigation navigation navigation navigation navigation navigation"
    ]
  },
  "components": {
    "timer": {
      "visible": true,
      "order": 1,
      "position": {
        "gridRow": "1",
        "gridColumn": "1 / -1"
      }
    }
    // ... more components
  }
}
```

#### Available Components

- `timer`: Countdown timer display
- `gameState`: Current game state information
- `hints`: Hint system interface
- `navigation`: Room navigation controls
- `chat`: Chat interface (optional)
- `media`: Media display (optional)

---

## Preset Management Tutorial

### Creating Layout Presets

Presets allow you to save and reuse layout configurations. Three built-in presets are available:

1. **Classic**: Traditional vertical stack layout
2. **Modern**: Contemporary grid-based layout
3. **Compact**: Space-efficient mobile layout

### Saving Custom Presets

1. Open the Layout Configuration Manager from the admin panel
2. Configure your desired layout using the visual interface
3. Click "Save Layout" to store the configuration
4. Presets are saved to localStorage and can be loaded later

### Preset JSON Structure

```json
{
  "name": "Preset Name",
  "description": "Preset description",
  "layout": {
    "type": "grid",
    "components": {
      "timer": {
        "visible": true,
        "order": 1,
        "position": {
          "gridRow": "1",
          "gridColumn": "1 / -1"
        }
      }
      // ... more components
    }
  }
}
```

### Loading Presets

Presets can be loaded through the admin interface or programmatically:

```javascript
// Load a preset from configuration
const preset = layoutConfig.presets.classic;
applyLayout(preset.layout);
```

---

## Responsive Design Best Practices

### Breakpoint Definitions

The system uses three main breakpoints defined in [`config/layout-config.json`](config/layout-config.json:238):

- **Mobile**: 0-768px
- **Tablet**: 769-1024px
- **Desktop**: 1025px and above

### Responsive Layout Strategies

1. **Mobile-First Design**: Start with mobile layouts and enhance for larger screens
2. **Flexible Grids**: Use relative units (rem, %) instead of fixed pixels
3. **Media Queries**: Implement breakpoint-specific styles
4. **Touch-Friendly**: Ensure interactive elements are at least 44px for touch devices

### Component Visibility Control

Components can be conditionally shown/hidden based on breakpoints:

```json
{
  "components": {
    "chat": {
      "visible": false,  // Hidden on mobile
      "order": 5
    },
    "media": {
      "visible": true,   // Visible on desktop
      "order": 6
    }
  }
}
```

### Performance Considerations

- **CSS Variables**: Use CSS custom properties for dynamic theming
- **Efficient Rendering**: Minimize layout shifts and repaints
- **Lazy Loading**: Load non-essential components on demand

---

## API Endpoint Reference

### Room Management Endpoints

#### GET /api/rooms
Retrieve all rooms

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "room_id",
      "name": "Room Name",
      "timer_duration": 300,
      "api_variables": {},
      "config": {},
      "hint_config": {"type": "broadcast"},
      "created_at": "2023-01-01T00:00:00.000Z"
    }
  ]
}
```

#### POST /api/rooms
Create a new room

**Request Body:**
```json
{
  "name": "Room Name",
  "timer_duration": 300,
  "api_variables": {},
  "config": {},
  "hint_config": {"type": "broadcast"}
}
```

#### PUT /api/rooms/:id
Update a room

**Request Body:** Same as POST

#### DELETE /api/rooms/:id
Delete a room

### Theme Endpoints

#### GET /api/theme
Get available themes

#### POST /api/theme/global
Apply theme to all rooms

**Request Body:**
```json
{
  "theme": "theme_id"
}
```

### Layout Endpoints

#### PUT /api/rooms/:id/layout
Apply layout to specific room

**Request Body:**
```json
{
  "layout": {
    "type": "grid",
    "components": {
      // layout configuration
    }
  }
}
```

#### GET /api/layout/presets
Get available layout presets

---

## Troubleshooting

### Common Issues

#### Theme Not Applying
- Check if the theme exists in `theme-config.json`
- Verify CSS custom properties are properly defined
- Ensure the theme manager is initialized

#### Layout Validation Errors
- Validate JSON against the schema in `layout-schema.json`
- Check for required fields: `version`, `layouts`, `breakpoints`
- Ensure component configurations are valid

#### Responsive Issues
- Test on actual devices, not just emulators
- Check breakpoint definitions in `layout-config.json`
- Verify media queries are correctly implemented

#### API Errors
- Check server connectivity
- Validate JSON payloads
- Verify authentication if implemented

### Debugging Tools

1. **Browser DevTools**: Inspect CSS variables and layout
2. **JSON Validator**: Validate configuration files
3. **Network Tab**: Monitor API requests and responses
4. **Console Logs**: Check for JavaScript errors

### Performance Optimization

- Minimize configuration file size
- Use efficient CSS selectors
- Implement lazy loading for non-essential components
- Cache frequently used data

---

## Search Index

### Keywords for Documentation Search

- **Theme**: color, gradient, CSS variables, customization
- **Layout**: grid, flexbox, responsive, breakpoints, components
- **API**: endpoints, REST, JSON, rooms, themes
- **Admin**: interface, controls, management, configuration
- **Troubleshooting**: errors, debugging, issues, solutions
- **Performance**: optimization, loading, efficiency

### Documentation Files

- [`SYSTEM_DOCUMENTATION.md`](SYSTEM_DOCUMENTATION.md) - This file
- [`config/layout-config.json`](config/layout-config.json) - Layout configurations
- [`config/layout-schema.json`](config/layout-schema.json) - Layout JSON schema
- [`public/theme-config.json`](public/theme-config.json) - Theme configurations
- [`public/admin.html`](public/admin.html) - Admin interface
- [`public/admin.js`](public/admin.js) - Admin JavaScript logic

### Quick Access

- [Theme Configuration](#theme-configuration)
- [Layout Management](#layout-management)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

---

## Conclusion

This documentation provides comprehensive guidance for administering, configuring, and developing with the Quandary Control system. For additional support, refer to the individual configuration files and their inline documentation.

*Last Updated: September 9, 2025*