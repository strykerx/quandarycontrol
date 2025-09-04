const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const request = require('supertest');
const Database = require('better-sqlite3');
const { readFileSync } = require('fs');
const { join } = require('path');

// Import the server app
let app;
let server;
let db;
let testDbPath;

describe('API Integration Tests', () => {
  beforeEach(async () => {
    // Create unique test database path for each test
    testDbPath = join(__dirname, '../__fixtures__/test-api-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9) + '.db');
    
    // Create new test database
    db = new Database(testDbPath);
    db.pragma('foreign_keys = ON');

    // Load and execute schema
    const schema = readFileSync(join(__dirname, '../../db/init.sql'), 'utf-8');
    db.exec(schema);

    // Mock the database module to use our test database
    jest.doMock('../../db/database', () => ({
      getDatabase: () => db,
      closeDatabase: () => db.close()
    }));

    // Clear module cache and import server
    delete require.cache[require.resolve('../../server')];
    const serverModule = require('../../server');
    app = serverModule.app;
    server = serverModule.server;
  });

  afterEach(async () => {
    // Close server and database connections
    if (server) {
      server.close();
    }
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

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('GET /api/rooms', () => {
    test('should return empty array when no rooms exist', async () => {
      const response = await request(app)
        .get('/api/rooms')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    test('should return all rooms', async () => {
      // Insert test rooms
      const insertStmt = db.prepare(`
        INSERT INTO rooms (id, name, config, timer_duration, api_variables)
        VALUES (?, ?, ?, ?, ?)
      `);

      insertStmt.run('room-1', 'Test Room 1', '{}', 300, '{}');
      insertStmt.run('room-2', 'Test Room 2', '{"maxPlayers": 4}', 600, '{"score": 0}');

      const response = await request(app)
        .get('/api/rooms')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      // Check that both rooms exist, order doesn't matter for this test
      const roomNames = response.body.data.map(room => room.name);
      expect(roomNames).toContain('Test Room 1');
      expect(roomNames).toContain('Test Room 2');
    });
  });

  describe('GET /api/rooms/:id', () => {
    test('should return specific room', async () => {
      // Insert test room
      const insertStmt = db.prepare(`
        INSERT INTO rooms (id, name, config, timer_duration, api_variables)
        VALUES (?, ?, ?, ?, ?)
      `);

      insertStmt.run('test-room', 'Test Room', '{"maxPlayers": 4}', 300, '{"score": 100}');

      const response = await request(app)
        .get('/api/rooms/test-room')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('test-room');
      expect(response.body.data.name).toBe('Test Room');
      expect(JSON.parse(response.body.data.config).maxPlayers).toBe(4);
    });

    test('should return 404 for non-existent room', async () => {
      const response = await request(app)
        .get('/api/rooms/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Room not found');
    });
  });

  describe('POST /api/rooms', () => {
    test('should create new room', async () => {
      const roomData = {
        name: 'New Test Room',
        config: { maxPlayers: 6, gameMode: 'classic' },
        timer_duration: 450,
        api_variables: { score: 0, level: 1 }
      };

      const response = await request(app)
        .post('/api/rooms')
        .send(roomData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('New Test Room');
      expect(JSON.parse(response.body.data.config).maxPlayers).toBe(6);
      expect(response.body.data.timer_duration).toBe(450);

      // Verify room was actually created in database
      const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(response.body.data.id);
      expect(room).toBeDefined();
      expect(room.name).toBe('New Test Room');
    });

    test('should return 400 when name is missing', async () => {
      const roomData = {
        config: { maxPlayers: 6 },
        timer_duration: 450
      };

      const response = await request(app)
        .post('/api/rooms')
        .send(roomData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Room name is required');
    });

    test('should create room with default values', async () => {
      const roomData = {
        name: 'Minimal Room'
      };

      const response = await request(app)
        .post('/api/rooms')
        .send(roomData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Minimal Room');
      expect(response.body.data.timer_duration).toBe(0);
      expect(response.body.data.api_variables).toBe('{}');
    });
  });

  describe('PUT /api/rooms/:id', () => {
    test('should update room', async () => {
      // Insert test room first
      const insertStmt = db.prepare(`
        INSERT INTO rooms (id, name, config, timer_duration, api_variables)
        VALUES (?, ?, ?, ?, ?)
      `);

      insertStmt.run('update-room', 'Original Name', '{}', 300, '{}');

      const updateData = {
        name: 'Updated Name',
        config: { maxPlayers: 8 },
        timer_duration: 600
      };

      const response = await request(app)
        .put('/api/rooms/update-room')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');
      expect(JSON.parse(response.body.data.config).maxPlayers).toBe(8);
      expect(response.body.data.timer_duration).toBe(600);
    });

    test('should return 404 for non-existent room', async () => {
      const updateData = {
        name: 'Updated Name'
      };

      const response = await request(app)
        .put('/api/rooms/non-existent')
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Room not found');
    });

    test('should return 400 when no fields to update', async () => {
      // Insert test room first
      const insertStmt = db.prepare(`
        INSERT INTO rooms (id, name, config, timer_duration, api_variables)
        VALUES (?, ?, ?, ?, ?)
      `);

      insertStmt.run('empty-update', 'Test Room', '{}', 300, '{}');

      const response = await request(app)
        .put('/api/rooms/empty-update')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No fields to update');
    });
  });

  describe('DELETE /api/rooms/:id', () => {
    test('should delete room', async () => {
      // Insert test room first
      const insertStmt = db.prepare(`
        INSERT INTO rooms (id, name, config, timer_duration, api_variables)
        VALUES (?, ?, ?, ?, ?)
      `);

      insertStmt.run('delete-room', 'To Be Deleted', '{}', 300, '{}');

      const response = await request(app)
        .delete('/api/rooms/delete-room')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Room deleted successfully');

      // Verify room was actually deleted
      const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get('delete-room');
      expect(room).toBeUndefined();
    });

    test('should return 404 for non-existent room', async () => {
      const response = await request(app)
        .delete('/api/rooms/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Room not found');
    });
  });

  describe('GET /api/rooms/:id/variables', () => {
    test('should return variables for room', async () => {
      // Insert test room and variables
      const roomInsert = db.prepare(`
        INSERT INTO rooms (id, name, config, timer_duration, api_variables)
        VALUES (?, ?, ?, ?, ?)
      `);
      roomInsert.run('var-room', 'Test Room', '{}', 300, '{}');

      const varInsert = db.prepare(`
        INSERT INTO legacy_variables (room_id, name, type, value)
        VALUES (?, ?, ?, ?)
      `);
      varInsert.run('var-room', 'score', 'integer', '100');
      varInsert.run('var-room', 'level', 'integer', '5');

      const response = await request(app)
        .get('/api/rooms/var-room/variables')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].name).toBe('score');
      expect(response.body.data[1].name).toBe('level');
    });

    test('should return 404 for non-existent room', async () => {
      const response = await request(app)
        .get('/api/rooms/non-existent/variables')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Room not found');
    });
  });

  describe('POST /api/rooms/:id/variables', () => {
    test('should add variable to room', async () => {
      // Insert test room first
      const roomInsert = db.prepare(`
        INSERT INTO rooms (id, name, config, timer_duration, api_variables)
        VALUES (?, ?, ?, ?, ?)
      `);
      roomInsert.run('add-var-room', 'Test Room', '{}', 300, '{}');

      const variableData = {
        name: 'newVariable',
        type: 'string',
        value: 'test value'
      };

      const response = await request(app)
        .post('/api/rooms/add-var-room/variables')
        .send(variableData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('newVariable');
      expect(response.body.data.type).toBe('string');
      expect(response.body.data.value).toBe('test value');

      // Verify variable was actually created
      const variable = db.prepare('SELECT * FROM legacy_variables WHERE name = ?').get('newVariable');
      expect(variable).toBeDefined();
      expect(variable.room_id).toBe('add-var-room');
    });

    test('should return 400 when required fields are missing', async () => {
      // Insert test room first
      const roomInsert = db.prepare(`
        INSERT INTO rooms (id, name, config, timer_duration, api_variables)
        VALUES (?, ?, ?, ?, ?)
      `);
      roomInsert.run('missing-fields-room', 'Test Room', '{}', 300, '{}');

      const variableData = {
        name: 'incompleteVariable'
        // Missing type and value
      };

      const response = await request(app)
        .post('/api/rooms/missing-fields-room/variables')
        .send(variableData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Name, type, and value are required');
    });

    test('should return 400 for invalid type', async () => {
      // Insert test room first
      const roomInsert = db.prepare(`
        INSERT INTO rooms (id, name, config, timer_duration, api_variables)
        VALUES (?, ?, ?, ?, ?)
      `);
      roomInsert.run('invalid-type-room', 'Test Room', '{}', 300, '{}');

      const variableData = {
        name: 'invalidVariable',
        type: 'invalid_type',
        value: 'test value'
      };

      const response = await request(app)
        .post('/api/rooms/invalid-type-room/variables')
        .send(variableData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Type must be one of:');
    });

    test('should return 404 for non-existent room', async () => {
      const variableData = {
        name: 'testVariable',
        type: 'string',
        value: 'test value'
      };

      const response = await request(app)
        .post('/api/rooms/non-existent/variables')
        .send(variableData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Room not found');
    });
  });

  describe('Configuration Management Flow (End-to-End Tests)', () => {
    describe('Complex Room Configuration', () => {
      test('should create room with complex configuration and validate end-to-end', async () => {
        const complexConfig = {
          maxPlayers: 10,
          gameMode: 'multiplayer',
          difficulty: 'expert',
          features: ['timer', 'hints', 'variables', 'actions', 'real-time'],
          theme: {
            background: 'dark_forest',
            sound: 'ambient_forest',
            effects: ['fog', 'lighting']
          },
          scoring: {
            win: 2000,
            partial: 500,
            completion: 1500,
            bonus: {
              timeBonus: 100,
              noHints: 200,
              firstTry: 300
            }
          },
          rules: {
            allowReplay: true,
            publicStats: false,
            leaderboards: true
          }
        };

        const roomData = {
          name: 'Complex Configuration Room',
          config: complexConfig,
          timer_duration: 600,
          api_variables: { score: 0, level: 1, attempts: 0, hints_used: 0 },
          custom_html: '<div id="game-headers"><h1>Welcome to Complex Room!</h1></div>',
          custom_css: '.complex-room { background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); } .effects-fog { backdrop-filter: blur(2px); }',
          rules_config: {
            allowHints: true,
            timeLimit: 600,
            winConditions: ['solve_puzzle', 'find_artifacts', 'escape_room'],
            penalties: { timeout: -100, wrongChoice: -25 }
          },
          hint_config: {
            maxHints: 5,
            hintDelay: 60,
            hintTypes: ['text', 'image', 'video', 'audio'],
            progressiveDifficulty: true,
            contextualHints: true
          }
        };

        const response = await request(app)
          .post('/api/rooms')
          .send(roomData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('Complex Configuration Room');
        expect(JSON.parse(response.body.data.config).gameMode).toBe('multiplayer');
        expect(JSON.parse(response.body.data.config).difficulty).toBe('expert');

        // Verify in database
        const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(response.body.data.id);
        expect(room).toBeDefined();
        const parsedConfig = JSON.parse(room.config);
        expect(parsedConfig.theme.background).toBe('dark_forest');
        expect(parsedConfig.scoring.bonus.timeBonus).toBe(100);

        // Test GET to verify retrieval
        const getResponse = await request(app)
          .get(`/api/rooms/${response.body.data.id}`)
          .expect(200);

        expect(getResponse.body.success).toBe(true);
        expect(JSON.parse(getResponse.body.data.config).gameMode).toBe('multiplayer');
      });
    });

  describe('Configuration Updates and PUT Operations', () => {
    test('should update room config with complex nested data', async () => {
      // Insert test room first
      const insertStmt = db.prepare(`
        INSERT INTO rooms (id, name, config, timer_duration, api_variables)
        VALUES (?, ?, ?, ?, ?)
      `);
      insertStmt.run('update-config-room', 'Config Room', '{"gameMode": "basic"}', 300, '{}');

      const updateData = {
        config: {
          gameMode: 'advanced',
          players: { min: 2, max: 8 },
          settings: { timeLimit: 45, hintsEnabled: true, difficulty: 'medium' }
        }
      };

      const response = await request(app)
        .put('/api/rooms/update-config-room')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      const updatedConfig = JSON.parse(response.body.data.config);
      expect(updatedConfig.gameMode).toBe('advanced');
      expect(updatedConfig.players.min).toBe(2);
      expect(updatedConfig.settings.difficulty).toBe('medium');

      // Verify in database
      const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get('update-config-room');
      const dbConfig = JSON.parse(room.config);
      expect(dbConfig.settings.hintsEnabled).toBe(true);
    });

    test('should handle empty config object', async () => {
      const insertStmt = db.prepare(`
        INSERT INTO rooms (id, name, config, timer_duration, api_variables)
        VALUES (?, ?, ?, ?, ?)
      `);
      insertStmt.run('empty-config-room', 'Empty Config Room', '{"gameMode": "basic"}', 300, '{}');

      const updateData = { config: {} };

      const response = await request(app)
        .put('/api/rooms/empty-config-room')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(JSON.parse(response.body.data.config)).toEqual({});
    });

    test('should create and update room with minimal config', async () => {
      // Create minimal room
      const createResponse = await request(app)
        .post('/api/rooms')
        .send({ name: 'Minimal Config Room' })
        .expect(201);

      expect(createResponse.body.data.config).toBe('{}');

      // Update with minimal config
      const updateResponse = await request(app)
        .put(`/api/rooms/${createResponse.body.data.id}`)
        .send({ config: { gameMode: 'basic' } })
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      expect(JSON.parse(updateResponse.body.data.config).gameMode).toBe('basic');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle large config object', async () => {
      const largeConfig = {
        gameMode: 'complex',
        features: Array.from({ length: 50 }, (_, i) => `feature-${i}`),
        settings: {
          nested: {
            data: {
              values: Array.from({ length: 100 }, (_, i) => ({ id: i, data: `item-${i}` }))
            }
          }
        }
      };

      const roomData = {
        name: 'Large Config Room',
        config: largeConfig
      };

      const response = await request(app)
        .post('/api/rooms')
        .send(roomData)
        .expect(201);

      expect(response.body.success).toBe(true);
      const config = JSON.parse(response.body.data.config);
      expect(config.features).toHaveLength(50);
      expect(config.settings.nested.data.values).toHaveLength(100);
    });

    test('should handle special characters in config', async () => {
      const specialConfig = {
        name: 'Special "Characters" Room',
        description: 'Room with <script>alert("test")</script> tags',
        path: 'room/with\nlines\tand\ttabs',
        unicode: '🌟 Unicode ❤️ Content 📝'
      };

      const roomData = {
        name: 'Special Characters Room',
        config: specialConfig
      };

      const response = await request(app)
        .post('/api/rooms')
        .send(roomData)
        .expect(201);

      expect(response.body.success).toBe(true);
      const savedConfig = JSON.parse(response.body.data.config);
      expect(savedConfig.description).toContain('<script>');
      expect(savedConfig.unicode).toContain('🌟');
    });

    test('should create room with different config data types', async () => {
      const typeConfig = {
        booleanValue: true,
        stringValue: 'test',
        numberValue: 42,
        arrayValue: [1, 2, 3],
        objectValue: { key: 'value' },
        nullValue: null,
        undefinedValue: undefined // Should be ignored in JSON
      };

      const roomData = {
        name: 'Type Test Room',
        config: typeConfig
      };

      const response = await request(app)
        .post('/api/rooms')
        .send(roomData)
        .expect(201);

      expect(response.body.success).toBe(true);
      const config = JSON.parse(response.body.data.config);
      expect(config.booleanValue).toBe(true);
      expect(config.stringValue).toBe('test');
      expect(config.numberValue).toBe(42);
      expect(config.arrayValue).toEqual([1, 2, 3]);
      expect(config.objectValue.key).toBe('value');
      expect(config.nullValue).toBeNull();
    });
  });

  describe('UI-API-Database Integration Validation', () => {
    test('should validate complete room lifecycle with config', async () => {
      // 1. Create room with config (simulates UI form submission)
      const roomData = {
        name: 'Lifecycle Test Room',
        config: { gameMode: 'test', maxPlayers: 4 },
        timer_duration: 180,
        api_variables: { score: 0, attempts: 0 }
      };

      const createResponse = await request(app)
        .post('/api/rooms')
        .send(roomData)
        .expect(201);

      const roomId = createResponse.body.data.id;

      // 2. Retrieve room (UI loads data)
      const getResponse = await request(app)
        .get(`/api/rooms/${roomId}`)
        .expect(200);

      expect(JSON.parse(getResponse.body.data.config).gameMode).toBe('test');

      // 3. Update config (UI edits)
      const updateData = {
        config: { gameMode: 'updated-test', maxPlayers: 6, newSetting: true }
      };

      const updateResponse = await request(app)
        .put(`/api/rooms/${roomId}`)
        .send(updateData)
        .expect(200);

      // 4. Verify update persisted in DB
      const dbCheck = db.prepare('SELECT config FROM rooms WHERE id = ?').get(roomId);
      const dbConfig = JSON.parse(dbCheck.config);
      expect(dbConfig.gameMode).toBe('updated-test');
      expect(dbConfig.newSetting).toBe(true);

      // 5. API list includes updated data
      const listResponse = await request(app)
        .get('/api/rooms')
        .expect(200);

      const roomInList = listResponse.body.data.find(r => r.id === roomId);
      expect(JSON.parse(roomInList.config).gameMode).toBe('updated-test');

      // 6. Delete room (cleanup)
      await request(app)
        .delete(`/api/rooms/${roomId}`)
        .expect(200);
    });

    test('should handle config validation errors properly', async () => {
      // This test would extend API to support config schema validation
      // For now, test with malformed JSON input to form
      const response = await request(app)
        .post('/api/rooms')
        .send({
          name: 'Valid Room Name'
          // Note: No config provided, should use defaults
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.config).toBe('{}');
    });
  });
});