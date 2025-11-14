# Quandary Control Themes

This directory contains the core theme for Quandary Control player interfaces. Each theme defines the HTML layout and styling for how players interact with escape rooms.

## Community Themes

Looking for more themes? Check out the **[Quandary Control Community Themes](https://github.com/strykerx/quandarycontrol-themes)** repository for additional theme options including:
- Windows 95 retro interface
- Modern card-based design
- 1930s newsreel aesthetic
- And more!

**Installation:**
```bash
cd themes
git clone https://github.com/strykerx/quandarycontrol-themes.git community
```

Themes will be available under `themes/community/` folder.

## Theme Structure

Each theme is a directory containing:
- `index.html` - Main theme template with shortcodes
- `style.css` - Theme-specific CSS styles  
- `theme-config.json` - Theme metadata, component configuration, and CSS variables
- `script.js` - Optional theme-specific JavaScript for enhanced functionality
- `README.md` - Documentation for theme-specific CSS selectors and features

## Available Shortcodes

Use these shortcodes in your `index.html` to include functional components:

### `[timer]` - Game Timer Display
Shows the current game timer with controls (if enabled).

**Attributes:**
- `format="mm:ss"` - Time display format (default: mm:ss)
- `showControls="true"` - Show timer controls (default: true)
- `position="inline"` - Component position: inline, window, lightbox (theme-dependent)

**CSS Selectors:**
```css
.timer-component { /* Main timer container */ }
.timer-display { /* Time display text */ }
.timer-status { /* Status badge (Ready/Running/Paused/Finished) */ }
.timer-controls { /* Timer control buttons container */ }
```

### `[chat]` - Two-Way Chat Interface
Enables communication between players and game master.

**Attributes:**
- `maxMessages="50"` - Maximum messages to display (default: 50)
- `showTimestamps="true"` - Show message timestamps (default: true)
- `allowUserInput="true"` - Allow player to send messages (default: true)
- `position="inline"` - Component position: inline, window, lightbox (theme-dependent)

**CSS Selectors:**
```css
.chat-component { /* Main chat container */ }
.chat-header { /* Chat section header */ }
.chat-log { /* Messages display area */ }
.chat-input-container { /* Input area container */ }
.chat-input { /* Text input field */ }
.chat-submit { /* Send button */ }
.chat-message { /* Individual message */ }
.chat-message.player { /* Player messages */ }
.chat-message.gm { /* Game master messages */ }
.chat-timestamp { /* Message timestamp */ }
```

### `[hints]` - Hint Display System
Shows hints provided by the game master.

**Attributes:**
- `maxHints="10"` - Maximum hints to store (default: 10)
- `showNavigation="true"` - Show hint navigation buttons (default: true)
- `autoCycle="false"` - Auto-cycle through hints (default: false)
- `position="inline"` - Component position: inline, window, lightbox (theme-dependent)

**CSS Selectors:**
```css
.hints-component { /* Main hints container */ }
.hints-header { /* Hints section header */ }
.hint-container { /* Hints display area */ }
.hint-navigation { /* Navigation buttons container */ }
.hint-placeholder { /* No hints message */ }
.hint-overlay { /* Full-screen hint overlay */ }
.hint-overlay-content { /* Overlay content area */ }
.overlay-hint-text { /* Overlay hint text */ }
.hint-overlay-close { /* Overlay close button */ }
.hint-card { /* Individual hint card */ }
```

### `[variables]` - Room Variables Display
Shows dynamic game variables set by the game master.

**Attributes:**
- `updateInterval="1000"` - Update interval in milliseconds (default: 1000)
- `position="inline"` - Component position: inline, window, lightbox (theme-dependent)

**CSS Selectors:**
```css
.variables-component { /* Main variables container */ }
.variables-header { /* Variables section header */ }
.variable-display { /* Variables display area */ }
.variable-placeholder { /* Loading/empty message */ }
.variable-item { /* Individual variable */ }
.variable-name { /* Variable name */ }
.variable-value { /* Variable value */ }
.state-item { /* State item (alternative class) */ }
```

### `[media]` - Media Lightbox Component
Handles display of images, videos, and audio files.

**Attributes:**
- `supportedFormats="jpg,png,gif,mp4,mp3"` - Supported file formats
- `position="lightbox"` - Component position: inline, window, lightbox (default: lightbox)

**CSS Selectors:**
```css
.media-component { /* Main media container */ }
.lightbox { /* Lightbox overlay */ }
.lightbox-content { /* Lightbox content area */ }
.lightbox-header { /* Lightbox header */ }
.lightbox-headline { /* Lightbox title */ }
.lightbox-close { /* Close button */ }
.lightbox-media { /* Media display area */ }
.lightbox img { /* Images in lightbox */ }
.lightbox video { /* Videos in lightbox */ }
.lightbox audio { /* Audio in lightbox */ }
```

### `[room-info]` - Room Information Display
Shows room name, code, and basic information.

**Attributes:**
- `showProgress="true"` - Show progress indicators (default: true)
- `position="inline"` - Component position: inline, window, lightbox (theme-dependent)

**CSS Selectors:**
```css
.room-info-component { /* Main room info container */ }
.room-title { /* Room name/title */ }
.room-info { /* Room details (code, etc.) */ }
.room-progress { /* Progress indicators */ }
```

### `[game-state]` - Game State Display
Shows score, status, and other game information.

**Attributes:**
- `showScore="true"` - Show score display (default: true)
- `updateInterval="1000"` - Update interval in milliseconds (default: 1000)
- `position="inline"` - Component position: inline, window, lightbox (theme-dependent)

**CSS Selectors:**
```css
.game-state-component { /* Main game state container */ }
.game-score { /* Score display */ }
.game-status { /* Current game status */ }
.config-display { /* Configuration display area */ }
.state-section { /* Alternative container class */ }
.state-card { /* State card styling */ }
```

## Theme Configuration

Themes use a `theme-config.json` file to define metadata and CSS variables:

```json
{
  "name": "My Theme",
  "version": "1.0.0",
  "description": "A custom theme for escape rooms",
  "author": "Your Name",
  "components": {
    "timer": { "enabled": true },
    "chat": { "enabled": true },
    "hints": { "enabled": true },
    "variables": { "enabled": true },
    "media": { "enabled": true },
    "room-info": { "enabled": true },
    "game-state": { "enabled": true }
  },
  "variables": {
    "primary-color": "#007bff",
    "secondary-color": "#6c757d",
    "background-color": "#f8f9fa",
    "text-color": "#212529",
    "border-radius": "0.25rem",
    "font-family": "Arial, sans-serif"
  }
}
```

### CSS Variables
Themes can define CSS variables in `theme-config.json` that are automatically applied to the document root. These variables can be used in your theme's `style.css`:

```css
:root {
  --primary-color: #007bff;
  --secondary-color: #6c757d;
  --background-color: #f8f9fa;
  --text-color: #212529;
}
```

In your `style.css`, you can then use these variables:
```css
.timer-display {
  color: var(--primary-color);
  background-color: var(--background-color);
}
```

## Theme Script Files

Themes can include an optional `script.js` file for enhanced functionality. This file is automatically loaded when the theme is applied. The Windows 95 theme is an example of a theme that uses script.js to create a desktop-like interface with moveable windows.

When creating a theme script:
1. Use feature detection to ensure compatibility
2. Clean up event listeners and DOM elements when the theme is unloaded
3. Use the theme's CSS classes to target elements
4. Follow the existing theme architecture patterns

## Creating a Theme

1. Create a new directory in `themes/your-theme-name/`
2. Create `index.html` with your layout and shortcodes
3. Create `style.css` with your theme styles
4. Create `theme-config.json` with metadata and CSS variables
5. Optionally create `script.js` for theme-specific functionality
6. Create `README.md` documenting any custom CSS

### Example `index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Theme</title>
    <link rel="stylesheet" href="/styles.css">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="my-theme">
        <header class="game-header">
            [room-info]
            [timer format="mm:ss"]
        </header>
        
        <main class="game-main">
            <div class="left-panel">
                [chat maxMessages="30"]
            </div>
            <div class="right-panel">
                [hints showNavigation="true"]
                [variables]
            </div>
        </main>
        
        [media]
        [game-state showScore="false"]
    </div>
    <script src="/socket.io/socket.io.js"></script>
    <script src="/player.js"></script>
</body>
</html>
```

### Example `theme-config.json`:
```json
{
  "name": "My Theme",
  "version": "1.0.0",
  "description": "A custom theme for escape rooms",
  "author": "Your Name",
  "components": {
    "timer": { "enabled": true },
    "chat": { "enabled": true },
    "hints": { "enabled": true },
    "variables": { "enabled": true },
    "media": { "enabled": true },
    "room-info": { "enabled": true },
    "game-state": { "enabled": true }
  },
  "variables": {
    "primary-color": "#007bff",
    "secondary-color": "#6c757d",
    "background-color": "#f8f9fa",
    "text-color": "#212529"
  }
}
```

## Using Themes

When creating a room, specify the theme name:
```javascript
POST /api/rooms
{
  "name": "My Escape Room",
  "theme": "my-theme-name"
}
```

The theme will be used to generate the player interface automatically.

## Advanced Theme Features

### Component Positioning
Themes can implement different positioning strategies for components using the `position` attribute:
- `inline` - Default positioning within the document flow
- `window` - Theme-specific windowing (like the Windows 95 theme)
- `lightbox` - Modal overlay display

### Theme Inheritance
Themes can inherit from other themes, allowing for easier customization and updates. This feature is handled by the theme manager system.

### Responsive Design
Themes should implement responsive design principles to work on various screen sizes. Use CSS media queries and flexible layouts.

### Accessibility
Themes should follow accessibility best practices:
- Sufficient color contrast
- Keyboard navigation support
- Screen reader compatibility
- Focus indicators for interactive elements