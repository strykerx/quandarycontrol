# Quandary Control - Complete User Guide

## Table of Contents
1. [What is Quandary Control?](#what-is-quandary-control)
2. [Quick Setup Guide](#quick-setup-guide)
3. [System Requirements](#system-requirements)
4. [Getting Started](#getting-started)
5. [Creating Your First Room](#creating-your-first-room)
6. [Understanding the Interface](#understanding-the-interface)
7. [Theme System](#theme-system)
8. [Variable System & Room Actions](#variable-system--room-actions)
9. [Advanced Features](#advanced-features)
10. [Troubleshooting](#troubleshooting)
11. [API Reference](#api-reference)

---

## What is Quandary Control?

**Quandary Control** is a self-hostable, open-source control system designed for escape room operations. It provides real-time game management, customizable player interfaces, and hardware integration capabilities through REST APIs. The system runs on local networks or web servers and offers complete customization control.

### Key Features
- **Real-time Game Management**: Live timer controls, hint systems, and player monitoring
- **Customizable Player Interfaces**: Themes, layouts, and responsive design
- **Hardware Integration**: REST API for connecting Arduino, Raspberry Pi, and other devices
- **Multi-room Support**: Manage multiple escape rooms from one system
- **Mobile & TV Friendly**: Responsive design with Android TV optimization
- **Two-way Communication**: Chat system between game masters and players
- **Media Support**: Image and video uploads with lightbox display

---

## Quick Setup Guide

### For Complete Beginners

1. **Download & Install Node.js**
   - Go to [nodejs.org](https://nodejs.org/)
   - Download the LTS (Long Term Support) version
   - Install it on your computer (Windows/Mac/Linux)

2. **Download Quandary Control**
   ```bash
   # Option 1: Download from GitHub (if you have git)
   git clone https://github.com/your-username/QuandaryControl.git
   cd QuandaryControl

   # Option 2: Download ZIP file from GitHub
   # Extract the ZIP file and open a terminal/command prompt in that folder
   ```

3. **Install Dependencies**
   ```bash
   npm install
   ```

4. **Start the Server**
   ```bash
   npm start
   ```

5. **Open Your Browser**
   - Go to `http://localhost:3000`
   - You're ready to create your first room!

---

## System Requirements

### Minimum Requirements
- **Node.js**: Version 18.x or higher
- **RAM**: 512MB available memory
- **Storage**: 100MB free disk space
- **Network**: Local network access for player devices

### Recommended Setup
- **Node.js**: Latest LTS version
- **RAM**: 1GB+ for multiple rooms
- **Storage**: 1GB+ for media files
- **Network**: Dedicated Wi-Fi network for escape room

### Supported Platforms
- **Windows**: 10/11
- **macOS**: 10.15 (Catalina) or newer
- **Linux**: Ubuntu 18.04+, CentOS 7+, or equivalent
- **Browsers**: Chrome, Firefox, Safari, Edge (modern versions)

---

## Getting Started

### Initial Setup

1. **Start the Server**
   ```bash
   npm start
   ```
   You should see: `Server running on port 3000`

2. **Access the Admin Panel**
   - Open your browser to `http://localhost:3000/admin.html`
   - This is your main control center

3. **Test the System**
   - Create a test room (see next section)
   - Open the player interface on another device
   - Verify real-time communication works

### Network Setup

**For Local Network Use:**
- Find your computer's IP address
- Players connect to `http://YOUR_IP:3000/p/ROOMCODE`
- Example: `http://192.168.1.100:3000/p/ABC123`

**For Internet Use:**
- Set up port forwarding on your router (port 3000)
- Or use a hosting service like Heroku, DigitalOcean, etc.

---

## Creating Your First Room

### Step 1: Access Admin Panel
1. Open `http://localhost:3000/admin.html`
2. Click "Create New Room"

### Step 2: Basic Room Settings
- **Room Name**: Choose a descriptive name (e.g., "Mystery Mansion")
- **Timer Duration**: Set in MM:SS format (e.g., "60:00" for 60 minutes)
- **Secondary Timer**: Optional additional timer
- **Hint System**:
  - "One-way Broadcast": You send hints to players
  - "Two-way Chat": Players can message you back

### Step 3: Choose a Theme
Select from 5 built-in themes:
- **Default Purple**: Original gradient theme
- **Ocean Blue**: Calming blue ocean theme
- **Forest Green**: Natural green theme
- **Sunset Orange**: Warm orange theme
- **Midnight Dark**: Dark blue theme

### Step 4: Save and Test
1. Click "Create Room"
2. Note the room shortcode (e.g., "ABC123")
3. Open player view: `http://localhost:3000/p/ABC123`

---

## Understanding the Interface

### Admin Dashboard (`/admin.html`)
- **Room Grid**: Shows all created rooms
- **Create New Room**: Add new escape rooms
- **Room Management**: Edit, delete, or view rooms
- **TV Portal**: Android TV optimized interface

### Game Master Interface (`/gm.html?room=ROOMID`)
- **Timer Controls**: Start, pause, stop, adjust timers
- **Hint System**: Send hints or chat with players
- **Variable Monitor**: View and modify room variables
- **Player Status**: See connected players

### Player Interface (`/p/ROOMCODE`)
- **Timer Display**: Shows remaining time
- **Hint Area**: Receives hints from game master
- **Interactive Elements**: Custom buttons, media displays
- **Chat**: Two-way communication (if enabled)

### Rules Editor (`/rules-editor.html?room=ROOMID`)
- **Slideshow Creator**: Build instruction slideshows
- **Media Upload**: Add images and videos
- **Presentation Mode**: Full-screen rule display

---

## Theme System

### How Themes Work
Themes use CSS custom properties (variables) to control colors, gradients, and styling across the entire interface. Each theme defines:
- **Primary/Secondary Colors**: Main interface colors
- **Accent Colors**: Highlights and interactive elements
- **Background Colors**: Dark, medium, and light backgrounds
- **Text Colors**: Various text contrast levels
- **Gradients**: Background animations and effects

### Using Themes

**Apply Theme to Room:**
1. Edit room in admin panel
2. Select theme from dropdown
3. Save changes
4. Theme applies immediately to player interface

**Live Theme Preview:**
- Changes apply instantly without page reload
- Test different themes during setup

### Available Themes

| Theme | Description | Best For |
|-------|------------|----------|
| **Default Purple** | Original gradient design | General use, tech themes |
| **Ocean Blue** | Calming blue tones | Underwater, calm environments |
| **Forest Green** | Natural earth tones | Nature, outdoor themes |
| **Sunset Orange** | Warm orange gradients | Adventure, warm environments |
| **Midnight Dark** | Deep dark blues | Horror, mystery themes |

### Creating Custom Themes

To add custom themes, edit `public/theme-config.json`:

```json
{
  "themes": {
    "custom-red": {
      "name": "Custom Red",
      "description": "Your custom red theme",
      "colors": {
        "primary-color": "#dc2626",
        "primary-color-dark": "#b91c1c",
        "secondary-color": "#ef4444",
        "accent-color": "#f87171",
        "accent-color-light": "#fca5a5",
        "bg-dark": "#1f1f1f",
        "bg-medium": "#2f2f2f",
        "bg-light": "#3f3f3f",
        "text-light": "#ffffff",
        "text-muted": "#d1d5db",
        "text-dark": "#1f2937",
        "text-secondary": "#6b7280"
      },
      "gradients": {
        "player-primary": "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)",
        "player-secondary": "linear-gradient(135deg, #f87171 0%, #fca5a5 100%)"
      }
    }
  }
}
```

---

## Variable System & Room Actions

### What are Variables?
Variables are custom data points that can trigger actions in your escape room. They connect physical puzzles (via API) to digital responses (sounds, displays, etc.).

### Variable Types
- **Boolean**: True/false (light switches, door locks)
- **Integer**: Numbers (combination locks, counters)
- **String**: Text (passwords, clues)

### Setting Up Variables

**Method 1: JSON Editor (Advanced)**
```json
{
  "puzzle1_solved": {
    "type": "boolean",
    "value": false,
    "description": "First puzzle completion status"
  },
  "door_code": {
    "type": "string",
    "value": "",
    "description": "4-digit door code"
  }
}
```

**Method 2: Variable Manager (Recommended)**
1. Edit room in admin panel
2. Click "Manage Variables"
3. Add variables through interface
4. Set triggers and actions

### Trigger System

**Available Conditions:**
- `equals`: Variable equals specific value
- `not_equals`: Variable doesn't equal value
- `greater_than`: Numeric comparison
- `less_than`: Numeric comparison
- `contains`: String contains substring
- `changes_to`: Variable changes to value

**Available Actions:**
- `play_sound`: Play audio file
- `display_text`: Show text to players
- `show_lightbox`: Display image/video
- `webhook`: Call external URL
- `update_variable`: Change another variable

### Example Trigger Configuration
```json
{
  "triggers": [
    {
      "variable": "puzzle1_solved",
      "condition": "equals",
      "value": true,
      "actions": [
        {
          "type": "play_sound",
          "file": "success.mp3",
          "volume": 70
        },
        {
          "type": "display_text",
          "text": "Great job! The first puzzle is complete!",
          "duration": 5000
        }
      ]
    }
  ]
}
```

### Using the API

**Get Variable:**
```bash
GET /api/rooms/ROOM_ID/variables/VARIABLE_NAME
```

**Set Variable:**
```bash
POST /api/rooms/ROOM_ID/variables/VARIABLE_NAME
Content-Type: application/json

{
  "value": true
}
```

**Example with Arduino:**
```cpp
// Arduino code to update variable
WiFiClient client;
HTTPClient http;

http.begin(client, "http://192.168.1.100:3000/api/rooms/room123/variables/door_opened");
http.addHeader("Content-Type", "application/json");

int httpResponseCode = http.POST("{\"value\": true}");
```

---

## Advanced Features

### File Upload System
- **Supported Formats**: Images (JPG, PNG, GIF), Videos (MP4, WebM)
- **Upload Location**: Admin panel → Edit Room → Media section
- **Usage**: Automatic lightbox display, background images

### Layout System (Beta)
The layout builder allows custom player interface design:
- **Grid System**: Drag-and-drop positioning
- **Responsive Design**: Mobile, tablet, desktop breakpoints
- **Components**: Timers, buttons, text, media displays

**Note**: Layout builder has known issues and is under development.

### Android TV Support
- **TV Portal**: `/tv` - Remote-friendly interface
- **D-pad Navigation**: Optimized for TV remotes
- **Large Text**: Readable from distance

### Multi-room Management
- **Concurrent Rooms**: Run multiple escape rooms simultaneously
- **Isolated Sessions**: Each room operates independently
- **Shared Resources**: Common themes and media files

### Debugging & Testing
```bash
# Run tests
npm test

# Run with debug logging
DEBUG=* npm start

# Check specific test suites
npm run test:unit      # Unit tests
npm run test:integration  # API tests
npm run test:db        # Database tests
```

---

## Troubleshooting

### Common Issues

**"Server won't start"**
- Check Node.js version: `node --version` (should be 18+)
- Install dependencies: `npm install`
- Check port availability: Try `PORT=3001 npm start`

**"Players can't connect"**
- Verify IP address: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
- Check firewall settings
- Ensure all devices on same network

**"Timers not syncing"**
- Refresh player browsers
- Check WebSocket connection in browser console
- Restart server if needed

**"Variables not updating"**
- Check API endpoint URLs
- Verify JSON format in requests
- Check server logs for errors

**"Themes not applying"**
- Clear browser cache
- Check theme configuration in JSON
- Verify theme name matches exactly

### Getting Help

**Check Logs:**
```bash
# Server logs show in terminal
npm start

# For detailed debugging
DEBUG=* npm start
```

**Browser Console:**
1. Press F12 in browser
2. Check Console tab for errors
3. Look for WebSocket connection issues

**Database Issues:**
```bash
# Reset database (WARNING: Deletes all rooms)
rm db/quandary.db
npm start
```

---

## API Reference

### Room Management

**Get All Rooms**
```
GET /api/rooms
```

**Create Room**
```
POST /api/rooms
Content-Type: application/json

{
  "name": "Room Name",
  "timer_duration": 3600,
  "config": {}
}
```

**Get Room by ID**
```
GET /api/rooms/{roomId}
```

**Update Room**
```
PUT /api/rooms/{roomId}
Content-Type: application/json

{
  "name": "Updated Name"
}
```

**Delete Room**
```
DELETE /api/rooms/{roomId}
```

### Variable Management

**Get All Variables**
```
GET /api/rooms/{roomId}/variables
```

**Get Specific Variable**
```
GET /api/rooms/{roomId}/variables/{variableName}
```

**Set Variable**
```
POST /api/rooms/{roomId}/variables/{variableName}
Content-Type: application/json

{
  "value": "new_value"
}
```

### File Upload

**Upload Media**
```
POST /api/rooms/{roomId}/media
Content-Type: multipart/form-data

files: [file1, file2, ...]
```

### WebSocket Events

**Client → Server:**
- `join_room`: Connect to room
- `timer_control`: Timer commands
- `sendHint`: Send hint to players
- `chat_message`: Chat message

**Server → Client:**
- `timer_update`: Timer state changes
- `hintReceived`: New hint received
- `variableUpdate`: Variable changed
- `show_lightbox`: Display media

### Shortcode Resolution

**Get Room by Shortcode**
```
GET /api/shortcode/{shortcode}
```

---

## Next Steps

### For Escape Room Operators
1. **Setup Hardware Integration**: Connect Arduino/Raspberry Pi devices
2. **Create Multiple Rooms**: Design different experiences
3. **Train Staff**: Teach game masters the interface
4. **Test Thoroughly**: Run complete game sessions

### For Developers
1. **Explore the Codebase**: Check `CLAUDE.md` for technical details
2. **Run Tests**: `npm test` to verify functionality
3. **Contribute**: Submit issues and pull requests
4. **Extend Features**: Add custom actions and triggers

### For System Administrators
1. **Setup Backups**: Regular database backups
2. **Monitor Performance**: Check server logs
3. **Security**: Firewall configuration, network isolation
4. **Updates**: Keep Node.js and dependencies current

---

**Need more help?** Check the technical documentation in `CLAUDE.md` or submit issues on GitHub.

**Ready to get started?** Jump back to [Quick Setup Guide](#quick-setup-guide) and create your first room!