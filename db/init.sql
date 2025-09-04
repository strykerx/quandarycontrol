-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    shortcode TEXT UNIQUE,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    config JSON,
    timer_duration INTEGER DEFAULT 0,
    api_variables JSON DEFAULT '{}',
    custom_html TEXT DEFAULT '',
    custom_css TEXT DEFAULT '',
    rules_config JSON DEFAULT '{}',
    hint_config JSON DEFAULT '{}'
);

-- Create index on shortcode for fast lookups
CREATE INDEX IF NOT EXISTS idx_rooms_shortcode ON rooms(shortcode);

-- Legacy tables (marked for migration)
-- Custom variables storage
CREATE TABLE IF NOT EXISTS legacy_variables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('boolean', 'integer', 'string')) NOT NULL,
    value TEXT NOT NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(id)
);

-- Timers configuration
CREATE TABLE IF NOT EXISTS legacy_timers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    name TEXT NOT NULL,
    duration INTEGER NOT NULL,
    remaining INTEGER NOT NULL,
    active BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (room_id) REFERENCES rooms(id)
);

-- Hint system storage
CREATE TABLE IF NOT EXISTS legacy_hints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT CHECK(status IN ('pending', 'sent', 'acknowledged')) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id)
);

-- Event triggers
CREATE TABLE IF NOT EXISTS legacy_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    variable_id INTEGER NOT NULL,
    condition TEXT NOT NULL,
    action_type TEXT NOT NULL,
    action_data JSON NOT NULL,
    FOREIGN KEY (variable_id) REFERENCES variables(id)
);

-- Media storage for Lightbox feature
CREATE TABLE IF NOT EXISTS room_media (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    type TEXT CHECK(type IN ('image','video','audio','other')) NOT NULL,
    title TEXT DEFAULT '',
    url TEXT NOT NULL,
    thumbnail_url TEXT DEFAULT '',
    metadata JSON DEFAULT '{}',
    order_index INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id)
);

CREATE INDEX IF NOT EXISTS idx_room_media_room ON room_media(room_id);

-- Lightbox sequences (ordered sets of media items)
CREATE TABLE IF NOT EXISTS lightbox_sequences (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    name TEXT NOT NULL,
    items JSON NOT NULL DEFAULT '[]', -- array of media ids or objects
    settings JSON DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id)
);

CREATE INDEX IF NOT EXISTS idx_lightbox_room ON lightbox_sequences(room_id);
