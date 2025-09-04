const { Server } = require('socket.io');
const { createServer } = require('http');
const Client = require('socket.io-client');

/**
 * WebSocket test utilities for Socket.io testing
 */
class WebSocketTestHelper {
  constructor() {
    this.server = null;
    this.io = null;
    this.clientSockets = [];
    this.serverPort = 0; // Let OS choose available port
  }

  /**
   * Create a test Socket.io server
   * @param {Object} options - Socket.io server options
   * @returns {Promise<Object>} - Server and io instances
   */
  async createTestServer(options = {}) {
    return new Promise((resolve, reject) => {
      try {
        // Create HTTP server
        this.server = createServer();
        
        // Create Socket.io server with options
        this.io = new Server(this.server, {
          cors: {
            origin: "*",
            methods: ["GET", "POST"]
          },
          ...options
        });

        // Start server
        this.server.listen(0, () => {
          this.serverPort = this.server.address().port;
          console.log(`Test WebSocket server running on port ${this.serverPort}`);
          resolve({ server: this.server, io: this.io, port: this.serverPort });
        });

        this.server.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Create a test client connection
   * @param {Object} options - Client connection options
   * @returns {Promise<Object>} - Client socket instance
   */
  async createTestClient(options = {}) {
    return new Promise((resolve, reject) => {
      try {
        const clientUrl = `http://localhost:${this.serverPort}`;
        const clientSocket = Client(clientUrl, {
          timeout: 5000,
          forceNew: true,
          ...options
        });

        clientSocket.on('connect', () => {
          console.log('Test client connected');
          this.clientSockets.push(clientSocket);
          resolve(clientSocket);
        });

        clientSocket.on('connect_error', (error) => {
          console.error('Test client connection error:', error);
          reject(error);
        });

        // Set timeout for connection
        setTimeout(() => {
          if (!clientSocket.connected) {
            reject(new Error('Client connection timeout'));
          }
        }, 5000);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Create multiple test clients
   * @param {number} count - Number of clients to create
   * @param {Object} options - Client connection options
   * @returns {Promise<Array>} - Array of client socket instances
   */
  async createTestClients(count, options = {}) {
    const clients = [];
    for (let i = 0; i < count; i++) {
      const client = await this.createTestClient(options);
      clients.push(client);
    }
    return clients;
  }

  /**
   * Wait for an event to be emitted
   * @param {Object} emitter - Socket or server that emits events
   * @param {string} eventName - Name of the event to wait for
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<any>} - Event data
   */
  async waitForEvent(emitter, eventName, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Event '${eventName}' timeout after ${timeout}ms`));
      }, timeout);

      const handler = (data) => {
        clearTimeout(timer);
        emitter.removeListener(eventName, handler);
        resolve(data);
      };

      emitter.on(eventName, handler);
    });
  }

  /**
   * Wait for multiple events
   * @param {Object} emitter - Socket or server that emits events
   * @param {Array} eventNames - Array of event names to wait for
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Object>} - Object with event names as keys and event data as values
   */
  async waitForEvents(emitter, eventNames, timeout = 5000) {
    const promises = eventNames.map(eventName => 
      this.waitForEvent(emitter, eventName, timeout)
    );
    
    const results = await Promise.all(promises);
    const eventResults = {};
    
    eventNames.forEach((eventName, index) => {
      eventResults[eventName] = results[index];
    });
    
    return eventResults;
  }

  /**
   * Emit an event and wait for response
   * @param {Object} socket - Socket to emit from
   * @param {string} eventName - Event to emit
   * @param {any} data - Data to emit
   * @param {string} responseEvent - Event to wait for as response
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<any>} - Response data
   */
  async emitAndWait(socket, eventName, data, responseEvent, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Response event '${responseEvent}' timeout after ${timeout}ms`));
      }, timeout);

      const handler = (responseData) => {
        clearTimeout(timer);
        socket.removeListener(responseEvent, handler);
        resolve(responseData);
      };

      socket.on(responseEvent, handler);
      socket.emit(eventName, data);
    });
  }

  /**
   * Clean up all resources
   */
  async cleanup() {
    // Disconnect all client sockets
    for (const socket of this.clientSockets) {
      if (socket.connected) {
        socket.disconnect();
      }
    }
    this.clientSockets = [];

    // Close server
    if (this.io) {
      await new Promise((resolve) => {
        this.io.close(() => {
          console.log('Test WebSocket server closed');
          resolve();
        });
      });
    }

    if (this.server) {
      await new Promise((resolve) => {
        this.server.close(() => {
          console.log('Test HTTP server closed');
          resolve();
        });
      });
    }

    this.server = null;
    this.io = null;
    this.serverPort = 0;
  }

  /**
   * Get connected clients count
   * @returns {number} - Number of connected clients
   */
  getConnectedClientsCount() {
    if (!this.io) return 0;
    return this.io.sockets.sockets.size;
  }

  /**
   * Get all connected client sockets
   * @returns {Array} - Array of connected client sockets
   */
  getConnectedClients() {
    if (!this.io) return [];
    return Array.from(this.io.sockets.sockets.values());
  }
}

// Export singleton instance and helper functions
const webSocketTestHelper = new WebSocketTestHelper();

module.exports = {
  webSocketTestHelper,
  // Helper functions for common test patterns
  setupWebSocketTest: async (serverOptions = {}) => {
    await webSocketTestHelper.createTestServer(serverOptions);
    return webSocketTestHelper;
  },
  teardownWebSocketTest: async () => {
    await webSocketTestHelper.cleanup();
  },
  createTestRoom: (roomId = 'test-room', roomData = {}) => {
    return {
      id: roomId,
      name: roomData.name || 'Test Room',
      config: roomData.config || {},
      timer_duration: roomData.timer_duration || 300,
      api_variables: roomData.api_variables || {},
      ...roomData
    };
  },
  createTestVariable: (variableData = {}) => {
    return {
      name: variableData.name || 'testVariable',
      type: variableData.type || 'string',
      value: variableData.value || 'test value',
      ...variableData
    };
  }
};