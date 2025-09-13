# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Quandary Control** is a self-hostable, open-source control system for escape room operations. It provides real-time game management, customizable player interfaces, and hardware integration via REST API. The system runs on local networks or web servers and offers complete customization control.

### Technology Stack
- **Backend**: Node.js + Express.js + SQLite (better-sqlite3)
- **Real-time**: Socket.IO WebSocket communication
- **Frontend**: Vanilla HTML/CSS/JS for maximum customizability
- **Validation**: AJV for JSON schema validation
- **File Upload**: Multer for media and template handling

## Commands

### Testing
```bash
npm test                    # Run all tests
npm run test:coverage      # Run tests with coverage report
npm run test:unit          # Run unit tests only
npm run test:integration   # Run integration tests only
npm run test:db           # Run database tests only
npm run test:watch        # Run tests in watch mode
npm run test:debug        # Debug tests
npm run test:ci           # CI-optimized test run
```

### Development
```bash
npm run dev               # Start server with nodemon (development)
node server.js           # Start server (production)
```

## Current Development Status

### ✅ Working Features
- Core room management system with SQLite database
- Real-time timer controls and state synchronization
- Admin panel for room creation/editing
- Game Master interface with live controls
- Player interface with responsive design
- Theme system with CSS variables
- Media upload and lightbox display
- Rules editor and slideshow system
- Two-way chat and hint broadcasting

### 🚧 Known Issues Needing Fixes
1. **Layout Builder** (`public/layout-builder.js`):
   - Grid highlighting broken on mouse hover
   - Vertical dragging doesn't work (only horizontal)
   - Cannot add/position custom images/videos
   - No background image support for sections
   - Missing text box creation with font controls
   - No way to apply layouts to rooms or preview

2. **Variable System** (Needs Room Actions Builder):
   - Current JSON editing is too technical
   - Need visual interface showing API endpoints
   - Missing conditional logic builder ("if X then Y")
   - No action types (play media, display text, webhooks)

3. **Audio System** (Missing entirely):
   - No hint sound notifications
   - No audio file upload/management
   - No volume/mute controls

## High-Level Architecture

### Core Components

- **server.js**: Main Express server with Socket.io integration
- **db/**: SQLite database layer with better-sqlite3
- **routes/api.js**: REST API endpoints for room management
- **public/**: Frontend files including admin, player, GM interfaces

### Database Layer
Single SQLite database (`db/quandary.db`) with schema in `db/init.sql`. Uses better-sqlite3 for synchronous operations. Database connection managed through `db/database.js` singleton pattern.

### Real-time Communication
Socket.io handles bidirectional communication for:
- Timer synchronization between GM and player views
- Hint broadcasting and two-way chat
- Layout updates and media display
- Variable state changes

### Room System
Each room has unique ID and shortcode for player access (`/p/ABC123`). Rooms support:
- Timer management with WebSocket synchronization
- Custom layouts via JSON configuration (buggy - needs fixes)
- Theme customization via CSS variables
- Rules editor and slideshow system
- File upload system for media

### Layout System (Partially Working)
JSON-driven responsive layout system with:
- Grid and flexbox-based positioning
- Breakpoint definitions for mobile/tablet/desktop
- Component visibility controls
- Schema validation via `config/layout-schema.json`
- **Issues**: Drag-and-drop buggy, no custom elements, no room application

### Theme System (Working)
CSS custom properties-based theming with:
- Predefined themes in `public/theme-config.json`
- Dynamic theme switching without page reload
- Theme persistence via localStorage

## Key File Structure

```
quandarycontrol/
├── server.js                 # Main server file
├── package.json              # Dependencies
├── db/
│   ├── database.js           # DB connection singleton
│   └── init.sql              # Database schema
├── config/
│   ├── layout-config.json    # Layout configurations
│   ├── layout-schema.json    # Layout validation
│   └── template-schema.json  # Template validation
├── public/
│   ├── admin.html/.js/.css   # Admin interface (working)
│   ├── player.html/.js       # Player view (working)
│   ├── gm.html/.js           # Game master interface (working)
│   ├── rules-editor.html/.js # Rules management (working)
│   ├── layout-builder.*      # Layout tools (buggy - needs fixes)
│   ├── theme-manager.js      # Theme system (working)
│   ├── ui-state.js          # State management (working)
│   └── styles.css           # Main stylesheet
```

## API Structure

### Core Endpoints
- `GET/POST/PUT/DELETE /api/rooms` - Room CRUD operations
- `GET/POST /api/rooms/:id/variables` - Room variables (needs testing)
- `PUT /api/rooms/:id/layout` - Layout configuration
- `POST /api/rooms/:id/media` - Media upload
- `GET /api/shortcode/:code` - Shortcode resolution

### WebSocket Events
- `join_room` - Connect to room with client type (gm/player)
- `timer_control` - Timer start/pause/stop/adjust commands
- `sendHint`/`hintReceived` - Hint system
- `chat_message` - Two-way chat between GM and players
- `layout_preview`/`apply_layout` - Dynamic layout management
- `show_lightbox` - Media display with auto-close

## Development Priorities

### Immediate Fixes Needed
1. **Fix Layout Builder** (`public/layout-builder.js`):
   - Debug grid highlighting on hover
   - Fix vertical dragging (only horizontal works)
   - Add custom image/video placement
   - Add background image support
   - Create text box elements with styling
   - Build room application and preview system

2. **Build Room Actions Builder**:
   - Create visual interface for variables (replace JSON editing)
   - Show API endpoints (GET/POST examples)
   - Add conditional logic builder
   - Add action types (media, text, webhooks)

3. **Add Audio System**:
   - Hint sound notifications
   - Audio file upload/management
   - Volume controls

### Future Enhancements
- Template system for shareable layouts
- Android TV optimization with D-pad navigation
- Hardware integration examples (Arduino/Raspberry Pi)
- Multi-room management dashboard

## Testing Strategy

Comprehensive test suite using Jest:
- **Unit tests**: Database operations, utilities, core functions
- **Integration tests**: API endpoints, WebSocket functionality  
- **Test utilities**: Database fixtures, WebSocket helpers
- **Coverage reporting**: Text, LCOV, HTML formats

Test database isolation ensures clean state. WebSocket testing uses custom helper class.

## Development Notes

**Database**: Uses synchronous better-sqlite3. Foreign keys enabled. Schema changes require updating `db/init.sql`.

**WebSocket**: Timer state managed in-memory per room. Active timers cleared on server restart.

**File Uploads**: Handled via multer to `public/uploads/` with nanoid-based naming.

**Layout System**: Currently uses basic grid positioning. Template system planned for advanced customization.

**Variable System**: Exists but needs visual builder interface for usability.

**Android TV**: Theme and responsive design support exists, but needs D-pad navigation implementation.

## Common Development Tasks

### Adding New Features
1. Update database schema in `db/init.sql` if needed
2. Add API endpoints in `routes/api.js`
3. Update frontend interfaces as needed
4. Add WebSocket events if real-time sync required
5. Write tests for new functionality

### Debugging Layout Builder
- Check `public/layout-builder.js` for drag/drop event handlers
- Grid highlighting logic in CSS hover states
- Vertical drag limitations in pointToGrid() function
- Missing preview functionality needs socket integration

### Testing Variable System
- Test via `GET/POST /api/rooms/:id/variables`
- Check WebSocket `variableUpdate` events
- Verify GM interface variable display
- Room Actions Builder needs to be built from scratch