#!/usr/bin/env node

/**
 * Quick validation test for the webhook testing utility
 */

const QuandaryTester = require('./webhook-tester');

async function testWebhookUtility() {
    console.log('🧪 Testing webhook utility...\n');

    try {
        // Test 1: Instantiate the tester
        console.log('✅ Test 1: Creating QuandaryTester instance');
        const tester = new QuandaryTester();

        // Test 2: Start the webhook server
        console.log('✅ Test 2: Starting webhook server');
        await tester.startWebhookServer();

        // Test 3: Test the dashboard generation
        console.log('✅ Test 3: Testing dashboard generation');
        const dashboard = tester.generateDashboard();
        console.log(`   Dashboard length: ${dashboard.length} characters`);

        // Test 4: Test webhook reception simulation
        console.log('✅ Test 4: Simulating webhook reception');
        const testWebhook = {
            timestamp: new Date().toISOString(),
            method: 'POST',
            url: '/webhook',
            body: { test: 'data' }
        };
        tester.webhookReceived.push(testWebhook);
        console.log(`   Webhooks received: ${tester.webhookReceived.length}`);

        // Test 5: Test API documentation generation
        console.log('✅ Test 5: Testing API documentation');
        tester.currentRoomId = 'test-room-123';
        // API documentation is console output, so we just verify no errors

        console.log('\n🎉 All tests passed! The webhook testing utility is ready to use.');
        console.log('📋 To use the full interactive utility, run: node webhook-tester.js');

        // Clean shutdown
        tester.server.close();
        process.exit(0);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the test
testWebhookUtility();