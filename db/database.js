const Database = require('better-sqlite3');
const { readFileSync } = require('fs');
const { join } = require('path');

let db = null;

/**
 * Initialize the database connection and schema
 * @returns {Database} The database instance
 */
function initializeDatabase() {
  if (db) {
    return db; // Return existing instance if already initialized
  }

  try {
    // Initialize database connection
    db = new Database(join(__dirname, 'quandary.db'));
    
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    
    // Execute initialization SQL
    const schema = readFileSync(join(__dirname, 'init.sql'), 'utf-8');
    db.exec(schema);

    // Run database migrations
    runMigrations(db);

    console.log('Database schema initialized successfully');
    return db;
  } catch (err) {
    console.error('Error initializing database:', err);
    throw err;
  }
}

/**
 * Get the database instance, initializing if necessary
 * @returns {Database} The database instance
 */
function getDatabase() {
  if (!db) {
    return initializeDatabase();
  }
  return db;
}

/**
 * Run database migrations for schema updates
 * @param {Database} database - The database instance
 */
function runMigrations(database) {
  try {
    // Check if gm_customizations table has the new columns
    const tableInfo = database.prepare("PRAGMA table_info(gm_customizations)").all();
    const columnNames = tableInfo.map(col => col.name);

    // Add missing columns if they don't exist
    if (!columnNames.includes('secondary_color')) {
      console.log('Adding secondary_color column to gm_customizations');
      database.exec("ALTER TABLE gm_customizations ADD COLUMN secondary_color TEXT DEFAULT '#6c757d'");
    }

    if (!columnNames.includes('title_color')) {
      console.log('Adding title_color column to gm_customizations');
      database.exec("ALTER TABLE gm_customizations ADD COLUMN title_color TEXT DEFAULT '#ffffff'");
    }
  } catch (error) {
    // Table might not exist yet, which is fine
    console.log('Migration check completed (table may not exist yet)');
  }
}

/**
 * Close the database connection
 */
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('Database connection closed');
  }
}

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase
};