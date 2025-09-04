const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const Database = require('better-sqlite3');
const { readFileSync } = require('fs');
const { join } = require('path');

describe('Database Layer - Simple Tests', () => {
  let db;
  let testDbPath;

  beforeEach(() => {
    // Create unique test database path for each test
    testDbPath = join(__dirname, '../__fixtures__/test-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9) + '.db');
    
    // Create new test database
    db = new Database(testDbPath);
    db.pragma('foreign_keys = ON');

    // Load and execute schema
    const schema = readFileSync(join(__dirname, '../../db/init.sql'), 'utf-8');
    db.exec(schema);
  });

  afterEach(() => {
    // Close database connection
    if (db) {
      db.close();
    }

    // Clean up test database file
    try {
      const fs = require('fs');
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Database Initialization', () => {
    test('should initialize database successfully', () => {
      expect(db).toBeDefined();
      expect(db.constructor.name).toBe('Database');
    });

    test('should enable foreign keys', () => {
      const result = db.pragma('foreign_keys', { simple: true });
      expect(result).toBe(1);
    });

    test('should create all required tables', () => {
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
      // First insert a room
      const insertStmt = db.prepare(`
        INSERT INTO rooms (id, name, config, timer_duration, api_variables)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      insertStmt.run(
        'test-room-update',
        'Test Room Update',
        JSON.stringify({ maxPlayers: 4 }),
        300,
        JSON.stringify({ score: 0 })
      );

      // Update the room
      const updateStmt = db.prepare(`
        UPDATE rooms 
        SET name = ?, timer_duration = ?
        WHERE id = ?
      `);
      
      const result = updateStmt.run('Updated Test Room', 900, 'test-room-update');
      expect(result.changes).toBe(1);
      
      // Verify update
      const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get('test-room-update');
      expect(room.name).toBe('Updated Test Room');
      expect(room.timer_duration).toBe(900);
    });

    test('should delete room data', () => {
      // First insert a room
      const insertStmt = db.prepare(`
        INSERT INTO rooms (id, name, config, timer_duration, api_variables)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      insertStmt.run(
        'test-room-delete',
        'Test Room Delete',
        JSON.stringify({ maxPlayers: 4 }),
        300,
        JSON.stringify({ score: 0 })
      );

      // Delete the room
      const deleteStmt = db.prepare('DELETE FROM rooms WHERE id = ?');
      const result = deleteStmt.run('test-room-delete');
      expect(result.changes).toBe(1);
      
      // Verify deletion
      const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get('test-room-delete');
      expect(room).toBeUndefined();
    });
  });

  describe('Legacy Variables Operations', () => {
    test('should insert and retrieve variable data', () => {
      // First insert a room
      const roomInsert = db.prepare(`
        INSERT INTO rooms (id, name, config, timer_duration, api_variables)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      roomInsert.run('test-room-var', 'Test Room Variables', '{}', 300, '{}');

      // Insert a variable
      const insertStmt = db.prepare(`
        INSERT INTO legacy_variables (room_id, name, type, value)
        VALUES (?, ?, ?, ?)
      `);
      
      const result = insertStmt.run('test-room-var', 'testVar', 'string', 'test value');
      expect(result.changes).toBe(1);
      
      // Retrieve the variable
      const variable = db.prepare('SELECT * FROM legacy_variables WHERE name = ?').get('testVar');
      
      expect(variable).toBeDefined();
      expect(variable.name).toBe('testVar');
      expect(variable.type).toBe('string');
      expect(variable.value).toBe('test value');
    });

    test('should enforce type constraints on variables', () => {
      // First insert a room
      const roomInsert = db.prepare(`
        INSERT INTO rooms (id, name, config, timer_duration, api_variables)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      roomInsert.run('test-room-var-constraint', 'Test Room Variables Constraint', '{}', 300, '{}');

      // Try to insert variable with invalid type
      const insertStmt = db.prepare(`
        INSERT INTO legacy_variables (room_id, name, type, value)
        VALUES (?, ?, ?, ?)
      `);
      
      expect(() => {
        insertStmt.run('test-room-var-constraint', 'invalidVar', 'invalid_type', 'test value');
      }).toThrow();
    });
  });

  describe('Legacy Timers Operations', () => {
    test('should insert and retrieve timer data', () => {
      // First insert a room
      const roomInsert = db.prepare(`
        INSERT INTO rooms (id, name, config, timer_duration, api_variables)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      roomInsert.run('test-room-timer', 'Test Room Timers', '{}', 300, '{}');

      // Insert a timer
      const insertStmt = db.prepare(`
        INSERT INTO legacy_timers (room_id, name, duration, remaining, active)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      const result = insertStmt.run('test-room-timer', 'newTimer', 120, 120, 0);
      expect(result.changes).toBe(1);
      
      // Retrieve the timer
      const timer = db.prepare('SELECT * FROM legacy_timers WHERE name = ?').get('newTimer');
      
      expect(timer).toBeDefined();
      expect(timer.name).toBe('newTimer');
      expect(timer.duration).toBe(120);
      expect(timer.remaining).toBe(120);
      expect(timer.active).toBe(0);
    });

    test('should update timer remaining time', () => {
      // First insert a room and timer
      const roomInsert = db.prepare(`
        INSERT INTO rooms (id, name, config, timer_duration, api_variables)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      roomInsert.run('test-room-timer-update', 'Test Room Timers Update', '{}', 300, '{}');

      const timerInsert = db.prepare(`
        INSERT INTO legacy_timers (room_id, name, duration, remaining, active)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      timerInsert.run('test-room-timer-update', 'mainTimer', 300, 300, 0);

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
      // First insert a room
      const roomInsert = db.prepare(`
        INSERT INTO rooms (id, name, config, timer_duration, api_variables)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      roomInsert.run('test-room-hint', 'Test Room Hints', '{}', 300, '{}');

      // Insert a hint
      const insertStmt = db.prepare(`
        INSERT INTO legacy_hints (room_id, message, status)
        VALUES (?, ?, ?)
      `);
      
      const result = insertStmt.run('test-room-hint', 'New hint message', 'pending');
      expect(result.changes).toBe(1);
      
      // Retrieve the hint
      const hint = db.prepare('SELECT * FROM legacy_hints WHERE message = ?').get('New hint message');
      
      expect(hint).toBeDefined();
      expect(hint.room_id).toBe('test-room-hint');
      expect(hint.message).toBe('New hint message');
      expect(hint.status).toBe('pending');
    });

    test('should enforce status constraints on hints', () => {
      // First insert a room
      const roomInsert = db.prepare(`
        INSERT INTO rooms (id, name, config, timer_duration, api_variables)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      roomInsert.run('test-room-hint-constraint', 'Test Room Hints Constraint', '{}', 300, '{}');

      // Try to insert hint with invalid status
      const insertStmt = db.prepare(`
        INSERT INTO legacy_hints (room_id, message, status)
        VALUES (?, ?, ?)
      `);
      
      expect(() => {
        insertStmt.run('test-room-hint-constraint', 'Invalid hint', 'invalid_status');
      }).toThrow();
    });
  });

  describe('Database Error Handling', () => {
    test('should handle invalid SQL gracefully', () => {
      expect(() => {
        db.exec('INVALID SQL STATEMENT');
      }).toThrow();
    });

    test('should handle missing database file', () => {
      expect(() => {
        new Database('/nonexistent/path/database.db');
      }).toThrow();
    });
  });

  describe('Database Connection Management', () => {
    test('should close database connection successfully', () => {
      expect(() => {
        db.close();
      }).not.toThrow();
    });

    test('should handle operations on closed database', () => {
      db.close();
      
      expect(() => {
        db.prepare('SELECT * FROM rooms').all();
      }).toThrow();
    });
  });
});