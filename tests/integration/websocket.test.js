const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const { webSocketTestHelper, setupWebSocketTest, teardownWebSocketTest, createTestRoom } = require('../utils/websocket');

describe('WebSocket Integration Tests', () => {
  let helper;
  let server;
  let io;
  let port;

  beforeEach(async () => {
    helper = await setupWebSocketTest();
    server = helper.server;
    io = helper.io;
    port = helper.serverPort;

    // Set up basic server event handlers for testing
    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // Handle room joining
      socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        socket.emit('roomJoined', { roomId, success: true });
        io.to(roomId).emit('userJoined', { userId: socket.id, roomId });
      });

      // Handle room leaving
      socket.on('leaveRoom', (roomId) => {
        socket.leave(roomId);
        socket.emit('roomLeft', { roomId, success: true });
        io.to(roomId).emit('userLeft', { userId: socket.id, roomId });
      });

      // Handle timer updates
      socket.on('timerUpdate', (data) => {
        io.to(data.roomId).emit('timerUpdated', data);
      });

      // Handle variable updates
      socket.on('variableUpdate', (data) => {
        io.to(data.roomId).emit('variableUpdated', data);
      });

      // Handle hint requests
      socket.on('requestHint', (data) => {
        const hint = {
          id: Date.now(),
          message: `Hint for ${data.roomId}: Look for clues!`,
          timestamp: new Date().toISOString()
        };
        socket.emit('hintReceived', hint);
      });

      // Handle initial state requests
      socket.on('requestInitialState', () => {
        const initialState = {
          timer: { remaining: 300, active: false },
          variables: { score: 0, level: 1 },
          room: createTestRoom('test-room')
        };
        socket.emit('initialState', initialState);
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  });

  afterEach(async () => {
    await teardownWebSocketTest();
  });

  describe('Connection Management', () => {
    test('should establish connection successfully', async () => {
      const client = await helper.createTestClient();
      
      expect(client.connected).toBe(true);
      expect(helper.getConnectedClientsCount()).toBe(1);
    });

    test('should handle multiple client connections', async () => {
      const clients = await helper.createTestClients(3);
      
      expect(clients).toHaveLength(3);
      expect(helper.getConnectedClientsCount()).toBe(3);
      
      clients.forEach(client => {
        expect(client.connected).toBe(true);
      });
    });

    test('should handle client disconnection', async () => {
      const client = await helper.createTestClient();
      
      expect(helper.getConnectedClientsCount()).toBe(1);
      
      client.disconnect();
      
      // Wait a bit for disconnection to process
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(client.connected).toBe(false);
      expect(helper.getConnectedClientsCount()).toBe(0);
    });
  });

  describe('Room Management', () => {
    test('should join room successfully', async () => {
      const client = await helper.createTestClient();
      const roomId = 'test-room-1';
      
      const response = await helper.emitAndWait(
        client,
        'joinRoom',
        { roomId },
        'roomJoined'
      );
      
      expect(response.success).toBe(true);
      expect(response.roomId).toBe(roomId);
    });

    test('should broadcast user joined event to room', async () => {
      const client1 = await helper.createTestClient();
      const client2 = await helper.createTestClient();
      const roomId = 'test-room-broadcast';
      
      // Both clients join the room
      await helper.emitAndWait(client1, 'joinRoom', { roomId }, 'roomJoined');
      await helper.emitAndWait(client2, 'joinRoom', { roomId }, 'roomJoined');
      
      // Set up listener for userJoined event on client1
      const userJoinedPromise = helper.waitForEvent(client1, 'userJoined');
      
      // Client2 emits a userJoined event (simulated by joining again)
      client2.emit('joinRoom', { roomId });
      
      const userJoinedData = await userJoinedPromise;
      expect(userJoinedData.userId).toBe(client2.id);
      expect(userJoinedData.roomId).toBe(roomId);
    });

    test('should leave room successfully', async () => {
      const client = await helper.createTestClient();
      const roomId = 'test-room-leave';
      
      // Join room first
      await helper.emitAndWait(client, 'joinRoom', { roomId }, 'roomJoined');
      
      // Leave room
      const response = await helper.emitAndWait(
        client,
        'leaveRoom',
        { roomId },
        'roomLeft'
      );
      
      expect(response.success).toBe(true);
      expect(response.roomId).toBe(roomId);
    });

    test('should broadcast user left event to room', async () => {
      const client1 = await helper.createTestClient();
      const client2 = await helper.createTestClient();
      const roomId = 'test-room-left-broadcast';
      
      // Both clients join the room
      await helper.emitAndWait(client1, 'joinRoom', { roomId }, 'roomJoined');
      await helper.emitAndWait(client2, 'joinRoom', { roomId }, 'roomJoined');
      
      // Set up listener for userLeft event on client1
      const userLeftPromise = helper.waitForEvent(client1, 'userLeft');
      
      // Client2 leaves the room
      client2.emit('leaveRoom', { roomId });
      
      const userLeftData = await userLeftPromise;
      expect(userLeftData.userId).toBe(client2.id);
      expect(userLeftData.roomId).toBe(roomId);
    });
  });

  describe('Timer Functionality', () => {
    test('should update timer and broadcast to room', async () => {
      const client1 = await helper.createTestClient();
      const client2 = await helper.createTestClient();
      const roomId = 'test-room-timer';
      
      // Both clients join the room
      await helper.emitAndWait(client1, 'joinRoom', { roomId }, 'roomJoined');
      await helper.emitAndWait(client2, 'joinRoom', { roomId }, 'roomJoined');
      
      // Set up listener for timerUpdated event on client2
      const timerUpdatedPromise = helper.waitForEvent(client2, 'timerUpdated');
      
      // Client1 updates timer
      const timerData = {
        roomId,
        remaining: 150,
        active: true
      };
      
      client1.emit('timerUpdate', timerData);
      
      const timerUpdatedData = await timerUpdatedPromise;
      expect(timerUpdatedData.roomId).toBe(roomId);
      expect(timerUpdatedData.remaining).toBe(150);
      expect(timerUpdatedData.active).toBe(true);
    });

    test('should handle timer update from non-room member', async () => {
      const client1 = await helper.createTestClient();
      const client2 = await helper.createTestClient();
      const roomId = 'test-room-timer-isolated';
      
      // Only client1 joins the room
      await helper.emitAndWait(client1, 'joinRoom', { roomId }, 'roomJoined');
      
      // Set up listener for timerUpdated event on client1
      const timerUpdatedPromise = helper.waitForEvent(client1, 'timerUpdated', 1000);
      
      // Client2 (not in room) tries to update timer
      const timerData = {
        roomId,
        remaining: 100,
        active: false
      };
      
      client2.emit('timerUpdate', timerData);
      
      // Should not receive the event (timeout)
      await expect(timerUpdatedPromise).rejects.toThrow('timeout');
    });
  });

  describe('Variable Management', () => {
    test('should update variable and broadcast to room', async () => {
      const client1 = await helper.createTestClient();
      const client2 = await helper.createTestClient();
      const roomId = 'test-room-variable';
      
      // Both clients join the room
      await helper.emitAndWait(client1, 'joinRoom', { roomId }, 'roomJoined');
      await helper.emitAndWait(client2, 'joinRoom', { roomId }, 'roomJoined');
      
      // Set up listener for variableUpdated event on client2
      const variableUpdatedPromise = helper.waitForEvent(client2, 'variableUpdated');
      
      // Client1 updates variable
      const variableData = {
        roomId,
        name: 'score',
        value: 100,
        type: 'integer'
      };
      
      client1.emit('variableUpdate', variableData);
      
      const variableUpdatedData = await variableUpdatedPromise;
      expect(variableUpdatedData.roomId).toBe(roomId);
      expect(variableUpdatedData.name).toBe('score');
      expect(variableUpdatedData.value).toBe(100);
      expect(variableUpdatedData.type).toBe('integer');
    });

    test('should handle multiple variable updates', async () => {
      const client1 = await helper.createTestClient();
      const client2 = await helper.createTestClient();
      const roomId = 'test-room-multiple-vars';
      
      // Both clients join the room
      await helper.emitAndWait(client1, 'joinRoom', { roomId }, 'roomJoined');
      await helper.emitAndWait(client2, 'joinRoom', { roomId }, 'roomJoined');
      
      // Set up listeners for multiple variable updates
      const variableUpdatesPromise = helper.waitForEvents(client2, ['variableUpdated', 'variableUpdated'], 2000);
      
      // Client1 updates multiple variables
      const variableData1 = {
        roomId,
        name: 'score',
        value: 200,
        type: 'integer'
      };
      
      const variableData2 = {
        roomId,
        name: 'level',
        value: 3,
        type: 'integer'
      };
      
      client1.emit('variableUpdate', variableData1);
      client1.emit('variableUpdate', variableData2);
      
      const variableUpdates = await variableUpdatesPromise;
      expect(variableUpdates['variableUpdated']).toHaveLength(2);
      
      const scores = variableUpdates['variableUpdated'].filter(v => v.name === 'score');
      const levels = variableUpdates['variableUpdated'].filter(v => v.name === 'level');
      
      expect(scores).toHaveLength(1);
      expect(levels).toHaveLength(1);
      expect(scores[0].value).toBe(200);
      expect(levels[0].value).toBe(3);
    });
  });

  describe('Hint System', () => {
    test('should request and receive hint', async () => {
      const client = await helper.createTestClient();
      const roomId = 'test-room-hint';
      
      const hintPromise = helper.waitForEvent(client, 'hintReceived');
      
      client.emit('requestHint', { roomId });
      
      const hintData = await hintPromise;
      expect(hintData.id).toBeDefined();
      expect(hintData.message).toContain(roomId);
      expect(hintData.timestamp).toBeDefined();
    });

    test('should handle hint request without room ID', async () => {
      const client = await helper.createTestClient();
      
      const hintPromise = helper.waitForEvent(client, 'hintReceived');
      
      client.emit('requestHint', {});
      
      const hintData = await hintPromise;
      expect(hintData.id).toBeDefined();
      expect(hintData.message).toContain('undefined');
    });
  });

  describe('Initial State', () => {
    test('should request and receive initial state', async () => {
      const client = await helper.createTestClient();
      
      const initialStatePromise = helper.waitForEvent(client, 'initialState');
      
      client.emit('requestInitialState');
      
      const initialState = await initialStatePromise;
      expect(initialState.timer).toBeDefined();
      expect(initialState.timer.remaining).toBe(300);
      expect(initialState.variables).toBeDefined();
      expect(initialState.variables.score).toBe(0);
      expect(initialState.room).toBeDefined();
      expect(initialState.room.id).toBe('test-room');
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed events gracefully', async () => {
      const client = await helper.createTestClient();
      
      // Send malformed data - should not crash the server
      client.emit('malformedEvent', null);
      client.emit('malformedEvent', undefined);
      client.emit('malformedEvent');
      
      // Wait a bit to ensure no server crash
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Server should still be running and client connected
      expect(client.connected).toBe(true);
      expect(helper.getConnectedClientsCount()).toBe(1);
    });

    test('should handle events with large payloads', async () => {
      const client = await helper.createTestClient();
      
      // Create large payload
      const largePayload = {
        data: 'x'.repeat(1000000) // 1MB of data
      };
      
      // Send large payload - should handle gracefully
      client.emit('largePayloadEvent', largePayload);
      
      // Wait a bit to ensure no server crash
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Server should still be running and client connected
      expect(client.connected).toBe(true);
      expect(helper.getConnectedClientsCount()).toBe(1);
    });
  });

  describe('Performance Tests', () => {
    test('should handle high frequency events', async () => {
      const client = await helper.createTestClient();
      const roomId = 'test-room-performance';
      
      await helper.emitAndWait(client, 'joinRoom', { roomId }, 'roomJoined');
      
      const eventCount = 100;
      const receivedEvents = [];
      
      // Set up listener for variable updates
      client.on('variableUpdated', (data) => {
        receivedEvents.push(data);
      });
      
      // Send high frequency events
      for (let i = 0; i < eventCount; i++) {
        client.emit('variableUpdate', {
          roomId,
          name: 'counter',
          value: i,
          type: 'integer'
        });
      }
      
      // Wait for all events to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Should have received all events
      expect(receivedEvents.length).toBe(eventCount);
      
      // Verify events are in order
      receivedEvents.forEach((event, index) => {
        expect(event.value).toBe(index);
      });
    });
  });
});