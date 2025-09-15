# Boilerplate Theme

This is a basic, unstyled theme that includes all available components with minimal styling. It serves as a starting point for creating custom themes.

## Features

- All available shortcode components included
- Minimal CSS styling with CSS variables for easy customization
- Clean HTML structure with semantic classes
- Responsive grid layout
- Well-commented CSS with placeholder styles

## Components Included

- `[timer]` - Game timer with controls
- `[chat]` - Two-way chat interface
- `[hints]` - Hint display system
- `[variables]` - Room variables display
- `[media]` - Media lightbox component
- `[room-info]` - Room information display
- `[game-state]` - Game state and score display

## Customization

### CSS Variables

The theme uses CSS custom properties for easy customization. Modify these in `style.css`:

```css
:root {
  --primary-color: #007bff;
  --secondary-color: #6c757d;
  --background-color: #f8f9fa;
  --text-color: #212529;
  --border-color: #dee2e6;
  --border-radius: 0.25rem;
  --font-family: 'Arial', sans-serif;
  --spacing-small: 0.5rem;
  --spacing-medium: 1rem;
  --spacing-large: 1.5rem;
  --spacing-xl: 2rem;
}
```

### Component Styling

Each component has dedicated CSS sections with placeholder classes:

- `.timer-section` and related classes for timer styling
- `.chat-section` and related classes for chat styling
- `.hints-section` and related classes for hints styling
- `.variables-section` and related classes for variables styling
- `.media-section` and related classes for media styling
- `.game-state-section` and related classes for game state styling

### Layout Structure

The theme uses CSS Grid for responsive layout:

```css
.boilerplate-main {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--spacing-large);
}
```

## Usage

1. Copy this theme directory to create your own theme
2. Rename the directory and update `theme-config.json`
3. Customize the CSS variables and component styles
4. Add your own fonts, colors, and layout adjustments
5. Test with different screen sizes and components

## Available CSS Classes

### Layout Classes
- `.boilerplate-container` - Main container
- `.boilerplate-header` - Header section
- `.boilerplate-main` - Main content area
- `.boilerplate-footer` - Footer section
- `.component-wrapper` - Individual component wrapper
- `.component-title` - Component section titles

### Component Classes
See the CSS file for complete list of component-specific classes for each shortcode.

## Creating Your Theme

1. Duplicate this directory: `cp -r themes/boilerplate themes/my-theme`
2. Update `theme-config.json` with your theme details
3. Modify `style.css` to add your custom styling
4. Update `index.html` if you need different layout structure
5. Test your theme by setting it on a room via the admin interface