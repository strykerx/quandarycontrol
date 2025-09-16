const Database = require('better-sqlite3');
const { join } = require('path');

/**
 * Migration to add ON DELETE CASCADE to foreign key constraints
 * SQLite doesn't support ALTER TABLE for foreign keys, so we need to recreate tables
 */
function migrate(db) {
  console.log('Running migration: Fix foreign key CASCADE constraints...');

  // Begin transaction
  db.exec('BEGIN TRANSACTION');

  try {
    // Get existing data from tables that need foreign key updates
    const legacyVariables = db.prepare('SELECT * FROM legacy_variables').all();
    const legacyTimers = db.prepare('SELECT * FROM legacy_timers').all();
    const legacyHints = db.prepare('SELECT * FROM legacy_hints').all();
    const roomMedia = db.prepare('SELECT * FROM room_media').all();
    const lightboxSequences = db.prepare('SELECT * FROM lightbox_sequences').all();

    // Drop tables with incorrect foreign keys
    db.exec('DROP TABLE IF EXISTS legacy_variables');
    db.exec('DROP TABLE IF EXISTS legacy_timers');
    db.exec('DROP TABLE IF EXISTS legacy_hints');
    db.exec('DROP TABLE IF EXISTS room_media');
    db.exec('DROP TABLE IF EXISTS lightbox_sequences');

    // Recreate tables with proper CASCADE constraints
    db.exec(`
      CREATE TABLE IF NOT EXISTS legacy_variables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT CHECK(type IN ('boolean', 'integer', 'string')) NOT NULL,
        value TEXT NOT NULL,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS legacy_timers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT NOT NULL,
        name TEXT NOT NULL,
        duration INTEGER NOT NULL,
        remaining INTEGER NOT NULL,
        active BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS legacy_hints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT CHECK(status IN ('pending', 'sent', 'acknowledged')) DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
      )
    `);

    db.exec(`
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
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS lightbox_sequences (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        name TEXT NOT NULL,
        items JSON NOT NULL DEFAULT '[]',
        settings JSON DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
      )
    `);

    // Recreate indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_room_media_room ON room_media(room_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_lightbox_room ON lightbox_sequences(room_id)');

    // Restore data
    if (legacyVariables.length > 0) {
      const insertVar = db.prepare('INSERT INTO legacy_variables (id, room_id, name, type, value) VALUES (?, ?, ?, ?, ?)');
      for (const row of legacyVariables) {
        insertVar.run(row.id, row.room_id, row.name, row.type, row.value);
      }
    }

    if (legacyTimers.length > 0) {
      const insertTimer = db.prepare('INSERT INTO legacy_timers (id, room_id, name, duration, remaining, active) VALUES (?, ?, ?, ?, ?, ?)');
      for (const row of legacyTimers) {
        insertTimer.run(row.id, row.room_id, row.name, row.duration, row.remaining, row.active);
      }
    }

    if (legacyHints.length > 0) {
      const insertHint = db.prepare('INSERT INTO legacy_hints (id, room_id, message, status, created_at) VALUES (?, ?, ?, ?, ?)');
      for (const row of legacyHints) {
        insertHint.run(row.id, row.room_id, row.message, row.status, row.created_at);
      }
    }

    if (roomMedia.length > 0) {
      const insertMedia = db.prepare('INSERT INTO room_media (id, room_id, type, title, url, thumbnail_url, metadata, order_index, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const row of roomMedia) {
        insertMedia.run(row.id, row.room_id, row.type, row.title, row.url, row.thumbnail_url, row.metadata, row.order_index, row.created_at);
      }
    }

    if (lightboxSequences.length > 0) {
      const insertSequence = db.prepare('INSERT INTO lightbox_sequences (id, room_id, name, items, settings, created_at) VALUES (?, ?, ?, ?, ?, ?)');
      for (const row of lightboxSequences) {
        insertSequence.run(row.id, row.room_id, row.name, row.items, row.settings, row.created_at);
      }
    }

    // Commit transaction
    db.exec('COMMIT');
    console.log('Migration completed successfully');

  } catch (error) {
    // Rollback on error
    db.exec('ROLLBACK');
    console.error('Migration failed, rolling back:', error);
    throw error;
  }
}

module.exports = { migrate };