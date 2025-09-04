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