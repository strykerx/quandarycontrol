# Comprehensive Test Suite and Debugging Setup

## Overview

This project now includes a comprehensive test suite and debugging setup covering:

- ✅ **Unit Testing**: Database layer, utilities, and core functions
- ✅ **Integration Testing**: API routes and WebSocket functionality
- ✅ **End-to-End Testing**: (Ready for implementation)
- ✅ **Test Utilities**: Database fixtures, WebSocket helpers, test factories
- ✅ **Debugging**: VS Code launch configurations, logging utilities
- ✅ **CI/CD Integration**: Automated test scripts and coverage reporting

## Quick Start

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit       # Unit tests only
npm run test:integration  # Integration tests only
npm run test:db         # Database tests only

# Run tests in watch mode
npm run test:watch

# Debug tests
npm run test:debug
```

## Test Structure

```
tests/
├── setup.js                 # Global test setup/teardown
├── __fixtures__/           # Test data fixtures
│   └── sampleData.js      # Sample test data
├── utils/                  # Test utilities
│   ├── database.js        # Database test helpers
│   └── websocket.js       # WebSocket test helpers
├── unit/                   # Unit tests
│   └── database.test.js   # Database layer unit tests
├── integration/            # Integration tests
│   ├── api.test.js        # API endpoint tests
│   └── websocket.test.js  # WebSocket functionality tests
└── e2e/                    # End-to-end tests
    └── (ready for implementation)
```

## Database Testing

**Unit Tests**: `tests/unit/database.test.js`
- Database initialization testing
- CRUD operations on all tables
- Foreign key constraints validation
- SQLite error handling

**Test Utilities**: `tests/utils/database.js`
- TestDatabase class for isolated testing
- Automatic schema setup and teardown
- Test data fixtures and factories
- Database cleanup utilities

## API Integration Testing

**Location**: `tests/integration/api.test.js`

**Covered Endpoints**:
- GET `/api/rooms` - List all rooms
- GET `/api/rooms/:id` - Get room by ID
- POST `/api/rooms` - Create new room
- PUT `/api/rooms/:id` - Update room
- DELETE `/api/rooms/:id` - Delete room
- GET `/api/rooms/:id/variables` - Get room variables
- POST `/api/rooms/:id/variables` - Add room variable

**Features Tested**:
- Successful operations
- Error handling (400, 404 responses)
- Data validation
- Foreign key constraints

## WebSocket Testing

**Location**: `tests/integration/websocket.test.js`

**Test Utilities**: `tests/utils/websocket.js`
- WebSocketTestHelper class for Socket.io testing
- Client connection management
- Event emission and reception helpers
- Automatic server setup/teardown

**Tested Functionality**:
- Connection management
- Room joining/leaving
- Real-time variable updates
- Timer synchronization
- Hint system
- Error handling

## Debugging Setup

### VS Code Configuration

**Location**: `.vscode/launch.json`

**Available Configurations**:
- `Debug Server` - Debug the main server
- `Debug Tests` - Debug all tests
- `Debug Specific Test` - Debug currently open test file
- `Attach to Process` - Attach debugger to running process

### Logging Utilities

**Location**: `utils/logger.js`

**Features**:
- Multiple log levels (error, warn, info, debug)
- Colored console output
- File logging with rotation
- Contextual logging with child loggers
- HTTP request logging middleware
- Configurable log levels and destinations

## Test Configuration

**Location**: `jest.config.js`

**Key Settings**:
- Test environment: Node.js
- Coverage reporting: Text, LCOV, HTML
- Timeout: 10 seconds
- Setup files after environment
- Babel transformation for ES modules

## Implementation Summary

### ✅ Completed Features

1. **Testing Framework**: Jest with Supertest, jsdom support
2. **Database Testing**: Complete CRUD operations, constraints testing
3. **API Testing**: Full REST API endpoint coverage
4. **WebSocket Testing**: Real-time functionality testing setup
5. **Debugging**: VS Code launch configurations, logging utilities
6. **Test Data**: Fixtures and factories for consistent testing
7. **CI/CD Integration**: Multiple test scripts for different environments

### 📝 Ready for Implementation

1. **E2E Testing**: Full browser-based end-to-end test suite
2. **Performance Testing**: Load testing and performance benchmarking
3. **Security Testing**: API security and input validation tests

## Running All Tests

```bash
# Run complete test suite with coverage
npm run test:ci

# Output includes:
# - Test results (PASS/FAIL)
# - Code coverage report
# - Performance metrics
```

## Coverage Goals

Current test coverage targets:
- **Database Layer**: 90%+ coverage
- **API Routes**: 95%+ coverage (including error cases)
- **WebSocket Logic**: 85%+ coverage
- **Utilities**: 80%+ coverage

## Contributing to Tests

When adding new code, ensure:
1. **Unit tests** for new functions/utilities
2. **Integration tests** for new API endpoints
3. **WebSocket tests** for real-time features
4. **Documentation** updates for test structure
5. **Coverage** maintenance above thresholds

## Troubleshooting

**Common Issues**:
- WebSocket tests failing: Check Node.js version compatibility
- Database tests hanging: Ensure proper cleanup in betweenEach blocks
- Coverage reports missing: Run `npm run test:coverage` explicitly

**Debugging Tests**:
- Use `npm run test:debug` to debug individual tests
- Set breakpoints in VS Code for visual debugging
- Check logs in `logs/app.log` for detailed error information

---

This comprehensive test suite ensures robust, maintainable code with excellent debugging capabilities for the Quandary Control application.