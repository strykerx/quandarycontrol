/**
 * Component Integration System (Phase 3)
 * Maps builder positions to player component classes and connects socket events to positioned elements
 */

class ComponentIntegration {
    constructor() {
        this.components = new Map();
        this.layoutConfig = null;
        this.socket = null;
        this.roomId = null;
        this.initialized = false;
        this.componentClasses = {
            timer: 'TimerComponent',
            gameState: 'GameStateComponent',
            hints: 'HintsComponent',
            navigation: 'NavigationComponent',
            chat: 'ChatComponent',
            media: 'MediaComponent'
        };
        
        this.init();
    }

    init() {
        if (this.initialized) return;
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    initialize() {
        // Get socket instance from global scope
        this.socket = window.io ? window.io() : null;
        
        // Get room ID from URL or player.js
        this.roomId = this.extractRoomId();
        
        // Load layout configuration
        this.loadLayoutConfiguration();
        
        // Initialize component mapping
        this.initializeComponentMapping();
        
        // Connect socket events to positioned elements
        this.connectSocketEvents();
        
        // Set up layout change listeners
        this.setupLayoutChangeListeners();
        
        this.initialized = true;
        console.log('Component Integration System initialized');
    }

    extractRoomId() {
        // Try to get room ID from URL
        const pathSegments = window.location.pathname.split('/').filter(segment => segment);
        
        if (pathSegments.length >= 1) {
            // Check if using shortcode route (/p/ABC123)
            if (pathSegments[0] === 'p' && pathSegments[1]) {
                return pathSegments[1].toUpperCase();
            } else if (pathSegments.length >= 3 && pathSegments[0] === 'room' && pathSegments[2] === 'player') {
                // Traditional long ID route
                return pathSegments[1];
            }
        }
        
        // Fallback to player.js global variable
        return window.playerApp?.getCurrentRoomId() || null;
    }

    async loadLayoutConfiguration() {
        if (!this.roomId) {
            console.warn('No room ID found, using default layout');
            this.layoutConfig = this.getDefaultLayout();
            return;
        }

        try {
            const response = await fetch(`/api/rooms/${this.roomId}/layout`);
            const result = await response.json();
            
            if (result.success && result.data) {
                this.layoutConfig = result.data;
                console.log('Loaded layout configuration:', this.layoutConfig);
            } else {
                console.log('No custom layout found, using defaults');
                this.layoutConfig = this.getDefaultLayout();
            }
        } catch (error) {
            console.error('Error loading layout configuration:', error);
            this.layoutConfig = this.getDefaultLayout();
        }
    }

    getDefaultLayout() {
        return {
            columns: 12,
            rows: 6,
            gap: 10,
            components: [
                { type: 'timer', col: 1, row: 1, width: 12, id: 'timer-default' },
                { type: 'gameState', col: 1, row: 2, width: 6, id: 'gamestate-default' },
                { type: 'hints', col: 7, row: 2, width: 6, id: 'hints-default' },
                { type: 'navigation', col: 1, row: 3, width: 12, id: 'navigation-default' }
            ]
        };
    }

    initializeComponentMapping() {
        if (!this.layoutConfig || !this.layoutConfig.components) {
            console.warn('No components found in layout configuration');
            return;
        }

        // Clear existing components
        this.components.clear();

        // Map each component from layout configuration
        this.layoutConfig.components.forEach(componentConfig => {
            const component = this.createComponent(componentConfig);
            if (component) {
                this.components.set(componentConfig.id, component);
            }
        });

        // Apply layout to DOM
        this.applyLayoutToDOM();
        
        console.log(`Mapped ${this.components.size} components`);
    }

    createComponent(config) {
        const { type, id, col, row, width } = config;
        
        // Find the corresponding DOM element
        const element = this.findDOMElement(type);
        if (!element) {
            console.warn(`No DOM element found for component type: ${type}`);
            return null;
        }

        // Create component instance
        const component = {
            id,
            type,
            element,
            position: { col, row },
            size: { width },
            class: this.componentClasses[type] || 'GenericComponent'
        };

        // Add component class to element
        element.classList.add('positioned-component');
        element.dataset.componentId = id;
        element.dataset.componentType = type;

        return component;
    }

    findDOMElement(type) {
        const elementMap = {
            timer: document.getElementById('timer-section'),
            gameState: document.getElementById('game-state-section'),
            hints: document.getElementById('hints-section'),
            navigation: document.querySelector('.nav-section'),
            chat: document.getElementById('chat-section'),
            media: document.querySelector('.media-section') || document.createElement('div')
        };

        return elementMap[type] || null;
    }

    applyLayoutToDOM() {
        const container = document.getElementById('player-container');
        if (!container) {
            console.error('Player container not found');
            return;
        }

        // Apply grid layout to container
        container.style.display = 'grid';
        container.style.gridTemplateColumns = `repeat(${this.layoutConfig.columns}, 1fr)`;
        container.style.gap = `${this.layoutConfig.gap}px`;
        container.style.padding = '2rem';

        // Position each component
        this.components.forEach(component => {
            const { element, position, size } = component;
            
            element.style.gridColumn = `${position.col} / span ${size.width}`;
            element.style.gridRow = position.row;
            
            // Add transition for smooth positioning
            element.style.transition = 'all 0.3s ease';
        });

        // Add responsive behavior
        this.addResponsiveBehavior();
    }

    addResponsiveBehavior() {
        const handleResize = () => {
            const width = window.innerWidth;
            
            if (width < 768) {
                // Mobile layout - stack components
                this.applyMobileLayout();
            } else if (width < 1024) {
                // Tablet layout - adjust grid
                this.applyTabletLayout();
            } else {
                // Desktop layout - use configured layout
                this.applyDesktopLayout();
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize(); // Initial call
    }

    applyMobileLayout() {
        const container = document.getElementById('player-container');
        if (!container) return;

        container.style.gridTemplateColumns = '1fr';
        
        let row = 1;
        this.components.forEach(component => {
            component.element.style.gridColumn = '1';
            component.element.style.gridRow = row++;
        });
    }

    applyTabletLayout() {
        const container = document.getElementById('player-container');
        if (!container) return;

        container.style.gridTemplateColumns = 'repeat(6, 1fr)';
        
        this.components.forEach(component => {
            if (component.type === 'timer') {
                component.element.style.gridColumn = '1 / span 6';
                component.element.style.gridRow = 1;
            } else if (component.type === 'gameState') {
                component.element.style.gridColumn = '1 / span 3';
                component.element.style.gridRow = 2;
            } else if (component.type === 'hints') {
                component.element.style.gridColumn = '4 / span 3';
                component.element.style.gridRow = 2;
            } else {
                component.element.style.gridColumn = '1 / span 6';
                component.element.style.gridRow = 3;
            }
        });
    }

    applyDesktopLayout() {
        // Revert to configured layout
        this.components.forEach(component => {
            const { element, position, size } = component;
            element.style.gridColumn = `${position.col} / span ${size.width}`;
            element.style.gridRow = position.row;
        });
    }

    connectSocketEvents() {
        if (!this.socket) {
            console.warn('Socket not available, skipping socket event connection');
            return;
        }

        // Map socket events to component handlers
        const socketEventMap = {
            'timer_update': 'handleTimerUpdate',
            'variableUpdate': 'handleVariableUpdate',
            'hintReceived': 'handleHintReceived',
            'chat_message': 'handleChatMessage',
            'configUpdate': 'handleConfigUpdate',
            'show_lightbox': 'handleLightboxShow'
        };

        Object.entries(socketEventMap).forEach(([event, handler]) => {
            this.socket.on(event, (data) => {
                this.routeSocketEventToComponents(event, data, handler);
            });
        });

        console.log('Connected socket events to components');
    }

    routeSocketEventToComponents(event, data, handlerName) {
        // Find components that should handle this event
        const targetComponents = this.findTargetComponents(event);
        
        targetComponents.forEach(component => {
            this.invokeComponentHandler(component, handlerName, data);
        });

        // Also call global handlers if they exist
        if (window.playerApp && typeof window.playerApp[handlerName] === 'function') {
            window.playerApp[handlerName](data);
        }
    }

    findTargetComponents(event) {
        const eventComponentMap = {
            'timer_update': ['timer'],
            'variableUpdate': ['gameState'],
            'hintReceived': ['hints'],
            'chat_message': ['chat'],
            'configUpdate': ['gameState'],
            'show_lightbox': ['media']
        };

        const targetTypes = eventComponentMap[event] || [];
        const targetComponents = [];

        this.components.forEach(component => {
            if (targetTypes.includes(component.type)) {
                targetComponents.push(component);
            }
        });

        return targetComponents;
    }

    invokeComponentHandler(component, handlerName, data) {
        const handler = this.getComponentHandler(component, handlerName);
        if (handler) {
            try {
                handler.call(component, data);
                this.addComponentAnimation(component, event);
            } catch (error) {
                console.error(`Error in component handler ${handlerName}:`, error);
            }
        }
    }

    getComponentHandler(component, handlerName) {
        // Try to get handler from component instance
        if (component[handlerName]) {
            return component[handlerName];
        }

        // Try to get handler from component class
        const ComponentClass = window[component.class];
        if (ComponentClass && ComponentClass.prototype[handlerName]) {
            return ComponentClass.prototype[handlerName].bind(component);
        }

        // Use default handler
        return this.getDefaultHandler(component.type, handlerName);
    }

    getDefaultHandler(componentType, handlerName) {
        const defaultHandlers = {
            timer: {
                handleTimerUpdate: (data) => {
                    const timerDisplay = component.element.querySelector('#timer-display');
                    if (timerDisplay) {
                        timerDisplay.textContent = this.formatTime(data.remaining);
                    }
                }
            },
            gameState: {
                handleVariableUpdate: (data) => {
                    const variableDisplay = component.element.querySelector('#variable-display');
                    if (variableDisplay) {
                        // Update variable display
                        this.updateVariableDisplay(variableDisplay, data);
                    }
                },
                handleConfigUpdate: (data) => {
                    const configDisplay = component.element.querySelector('#config-display');
                    if (configDisplay) {
                        // Update config display
                        this.updateConfigDisplay(configDisplay, data);
                    }
                }
            },
            hints: {
                handleHintReceived: (data) => {
                    const hintContainer = component.element.querySelector('#hint-container');
                    if (hintContainer) {
                        // Update hints display
                        this.updateHintsDisplay(hintContainer, data);
                    }
                }
            },
            chat: {
                handleChatMessage: (data) => {
                    const chatLog = component.element.querySelector('#chat-log');
                    if (chatLog) {
                        // Update chat display
                        this.updateChatDisplay(chatLog, data);
                    }
                }
            },
            media: {
                handleLightboxShow: (data) => {
                    // Show lightbox
                    if (window.playerApp && window.playerApp.showLightbox) {
                        window.playerApp.showLightbox(data);
                    }
                }
            }
        };

        return defaultHandlers[componentType]?.[handlerName] || null;
    }

    addComponentAnimation(component, event) {
        const animationMap = {
            'timer_update': 'timer-update',
            'variableUpdate': 'variable-update',
            'hintReceived': 'hint-received',
            'chat_message': 'chat-message',
            'configUpdate': 'config-update'
        };

        const animationClass = animationMap[event];
        if (animationClass) {
            component.element.style.animation = 'none';
            setTimeout(() => {
                component.element.style.animation = `${animationClass} 0.5s ease-out`;
            }, 10);
        }
    }

    setupLayoutChangeListeners() {
        // Listen for layout changes from layout builder
        window.addEventListener('storage', (e) => {
            if (e.key === 'quandary-layout-config') {
                try {
                    const newConfig = JSON.parse(e.newValue);
                    this.handleLayoutChange(newConfig);
                } catch (error) {
                    console.error('Error handling layout change:', error);
                }
            }
        });

        // Listen for custom layout change events
        window.addEventListener('layoutChange', (e) => {
            const { layoutConfig } = e.detail;
            this.handleLayoutChange(layoutConfig);
        });
    }

    async handleLayoutChange(newConfig) {
        console.log('Layout configuration changed, updating components...');
        
        // Update layout configuration
        this.layoutConfig = newConfig;
        
        // Reinitialize component mapping
        this.initializeComponentMapping();
        
        // Show notification
        this.showLayoutChangeNotification();
    }

    showLayoutChangeNotification() {
        const notification = document.createElement('div');
        notification.className = 'layout-change-notification';
        notification.textContent = 'Layout updated';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(102, 126, 234, 0.9);
            color: white;
            padding: 1rem;
            border-radius: 8px;
            z-index: 1000;
            animation: slideInRight 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    // Utility methods
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    }

    updateVariableDisplay(container, data) {
        if (!container || !data) return;
        
        // Implementation depends on existing player.js logic
        if (window.playerApp && window.playerApp.renderVariables) {
            window.playerApp.renderVariables();
        }
    }

    updateConfigDisplay(container, data) {
        if (!container || !data) return;
        
        // Implementation depends on existing player.js logic
        if (window.playerApp && window.playerApp.handleConfigUpdate) {
            window.playerApp.handleConfigUpdate(data);
        }
    }

    updateHintsDisplay(container, data) {
        if (!container || !data) return;
        
        // Implementation depends on existing player.js logic
        if (window.playerApp && window.playerApp.handleHintReceived) {
            window.playerApp.handleHintReceived(data);
        }
    }

    updateChatDisplay(container, data) {
        if (!container || !data) return;
        
        // Implementation depends on existing player.js logic
        if (window.playerApp && window.playerApp.handleChatMessage) {
            window.playerApp.handleChatMessage(data);
        }
    }

    // Public API
    getComponent(id) {
        return this.components.get(id);
    }

    getComponentsByType(type) {
        return Array.from(this.components.values()).filter(comp => comp.type === type);
    }

    getCurrentLayout() {
        return this.layoutConfig;
    }

    updateLayout(newConfig) {
        this.handleLayoutChange(newConfig);
    }
}

// Initialize component integration system
document.addEventListener('DOMContentLoaded', () => {
    window.componentIntegration = new ComponentIntegration();
});

// Export for global access
window.ComponentIntegration = ComponentIntegration;