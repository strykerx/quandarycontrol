const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const { testDatabase, setupTestDatabase, teardownTestDatabase, clearTestDatabase } = require('../utils/database');
const { initializeDatabase, getDatabase, closeDatabase } = require('../../db/database');

describe('Database Layer', () => {
  let originalDb;

  beforeAll(async () => {
    // Store original database reference
    originalDb = getDatabase();
    
    // Setup test database once for all tests
    await setupTestDatabase();
  });

  afterAll(async () => {
    // Cleanup test database
    await teardownTestDatabase();
    
    // Restore original database if it existed
    if (originalDb) {
      // Reset the database module state
      delete require.cache[require.resolve('../../db/database')];
    }
  });

  beforeEach(() => {
    // Clear data before each test but keep schema
    clearTestDatabase();
  });

  describe('Database Initialization', () => {
    test('should initialize database successfully', () => {
      const db = testDatabase.getTestDatabase();
      expect(db).toBeDefined();
      expect(db.constructor.name).toBe('Database');
    });

    test('should enable foreign keys', () => {
      const db = testDatabase.getTestDatabase();
      const result = db.pragma('foreign_keys', { simple: true });
      expect(result).toBe(1);
    });

    test('should create all required tables', () => {
      const db = testDatabase.getTestDatabase();
      
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      const tableNames = tables.map(t => t.name);
      
      expect(tableNames).toContain('rooms');
      expect(tableNames).toContain('legacy_variables');
      expect(tableNames).toContain('legacy_timers');
      expect(tableNames).toContain('legacy_hints');
      expect(tableNames).toContain('legacy_events');
    });
  });

  describe('Database Operations', () => {
    test('should insert and retrieve room data', () => {
      const db = testDatabase.getTestDatabase();
      
      // Insert a new room
      const insertStmt = db.prepare(`
        INSERT INTO rooms (id, name, config, timer_duration, api_variables)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      const roomId = 'test-room-new';
      insertStmt.run(
        roomId,
        'New Test Room',
        JSON.stringify({ maxPlayers: 8 }),
        600,
        JSON.stringify({ score: 0 })
      );
      
      // Retrieve the room
      const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
      
      expect(room).toBeDefined();
      expect(room.id).toBe(roomId);
      expect(room.name).toBe('New Test Room');
      expect(JSON.parse(room.config).maxPlayers).toBe(8);
      expect(room.timer_duration).toBe(600);
    });

    test('should update room data', () => {
      const db = testDatabase.getTestDatabase();
      
      // Update existing room
      const updateStmt = db.prepare(`
        UPDATE rooms 
        SET name = ?, timer_duration = ?
        WHERE id = ?
      `);
      
      const result = updateStmt.run('Updated Test Room', 900, 'test-room-1');
      expect(result.changes).toBe(1);
      
      // Verify update
      const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get('test-room-1');
      expect(room.name).toBe('Updated Test Room');
      expect(room.timer_duration).toBe(900);
    });

    test('should delete room data', () => {
      const db = testDatabase.getTestDatabase();
      
      // Delete room
      const deleteStmt = db.prepare('DELETE FROM rooms WHERE id = ?');
      const result = deleteStmt.run('test-room-1');
      expect(result.changes).toBe(1);
      
      // Verify deletion
      const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get('test-room-1');
      expect(room).toBeUndefined();
    });
  });

  describe('Legacy Variables Operations', () => {
    test('should insert and retrieve variable data', () => {
      const db = testDatabase.getTestDatabase();
      
      // Insert a new variable
      const insertStmt = db.prepare(`
        INSERT INTO legacy_variables (room_id, name, type, value)
        VALUES (?, ?, ?, ?)
      `);
      
      const result = insertStmt.run('test-room-1', 'newVar', 'string', 'test value');
      expect(result.changes).toBe(1);
      
      // Retrieve the variable
      const variable = db.prepare('SELECT * FROM legacy_variables WHERE name = ?').get('newVar');
      
      expect(variable).toBeDefined();
      expect(variable.name).toBe('newVar');
      expect(variable.type).toBe('string');
      expect(variable.value).toBe('test value');
    });

    test('should enforce type constraints on variables', () => {
      const db = testDatabase.getTestDatabase();
      
      // Try to insert variable with invalid type
      const insertStmt = db.prepare(`
        INSERT INTO legacy_variables (room_id, name, type, value)
        VALUES (?, ?, ?, ?)
      `);
      
      expect(() => {
        insertStmt.run('test-room-1', 'invalidVar', 'invalid_type', 'test value');
      }).toThrow();
    });
  });

  describe('Legacy Timers Operations', () => {
    test('should insert and retrieve timer data', () => {
      const db = testDatabase.getTestDatabase();
      
      // Insert a new timer
      const insertStmt = db.prepare(`
        INSERT INTO legacy_timers (room_id, name, duration, remaining, active)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      const result = insertStmt.run('test-room-1', 'newTimer', 120, 120, false);
      expect(result.changes).toBe(1);
      
      // Retrieve the timer
      const timer = db.prepare('SELECT * FROM legacy_timers WHERE name = ?').get('newTimer');
      
      expect(timer).toBeDefined();
      expect(timer.name).toBe('newTimer');
      expect(timer.duration).toBe(120);
      expect(timer.remaining).toBe(120);
      expect(timer.active).toBe(0); // SQLite stores boolean as 0/1
    });

    test('should update timer remaining time', () => {
      const db = testDatabase.getTestDatabase();
      
      // Update timer
      const updateStmt = db.prepare(`
        UPDATE legacy_timers 
        SET remaining = ?, active = ?
        WHERE name = ?
      `);
      
      const result = updateStmt.run(30, 1, 'mainTimer');
      expect(result.changes).toBe(1);
      
      // Verify update
      const timer = db.prepare('SELECT * FROM legacy_timers WHERE name = ?').get('mainTimer');
      expect(timer.remaining).toBe(30);
      expect(timer.active).toBe(1);
    });
  });

  describe('Legacy Hints Operations', () => {
    test('should insert and retrieve hint data', () => {
      const db = testDatabase.getTestDatabase();
      
      // Insert a new hint
      const insertStmt = db.prepare(`
        INSERT INTO legacy_hints (room_id, message, status)
        VALUES (?, ?, ?)
      `);
      
      const result = insertStmt.run('test-room-1', 'New hint message', 'pending');
      expect(result.changes).toBe(1);
      
      // Retrieve the hint
      const hint = db.prepare('SELECT * FROM legacy_hints WHERE message = ?').get('New hint message');
      
      expect(hint).toBeDefined();
      expect(hint.room_id).toBe('test-room-1');
      expect(hint.message).toBe('New hint message');
      expect(hint.status).toBe('pending');
    });

    test('should enforce status constraints on hints', () => {
      const db = testDatabase.getTestDatabase();
      
      // Try to insert hint with invalid status
      const insertStmt = db.prepare(`
        INSERT INTO legacy_hints (room_id, message, status)
        VALUES (?, ?, ?)
      `);
      
      expect(() => {
        insertStmt.run('test-room-1', 'Invalid hint', 'invalid_status');
      }).toThrow();
    });
  });

  describe('Database Error Handling', () => {
    test('should handle invalid SQL gracefully', () => {
      const db = testDatabase.getTestDatabase();
      
      expect(() => {
        db.exec('INVALID SQL STATEMENT');
      }).toThrow();
    });

    test('should handle missing database file', () => {
      // This test verifies that the database module handles missing files gracefully
      expect(() => {
        const Database = require('better-sqlite3');
        new Database('/nonexistent/path/database.db');
      }).toThrow();
    });
  });

  describe('Database Connection Management', () => {
    test('should close database connection successfully', () => {
      const db = testDatabase.getTestDatabase();
      
      expect(() => {
        db.close();
      }).not.toThrow();
    });

    test('should handle operations on closed database', () => {
      const db = testDatabase.getTestDatabase();
      db.close();
      
      expect(() => {
        db.prepare('SELECT * FROM rooms').all();
      }).toThrow();
    });
  });
});