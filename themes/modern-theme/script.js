/**
 * Modern Theme Script
 * Plug-and-play theme architecture implementation
 */

class ModernTheme {
    constructor() {
        this.name = 'Modern Theme';
        this.version = '1.0.0';
        this.id = 'modern-theme';
        this.initialized = false;
        this.components = new Map();
        this.eventBus = null;
        this.themeContext = null;
        this.config = null;
    }

    /**
     * Initialize the modern theme
     */
    async init() {
        if (this.initialized) return;

        try {
            console.log(`Initializing ${this.name} v${this.version}`);
            
            // Load theme configuration
            await this.loadThemeConfig();
            
            // Initialize event bus
            this.initializeEventBus();
            
            // Set up theme context
            this.setupThemeContext();
            
            // Initialize components
            await this.initializeComponents();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Apply theme styles
            this.applyThemeStyles();
            
            this.initialized = true;
            console.log(`${this.name} initialized successfully`);
            
            // Emit initialization event
            this.emitEvent('theme:initialized', {
                themeId: this.id,
                name: this.name,
                version: this.version
            });
            
        } catch (error) {
            console.error(`Failed to initialize ${this.name}:`, error);
            throw error;
        }
    }

    /**
     * Load theme configuration
     */
    async loadThemeConfig() {
        try {
            const response = await fetch('/themes/modern-theme/theme-config.json');
            this.config = await response.json();
            console.log('Theme configuration loaded:', this.config);
        } catch (error) {
            console.error('Failed to load theme configuration:', error);
            throw error;
        }
    }

    /**
     * Initialize event bus
     */
    initializeEventBus() {
        // Use global event bus if available
        if (window.themeRegistry && window.themeRegistry.eventBus) {
            this.eventBus = window.themeRegistry.eventBus;
        } else if (window.themeInheritanceManager && window.themeInheritanceManager.eventBus) {
            this.eventBus = window.themeInheritanceManager.eventBus;
        } else {
            // Create local event bus
            this.eventBus = new EventBus();
        }
        
        console.log('Event bus initialized');
    }

    /**
     * Set up theme context
     */
    setupThemeContext() {
        this.themeContext = {
            themeId: this.id,
            themeName: this.name,
            variables: this.config.variables || {},
            assets: this.config.assets || {},
            features: this.config.features || {},
            components: this.config.components || {},
            layout: this.config.layout || {},
            typography: this.config.typography || {},
            animations: this.config.animations || {},
            accessibility: this.config.accessibility || {},
            performance: this.config.performance || {},
            compatibility: this.config.compatibility || {},
            development: this.config.development || {}
        };
        
        console.log('Theme context set up');
    }

    /**
     * Initialize components
     */
    async initializeComponents() {
        if (!window.componentFactory) {
            console.warn('Component factory not available, skipping component initialization');
            return;
        }

        const componentConfigs = this.config.components || {};
        
        for (const [componentId, componentConfig] of Object.entries(componentConfigs)) {
            if (componentConfig.enabled) {
                try {
                    await this.initializeComponent(componentId, componentConfig);
                } catch (error) {
                    console.error(`Failed to initialize component ${componentId}:`, error);
                }
            }
        }
        
        console.log('Components initialized');
    }

    /**
     * Initialize individual component
     * @param {string} componentId - Component ID
     * @param {Object} componentConfig - Component configuration
     */
    async initializeComponent(componentId, componentConfig) {
        if (!window.componentFactory.hasComponentType(componentId)) {
            console.warn(`Component type ${componentId} not registered`);
            return;
        }

        const component = window.componentFactory.createComponent(
            componentId,
            componentConfig.config || {},
            {
                eventBus: this.eventBus,
                themeContext: this.themeContext
            }
        );

        await component.init();
        this.components.set(componentId, component);
        
        console.log(`Component ${componentId} initialized`);
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Listen for theme changes
        this.eventBus.on('theme:changed', (data) => {
            this.handleThemeChange(data);
        });

        // Listen for component events
        this.eventBus.on('component:initialized', (component) => {
            this.handleComponentInitialized(component);
        });

        // Listen for timer events
        this.eventBus.on('timer:started', (data) => {
            this.handleTimerStarted(data);
        });

        this.eventBus.on('timer:paused', (data) => {
            this.handleTimerPaused(data);
        });

        this.eventBus.on('timer:reset', (data) => {
            this.handleTimerReset(data);
        });

        // Listen for chat events
        this.eventBus.on('chat:message-sent', (data) => {
            this.handleChatMessageSent(data);
        });

        this.eventBus.on('chat:message-added', (data) => {
            this.handleChatMessageAdded(data);
        });

        // Listen for hints events
        this.eventBus.on('hints:hint-added', (data) => {
            this.handleHintAdded(data);
        });

        this.eventBus.on('hints:navigation-changed', (data) => {
            this.handleHintsNavigationChanged(data);
        });

        // Listen for variables events
        this.eventBus.on('variables:variable-set', (data) => {
            this.handleVariableSet(data);
        });

        this.eventBus.on('variables:update-requested', () => {
            this.handleVariablesUpdateRequested();
        });

        console.log('Event listeners set up');
    }

    /**
     * Apply theme styles
     */
    applyThemeStyles() {
        const root = document.documentElement;
        
        // Apply CSS custom properties from theme configuration
        if (this.config.variables) {
            Object.entries(this.config.variables).forEach(([property, value]) => {
                root.style.setProperty(`--${property}`, value);
            });
        }
        
        // Apply theme-specific classes
        document.body.className = `theme-${this.id}`;
        
        // Apply accessibility features
        if (this.config.accessibility) {
            this.applyAccessibilityFeatures();
        }
        
        // Apply performance optimizations
        if (this.config.performance) {
            this.applyPerformanceOptimizations();
        }
        
        console.log('Theme styles applied');
    }

    /**
     * Apply accessibility features
     */
    applyAccessibilityFeatures() {
        const accessibility = this.config.accessibility;
        
        // Apply focus visible styles
        if (accessibility.focusVisible) {
            const style = document.createElement('style');
            style.textContent = `
                :focus-visible {
                    outline: ${accessibility.focusVisible.outline};
                    outline-offset: ${accessibility.focusVisible.outlineOffset};
                }
            `;
            document.head.appendChild(style);
        }
        
        // Apply skip to content link
        if (accessibility.skipToContent) {
            const skipLink = document.createElement('a');
            skipLink.href = '#main-content';
            skipLink.textContent = 'Skip to main content';
            skipLink.className = 'skip-to-content';
            skipLink.style.cssText = `
                position: absolute;
                top: -40px;
                left: 0;
                background: var(--primary-color);
                color: var(--text-light);
                padding: 8px;
                text-decoration: none;
                border-radius: 0 0 4px 0;
                z-index: 100;
            `;
            
            skipLink.addEventListener('focus', () => {
                skipLink.style.top = '0';
            });
            
            skipLink.addEventListener('blur', () => {
                skipLink.style.top = '-40px';
            });
            
            document.body.insertBefore(skipLink, document.body.firstChild);
        }
        
        console.log('Accessibility features applied');
    }

    /**
     * Apply performance optimizations
     */
    applyPerformanceOptimizations() {
        const performance = this.config.performance;
        
        // Apply lazy loading
        if (performance.lazyLoading) {
            const images = document.querySelectorAll('img[data-src]');
            images.forEach(img => {
                img.setAttribute('src', img.getAttribute('data-src'));
                img.removeAttribute('data-src');
            });
        }
        
        // Apply font optimization
        if (performance.fontOptimization) {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'style';
            link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap';
            link.onload = function() {
                this.rel = 'stylesheet';
            };
            document.head.appendChild(link);
        }
        
        console.log('Performance optimizations applied');
    }

    /**
     * Handle theme change
     * @param {Object} data - Theme change data
     */
    handleThemeChange(data) {
        console.log('Theme changed:', data);
        
        // Re-apply theme styles
        this.applyThemeStyles();
        
        // Update components
        this.components.forEach((component, componentId) => {
            if (component.handleThemeChange) {
                component.handleThemeChange(data);
            }
        });
        
        // Emit theme change handled event
        this.emitEvent('theme:change-handled', data);
    }

    /**
     * Handle component initialized
     * @param {Object} component - Initialized component
     */
    handleComponentInitialized(component) {
        console.log(`Component initialized: ${component.id}`);
        
        // Add component to DOM if needed
        if (component.element && !component.element.parentNode) {
            const container = document.getElementById(`${component.id}-component`);
            if (container) {
                container.innerHTML = '';
                container.appendChild(component.element);
            }
        }
        
        // Emit component ready event
        this.emitEvent('component:ready', component);
    }

    /**
     * Handle timer started
     * @param {Object} data - Timer data
     */
    handleTimerStarted(data) {
        console.log('Timer started:', data);
        this.emitEvent('theme:timer-started', data);
    }

    /**
     * Handle timer paused
     * @param {Object} data - Timer data
     */
    handleTimerPaused(data) {
        console.log('Timer paused:', data);
        this.emitEvent('theme:timer-paused', data);
    }

    /**
     * Handle timer reset
     * @param {Object} data - Timer data
     */
    handleTimerReset(data) {
        console.log('Timer reset:', data);
        this.emitEvent('theme:timer-reset', data);
    }

    /**
     * Handle chat message sent
     * @param {Object} data - Message data
     */
    handleChatMessageSent(data) {
        console.log('Chat message sent:', data);
        this.emitEvent('theme:chat-message-sent', data);
    }

    /**
     * Handle chat message added
     * @param {Object} data - Message data
     */
    handleChatMessageAdded(data) {
        console.log('Chat message added:', data);
        this.emitEvent('theme:chat-message-added', data);
    }

    /**
     * Handle hint added
     * @param {Object} data - Hint data
     */
    handleHintAdded(data) {
        console.log('Hint added:', data);
        this.emitEvent('theme:hint-added', data);
    }

    /**
     * Handle hints navigation changed
     * @param {Object} data - Navigation data
     */
    handleHintsNavigationChanged(data) {
        console.log('Hints navigation changed:', data);
        this.emitEvent('theme:hints-navigation-changed', data);
    }

    /**
     * Handle variable set
     * @param {Object} data - Variable data
     */
    handleVariableSet(data) {
        console.log('Variable set:', data);
        this.emitEvent('theme:variable-set', data);
    }

    /**
     * Handle variables update requested
     */
    handleVariablesUpdateRequested() {
        console.log('Variables update requested');
        
        // Request variables update from server
        if (window.socket) {
            window.socket.emit('variables:request');
        }
        
        this.emitEvent('theme:variables-update-requested');
    }

    /**
     * Get component by ID
     * @param {string} componentId - Component ID
     */
    getComponent(componentId) {
        return this.components.get(componentId);
    }

    /**
     * Get all components
     */
    getComponents() {
        return Array.from(this.components.values());
    }

    /**
     * Get theme configuration
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Get theme context
     */
    getThemeContext() {
        return { ...this.themeContext };
    }

    /**
     * Update theme configuration
     * @param {Object} newConfig - New configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.setupThemeContext();
        this.applyThemeStyles();
        
        this.emitEvent('theme:config-updated', this.config);
    }

    /**
     * Add custom component
     * @param {string} componentId - Component ID
     * @param {class} componentClass - Component class
     */
    addCustomComponent(componentId, componentClass) {
        if (window.componentFactory) {
            window.componentFactory.registerComponent(componentId, componentClass);
            console.log(`Custom component ${componentId} registered`);
        }
    }

    /**
     * Remove component
     * @param {string} componentId - Component ID
     */
    removeComponent(componentId) {
        const component = this.components.get(componentId);
        if (component) {
            component.destroy();
            this.components.delete(componentId);
            console.log(`Component ${componentId} removed`);
        }
    }

    /**
     * Emit event
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emitEvent(event, data) {
        if (this.eventBus) {
            this.eventBus.emit(event, data);
        }
    }

    /**
     * Destroy theme
     */
    destroy() {
        // Destroy all components
        this.components.forEach((component, componentId) => {
            component.destroy();
        });
        this.components.clear();
        
        // Clear references
        this.eventBus = null;
        this.themeContext = null;
        this.config = null;
        
        this.initialized = false;
        console.log(`${this.name} destroyed`);
    }
}

/**
 * Event Bus for Modern Theme
 */
class EventBus {
    constructor() {
        this.events = {};
        this.onceEvents = {};
    }

    /**
     * Register event listener
     * @param {string} event - Event name
     * @param {Function} callback - Event callback
     */
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    /**
     * Register one-time event listener
     * @param {string} event - Event name
     * @param {Function} callback - Event callback
     */
    once(event, callback) {
        if (!this.onceEvents[event]) {
            this.onceEvents[event] = [];
        }
        this.onceEvents[event].push(callback);
    }

    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} callback - Event callback
     */
    off(event, callback) {
        if (this.events[event]) {
            const index = this.events[event].indexOf(callback);
            if (index > -1) {
                this.events[event].splice(index, 1);
            }
        }
        
        if (this.onceEvents[event]) {
            const index = this.onceEvents[event].indexOf(callback);
            if (index > -1) {
                this.onceEvents[event].splice(index, 1);
            }
        }
    }

    /**
     * Emit event
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data) {
        // Regular events
        if (this.events[event]) {
            this.events[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event handler for ${event}:`, error);
                }
            });
        }

        // Once events
        if (this.onceEvents[event]) {
            const callbacks = this.onceEvents[event];
            delete this.onceEvents[event];
            
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in once event handler for ${event}:`, error);
                }
            });
        }
    }

    /**
     * Destroy event bus
     */
    destroy() {
        this.events = {};
        this.onceEvents = {};
    }
}

// Initialize modern theme when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Create modern theme instance
    window.modernTheme = new ModernTheme();
    
    // Initialize theme
    window.modernTheme.init().then(() => {
        console.log('Modern theme ready');
        
        // Set up global theme object for compatibility
        window.currentTheme = window.modernTheme;
        
        // Emit theme ready event
        if (window.themeRegistry) {
            window.themeRegistry.eventBus.emit('theme:ready', {
                themeId: 'modern-theme',
                theme: window.modernTheme
            });
        }
        
    }).catch(error => {
        console.error('Failed to initialize modern theme:', error);
    });
    
    // Handle theme switching
    if (window.themeRegistry) {
        window.themeRegistry.eventBus.on('theme:switched', (data) => {
            if (data.newTheme !== 'modern-theme') {
                // Deactivate modern theme
                if (window.modernTheme.initialized) {
                    window.modernTheme.destroy();
                }
            } else {
                // Activate modern theme
                if (!window.modernTheme.initialized) {
                    window.modernTheme.init();
                }
            }
        });
    }
    
    // Handle component hot reload
    if (window.componentFactory) {
        window.componentFactory.eventBus = window.componentFactory.eventBus || new EventBus();
        
        window.componentFactory.eventBus.on('component:registered', (data) => {
            console.log(`Component registered: ${data.type}`);
            
            // Re-initialize component if it's part of the theme
            if (window.modernTheme.config.components && window.modernTheme.config.components[data.type]) {
                const componentConfig = window.modernTheme.config.components[data.type];
                if (componentConfig.enabled) {
                    window.modernTheme.initializeComponent(data.type, componentConfig);
                }
            }
        });
    }
    
    // Export for global access
    window.ModernTheme = ModernTheme;
    window.EventBus = EventBus;
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ModernTheme,
        EventBus
    };
}