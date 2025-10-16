# Window Man Theme

A immersive escape room theme featuring a man behind a window with speech bubble hints and a large timer display at the bottom.

## Visual Design

- **Winter Scene Background**: Snowy outdoor scene as the backdrop
- **Window Frame**: Four-pane window with a man's silhouette visible inside
- **Speech Bubble**: Large, prominent speech bubble above the window displaying hints
- **Timer**: Large countdown timer fixed at the bottom of the screen
- **Room Info**: Displayed in the top-right corner

## Theme Features

### Main Components

1. **Window with Man Silhouette**
   - 500x500px window frame with grid layout
   - Man silhouette positioned behind the window panes
   - Creates an immersive "looking through a window" effect

2. **Speech Bubble Hint Display**
   - Large, readable speech bubble pointing up toward the window
   - Displays hints with navigation controls
   - Positioned centrally below the window
   - Minimum 150px height with scrollable content

3. **Large Timer Display**
   - Fixed at the bottom of the screen
   - 4rem font size with monospace styling
   - Dark background with white text for high contrast
   - Shows timer status badge

4. **Room Information**
   - Fixed in top-right corner
   - Shows room name and code
   - Subtle styling that doesn't distract from main content

### Hidden/Accessible Components

The following components are included but not prominently displayed by default:
- **Chat**: Two-way communication with game master
- **Variables**: Dynamic game state variables
- **Game State**: Score and status information
- **Media Lightbox**: Full-screen media display

These can be made visible by modifying `.hidden-components` display property in the CSS.

## Required Assets

Place these files in the `themes/window-man/assets/` directory:

1. **window-frame.png** - Four-pane window frame with dark wood or metal frame
2. **man-silhouette.png** - Silhouette of a man (shown behind the window)
3. **winter-scene.png** - Winter/snowy background scene

## CSS Variables

Customize the theme by modifying these CSS variables in `theme-config.json`:

```json
{
  "primary-color": "#2c3e50",      // Main dark color
  "secondary-color": "#34495e",     // Secondary dark shade
  "background-color": "#ecf0f1",    // Light background
  "text-color": "#2c3e50",          // Main text color
  "accent-color": "#3498db",        // Blue accent for buttons
  "hint-bg": "#ffffff",             // Speech bubble background
  "hint-border": "#3498db",         // Speech bubble border
  "timer-bg": "#2c3e50",            // Timer bar background
  "timer-color": "#ffffff",         // Timer text color
  "border-radius": "12px",          // Border radius for elements
  "font-family": "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
}
```

## Component Customization

### Timer Display
The timer is styled with:
- `.timer-display` - Large 4rem monospace font
- `.timer-status` - Status badge (Ready/Running/Paused/Finished)
- `.timer-container` - Fixed bottom positioning

### Hint Speech Bubble
The hints appear in a speech bubble with:
- `.speech-bubble` - Main bubble styling with border and shadow
- `.hint-container` - Hint text display
- `.hint-navigation` - Previous/Next buttons

### Window Frame
The window is composed of:
- `.window-frame` - Main container with grid layout
- `.window-pane` - Individual window panes with glass effect
- `.man-silhouette` - Man image positioned behind panes

## Responsive Design

The theme adapts to different screen sizes:

- **Desktop (>768px)**: Full-size window (500px), large speech bubble
- **Tablet (≤768px)**: Medium window (350px), adjusted text sizes
- **Mobile (≤480px)**: Compact window (280px), smaller timer and bubbles

## Usage

To use this theme when creating a room:

```javascript
POST /api/rooms
{
  "name": "Mystery at the Window",
  "theme": "window-man"
}
```

## Customization Tips

1. **Change the Man**: Replace `man-silhouette.png` with any silhouette or character image
2. **Different Backgrounds**: Swap `winter-scene.png` for any seasonal or thematic background
3. **Speech Bubble Color**: Modify `--hint-bg` and `--hint-border` variables
4. **Timer Position**: Move timer by adjusting `.timer-container` CSS
5. **Show Hidden Components**: Change `.hidden-components { display: block; }` to reveal chat and variables

## Theme-Specific CSS Classes

### Window Elements
- `.window-man-theme` - Main theme container
- `.winter-background` - Background image container
- `.window-container` - Window and speech bubble wrapper
- `.window-frame` - Window frame container
- `.window-pane` - Individual window glass panes
- `.man-silhouette` - Man image

### Speech Bubble
- `.speech-bubble-container` - Speech bubble wrapper
- `.speech-bubble` - Main speech bubble with tail
- `.speech-bubble::before` - Tail border
- `.speech-bubble::after` - Tail fill

### Layout Containers
- `.timer-container` - Bottom timer bar
- `.room-info-container` - Top-right info box
- `.hidden-components` - Hidden component container

## Browser Support

- Modern browsers with CSS Grid support
- Flexbox for component positioning
- CSS custom properties (CSS variables)
- Backdrop-filter for glass effect (fallback available)
