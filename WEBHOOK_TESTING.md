# 🧪 Webhook & API Testing Utility

A comprehensive testing tool for the Quandary Control escape room system that helps you verify webhooks, API endpoints, variables, and trigger functionality.

## Features

- 📡 **Webhook Receiver**: Captures incoming webhooks with detailed logging
- 🌐 **Web Dashboard**: Real-time view of received webhooks
- 🔌 **WebSocket Testing**: Connect to room WebSockets and monitor trigger events
- 📊 **API Testing**: Test all variable-related API endpoints
- 🎭 **Test Data Loader**: Creates sample variables and triggers for testing
- 📚 **API Documentation**: Shows example requests and responses

## Quick Start

### 1. Install Dependencies
```bash
# Install the testing utility dependencies
npm install express socket.io-client chalk --save-dev
```

### 2. Start Your Main Quandary App
```bash
# In one terminal, start the main app
npm run dev
# or
node server.js
```

### 3. Start the Webhook Tester
```bash
# In another terminal, start the tester
node webhook-tester.js
```

### 4. Open the Dashboard
Visit `http://localhost:3001/` in your browser to see the webhook dashboard.

## How to Use

The tester provides an interactive menu with the following options:

### 1. Set Room ID
Set the room ID you want to test against. You can get this from your Quandary admin interface.

### 2. Test Variable API Endpoints
Automatically tests:
- `GET /api/rooms/:id/variables` - Retrieve all variables
- `POST /api/rooms/:id/variables` - Create new variables
- `POST /api/rooms/:roomId/variables/:varName` - Update variables (triggers events)

### 3. Connect WebSocket & Test Triggers
- Connects to the room's WebSocket
- Sends test variable updates
- Monitors for trigger events like:
  - `play_sound`
  - `show_message`
  - `show_lightbox`
  - `hintReceived`
  - `variable_updated`

### 4. View API Documentation
Shows example curl commands and API endpoints for your current room.

### 5. Send Test Webhook
Sends a test webhook to the local receiver to verify webhook functionality.

### 6. View Received Webhooks
Shows all webhooks received by the tester.

### 7. Load Test Variables & Triggers
Creates sample variables like:
- `door_open` (boolean)
- `puzzle_solved` (boolean)
- `timer_remaining` (integer)
- `player_count` (integer)
- `game_state` (string)

## Testing Workflow

### Basic Variable Testing
1. Start the tester: `node webhook-tester.js`
2. Set your room ID (option 1)
3. Load test data (option 7)
4. Test API endpoints (option 2)
5. Connect WebSocket and test triggers (option 3)

### Webhook Testing
1. Configure your Quandary triggers to send webhooks to `http://localhost:3001/webhook`
2. Update variables through the API or admin interface
3. Watch the webhook dashboard at `http://localhost:3001/`
4. Monitor the console for real-time webhook logs

### WebSocket Event Testing
1. Connect to WebSocket (option 3)
2. The tester will automatically send test variable updates
3. Watch console output for trigger events:
   ```
   📡 Variable Update Received:
   {
     "var": "door_open",
     "value": true,
     "timestamp": "2024-01-01T12:00:00.000Z"
   }

   🔊 Play Sound Trigger:
   {
     "file": "door_open.mp3",
     "volume": 70
   }
   ```

## API Endpoints Tested

### Variable Management
- **GET** `/api/rooms/{roomId}/variables` - Get all variables
- **POST** `/api/rooms/{roomId}/variables` - Create variable
- **POST** `/api/rooms/{roomId}/variables/{varName}` - Update variable (triggers events)

### Webhook Receiver
- **POST** `http://localhost:3001/webhook` - Receive webhook data
- **GET** `http://localhost:3001/webhook` - Receive GET webhooks
- **GET** `http://localhost:3001/` - View dashboard
- **GET** `http://localhost:3001/api/received` - Get received webhooks JSON
- **POST** `http://localhost:3001/api/clear` - Clear received webhooks

## WebSocket Events Monitored

- `variable_updated` - When variables change
- `play_sound` - Audio trigger actions
- `show_message` - Message display triggers
- `show_lightbox` - Media display triggers
- `hintReceived` - Hint system triggers

## Example Trigger Actions Tested

The utility tests these trigger action types:
- **play_sound**: Plays audio files
- **show_message**: Displays text messages
- **show_media**: Shows images/videos in lightbox
- **update_variable**: Changes other variables
- **send_hint**: Sends hints to players
- **send_webhook**: Calls external webhooks

## Troubleshooting

### Common Issues

**"Connection refused" errors:**
- Make sure the main Quandary app is running on port 3000
- Check that the room ID exists in your database

**No webhook events received:**
- Verify your triggers are configured correctly in the admin interface
- Check that trigger conditions match your test data
- Ensure WebSocket connection is established (look for ✅ WebSocket connected)

**Variable updates not triggering:**
- Confirm triggers exist in the room's config JSON
- Check the trigger conditions (equals, greater_than, etc.)
- Verify variable names match exactly

### Debug Tips

1. **Check the main app logs** - The Quandary server logs trigger execution
2. **Use the webhook dashboard** - Real-time view of all webhook traffic
3. **Monitor WebSocket events** - The tester shows all WebSocket traffic
4. **Verify room config** - Check admin interface for trigger configuration

## Integration with External Systems

The webhook tester can help you test integration with:
- **Arduino/Raspberry Pi** devices that call the variable API
- **RFID readers** that update door_open variables
- **Game props** that trigger puzzle_solved events
- **Timer systems** that update time remaining
- **External dashboards** that monitor game state

## Files Created

- `webhook-tester.js` - Main testing utility
- `package-webhook-tester.json` - Dependencies for the tester
- `WEBHOOK_TESTING.md` - This documentation

## Example Test Session

```bash
$ node webhook-tester.js

🚀 Quandary Webhook Tester Started
📡 Webhook receiver: http://localhost:3001/webhook
🌐 Dashboard: http://localhost:3001/
🎯 Testing against: http://localhost:3000

==================================================
🧪 QUANDARY TESTING MENU
==================================================
1. Set Room ID
2. Test Variable API Endpoints
3. Connect WebSocket & Test Triggers
4. View API Documentation Examples
5. Send Test Webhook
6. View Received Webhooks
7. Load Test Variables & Triggers
8. Exit
==================================================
⚠️  No room ID set - set one first!

Select option (1-8): 1
Enter Room ID: 123
✅ Room ID set to: 123

Select option (1-8): 7
🎭 Loading test variables and triggers for Room 123
📝 Creating test variables...
✅ Created door_open: Success
✅ Created puzzle_solved: Success
✅ Created timer_remaining: Success
✅ Created player_count: Success
✅ Created game_state: Success
✅ Test data loaded! You can now test the API endpoints.

Select option (1-8): 3
🔌 Testing WebSocket & Triggers for Room 123
🔌 Connecting to WebSocket for room 123...
✅ WebSocket connected
🧪 Sending test variable updates to trigger actions...

📤 Setting door_open = true
API Response: { "success": true, "data": { "door_open": true } }

📡 Variable Update Received:
{
  "var": "door_open",
  "value": true,
  "timestamp": "2024-01-01T12:00:00.000Z"
}

🔊 Play Sound Trigger:
{
  "file": "door_open.mp3",
  "volume": 70
}

💬 Show Message Trigger:
{
  "text": "The door has opened!",
  "duration": 5
}
```

This testing utility provides comprehensive verification of your Quandary Control system's API, WebSocket, and trigger functionality!