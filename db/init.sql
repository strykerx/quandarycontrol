-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    shortcode TEXT UNIQUE,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    config JSON,
    timer_duration INTEGER DEFAULT 0,
    secondary_timer_enabled BOOLEAN DEFAULT FALSE,
    secondary_timer_duration INTEGER DEFAULT 0,
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

-- Layout templates for the Layout Builder
CREATE TABLE IF NOT EXISTS layout_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    layout JSON NOT NULL,
    theme_meta JSON NOT NULL DEFAULT '{}',
    is_system BOOLEAN DEFAULT FALSE,
    is_child BOOLEAN NOT NULL DEFAULT FALSE,
    parent_theme_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_layout_templates_name ON layout_templates(name);

-- Room layouts storage for the Layout Builder
CREATE TABLE IF NOT EXISTS room_layouts (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    name TEXT DEFAULT 'Default Layout',
    layout JSON NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_room_layouts_room ON room_layouts(room_id);
CREATE INDEX IF NOT EXISTS idx_room_layouts_active ON room_layouts(room_id, is_active);

-- Theme assets table for storing theme files (CSS, JS, etc.)
CREATE TABLE IF NOT EXISTS theme_assets (
    id TEXT PRIMARY KEY,
    theme_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (theme_id) REFERENCES layout_templates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_theme_assets_theme ON theme_assets(theme_id);

-- Notification system for audio alerts
CREATE TABLE IF NOT EXISTS notification_audio (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    mime_type TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notification_audio_room ON notification_audio(room_id);

-- Notification settings table
CREATE TABLE IF NOT EXISTS notification_settings (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    setting_type TEXT NOT NULL, -- 'player_hint_receive', 'player_chat_send', 'player_chat_receive', 'gm_chat_receive', 'variable_trigger'
    audio_id TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    settings JSON DEFAULT '{}', -- Additional settings like volume, conditions
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (audio_id) REFERENCES notification_audio(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_settings_room ON notification_settings(room_id);
CREATE INDEX IF NOT EXISTS idx_notification_settings_type ON notification_settings(room_id, setting_type);
