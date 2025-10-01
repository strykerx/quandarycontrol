#!/usr/bin/env node

/**
 * Quandary Control Webhook & API Testing Utility
 *
 * A standalone testing app to verify webhooks, API endpoints, variables, and triggers
 * for the Quandary Control escape room system.
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io-client');
const chalk = require('chalk');
const readline = require('readline');
const path = require('path');

class QuandaryTester {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.port = 3001; // Different from main app
        this.baseUrl = 'http://localhost:3000'; // Main Quandary app
        this.socket = null;
        this.webhookReceived = [];
        this.currentRoomId = null;

        this.setupWebhookReceiver();
        this.setupConsoleInterface();
    }

    setupWebhookReceiver() {
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, 'webhook-tester-public')));

        // Webhook endpoint to receive notifications
        this.app.post('/webhook', (req, res) => {
            const timestamp = new Date().toISOString();
            const payload = {
                timestamp,
                headers: req.headers,
                body: req.body,
                method: req.method,
                url: req.url
            };

            this.webhookReceived.push(payload);

            console.log(chalk.green('\n📥 Webhook Received:'));
            console.log(chalk.cyan('Time:'), timestamp);
            console.log(chalk.cyan('Headers:'), JSON.stringify(req.headers, null, 2));
            console.log(chalk.cyan('Body:'), JSON.stringify(req.body, null, 2));

            res.json({ success: true, received: timestamp });
        });

        // GET endpoint for testing
        this.app.get('/webhook', (req, res) => {
            const timestamp = new Date().toISOString();
            const payload = {
                timestamp,
                headers: req.headers,
                query: req.query,
                method: req.method,
                url: req.url
            };

            this.webhookReceived.push(payload);

            console.log(chalk.green('\n📥 GET Webhook Received:'));
            console.log(chalk.cyan('Time:'), timestamp);
            console.log(chalk.cyan('Query:'), JSON.stringify(req.query, null, 2));

            res.json({ success: true, received: timestamp });
        });

        // Dashboard to view received webhooks
        this.app.get('/', (req, res) => {
            res.send(this.generateDashboard());
        });

        // API to get received webhooks
        this.app.get('/api/received', (req, res) => {
            res.json({ received: this.webhookReceived });
        });

        // Clear received webhooks
        this.app.post('/api/clear', (req, res) => {
            this.webhookReceived = [];
            res.json({ success: true, message: 'Cleared received webhooks' });
        });
    }

    generateDashboard() {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>Quandary Webhook Tester</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .webhook { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
        .timestamp { color: #666; font-size: 0.9em; }
        pre { background: #f5f5f5; padding: 10px; border-radius: 3px; overflow-x: auto; }
        button { background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
        .empty { text-align: center; color: #666; font-style: italic; padding: 40px; }
    </style>
</head>
<body>
    <h1>🧪 Quandary Webhook Tester</h1>
    <p>Listening for webhooks on <code>http://localhost:${this.port}/webhook</code></p>

    <button onclick="refresh()">Refresh</button>
    <button onclick="clear()">Clear All</button>

    <div id="webhooks">
        ${this.webhookReceived.length === 0 ?
            '<div class="empty">No webhooks received yet. Send a test webhook to see it here!</div>' :
            this.webhookReceived.map((webhook, index) => `
                <div class="webhook">
                    <div class="timestamp">#${index + 1} - ${webhook.timestamp}</div>
                    <strong>${webhook.method} ${webhook.url}</strong>
                    ${webhook.body ? `<pre>${JSON.stringify(webhook.body, null, 2)}</pre>` : ''}
                    ${webhook.query ? `<pre>Query: ${JSON.stringify(webhook.query, null, 2)}</pre>` : ''}
                </div>
            `).reverse().join('')
        }
    </div>

    <script>
        function refresh() { location.reload(); }
        function clear() {
            fetch('/api/clear', { method: 'POST' })
                .then(() => location.reload());
        }

        // Auto-refresh every 5 seconds
        setInterval(refresh, 5000);
    </script>
</body>
</html>`;
    }

    setupConsoleInterface() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async start() {
        await this.startWebhookServer();
        this.showMainMenu();
    }

    startWebhookServer() {
        return new Promise((resolve) => {
            this.server.listen(this.port, () => {
                console.log(chalk.blue('\n🚀 Quandary Webhook Tester Started'));
                console.log(chalk.green(`📡 Webhook receiver: http://localhost:${this.port}/webhook`));
                console.log(chalk.green(`🌐 Dashboard: http://localhost:${this.port}/`));
                console.log(chalk.yellow(`🎯 Testing against: ${this.baseUrl}`));
                resolve();
            });
        });
    }

    connectWebSocket(roomId) {
        if (this.socket) {
            this.socket.disconnect();
        }

        console.log(chalk.blue(`\n🔌 Connecting to WebSocket for room ${roomId}...`));

        this.socket = socketIo(this.baseUrl);

        this.socket.on('connect', () => {
            console.log(chalk.green('✅ WebSocket connected'));
            this.socket.emit('join_room', roomId, 'test_client');
        });

        this.socket.on('disconnect', () => {
            console.log(chalk.red('❌ WebSocket disconnected'));
        });

        // Listen for variable updates
        this.socket.on('variable_updated', (data) => {
            console.log(chalk.magenta('\n📡 Variable Update Received:'));
            console.log(JSON.stringify(data, null, 2));
        });

        // Listen for trigger actions
        this.socket.on('play_sound', (data) => {
            console.log(chalk.magenta('\n🔊 Play Sound Trigger:'));
            console.log(JSON.stringify(data, null, 2));
        });

        this.socket.on('show_message', (data) => {
            console.log(chalk.magenta('\n💬 Show Message Trigger:'));
            console.log(JSON.stringify(data, null, 2));
        });

        this.socket.on('show_lightbox', (data) => {
            console.log(chalk.magenta('\n🖼️ Show Media Trigger:'));
            console.log(JSON.stringify(data, null, 2));
        });

        this.socket.on('hintReceived', (data) => {
            console.log(chalk.magenta('\n💡 Hint Received:'));
            console.log(JSON.stringify(data, null, 2));
        });
    }

    showMainMenu() {
        console.log(chalk.blue('\n' + '='.repeat(50)));
        console.log(chalk.white.bold('🧪 QUANDARY TESTING MENU'));
        console.log(chalk.blue('='.repeat(50)));
        console.log('1. Set Room ID');
        console.log('2. Test Variable API Endpoints');
        console.log('3. Connect WebSocket & Test Triggers');
        console.log('4. View API Documentation Examples');
        console.log('5. Send Test Webhook');
        console.log('6. View Received Webhooks');
        console.log('7. Load Test Variables & Triggers');
        console.log('8. Exit');
        console.log(chalk.blue('='.repeat(50)));

        if (this.currentRoomId) {
            console.log(chalk.green(`Current Room ID: ${this.currentRoomId}`));
        } else {
            console.log(chalk.yellow('⚠️  No room ID set - set one first!'));
        }

        this.rl.question('\nSelect option (1-8): ', (answer) => {
            this.handleMenuChoice(answer.trim());
        });
    }

    async handleMenuChoice(choice) {
        switch (choice) {
            case '1':
                await this.setRoomId();
                break;
            case '2':
                await this.testVariableAPI();
                break;
            case '3':
                await this.testWebSocketTriggers();
                break;
            case '4':
                this.showAPIDocumentation();
                break;
            case '5':
                await this.sendTestWebhook();
                break;
            case '6':
                this.viewReceivedWebhooks();
                break;
            case '7':
                await this.loadTestData();
                break;
            case '8':
                this.exit();
                return;
            default:
                console.log(chalk.red('Invalid choice. Please select 1-8.'));
        }

        setTimeout(() => this.showMainMenu(), 1000);
    }

    async setRoomId() {
        return new Promise((resolve) => {
            this.rl.question('Enter Room ID: ', (roomId) => {
                this.currentRoomId = roomId.trim();
                console.log(chalk.green(`✅ Room ID set to: ${this.currentRoomId}`));
                resolve();
            });
        });
    }

    async testVariableAPI() {
        if (!this.currentRoomId) {
            console.log(chalk.red('❌ Please set Room ID first!'));
            return;
        }

        console.log(chalk.blue(`\n🧪 Variable Manager for Room ${this.currentRoomId}`));

        try {
            // Load current variables
            console.log(chalk.yellow('\n📋 Loading current variables...'));
            const getResponse = await fetch(`${this.baseUrl}/api/rooms/${this.currentRoomId}/variables`);
            const getResult = await getResponse.json();

            if (!getResult.success || !getResult.data) {
                console.log(chalk.red('❌ Failed to load variables:'), getResult.error || 'Unknown error');
                return;
            }

            const variables = getResult.data;

            if (variables.length === 0) {
                console.log(chalk.yellow('No variables found. You can create some using option 7 (Load Test Data) first.'));
                return;
            }

            // Display variables
            console.log(chalk.blue('\n📊 Current Variables:'));
            variables.forEach((variable, index) => {
                // Use parsed_value if available, otherwise fall back to value
                const displayValue = variable.parsed_value !== undefined ? variable.parsed_value : variable.value;
                const actualType = typeof displayValue;
                console.log(`${index + 1}. ${chalk.cyan(variable.name)} (${variable.type}/${actualType}): ${chalk.white(JSON.stringify(displayValue))}`);
            });

            // Let user choose variable to modify
            const choice = await this.promptUser(`\nSelect variable to modify (1-${variables.length}) or 0 to cancel: `);
            const varIndex = parseInt(choice) - 1;

            if (choice === '0') {
                console.log(chalk.yellow('Operation cancelled.'));
                return;
            }

            if (isNaN(varIndex) || varIndex < 0 || varIndex >= variables.length) {
                console.log(chalk.red('Invalid selection.'));
                return;
            }

            const selectedVar = variables[varIndex];
            const currentValue = selectedVar.parsed_value !== undefined ? selectedVar.parsed_value : selectedVar.value;
            const actualType = typeof currentValue;

            console.log(chalk.blue(`\n🎯 Selected: ${selectedVar.name} (stored as: ${selectedVar.type}, actual: ${actualType})`));
            console.log(chalk.cyan(`Current value: ${JSON.stringify(currentValue)}`));

            // Get new value based on actual type, not stored type
            let newValue;
            switch (actualType) {
                case 'boolean':
                    const boolChoice = await this.promptUser('Enter new value (true/false): ');
                    newValue = boolChoice.toLowerCase() === 'true';
                    break;
                case 'number':
                    const intValue = await this.promptUser('Enter new number value: ');
                    newValue = parseFloat(intValue);
                    if (isNaN(newValue)) {
                        console.log(chalk.red('Invalid number value.'));
                        return;
                    }
                    break;
                case 'string':
                    newValue = await this.promptUser('Enter new string value: ');
                    break;
                default:
                    newValue = await this.promptUser('Enter new value: ');
            }

            // Determine the correct type to send to API
            let apiType;
            if (typeof newValue === 'boolean') {
                apiType = 'boolean';
            } else if (typeof newValue === 'number') {
                apiType = Number.isInteger(newValue) ? 'integer' : 'number';
            } else {
                apiType = 'string';
            }

            // Update the variable
            console.log(chalk.yellow(`\n🔄 Updating ${selectedVar.name} to ${JSON.stringify(newValue)} (type: ${apiType})...`));
            const updateResponse = await fetch(`${this.baseUrl}/api/rooms/${this.currentRoomId}/variables/${selectedVar.name}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: newValue, type: apiType })
            });

            const updateResult = await updateResponse.json();

            if (updateResult.success) {
                console.log(chalk.green(`✅ Successfully updated ${selectedVar.name}`));
                console.log(chalk.cyan('API Response:'), JSON.stringify(updateResult, null, 2));
            } else {
                console.log(chalk.red('❌ Update failed:'), updateResult.error);
            }

        } catch (error) {
            console.log(chalk.red('❌ API Error:'), error.message);
        }
    }

    async promptUser(question) {
        return new Promise((resolve) => {
            this.rl.question(question, (answer) => {
                resolve(answer.trim());
            });
        });
    }

    async testWebSocketTriggers() {
        if (!this.currentRoomId) {
            console.log(chalk.red('❌ Please set Room ID first!'));
            return;
        }

        console.log(chalk.blue(`\n🔌 Testing WebSocket & Triggers for Room ${this.currentRoomId}`));

        this.connectWebSocket(this.currentRoomId);

        // Wait a bit for connection, then test variable updates
        setTimeout(async () => {
            console.log(chalk.yellow('\n🧪 Sending test variable updates to trigger actions...'));

            const testVariables = [
                { name: 'door_open', value: true, type: 'boolean' },
                { name: 'puzzle_solved', value: true, type: 'boolean' },
                { name: 'timer_remaining', value: 300, type: 'integer' },
                { name: 'player_count', value: 4, type: 'integer' }
            ];

            for (const variable of testVariables) {
                console.log(chalk.cyan(`\n📤 Setting ${variable.name} = ${variable.value}`));

                try {
                    const response = await fetch(`${this.baseUrl}/api/rooms/${this.currentRoomId}/variables/${variable.name}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ value: variable.value, type: variable.type })
                    });

                    const result = await response.json();
                    console.log('API Response:', JSON.stringify(result, null, 2));
                } catch (error) {
                    console.log(chalk.red('❌ Error updating variable:'), error.message);
                }

                // Wait between updates to see results
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }, 2000);
    }

    showAPIDocumentation() {
        const roomId = this.currentRoomId || '{roomId}';

        console.log(chalk.blue('\n📚 API DOCUMENTATION & EXAMPLES'));
        console.log(chalk.blue('='.repeat(50)));

        console.log(chalk.white.bold('\n1. GET Variables'));
        console.log(chalk.cyan(`GET ${this.baseUrl}/api/rooms/${roomId}/variables`));
        console.log('Returns all variables for the room');

        console.log(chalk.white.bold('\n2. Create Variable'));
        console.log(chalk.cyan(`POST ${this.baseUrl}/api/rooms/${roomId}/variables`));
        console.log('Body: { "name": "door_open", "type": "boolean", "value": false }');

        console.log(chalk.white.bold('\n3. Update Variable (Triggers Events)'));
        console.log(chalk.cyan(`POST ${this.baseUrl}/api/rooms/${roomId}/variables/{variableName}`));
        console.log('Body: { "value": true, "type": "boolean" }');

        console.log(chalk.white.bold('\n4. Curl Examples:'));
        console.log(chalk.green(`# Get all variables
curl "${this.baseUrl}/api/rooms/${roomId}/variables"

# Create a variable
curl -X POST "${this.baseUrl}/api/rooms/${roomId}/variables" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "door_open", "type": "boolean", "value": false}'

# Update variable (triggers actions)
curl -X POST "${this.baseUrl}/api/rooms/${roomId}/variables/door_open" \\
  -H "Content-Type: application/json" \\
  -d '{"value": true, "type": "boolean"}'`));

        console.log(chalk.white.bold('\n5. Webhook URL for triggers:'));
        console.log(chalk.green(`http://localhost:${this.port}/webhook`));
    }

    async sendTestWebhook() {
        console.log(chalk.blue('\n📤 Sending test webhook to ourselves...'));

        try {
            const testPayload = {
                timestamp: new Date().toISOString(),
                event: 'test_webhook',
                room_id: this.currentRoomId,
                variable: 'test_var',
                value: 'test_value',
                message: 'This is a test webhook from the tester utility'
            };

            const response = await fetch(`http://localhost:${this.port}/webhook`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testPayload)
            });

            const result = await response.json();
            console.log(chalk.green('✅ Test webhook sent successfully'));
            console.log('Response:', JSON.stringify(result, null, 2));
        } catch (error) {
            console.log(chalk.red('❌ Error sending test webhook:'), error.message);
        }
    }

    viewReceivedWebhooks() {
        console.log(chalk.blue('\n📥 RECEIVED WEBHOOKS'));
        console.log(chalk.blue('='.repeat(50)));

        if (this.webhookReceived.length === 0) {
            console.log(chalk.yellow('No webhooks received yet.'));
            return;
        }

        this.webhookReceived.forEach((webhook, index) => {
            console.log(chalk.white.bold(`\n${index + 1}. ${webhook.method} ${webhook.url}`));
            console.log(chalk.cyan('Time:'), webhook.timestamp);
            if (webhook.body) {
                console.log(chalk.cyan('Body:'), JSON.stringify(webhook.body, null, 2));
            }
            if (webhook.query) {
                console.log(chalk.cyan('Query:'), JSON.stringify(webhook.query, null, 2));
            }
        });
    }

    async loadTestData() {
        if (!this.currentRoomId) {
            console.log(chalk.red('❌ Please set Room ID first!'));
            return;
        }

        console.log(chalk.blue(`\n🎭 Loading test variables and triggers for Room ${this.currentRoomId}`));

        const testVariables = [
            { name: 'door_open', type: 'boolean', value: false },
            { name: 'puzzle_solved', type: 'boolean', value: false },
            { name: 'timer_remaining', type: 'integer', value: 3600 },
            { name: 'player_count', type: 'integer', value: 1 },
            { name: 'game_state', type: 'string', value: 'waiting' }
        ];

        const testTriggers = [
            {
                name: 'Door Opens',
                variable: 'door_open',
                condition: 'equals',
                value: 'true',
                actions: [
                    { type: 'show_message', text: 'The door has opened!', duration: 5 },
                    { type: 'play_sound', file: 'door_open.mp3', volume: 70 }
                ]
            },
            {
                name: 'Puzzle Solved',
                variable: 'puzzle_solved',
                condition: 'equals',
                value: 'true',
                actions: [
                    { type: 'show_message', text: 'Congratulations! Puzzle solved!', duration: 10 },
                    { type: 'send_hint', message: 'Great work! Move to the next challenge.' }
                ]
            },
            {
                name: 'Timer Warning',
                variable: 'timer_remaining',
                condition: 'less_than',
                value: '300',
                actions: [
                    { type: 'show_message', text: 'Warning: 5 minutes remaining!', duration: 5 },
                    { type: 'play_sound', file: 'warning.mp3', volume: 80 }
                ]
            }
        ];

        try {
            // Create test variables
            console.log(chalk.yellow('\n📝 Creating test variables...'));
            for (const variable of testVariables) {
                const response = await fetch(`${this.baseUrl}/api/rooms/${this.currentRoomId}/variables`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(variable)
                });
                const result = await response.json();
                console.log(`✅ Created ${variable.name}:`, result.success ? 'Success' : result.error);
            }

            // Note: For triggers, you would typically need to update the room config
            // This would require additional API endpoints or direct database access
            console.log(chalk.yellow('\n⚙️ Test triggers (would need to be configured via admin interface):'));
            testTriggers.forEach((trigger, index) => {
                console.log(`${index + 1}. ${trigger.name}: When ${trigger.variable} ${trigger.condition} ${trigger.value}`);
                console.log(`   Actions: ${trigger.actions.map(a => a.type).join(', ')}`);
            });

            console.log(chalk.green('\n✅ Test data loaded! You can now test the API endpoints.'));

        } catch (error) {
            console.log(chalk.red('❌ Error loading test data:'), error.message);
        }
    }

    exit() {
        console.log(chalk.blue('\n👋 Goodbye! Shutting down webhook tester...'));

        if (this.socket) {
            this.socket.disconnect();
        }

        this.server.close(() => {
            console.log(chalk.green('✅ Server stopped'));
            process.exit(0);
        });
    }
}

// Start the tester
if (require.main === module) {
    const tester = new QuandaryTester();
    tester.start().catch(console.error);
}

module.exports = QuandaryTester;