/**
 * Component Integration Test Suite
 * Tests the integration between layout builder positions and player component classes
 * Verifies socket event routing to positioned elements
 */

class ComponentIntegrationTest {
    constructor() {
        this.testResults = [];
        this.currentTest = 0;
        this.totalTests = 0;
        this.integration = null;
        this.mockSocket = null;
        this.testContainer = null;
        
        this.init();
    }

    init() {
        // Wait for DOM to be ready and integration to be initialized
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeTests());
        } else {
            this.initializeTests();
        }
    }

    initializeTests() {
        // Wait for component integration to be ready
        if (window.componentIntegration) {
            this.integration = window.componentIntegration;
            this.runAllTests();
        } else {
            // Poll for integration to be ready
            const checkInterval = setInterval(() => {
                if (window.componentIntegration) {
                    this.integration = window.componentIntegration;
                    clearInterval(checkInterval);
                    this.runAllTests();
                }
            }, 100);
        }
    }

    runAllTests() {
        console.log('🧪 Starting Component Integration Tests...');
        
        // Create test UI
        this.createTestUI();
        
        // Setup mock socket for testing
        this.setupMockSocket();
        
        // Run test suites
        this.testComponentMapping();
        this.testSocketEventRouting();
        this.testLayoutApplication();
        this.testResponsiveBehavior();
        this.testTimerUpdateIntegration();
        this.testHintReceivedIntegration();
        
        // Display results
        this.displayTestResults();
        
        console.log('✅ Component Integration Tests Completed');
    }

    createTestUI() {
        // Create test container
        this.testContainer = document.createElement('div');
        this.testContainer.id = 'test-container';
        this.testContainer.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 300px;
            max-height: 400px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 1rem;
            border-radius: 8px;
            z-index: 10000;
            font-family: monospace;
            font-size: 12px;
            overflow-y: auto;
            border: 1px solid #667eea;
        `;
        
        document.body.appendChild(this.testContainer);
        
        // Add test header
        const header = document.createElement('div');
        header.innerHTML = '<h3 style="margin: 0 0 1rem 0; color: #667eea;">🧪 Integration Tests</h3>';
        this.testContainer.appendChild(header);
        
        // Add test results container
        this.resultsContainer = document.createElement('div');
        this.resultsContainer.id = 'test-results';
        this.testContainer.appendChild(this.resultsContainer);
    }

    setupMockSocket() {
        // Create mock socket for testing events
        this.mockSocket = {
            _events: {},
            on: function(event, callback) {
                if (!this._events[event]) {
                    this._events[event] = [];
                }
                this._events[event].push(callback);
            },
            emit: function(event, data) {
                if (this._events[event]) {
                    this._events[event].forEach(callback => {
                        try {
                            callback(data);
                        } catch (error) {
                            console.error(`Error in socket event ${event}:`, error);
                        }
                    });
                }
            }
        };
        
        // Replace the integration's socket with mock for testing
        if (this.integration) {
            this.integration.socket = this.mockSocket;
        }
    }

    testComponentMapping() {
        this.testSuite('Component Mapping');
        
        // Test 1: Components are mapped correctly
        this.test('Components mapped from layout config', () => {
            if (!this.integration) return false;
            
            const components = Array.from(this.integration.components.values());
            return components.length > 0 && 
                   components.every(comp => comp.id && comp.type && comp.element);
        });
        
        // Test 2: Component classes are assigned correctly
        this.test('Component classes assigned correctly', () => {
            if (!this.integration) return false;
            
            const timerComponent = this.integration.getComponentsByType('timer')[0];
            return timerComponent && 
                   timerComponent.class === 'TimerComponent' &&
                   timerComponent.element.classList.contains('positioned-component');
        });
        
        // Test 3: Component positions are set correctly
        this.test('Component positions set correctly', () => {
            if (!this.integration) return false;
            
            const components = Array.from(this.integration.components.values());
            return components.every(comp => 
                comp.position && 
                typeof comp.position.col === 'number' && 
                typeof comp.position.row === 'number'
            );
        });
    }

    testSocketEventRouting() {
        this.testSuite('Socket Event Routing');
        
        // Test 1: Socket events are connected
        this.test('Socket events connected', () => {
            if (!this.mockSocket) return false;
            
            const eventCount = Object.keys(this.mockSocket._events).length;
            return eventCount > 0;
        });
        
        // Test 2: Timer update event routing
        this.test('Timer update event routing', () => {
            if (!this.integration || !this.mockSocket) return false;
            
            let timerEventReceived = false;
            
            // Override handler to capture event
            const originalHandler = this.integration.routeSocketEventToComponents;
            this.integration.routeSocketEventToComponents = (event, data, handler) => {
                if (event === 'timer_update') {
                    timerEventReceived = true;
                }
                return originalHandler.call(this.integration, event, data, handler);
            };
            
            // Emit test event
            this.mockSocket.emit('timer_update', { remaining: 300 });
            
            // Restore original handler
            this.integration.routeSocketEventToComponents = originalHandler;
            
            return timerEventReceived;
        });
        
        // Test 3: Hint received event routing
        this.test('Hint received event routing', () => {
            if (!this.integration || !this.mockSocket) return false;
            
            let hintEventReceived = false;
            
            // Override handler to capture event
            const originalHandler = this.integration.routeSocketEventToComponents;
            this.integration.routeSocketEventToComponents = (event, data, handler) => {
                if (event === 'hintReceived') {
                    hintEventReceived = true;
                }
                return originalHandler.call(this.integration, event, data, handler);
            };
            
            // Emit test event
            this.mockSocket.emit('hintReceived', { message: 'Test hint' });
            
            // Restore original handler
            this.integration.routeSocketEventToComponents = originalHandler;
            
            return hintEventReceived;
        });
    }

    testLayoutApplication() {
        this.testSuite('Layout Application');
        
        // Test 1: Layout applied to container
        this.test('Layout applied to container', () => {
            if (!this.integration) return false;
            
            const container = document.getElementById('player-container');
            return container && 
                   container.style.display === 'grid' &&
                   container.style.gridTemplateColumns.includes('repeat');
        });
        
        // Test 2: Components positioned correctly
        this.test('Components positioned correctly', () => {
            if (!this.integration) return false;
            
            const components = Array.from(this.integration.components.values());
            return components.every(comp => 
                comp.element.style.gridColumn && 
                comp.element.style.gridRow
            );
        });
        
        // Test 3: Layout change handling
        this.test('Layout change handling', () => {
            if (!this.integration) return false;
            
            let layoutChanged = false;
            
            // Override handler to capture change
            const originalHandler = this.integration.handleLayoutChange;
            this.integration.handleLayoutChange = (newConfig) => {
                layoutChanged = true;
                return originalHandler.call(this.integration, newConfig);
            };
            
            // Trigger layout change
            const testConfig = {
                columns: 8,
                rows: 4,
                gap: 15,
                components: []
            };
            
            this.integration.handleLayoutChange(testConfig);
            
            // Restore original handler
            this.integration.handleLayoutChange = originalHandler;
            
            return layoutChanged;
        });
    }

    testResponsiveBehavior() {
        this.testSuite('Responsive Behavior');
        
        // Test 1: Mobile layout applied
        this.test('Mobile layout applied', () => {
            if (!this.integration) return false;
            
            // Simulate mobile width
            const originalInnerWidth = window.innerWidth;
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 600
            });
            
            // Trigger resize
            window.dispatchEvent(new Event('resize'));
            
            // Check if mobile layout was applied
            const container = document.getElementById('player-container');
            const isMobileLayout = container && container.style.gridTemplateColumns === '1fr';
            
            // Restore original width
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: originalInnerWidth
            });
            
            // Trigger resize again
            window.dispatchEvent(new Event('resize'));
            
            return isMobileLayout;
        });
        
        // Test 2: Desktop layout applied
        this.test('Desktop layout applied', () => {
            if (!this.integration) return false;
            
            // Simulate desktop width
            const originalInnerWidth = window.innerWidth;
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 1200
            });
            
            // Trigger resize
            window.dispatchEvent(new Event('resize'));
            
            // Check if desktop layout was applied
            const container = document.getElementById('player-container');
            const isDesktopLayout = container && 
                                   container.style.gridTemplateColumns.includes('repeat') &&
                                   !container.style.gridTemplateColumns.includes('1fr');
            
            // Restore original width
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: originalInnerWidth
            });
            
            // Trigger resize again
            window.dispatchEvent(new Event('resize'));
            
            return isDesktopLayout;
        });
    }

    testTimerUpdateIntegration() {
        this.testSuite('Timer Update Integration');
        
        // Test 1: Timer update event received and processed
        this.test('Timer update event processed', () => {
            if (!this.integration || !this.mockSocket) return false;
            
            let timerUpdated = false;
            let timerData = null;
            
            // Monitor timer display element
            const timerDisplay = document.getElementById('timer-display');
            if (timerDisplay) {
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'childList' || mutation.type === 'characterData') {
                            timerUpdated = true;
                        }
                    });
                });
                
                observer.observe(timerDisplay, { 
                    childList: true, 
                    characterData: true, 
                    subtree: true 
                });
                
                // Emit timer update event
                this.mockSocket.emit('timer_update', { remaining: 300 });
                
                // Check if timer was updated
                setTimeout(() => {
                    timerData = timerDisplay.textContent;
                    observer.disconnect();
                }, 100);
            }
            
            return timerUpdated && timerData === '05:00';
        });
        
        // Test 2: Timer component animation triggered
        this.test('Timer component animation triggered', () => {
            if (!this.integration) return false;
            
            let animationTriggered = false;
            
            // Monitor timer section for animation
            const timerSection = document.getElementById('timer-section');
            if (timerSection) {
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                            const style = timerSection.style.animation;
                            if (style && style.includes('timer-update')) {
                                animationTriggered = true;
                            }
                        }
                    });
                });
                
                observer.observe(timerSection, { 
                    attributes: true, 
                    attributeFilter: ['style'] 
                });
                
                // Manually trigger component animation
                const timerComponent = this.integration.getComponentsByType('timer')[0];
                if (timerComponent) {
                    this.integration.addComponentAnimation(timerComponent, 'timer_update');
                }
                
                // Check if animation was triggered
                setTimeout(() => {
                    observer.disconnect();
                }, 100);
            }
            
            return animationTriggered;
        });
    }

    testHintReceivedIntegration() {
        this.testSuite('Hint Received Integration');
        
        // Test 1: Hint received event processed
        this.test('Hint received event processed', () => {
            if (!this.integration || !this.mockSocket) return false;
            
            let hintReceived = false;
            let hintMessage = '';
            
            // Monitor hint container
            const hintContainer = document.getElementById('hint-container');
            if (hintContainer) {
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'childList') {
                            hintReceived = true;
                            hintMessage = hintContainer.textContent;
                        }
                    });
                });
                
                observer.observe(hintContainer, { 
                    childList: true, 
                    subtree: true 
                });
                
                // Emit hint received event
                this.mockSocket.emit('hintReceived', { message: 'Test hint message' });
                
                // Check if hint was received
                setTimeout(() => {
                    observer.disconnect();
                }, 100);
            }
            
            return hintReceived && hintMessage.includes('Test hint message');
        });
        
        // Test 2: Hint component animation triggered
        this.test('Hint component animation triggered', () => {
            if (!this.integration) return false;
            
            let animationTriggered = false;
            
            // Monitor hints section for animation
            const hintsSection = document.getElementById('hints-section');
            if (hintsSection) {
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                            const style = hintsSection.style.animation;
                            if (style && style.includes('hint-received')) {
                                animationTriggered = true;
                            }
                        }
                    });
                });
                
                observer.observe(hintsSection, { 
                    attributes: true, 
                    attributeFilter: ['style'] 
                });
                
                // Manually trigger component animation
                const hintsComponent = this.integration.getComponentsByType('hints')[0];
                if (hintsComponent) {
                    this.integration.addComponentAnimation(hintsComponent, 'hintReceived');
                }
                
                // Check if animation was triggered
                setTimeout(() => {
                    observer.disconnect();
                }, 100);
            }
            
            return animationTriggered;
        });
    }

    // Test utility methods
    testSuite(name) {
        this.totalTests++;
        const suiteElement = document.createElement('div');
        suiteElement.innerHTML = `<strong style="color: #764ba2;">${name}</strong>`;
        suiteElement.style.margin = '1rem 0 0.5rem 0';
        this.resultsContainer.appendChild(suiteElement);
    }

    test(name, testFunction) {
        this.totalTests++;
        let passed = false;
        let error = null;
        
        try {
            passed = testFunction();
        } catch (e) {
            error = e;
            console.error(`Test failed: ${name}`, e);
        }
        
        this.currentTest++;
        this.testResults.push({ name, passed, error });
        
        const testElement = document.createElement('div');
        testElement.style.marginLeft = '1rem';
        testElement.style.marginBottom = '0.25rem';
        
        if (passed) {
            testElement.innerHTML = `<span style="color: #4ade80;">✓</span> ${name}`;
        } else {
            testElement.innerHTML = `<span style="color: #f87171;">✗</span> ${name}`;
            if (error) {
                testElement.innerHTML += ` <span style="color: #fbbf24; font-size: 10px;">(${error.message})</span>`;
            }
        }
        
        this.resultsContainer.appendChild(testElement);
    }

    displayTestResults() {
        const passedTests = this.testResults.filter(r => r.passed).length;
        const failedTests = this.testResults.filter(r => !r.passed).length;
        
        const summaryElement = document.createElement('div');
        summaryElement.style.marginTop = '1rem';
        summaryElement.style.paddingTop = '1rem';
        summaryElement.style.borderTop = '1px solid #667eea';
        
        if (failedTests === 0) {
            summaryElement.innerHTML = `
                <strong style="color: #4ade80;">All Tests Passed!</strong><br>
                ${passedTests}/${this.totalTests} tests passed
            `;
        } else {
            summaryElement.innerHTML = `
                <strong style="color: #f87171;">Tests Failed</strong><br>
                ${passedTests}/${this.totalTests} tests passed<br>
                ${failedTests} test(s) failed
            `;
        }
        
        this.resultsContainer.appendChild(summaryElement);
        
        // Add close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.cssText = `
            margin-top: 1rem;
            padding: 0.5rem 1rem;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        `;
        closeButton.onclick = () => {
            document.body.removeChild(this.testContainer);
        };
        
        this.resultsContainer.appendChild(closeButton);
        
        // Log results to console
        console.log(`🧪 Test Results: ${passedTests}/${this.totalTests} passed, ${failedTests} failed`);
        
        // Store results globally for debugging
        window.componentIntegrationTestResults = {
            passed: passedTests,
            failed: failedTests,
            total: this.totalTests,
            results: this.testResults
        };
    }
}

// Auto-start tests when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for integration to initialize
    setTimeout(() => {
        window.componentIntegrationTest = new ComponentIntegrationTest();
    }, 1000);
});

// Export for global access
window.ComponentIntegrationTest = ComponentIntegrationTest;