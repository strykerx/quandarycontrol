# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## High-Level Architecture

**Quandary Control** is a real-time room management system for escape room experiences with WebSocket-based communication, SQLite database, and dynamic layout/theme customization.

### Core Components

- **server.js**: Main Express server with Socket.io integration
- **db/**: SQLite database layer with better-sqlite3
- **routes/api.js**: REST API endpoints for room management
- **api/template-routes.js**: Template system API endpoints
- **public/**: Frontend files including admin interface, player interface, and layout builders

### Key Architecture Patterns

**Database Layer**: Single SQLite database (`db/quandary.db`) with schema in `db/init.sql`. Uses better-sqlite3 for synchronous operations. Database connection managed through `db/database.js` singleton pattern.

**Real-time Communication**: Socket.io for bidirectional communication between GM interface, player interface, and admin panel. Handles timer synchronization, hint broadcasting, chat, and layout updates.

**Room System**: Each room has unique ID and shortcode for player access. Rooms support:
- Timer management with WebSocket synchronization
- Custom layouts via JSON configuration
- Theme customization via CSS variables
- Rules editor and slideshow system
- File upload system for media

**Layout System**: JSON-driven responsive layout system with:
- Grid and flexbox-based positioning
- Breakpoint definitions for mobile/tablet/desktop
- Component visibility controls
- Live preview capabilities
- Schema validation via `config/layout-schema.json`

**Theme System**: CSS custom properties-based theming with:
- Predefined themes in `public/theme-config.json`
- Dynamic theme switching without page reload
- Gradient and color customization
- Theme persistence

### API Structure

**Core Endpoints**:
- `GET/POST/PUT/DELETE /api/rooms` - Room CRUD operations
- `GET/POST /api/rooms/:id/variables` - Room-specific variables
- `PUT /api/rooms/:id/layout` - Layout configuration
- Template system endpoints in `/api/templates`

**WebSocket Events**:
- `join_room` - Connect to room with client type (gm/player)
- `timer_control` - Timer start/pause/stop/adjust commands
- `sendHint`/`hintReceived` - Hint system
- `chat_message` - Two-way chat between GM and players
- `layout_preview`/`apply_layout` - Dynamic layout management
- `show_lightbox` - Media display with auto-close

### Frontend Architecture

**Admin Interface** (`public/admin.html`): Main control panel with room management, layout builder, and theme controls.

**Player Interface** (`public/player.html`): Game interface with timer, hints, chat, and responsive layouts.

**GM Interface** (`public/gm.html`): Game master controls for hints, timer, and player communication.

**Layout Builder** (`public/layout-builder.html`): Visual layout configuration tool with drag-and-drop and live preview.

### Testing Strategy

Comprehensive test suite using Jest:
- **Unit tests**: Database operations, utilities, core functions
- **Integration tests**: API endpoints, WebSocket functionality  
- **Test utilities**: Database fixtures, WebSocket helpers, test factories
- **Coverage reporting**: Text, LCOV, HTML formats

Test database isolation ensures clean state for each test. WebSocket testing uses custom helper class for connection management.

### Key Configuration Files

- `config/layout-config.json` - Layout presets and breakpoint definitions
- `config/layout-schema.json` - JSON schema for layout validation
- `config/template-schema.json` - Template system validation
- `public/theme-config.json` - Theme definitions and settings
- `jest.config.js` - Test configuration with coverage settings

### Development Notes

**Database**: Uses synchronous better-sqlite3 operations. Foreign keys enabled. Schema changes require updating `db/init.sql`.

**WebSocket**: Timer state managed in-memory per room. Active timers cleared on server restart.

**File Uploads**: Handled via multer to `public/uploads/` with nanoid-based naming.

**Shortcodes**: Auto-generated 4-6 character codes for room access via `/p/:shortcode` route.