const Database = require('better-sqlite3');
const { readFileSync } = require('fs');
const { join } = require('path');
const { getDatabase, closeDatabase } = require('../../db/database');

// Test database utilities
class TestDatabase {
  constructor() {
    this.testDbPath = join(__dirname, '../__fixtures__/test.db');
    this.db = null;
  }

  /**
   * Create a fresh test database
   */
  async createTestDatabase() {
    // Remove existing test database if it exists
    try {
      const fs = require('fs');
      if (fs.existsSync(this.testDbPath)) {
        // Try to close any existing connections first
        if (this.db) {
          this.db.close();
          this.db = null;
        }
        // Use a more aggressive cleanup approach
        const { execSync } = require('child_process');
        try {
          if (process.platform === 'win32') {
            execSync(`del /F "${this.testDbPath}"`, { stdio: 'ignore' });
          } else {
            execSync(`rm -f "${this.testDbPath}"`, { stdio: 'ignore' });
          }
        } catch (e) {
          // If command fails, try direct unlink
          fs.unlinkSync(this.testDbPath);
        }
      }
    } catch (error) {
      // File might not exist, continue
    }

    // Create new test database
    this.db = new Database(this.testDbPath);
    this.db.pragma('foreign_keys = ON');

    // Load and execute schema
    const schema = readFileSync(join(__dirname, '../../db/init.sql'), 'utf-8');
    this.db.exec(schema);

    console.log('Test database created successfully');
    return this.db;
  }

  /**
   * Get the test database instance
   */
  getTestDatabase() {
    if (!this.db) {
      throw new Error('Test database not initialized. Call createTestDatabase() first.');
    }
    return this.db;
  }

  /**
   * Clean up test database
   */
  async cleanup() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }

    // Remove test database file
    try {
      const fs = require('fs');
      if (fs.existsSync(this.testDbPath)) {
        fs.unlinkSync(this.testDbPath);
      }
    } catch (error) {
      console.error('Error cleaning up test database:', error);
    }
  }

  /**
   * Insert test data
   */
  insertTestData() {
    const db = this.getTestDatabase();
    
    // Insert sample room
    const roomInsert = db.prepare(`
      INSERT INTO rooms (id, name, config, timer_duration, api_variables, custom_html, custom_css, rules_config, hint_config)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    roomInsert.run(
      'test-room-1',
      'Test Room 1',
      JSON.stringify({ maxPlayers: 4, gameMode: 'classic' }),
      300,
      JSON.stringify({ score: 0, level: 1 }),
      '<div>Test HTML</div>',
      '.test { color: red; }',
      JSON.stringify({ allowHints: true, timeLimit: 300 }),
      JSON.stringify({ maxHints: 3, hintDelay: 30 })
    );

    // Insert sample legacy variables
    const variableInsert = db.prepare(`
      INSERT INTO legacy_variables (room_id, name, type, value)
      VALUES (?, ?, ?, ?)
    `);
    
    variableInsert.run('test-room-1', 'testVar1', 'integer', '42');
    variableInsert.run('test-room-1', 'testVar2', 'string', 'hello world');
    variableInsert.run('test-room-1', 'testVar3', 'boolean', 'true');

    // Insert sample legacy timers
    const timerInsert = db.prepare(`
      INSERT INTO legacy_timers (room_id, name, duration, remaining, active)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    timerInsert.run('test-room-1', 'mainTimer', 300, 300, 0);
    timerInsert.run('test-room-1', 'bonusTimer', 60, 60, 1);

    // Insert sample legacy hints
    const hintInsert = db.prepare(`
      INSERT INTO legacy_hints (room_id, message, status)
      VALUES (?, ?, ?)
    `);
    
    hintInsert.run('test-room-1', 'This is your first hint!', 'pending');
    hintInsert.run('test-room-1', 'Try looking for clues in the room.', 'sent');

    console.log('Test data inserted successfully');
  }

  /**
   * Clear all data from tables
   */
  clearAllData() {
    const db = this.getTestDatabase();
    
    const tables = [
      'legacy_events',
      'legacy_hints',
      'legacy_timers',
      'legacy_variables',
      'rooms'
    ];

    tables.forEach(table => {
      try {
        db.exec(`DELETE FROM ${table}`);
      } catch (error) {
        console.error(`Error clearing table ${table}:`, error);
      }
    });

    console.log('All test data cleared');
  }

  /**
   * Clear all data and re-insert test data
   */
  resetTestData() {
    this.clearAllData();
    this.insertTestData();
  }
}

// Export singleton instance
const testDatabase = new TestDatabase();

module.exports = {
  testDatabase,
  // Helper functions for common test operations
  setupTestDatabase: async () => {
    await testDatabase.createTestDatabase();
    testDatabase.insertTestData();
  },
  teardownTestDatabase: async () => {
    await testDatabase.cleanup();
  },
  clearTestDatabase: () => {
    testDatabase.resetTestData();
  }
};