# Theme Developer Guide

## Overview

This guide provides comprehensive documentation for developing themes using the plug-and-play theme architecture. The architecture separates component logic from visual styling, enabling developers to create flexible, maintainable, and extensible themes.

## Architecture Overview

The theme architecture consists of several key components:

1. **Theme Architecture Core** (`theme-architecture.js`) - Main system that manages themes and components
2. **Theme Registry** (`theme-registry.js`) - Handles theme registration, loading, and lifecycle
3. **Theme Inheritance** (`theme-inheritance.js`) - Manages theme inheritance and overrides
4. **Component Interfaces** (`theme-component-interface.js`) - Defines standardized component interfaces

## Core Concepts

### Separation of Concerns

The architecture enforces strict separation between:
- **Component Logic**: Business logic, data handling, and event management
- **Visual Styling**: CSS, layout, and presentation
- **Configuration**: Theme settings and component parameters

### Component Interfaces

All components implement standardized interfaces that define:
- Lifecycle methods (`init`, `destroy`)
- Data management (`update`, `render`)
- Event handling (`setupEventListeners`)
- Style application (`applyStyles`)

### Theme Inheritance

Themes can inherit from parent themes, allowing:
- Property overriding
- Asset extension
- Component configuration inheritance
- Variable cascading

## Getting Started

### Basic Theme Structure

```
my-theme/
├── theme-config.json      # Theme metadata and configuration
├── style.css             # Theme-specific styles
├── script.js             # Theme-specific JavaScript (optional)
├── templates/            # HTML templates (optional)
│   ├── components/
│   └── layouts/
└── assets/              # Static assets (images, fonts, etc.)
```

### Theme Configuration

Create a `theme-config.json` file:

```json
{
  "id": "my-theme",
  "name": "My Custom Theme",
  "version": "1.0.0",
  "description": "A custom theme for escape rooms",
  "author": "Your Name",
  "parent_theme": "example-theme",
  "variables": {
    "primary-color": "#667eea",
    "secondary-color": "#764ba2",
    "background-color": "#f9f9f9",
    "text-color": "#333333",
    "border-radius": "8px",
    "spacing-unit": "1rem"
  },
  "assets": {
    "css": "/themes/my-theme/style.css",
    "js": "/themes/my-theme/script.js",
    "config": "/themes/my-theme/theme-config.json"
  },
  "components": {
    "timer": {
      "enabled": true,
      "config": {
        "format": "mm:ss",
        "showControls": true
      }
    },
    "chat": {
      "enabled": true,
      "config": {
        "maxMessages": 50,
        "showTimestamps": true
      }
    }
  },
  "features": {
    "responsive": true,
    "accessibility": true,
    "animations": true
  }
}
```

### CSS Variables

Use CSS custom properties for theming:

```css
:root {
  /* Theme variables */
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --background-color: #f9f9f9;
  --text-color: #333333;
  
  /* Layout variables */
  --border-radius: 8px;
  --spacing-unit: 1rem;
  --max-width: 1200px;
  
  /* Typography variables */
  --font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  --font-size-base: 1rem;
  --font-size-large: 1.25rem;
  --font-size-small: 0.875rem;
}

/* Component-specific variables */
.timer-component {
  --timer-background: var(--background-color);
  --timer-text-color: var(--text-color);
  --timer-border-color: var(--primary-color);
}
```

## Component Development

### Creating Custom Components

1. **Implement the Base Interface**:

```javascript
class MyCustomComponent extends BaseComponentInterface {
  constructor(config) {
    super(config);
    this.data = null;
    this.container = null;
  }

  render(data = {}) {
    this.data = data;
    
    // Create component container
    this.container = document.createElement('div');
    this.container.className = 'my-custom-component';
    
    // Add component content
    this.container.innerHTML = `
      <div class="component-header">
        <h3>${this.config.title || 'Custom Component'}</h3>
      </div>
      <div class="component-body">
        ${this.renderContent(data)}
      </div>
    `;
    
    return this.container;
  }

  renderContent(data) {
    // Override to provide custom content rendering
    return `<p>Custom content: ${JSON.stringify(data)}</p>`;
  }

  update(data) {
    this.data = { ...this.data, ...data };
    if (this.container) {
      const body = this.container.querySelector('.component-body');
      if (body) {
        body.innerHTML = this.renderContent(this.data);
      }
    }
    this.onDataUpdated(this.data);
  }

  onDataUpdated(data) {
    if (this.eventBus) {
      this.eventBus.emit('my-component:data-updated', data);
    }
  }

  setupEventListeners() {
    // Set up component-specific event listeners
    if (this.container) {
      this.container.addEventListener('click', (e) => {
        this.handleClick(e);
      });
    }
  }

  handleClick(e) {
    // Handle click events
    this.eventBus.emit('my-component:clicked', { target: e.target });
  }
}

// Register the component
window.componentFactory.registerComponent('my-custom', MyCustomComponent);
```

2. **Add Component Styles**:

```css
.my-custom-component {
  background: var(--background-color);
  border: 1px solid var(--primary-color);
  border-radius: var(--border-radius);
  padding: var(--spacing-unit);
  margin-bottom: var(--spacing-unit);
}

.my-custom-component .component-header {
  background: var(--primary-color);
  color: white;
  padding: calc(var(--spacing-unit) * 0.5);
  margin: calc(var(--spacing-unit) * -1);
  margin-bottom: var(--spacing-unit);
  border-radius: var(--border-radius) var(--border-radius) 0 0;
}

.my-custom-component .component-header h3 {
  margin: 0;
  font-size: var(--font-size-large);
}

.my-custom-component .component-body {
  color: var(--text-color);
  font-family: var(--font-family);
  font-size: var(--font-size-base);
}
```

### Using Components in Themes

Components can be used in theme templates using shortcodes:

```html
<div class="theme-container">
  <header class="theme-header">
    [room-info showProgress="true"]
    [timer format="mm:ss" showControls="false"]
  </header>
  
  <main class="theme-main">
    <div class="left-panel">
      [hints maxHints="10" showNavigation="true"]
      [variables updateInterval="2000"]
    </div>
    
    <div class="right-panel">
      [chat maxMessages="20" showTimestamps="true"]
      [game-state showScore="false"]
    </div>
  </main>
  
  [media supportedFormats="jpg,png,gif,mp4,mp3"]
</div>
```

## Theme Inheritance

### Creating Child Themes

Child themes inherit from parent themes and can override specific properties:

```json
{
  "id": "my-child-theme",
  "name": "My Child Theme",
  "version": "1.0.0",
  "parent_theme": "example-theme",
  "variables": {
    "primary-color": "#ff6b6b",  // Override parent color
    "secondary-color": "#4ecdc4"  // Override parent color
  },
  "components": {
    "timer": {
      "config": {
        "format": "hh:mm:ss"  // Override timer format
      }
    }
  }
}
```

### Programmatic Theme Creation

```javascript
// Create a child theme programmatically
const childTheme = window.themeInheritanceManager.createChildTheme(
  'example-theme',
  {
    id: 'my-child-theme',
    name: 'My Child Theme',
    version: '1.0.0',
    description: 'A child theme of example-theme',
    variables: {
      'primary-color': '#ff6b6b',
      'secondary-color': '#4ecdc4'
    }
  }
);
```

### Theme Overrides

Add runtime overrides to themes:

```javascript
// Add variable override
window.themeInheritanceManager.addOverride('my-theme', {
  type: 'variable',
  key: 'primary-color',
  value: '#ff0000'
});

// Add component override
window.themeInheritanceManager.addOverride('my-theme', {
  type: 'component',
  componentId: 'timer',
  property: 'enabled',
  value: false
});

// Apply override presets
window.themeOverrideSystem.applyPreset('my-theme', 'dark-mode');
```

## Asset Management

### Loading Theme Assets

The system automatically loads theme assets:

```javascript
// Assets are loaded automatically when theme is activated
await window.themeRegistry.activateTheme('my-theme');
```

### Custom Asset Loading

```javascript
// Load custom assets
const assets = await window.themeRegistry.loadThemeAssets({
  css: '/themes/my-theme/custom.css',
  js: '/themes/my-theme/custom.js',
  config: '/themes/my-theme/custom-config.json'
});
```

### Asset Caching

The system includes built-in asset caching:

```javascript
// Clear theme cache
window.themeRegistry.clearCache();

// Clear specific theme cache
window.themeInheritanceManager.clearThemeCache('my-theme');
```

## Event System

### Component Events

Components emit events for various actions:

```javascript
// Listen to component events
window.themeArchitecture.eventBus.on('timer:started', (data) => {
  console.log('Timer started:', data);
});

window.themeArchitecture.eventBus.on('chat:message-added', (message) => {
  console.log('New chat message:', message);
});
```

### Theme Events

Themes emit lifecycle events:

```javascript
// Listen to theme events
window.themeRegistry.eventBus.on('theme:activated', (theme) => {
  console.log('Theme activated:', theme.name);
});

window.themeRegistry.eventBus.on('theme:deactivated', (theme) => {
  console.log('Theme deactivated:', theme.name);
});
```

### Custom Events

Components can emit custom events:

```javascript
// Emit custom event
this.eventBus.emit('my-component:custom-event', {
  data: 'custom data'
});

// Listen to custom event
this.eventBus.on('my-component:custom-event', (data) => {
  console.log('Custom event received:', data);
});
```

## Testing Themes

### Theme Validation

The system includes built-in theme validation:

```javascript
// Validate theme configuration
const validation = window.themeRegistry.config.validateTheme(themeConfig);
if (!validation.valid) {
  console.error('Theme validation failed:', validation.errors);
}
```

### Component Testing

Test components independently:

```javascript
// Create component instance
const timerComponent = window.componentFactory.createComponent(
  'timer',
  { format: 'mm:ss', showControls: true },
  { eventBus: window.themeArchitecture.eventBus }
);

// Test component rendering
const element = timerComponent.render();
document.body.appendChild(element);

// Test component functionality
timerComponent.start();
timerComponent.stop();
timerComponent.reset();
```

### Theme Integration Testing

Test theme integration:

```javascript
// Test theme activation
await window.themeRegistry.activateTheme('my-theme');

// Test component functionality within theme
const timer = window.themeArchitecture.getComponent('timer');
timer.start();

// Test theme switching
await window.themeRegistry.activateTheme('another-theme');
```

## Best Practices

### Performance Optimization

1. **Lazy Loading**: Load assets only when needed
2. **Caching**: Utilize built-in caching mechanisms
3. **Event Delegation**: Use event delegation for better performance
4. **Minimal DOM Updates**: Batch DOM updates when possible

### Accessibility

1. **Semantic HTML**: Use proper HTML5 semantic elements
2. **ARIA Attributes**: Include appropriate ARIA attributes
3. **Keyboard Navigation**: Ensure keyboard accessibility
4. **Color Contrast**: Maintain sufficient color contrast ratios

### Responsive Design

1. **Mobile-First**: Design for mobile devices first
2. **Flexible Layouts**: Use flexible grid systems
3. **Media Queries**: Implement responsive breakpoints
4. **Touch-Friendly**: Ensure touch-friendly interactions

### Code Organization

1. **Modular Structure**: Keep code modular and organized
2. **Consistent Naming**: Use consistent naming conventions
3. **Documentation**: Document custom components and themes
4. **Version Control**: Use version control for theme development

## Troubleshooting

### Common Issues

**Theme Not Loading**
- Check theme configuration syntax
- Verify asset paths are correct
- Ensure theme ID is unique

**Component Not Working**
- Verify component is registered
- Check component configuration
- Ensure required dependencies are loaded

**Styling Issues**
- Check CSS variable usage
- Verify CSS specificity
- Ensure theme assets are loaded correctly

### Debug Mode

Enable debug mode for detailed logging:

```javascript
// Enable debug mode
window.themeArchitecture.debug = true;
window.themeRegistry.debug = true;
window.themeInheritanceManager.debug = true;
```

### Browser Developer Tools

Use browser developer tools to:
- Inspect component structure
- Debug JavaScript errors
- Analyze network requests for asset loading
- Monitor event system activity

## API Reference

### Theme Architecture

#### Methods

- `init()` - Initialize the theme architecture
- `registerComponent(componentData)` - Register a component
- `getComponent(componentId)` - Get a component instance
- `createComponent(componentId, config)` - Create a new component
- `applyTheme(themeId)` - Apply a theme

### Theme Registry

#### Methods

- `registerTheme(theme)` - Register a theme
- `getTheme(themeId)` - Get theme by ID
- `getAllThemes()` - Get all registered themes
- `activateTheme(themeId)` - Activate a theme
- `deactivateTheme(themeId)` - Deactivate a theme

### Theme Inheritance

#### Methods

- `resolveTheme(themeId)` - Resolve theme with inheritance
- `createChildTheme(parentId, childData)` - Create child theme
- `addOverride(themeId, override)` - Add theme override
- `getInheritanceChain(themeId)` - Get inheritance chain

### Component Factory

#### Methods

- `createComponent(type, config, context)` - Create component
- `registerComponent(type, componentClass)` - Register component type
- `getComponentTypes()` - Get registered component types

## Examples

### Complete Theme Example

See `themes/example-theme/` for a complete theme implementation.

### Custom Component Example

```javascript
class ScoreBoardComponent extends BaseComponentInterface {
  constructor(config) {
    super(config);
    this.scores = [];
    this.maxScores = config.maxScores || 10;
  }

  render(data = {}) {
    this.container = document.createElement('div');
    this.container.className = 'scoreboard-component';
    
    this.container.innerHTML = `
      <div class="scoreboard-header">
        <h3>Scoreboard</h3>
      </div>
      <div class="scoreboard-list">
        ${this.renderScores()}
      </div>
    `;
    
    return this.container;
  }

  renderScores() {
    if (this.scores.length === 0) {
      return '<p class="no-scores">No scores yet</p>';
    }
    
    return this.scores.map((score, index) => `
      <div class="score-item">
        <span class="score-rank">#${index + 1}</span>
        <span class="score-name">${score.name}</span>
        <span class="score-value">${score.value}</span>
      </div>
    `).join('');
  }

  addScore(name, value) {
    this.scores.push({ name, value });
    this.scores.sort((a, b) => b.value - a.value);
    
    if (this.scores.length > this.maxScores) {
      this.scores = this.scores.slice(0, this.maxScores);
    }
    
    this.updateScores();
  }

  updateScores() {
    if (this.container) {
      const list = this.container.querySelector('.scoreboard-list');
      if (list) {
        list.innerHTML = this.renderScores();
      }
    }
  }
}

// Register the component
window.componentFactory.registerComponent('scoreboard', ScoreBoardComponent);
```

### Theme with Custom Component

```json
{
  "id": "game-theme",
  "name": "Game Theme",
  "version": "1.0.0",
  "components": {
    "scoreboard": {
      "enabled": true,
      "config": {
        "maxScores": 5
      }
    }
  }
}
```

```html
<div class="game-container">
  [timer format="mm:ss"]
  [scoreboard maxScores="5"]
  [chat maxMessages="20"]
</div>
```

## Conclusion

The plug-and-play theme architecture provides a robust foundation for creating flexible, maintainable themes. By separating component logic from visual styling and providing standardized interfaces, developers can create themes that are both powerful and easy to maintain.

For additional support and examples, refer to the existing themes in the `themes/` directory and the component implementations in the core system files.