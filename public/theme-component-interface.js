/**
 * Theme Component Interface System
 * Provides standardized interfaces for theme-agnostic components
 */

class ComponentFactory {
    constructor() {
        this.componentTypes = new Map();
        this.componentInstances = new Map();
        this.eventBus = new EventBus();
        this.initialized = false;
        this.config = {
            enableHotReload: true,
            enableCaching: true,
            cacheTimeout: 300000, // 5 minutes
            defaultComponentOptions: {
                debug: false,
                enableAnimations: true,
                enableAccessibility: true,
                enablePerformance: true
            }
        };
        
        this.registerDefaultComponents();
    }

    /**
     * Initialize the component factory
     */
    async init() {
        if (this.initialized) return;

        try {
            console.log('Initializing Component Factory...');
            
            // Set up event listeners
            this.setupEventListeners();
            
            this.initialized = true;
            console.log('Component Factory initialized successfully');
            
            // Emit initialization event
            this.eventBus.emit('factory:initialized', {
                componentTypes: Array.from(this.componentTypes.keys())
            });
            
        } catch (error) {
            console.error('Failed to initialize Component Factory:', error);
            throw error;
        }
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Listen for component creation requests
        this.eventBus.on('component:create-requested', (data) => {
            this.createComponent(data.type, data.config, data.context).then(component => {
                this.eventBus.emit('component:created', {
                    type: data.type,
                    component,
                    context: data.context
                });
            }).catch(error => {
                this.eventBus.emit('component:creation-failed', {
                    type: data.type,
                    error: error.message
                });
            });
        });

        // Listen for component destruction requests
        this.eventBus.on('component:destroy-requested', (data) => {
            this.destroyComponent(data.componentId).then(() => {
                this.eventBus.emit('component:destroyed', {
                    componentId: data.componentId
                });
            }).catch(error => {
                this.eventBus.emit('component:destruction-failed', {
                    componentId: data.componentId,
                    error: error.message
                });
            });
        });

        // Listen for theme changes
        if (window.themeRegistry) {
            window.themeRegistry.eventBus.on('theme:activated', (data) => {
                this.handleThemeActivated(data);
            });
        }

        // Listen for inheritance changes
        if (window.themeInheritanceManager) {
            window.themeInheritanceManager.eventBus.on('inheritance:resolved', (data) => {
                this.handleInheritanceResolved(data);
            });
        }
    }

    /**
     * Register default components
     */
    registerDefaultComponents() {
        // Timer component
        this.registerComponent('timer', TimerComponent);
        
        // Chat component
        this.registerComponent('chat', ChatComponent);
        
        // Hints component
        this.registerComponent('hints', HintsComponent);
        
        // Variables component
        this.registerComponent('variables', VariablesComponent);
        
        // Media component
        this.registerComponent('media', MediaComponent);
        
        // Room info component
        this.registerComponent('room-info', RoomInfoComponent);
        
        // Game state component
        this.registerComponent('game-state', GameStateComponent);
        
        // Notifications component
        this.registerComponent('notifications', NotificationsComponent);
        
        console.log('Default components registered');
    }

    /**
     * Register component type
     * @param {string} type - Component type
     * @param {class} componentClass - Component class
     */
    registerComponent(type, componentClass) {
        if (this.componentTypes.has(type)) {
            console.warn(`Component type ${type} already registered`);
            return;
        }

        // Validate component class
        if (!this.validateComponentClass(componentClass)) {
            throw new Error(`Component class ${componentClass.name} does not implement required interface`);
        }

        this.componentTypes.set(type, componentClass);
        
        console.log(`Component type ${type} registered`);
        
        // Emit registration event
        this.eventBus.emit('component:registered', {
            type,
            componentClass
        });
    }

    /**
     * Validate component class
     * @param {class} componentClass - Component class to validate
     */
    validateComponentClass(componentClass) {
        const requiredMethods = ['init', 'destroy', 'render', 'update'];
        
        for (const method of requiredMethods) {
            if (typeof componentClass.prototype[method] !== 'function') {
                console.error(`Component class ${componentClass.name} missing required method: ${method}`);
                return false;
            }
        }
        
        return true;
    }

    /**
     * Create component instance
     * @param {string} type - Component type
     * @param {Object} config - Component configuration
     * @param {Object} context - Component context
     */
    async createComponent(type, config = {}, context = {}) {
        if (!this.componentTypes.has(type)) {
            throw new Error(`Component type ${type} not registered`);
        }

        const ComponentClass = this.componentTypes.get(type);
        
        try {
            // Merge default options
            const mergedConfig = {
                ...this.config.defaultComponentOptions,
                ...config
            };
            
            // Create component instance
            const component = new ComponentClass(type, mergedConfig, context);
            
            // Initialize component
            await component.init();
            
            // Store component instance
            this.componentInstances.set(component.id, component);
            
            console.log(`Component ${type} created with ID ${component.id}`);
            
            // Emit creation event
            this.eventBus.emit('component:instance-created', {
                type,
                component,
                config: mergedConfig,
                context
            });
            
            return component;
            
        } catch (error) {
            console.error(`Failed to create component ${type}:`, error);
            throw error;
        }
    }

    /**
     * Destroy component instance
     * @param {string} componentId - Component ID
     */
    async destroyComponent(componentId) {
        const component = this.componentInstances.get(componentId);
        if (!component) {
            console.warn(`Component with ID ${componentId} not found`);
            return;
        }

        try {
            // Destroy component
            await component.destroy();
            
            // Remove from instances
            this.componentInstances.delete(componentId);
            
            console.log(`Component ${componentId} destroyed`);
            
            // Emit destruction event
            this.eventBus.emit('component:instance-destroyed', {
                componentId,
                component
            });
            
        } catch (error) {
            console.error(`Failed to destroy component ${componentId}:`, error);
            throw error;
        }
    }

    /**
     * Get component instance
     * @param {string} componentId - Component ID
     */
    getComponent(componentId) {
        return this.componentInstances.get(componentId);
    }

    /**
     * Get all component instances
     */
    getComponents() {
        return Array.from(this.componentInstances.values());
    }

    /**
     * Get components by type
     * @param {string} type - Component type
     */
    getComponentsByType(type) {
        return Array.from(this.componentInstances.values()).filter(
            component => component.type === type
        );
    }

    /**
     * Check if component type is registered
     * @param {string} type - Component type
     */
    hasComponentType(type) {
        return this.componentTypes.has(type);
    }

    /**
     * Get all registered component types
     */
    getComponentTypes() {
        return Array.from(this.componentTypes.keys());
    }

    /**
     * Handle theme activation
     * @param {Object} data - Theme activation data
     */
    async handleThemeActivated(data) {
        const { themeId, theme } = data;
        
        // Update all components with new theme context
        for (const component of this.componentInstances.values()) {
            try {
                if (component.handleThemeChange) {
                    await component.handleThemeChange(theme);
                }
            } catch (error) {
                console.error(`Failed to update component ${component.id} for theme ${themeId}:`, error);
            }
        }
        
        console.log(`Components updated for theme ${themeId}`);
    }

    /**
     * Handle inheritance resolution
     * @param {Object} data - Inheritance resolution data
     */
    async handleInheritanceResolved(data) {
        const { themeId, resolved } = data;
        
        // Update components with resolved inheritance
        for (const component of this.componentInstances.values()) {
            try {
                if (component.context.themeId === themeId && component.handleInheritanceChange) {
                    await component.handleInheritanceChange(resolved);
                }
            } catch (error) {
                console.error(`Failed to update component ${component.id} for inheritance resolution:`, error);
            }
        }
        
        console.log(`Components updated for inheritance resolution of ${themeId}`);
    }

    /**
     * Get component factory statistics
     */
    getStatistics() {
        return {
            registeredTypes: this.componentTypes.size,
            activeInstances: this.componentInstances.size,
            typesByCount: this.getComponentTypeCounts()
        };
    }

    /**
     * Get component type counts
     */
    getComponentTypeCounts() {
        const counts = {};
        
        for (const component of this.componentInstances.values()) {
            counts[component.type] = (counts[component.type] || 0) + 1;
        }
        
        return counts;
    }

    /**
     * Destroy component factory
     */
    destroy() {
        // Destroy all component instances
        const componentIds = Array.from(this.componentInstances.keys());
        for (const componentId of componentIds) {
            try {
                this.destroyComponent(componentId);
            } catch (error) {
                console.error(`Failed to destroy component ${componentId}:`, error);
            }
        }
        
        // Clear collections
        this.componentTypes.clear();
        this.componentInstances.clear();
        
        // Destroy event bus
        this.eventBus.destroy();
        
        this.initialized = false;
        console.log('Component Factory destroyed');
    }
}

/**
 * Base Component Interface
 * All theme components must implement this interface
 */
class BaseComponent {
    constructor(type, config, context) {
        this.id = this.generateId();
        this.type = type;
        this.config = config;
        this.context = context;
        this.element = null;
        this.initialized = false;
        this.eventBus = context.eventBus || new EventBus();
        this.themeContext = context.themeContext || {};
        this.state = {};
        this.subscriptions = [];
    }

    /**
     * Initialize component
     */
    async init() {
        if (this.initialized) return;

        try {
            console.log(`Initializing component ${this.type} (${this.id})`);
            
            // Create component element
            this.createElement();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Render component
            await this.render();
            
            this.initialized = true;
            console.log(`Component ${this.type} (${this.id}) initialized successfully`);
            
            // Emit initialization event
            this.emitEvent('component:initialized', {
                componentId: this.id,
                type: this.type
            });
            
        } catch (error) {
            console.error(`Failed to initialize component ${this.type}:`, error);
            throw error;
        }
    }

    /**
     * Generate unique component ID
     */
    generateId() {
        return `${this.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Create component element
     */
    createElement() {
        this.element = document.createElement('div');
        this.element.className = `component component-${this.type}`;
        this.element.dataset.componentId = this.id;
        this.element.dataset.componentType = this.type;
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Set up theme change listener
        this.subscribe('theme:changed', (data) => {
            this.handleThemeChange(data);
        });

        // Set up inheritance change listener
        this.subscribe('inheritance:changed', (data) => {
            this.handleInheritanceChange(data);
        });
    }

    /**
     * Subscribe to event
     * @param {string} event - Event name
     * @param {Function} callback - Event callback
     */
    subscribe(event, callback) {
        this.eventBus.on(event, callback);
        this.subscriptions.push({ event, callback });
    }

    /**
     * Emit event
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emitEvent(event, data) {
        this.eventBus.emit(event, {
            ...data,
            componentId: this.id,
            componentType: this.type
        });
    }

    /**
     * Render component
     */
    async render() {
        // Override in subclasses
        console.warn(`Render method not implemented for component ${this.type}`);
    }

    /**
     * Update component
     * @param {Object} newState - New component state
     */
    async update(newState) {
        this.state = { ...this.state, ...newState };
        await this.render();
    }

    /**
     * Handle theme change
     * @param {Object} theme - Theme data
     */
    async handleThemeChange(theme) {
        // Override in subclasses
        console.log(`Theme change handled by component ${this.type}`);
    }

    /**
     * Handle inheritance change
     * @param {Object} resolved - Resolved inheritance data
     */
    async handleInheritanceChange(resolved) {
        // Override in subclasses
        console.log(`Inheritance change handled by component ${this.type}`);
    }

    /**
     * Get component configuration
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Update component configuration
     * @param {Object} newConfig - New configuration
     */
    async updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        await this.render();
    }

    /**
     * Get component state
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Show component
     */
    show() {
        if (this.element) {
            this.element.style.display = 'block';
        }
    }

    /**
     * Hide component
     */
    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    }

    /**
     * Enable component
     */
    enable() {
        if (this.element) {
            this.element.removeAttribute('disabled');
            this.element.classList.remove('disabled');
        }
    }

    /**
     * Disable component
     */
    disable() {
        if (this.element) {
            this.element.setAttribute('disabled', 'disabled');
            this.element.classList.add('disabled');
        }
    }

    /**
     * Add CSS class to component
     * @param {string} className - CSS class name
     */
    addClass(className) {
        if (this.element) {
            this.element.classList.add(className);
        }
    }

    /**
     * Remove CSS class from component
     * @param {string} className - CSS class name
     */
    removeClass(className) {
        if (this.element) {
            this.element.classList.remove(className);
        }
    }

    /**
     * Toggle CSS class on component
     * @param {string} className - CSS class name
     */
    toggleClass(className) {
        if (this.element) {
            this.element.classList.toggle(className);
        }
    }

    /**
     * Set component attribute
     * @param {string} name - Attribute name
     * @param {string} value - Attribute value
     */
    setAttribute(name, value) {
        if (this.element) {
            this.element.setAttribute(name, value);
        }
    }

    /**
     * Get component attribute
     * @param {string} name - Attribute name
     */
    getAttribute(name) {
        return this.element ? this.element.getAttribute(name) : null;
    }

    /**
     * Remove component attribute
     * @param {string} name - Attribute name
     */
    removeAttribute(name) {
        if (this.element) {
            this.element.removeAttribute(name);
        }
    }

    /**
     * Set component data attribute
     * @param {string} name - Data attribute name
     * @param {string} value - Data attribute value
     */
    setData(name, value) {
        if (this.element) {
            this.element.dataset[name] = value;
        }
    }

    /**
     * Get component data attribute
     * @param {string} name - Data attribute name
     */
    getData(name) {
        return this.element ? this.element.dataset[name] : null;
    }

    /**
     * Destroy component
     */
    async destroy() {
        try {
            console.log(`Destroying component ${this.type} (${this.id})`);
            
            // Remove event subscriptions
            for (const subscription of this.subscriptions) {
                this.eventBus.off(subscription.event, subscription.callback);
            }
            this.subscriptions = [];
            
            // Remove element from DOM
            if (this.element && this.element.parentNode) {
                this.element.parentNode.removeChild(this.element);
            }
            
            // Clear references
            this.element = null;
            this.config = null;
            this.context = null;
            this.state = {};
            
            this.initialized = false;
            console.log(`Component ${this.type} (${this.id}) destroyed successfully`);
            
            // Emit destruction event
            this.emitEvent('component:destroyed', {
                componentId: this.id,
                type: this.type
            });
            
        } catch (error) {
            console.error(`Failed to destroy component ${this.type}:`, error);
            throw error;
        }
    }
}

/**
 * Timer Component Implementation
 */
class TimerComponent extends BaseComponent {
    async render() {
        const format = this.config.format || 'mm:ss';
        const showControls = this.config.showControls !== false;
        
        this.element.innerHTML = `
            <div class="timer-container">
                <div class="timer-display" id="timer-display-${this.id}">00:00</div>
                ${showControls ? `
                    <div class="timer-controls">
                        <button class="timer-button timer-start" id="timer-start-${this.id}">
                            <i class="fas fa-play"></i>
                        </button>
                        <button class="timer-button timer-pause" id="timer-pause-${this.id}">
                            <i class="fas fa-pause"></i>
                        </button>
                        <button class="timer-button timer-reset" id="timer-reset-${this.id}">
                            <i class="fas fa-redo"></i>
                        </button>
                    </div>
                ` : ''}
                <div class="timer-status" id="timer-status-${this.id}">Ready</div>
            </div>
        `;
        
        // Set up control event listeners
        if (showControls) {
            this.setupTimerControls();
        }
        
        // Start timer updates
        this.startTimerUpdates();
    }

    setupTimerControls() {
        const startBtn = document.getElementById(`timer-start-${this.id}`);
        const pauseBtn = document.getElementById(`timer-pause-${this.id}`);
        const resetBtn = document.getElementById(`timer-reset-${this.id}`);
        
        startBtn.addEventListener('click', () => this.startTimer());
        pauseBtn.addEventListener('click', () => this.pauseTimer());
        resetBtn.addEventListener('click', () => this.resetTimer());
    }

    startTimer() {
        this.state.running = true;
        this.state.startTime = Date.now() - (this.state.elapsed || 0);
        this.updateStatus('Running');
        this.emitEvent('timer:started', { componentId: this.id });
    }

    pauseTimer() {
        this.state.running = false;
        this.state.elapsed = Date.now() - this.state.startTime;
        this.updateStatus('Paused');
        this.emitEvent('timer:paused', { componentId: this.id });
    }

    resetTimer() {
        this.state.running = false;
        this.state.elapsed = 0;
        this.state.startTime = null;
        this.updateDisplay();
        this.updateStatus('Ready');
        this.emitEvent('timer:reset', { componentId: this.id });
    }

    startTimerUpdates() {
        this.timerInterval = setInterval(() => {
            if (this.state.running) {
                this.updateDisplay();
            }
        }, 1000);
    }

    updateDisplay() {
        const display = document.getElementById(`timer-display-${this.id}`);
        if (!display) return;
        
        const elapsed = this.state.running ? 
            Date.now() - this.state.startTime : 
            (this.state.elapsed || 0);
        
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        display.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    updateStatus(status) {
        const statusElement = document.getElementById(`timer-status-${this.id}`);
        if (statusElement) {
            statusElement.textContent = status;
        }
    }

    async destroy() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        await super.destroy();
    }
}

/**
 * Chat Component Implementation
 */
class ChatComponent extends BaseComponent {
    async render() {
        const maxMessages = this.config.maxMessages || 50;
        const showTimestamps = this.config.showTimestamps !== false;
        const allowUserInput = this.config.allowUserInput !== false;
        
        this.element.innerHTML = `
            <div class="chat-container">
                <div class="chat-header">
                    <h3>Chat</h3>
                </div>
                <div class="chat-log" id="chat-log-${this.id}"></div>
                ${allowUserInput ? `
                    <div class="chat-input-container">
                        <input type="text" class="chat-input" id="chat-input-${this.id}" placeholder="Type a message...">
                        <button class="chat-submit" id="chat-submit-${this.id}">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
        
        // Set up input event listeners
        if (allowUserInput) {
            this.setupChatInput();
        }
        
        // Initialize message storage
        this.state.messages = [];
    }

    setupChatInput() {
        const input = document.getElementById(`chat-input-${this.id}`);
        const submit = document.getElementById(`chat-submit-${this.id}`);
        
        const sendMessage = () => {
            const text = input.value.trim();
            if (text) {
                this.addMessage({
                    text,
                    sender: 'player',
                    timestamp: new Date()
                });
                input.value = '';
            }
        };
        
        submit.addEventListener('click', sendMessage);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    addMessage(message) {
        const maxMessages = this.config.maxMessages || 50;
        
        this.state.messages.push(message);
        
        // Limit message count
        if (this.state.messages.length > maxMessages) {
            this.state.messages = this.state.messages.slice(-maxMessages);
        }
        
        this.updateChatDisplay();
        this.emitEvent('chat:message-added', { componentId: this.id, message });
    }

    updateChatDisplay() {
        const log = document.getElementById(`chat-log-${this.id}`);
        if (!log) return;
        
        const showTimestamps = this.config.showTimestamps !== false;
        
        log.innerHTML = this.state.messages.map(message => {
            const timestamp = showTimestamps ? 
                `<span class="chat-timestamp">${this.formatTimestamp(message.timestamp)}</span>` : '';
            
            return `
                <div class="chat-message chat-message-${message.sender}">
                    ${timestamp}
                    <span class="chat-text">${this.escapeHtml(message.text)}</span>
                </div>
            `;
        }).join('');
        
        // Scroll to bottom
        log.scrollTop = log.scrollHeight;
    }

    formatTimestamp(timestamp) {
        return new Date(timestamp).toLocaleTimeString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

/**
 * Hints Component Implementation
 */
class HintsComponent extends BaseComponent {
    async render() {
        const maxHints = this.config.maxHints || 10;
        const showNavigation = this.config.showNavigation !== false;
        
        this.element.innerHTML = `
            <div class="hints-container">
                <div class="hints-header">
                    <h3>Hints</h3>
                </div>
                <div class="hint-content">
                    <div class="hint-display" id="hint-display-${this.id}">
                        <div class="hint-placeholder">No hints available</div>
                    </div>
                    ${showNavigation ? `
                        <div class="hint-navigation">
                            <button class="hint-nav-btn hint-prev" id="hint-prev-${this.id}">
                                <i class="fas fa-chevron-left"></i>
                            </button>
                            <span class="hint-counter" id="hint-counter-${this.id}">0 / 0</span>
                            <button class="hint-nav-btn hint-next" id="hint-next-${this.id}">
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        // Set up navigation event listeners
        if (showNavigation) {
            this.setupHintNavigation();
        }
        
        // Initialize hint storage
        this.state.hints = [];
        this.state.currentHintIndex = 0;
    }

    setupHintNavigation() {
        const prevBtn = document.getElementById(`hint-prev-${this.id}`);
        const nextBtn = document.getElementById(`hint-next-${this.id}`);
        
        prevBtn.addEventListener('click', () => this.showPreviousHint());
        nextBtn.addEventListener('click', () => this.showNextHint());
    }

    addHint(hint) {
        const maxHints = this.config.maxHints || 10;
        
        this.state.hints.push(hint);
        
        // Limit hint count
        if (this.state.hints.length > maxHints) {
            this.state.hints = this.state.hints.slice(-maxHints);
        }
        
        this.updateHintDisplay();
        this.emitEvent('hints:hint-added', { componentId: this.id, hint });
    }

    showPreviousHint() {
        if (this.state.hints.length === 0) return;
        
        this.state.currentHintIndex = Math.max(0, this.state.currentHintIndex - 1);
        this.updateHintDisplay();
        this.emitEvent('hints:navigation-changed', { 
            componentId: this.id, 
            direction: 'previous',
            index: this.state.currentHintIndex
        });
    }

    showNextHint() {
        if (this.state.hints.length === 0) return;
        
        this.state.currentHintIndex = Math.min(
            this.state.hints.length - 1, 
            this.state.currentHintIndex + 1
        );
        this.updateHintDisplay();
        this.emitEvent('hints:navigation-changed', { 
            componentId: this.id, 
            direction: 'next',
            index: this.state.currentHintIndex
        });
    }

    updateHintDisplay() {
        const display = document.getElementById(`hint-display-${this.id}`);
        const counter = document.getElementById(`hint-counter-${this.id}`);
        
        if (!display) return;
        
        if (this.state.hints.length === 0) {
            display.innerHTML = '<div class="hint-placeholder">No hints available</div>';
        } else {
            const hint = this.state.hints[this.state.currentHintIndex];
            display.innerHTML = `<div class="hint-text">${this.escapeHtml(hint.text)}</div>`;
        }
        
        if (counter) {
            counter.textContent = `${this.state.currentHintIndex + 1} / ${this.state.hints.length}`;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

/**
 * Variables Component Implementation
 */
class VariablesComponent extends BaseComponent {
    async render() {
        const updateInterval = this.config.updateInterval || 1000;
        
        this.element.innerHTML = `
            <div class="variables-container">
                <div class="variables-header">
                    <h3>Variables</h3>
                </div>
                <div class="variables-display" id="variables-display-${this.id}">
                    <div class="variables-placeholder">Loading variables...</div>
                </div>
            </div>
        `;
        
        // Initialize variables storage
        this.state.variables = {};
        
        // Start variable updates
        this.startVariableUpdates(updateInterval);
    }

    startVariableUpdates(updateInterval) {
        this.variableInterval = setInterval(() => {
            this.requestVariablesUpdate();
        }, updateInterval);
        
        // Initial request
        this.requestVariablesUpdate();
    }

    requestVariablesUpdate() {
        this.emitEvent('variables:update-requested', { componentId: this.id });
    }

    setVariable(name, value) {
        this.state.variables[name] = value;
        this.updateVariablesDisplay();
        this.emitEvent('variables:variable-set', { 
            componentId: this.id, 
            name, 
            value 
        });
    }

    updateVariablesDisplay() {
        const display = document.getElementById(`variables-display-${this.id}`);
        if (!display) return;
        
        const variables = Object.entries(this.state.variables);
        
        if (variables.length === 0) {
            display.innerHTML = '<div class="variables-placeholder">No variables set</div>';
        } else {
            display.innerHTML = variables.map(([name, value]) => `
                <div class="variable-item">
                    <span class="variable-name">${this.escapeHtml(name)}</span>
                    <span class="variable-value">${this.escapeHtml(String(value))}</span>
                </div>
            `).join('');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async destroy() {
        if (this.variableInterval) {
            clearInterval(this.variableInterval);
        }
        await super.destroy();
    }
}

/**
 * Media Component Implementation
 */
class MediaComponent extends BaseComponent {
    async render() {
        this.element.innerHTML = `
            <div class="media-container">
                <div class="media-lightbox" id="media-lightbox-${this.id}" style="display: none;">
                    <div class="media-lightbox-content">
                        <div class="media-lightbox-header">
                            <h3 class="media-lightbox-title" id="media-title-${this.id}"></h3>
                            <button class="media-lightbox-close" id="media-close-${this.id}">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="media-lightbox-body" id="media-body-${this.id}"></div>
                    </div>
                </div>
            </div>
        `;
        
        // Set up lightbox event listeners
        this.setupMediaLightbox();
    }

    setupMediaLightbox() {
        const lightbox = document.getElementById(`media-lightbox-${this.id}`);
        const closeBtn = document.getElementById(`media-close-${this.id}`);
        
        closeBtn.addEventListener('click', () => this.closeLightbox());
        
        // Close on background click
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) {
                this.closeLightbox();
            }
        });
        
        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && lightbox.style.display !== 'none') {
                this.closeLightbox();
            }
        });
    }

    showMedia(media) {
        const lightbox = document.getElementById(`media-lightbox-${this.id}`);
        const title = document.getElementById(`media-title-${this.id}`);
        const body = document.getElementById(`media-body-${this.id}`);
        
        if (!lightbox || !title || !body) return;
        
        title.textContent = media.title || 'Media';
        
        // Render media based on type
        if (media.type === 'image') {
            body.innerHTML = `<img src="${media.url}" alt="${media.title || ''}" />`;
        } else if (media.type === 'video') {
            body.innerHTML = `<video controls><source src="${media.url}" type="${media.mimeType || 'video/mp4'}"></video>`;
        } else if (media.type === 'audio') {
            body.innerHTML = `<audio controls><source src="${media.url}" type="${media.mimeType || 'audio/mp3'}"></audio>`;
        } else {
            body.innerHTML = `<div class="media-unsupported">Unsupported media type</div>`;
        }
        
        lightbox.style.display = 'flex';
        this.emitEvent('media:shown', { componentId: this.id, media });
    }

    closeLightbox() {
        const lightbox = document.getElementById(`media-lightbox-${this.id}`);
        if (lightbox) {
            lightbox.style.display = 'none';
            this.emitEvent('media:hidden', { componentId: this.id });
        }
    }
}

/**
 * Room Info Component Implementation
 */
class RoomInfoComponent extends BaseComponent {
    async render() {
        const field = this.config.field;
        
        // If field parameter is specified, render only that field value
        if (field) {
            this.renderFieldValue(field);
            return;
        }
        
        // Default full component render
        const showProgress = this.config.showProgress !== false;
        
        this.element.innerHTML = `
            <div class="room-info-container">
                <div class="room-title" id="room-title-${this.id}">Loading room...</div>
                <div class="room-details">
                    <div class="room-code" id="room-code-${this.id}"></div>
                    ${showProgress ? '<div class="room-progress" id="room-progress-${this.id}"></div>' : ''}
                </div>
            </div>
        `;
        
        // Initialize room data
        this.state.roomData = {};
    }
    
    renderFieldValue(field) {
        const value = this.getFieldValue(field);
        this.element.innerHTML = value;
        this.element.className = `component component-${this.type} field-${field}`;
    }
    
    getFieldValue(field) {
        if (!this.state.roomData) return '';
        
        switch (field) {
            case 'name':
            case 'title':
                return this.state.roomData.name || '';
            case 'code':
                return this.state.roomData.code || '';
            case 'pid':
                return this.state.roomData.pid || '';
            case 'progress':
                return this.state.roomData.progress?.percentage || 0;
            default:
                return this.state.roomData[field] || '';
        }
    }

    updateRoomInfo(roomData) {
        this.state.roomData = roomData;
        this.updateRoomDisplay();
        this.emitEvent('room-info:updated', { componentId: this.id, roomData });
    }

    updateRoomDisplay() {
        // If in field mode, just update the field value
        if (this.config.field) {
            this.renderFieldValue(this.config.field);
            return;
        }
        
        // Default full component update
        const title = document.getElementById(`room-title-${this.id}`);
        const code = document.getElementById(`room-code-${this.id}`);
        const progress = document.getElementById(`room-progress-${this.id}`);
        
        if (title) {
            title.textContent = this.state.roomData.name || 'Unknown Room';
        }
        
        if (code) {
            code.textContent = `Code: ${this.state.roomData.code || 'N/A'}`;
        }
        
        if (progress && this.config.showProgress !== false) {
            const progressData = this.state.roomData.progress || {};
            progress.innerHTML = `
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progressData.percentage || 0}%"></div>
                </div>
                <div class="progress-text">${progressData.percentage || 0}% Complete</div>
            `;
        }
    }
}

/**
 * Game State Component Implementation
 */
class GameStateComponent extends BaseComponent {
    async render() {
        const showScore = this.config.showScore !== false;
        const updateInterval = this.config.updateInterval || 1000;
        
        this.element.innerHTML = `
            <div class="game-state-container">
                <div class="game-state-content">
                    ${showScore ? '<div class="game-score" id="game-score-${this.id}">Score: 0</div>' : ''}
                    <div class="game-status" id="game-status-${this.id}">Ready</div>
                    <div class="game-config" id="game-config-${this.id}"></div>
                </div>
            </div>
        `;
        
        // Initialize game state
        this.state.gameState = {};
        
        // Start state updates
        this.startStateUpdates(updateInterval);
    }

    startStateUpdates(updateInterval) {
        this.stateInterval = setInterval(() => {
            this.requestStateUpdate();
        }, updateInterval);
        
        // Initial request
        this.requestStateUpdate();
    }

    requestStateUpdate() {
        this.emitEvent('game-state:update-requested', { componentId: this.id });
    }

    updateGameState(gameState) {
        this.state.gameState = gameState;
        this.updateStateDisplay();
        this.emitEvent('game-state:updated', { componentId: this.id, gameState });
    }

    updateStateDisplay() {
        const score = document.getElementById(`game-score-${this.id}`);
        const status = document.getElementById(`game-status-${this.id}`);
        const config = document.getElementById(`game-config-${this.id}`);
        
        if (score && this.config.showScore !== false) {
            score.textContent = `Score: ${this.state.gameState.score || 0}`;
        }
        
        if (status) {
            status.textContent = this.state.gameState.status || 'Ready';
        }
        
        if (config) {
            const configItems = [];
            if (this.state.gameState.difficulty) {
                configItems.push(`Difficulty: ${this.state.gameState.difficulty}`);
            }
            if (this.state.gameState.mode) {
                configItems.push(`Mode: ${this.state.gameState.mode}`);
            }
            config.innerHTML = configItems.join(' | ');
        }
    }

    async destroy() {
        if (this.stateInterval) {
            clearInterval(this.stateInterval);
        }
        await super.destroy();
    }
}

/**
 * Notifications Component Implementation
 */
class NotificationsComponent extends BaseComponent {
    async render() {
        const showControls = this.config.showControls !== false;
        const showStatus = this.config.showStatus !== false;
        
        this.element.innerHTML = `
            <div class="notifications-container">
                ${showStatus ? `
                    <div class="notifications-status" id="notifications-status-${this.id}">
                        <span class="status-icon">🔊</span>
                        <span class="status-text">Enabled</span>
                    </div>
                ` : ''}
                ${showControls ? `
                    <div class="notifications-controls" id="notifications-controls-${this.id}">
                        <button class="notification-toggle" id="notification-toggle-${this.id}">
                            <i class="fas fa-volume-up"></i>
                        </button>
                        <button class="notification-test" id="notification-test-${this.id}">
                            <i class="fas fa-play"></i>
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
        
        // Set up control event listeners
        if (showControls) {
            this.setupNotificationControls();
        }
        
        // Initialize notification manager
        this.initializeNotificationManager();
        
        // Initialize notification state
        this.state.enabled = true;
        this.state.settings = {};
    }

    setupNotificationControls() {
        const toggleBtn = document.getElementById(`notification-toggle-${this.id}`);
        const testBtn = document.getElementById(`notification-test-${this.id}`);
        
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleNotifications());
        }
        
        if (testBtn) {
            testBtn.addEventListener('click', () => this.testNotifications());
        }
    }

    async initializeNotificationManager() {
        // Initialize global notification manager if available
        if (window.notificationManager) {
            await window.notificationManager.initialize(this.context.roomId);
            this.notificationManager = window.notificationManager;
        } else {
            console.warn('NotificationManager not available');
        }
    }

    toggleNotifications() {
        this.state.enabled = !this.state.enabled;
        
        if (this.notificationManager) {
            this.notificationManager.setEnabled(this.state.enabled);
        }
        
        this.updateNotificationStatus();
        this.emitEvent('notifications:toggled', { 
            componentId: this.id, 
            enabled: this.state.enabled 
        });
    }

    async testNotifications() {
        if (!this.notificationManager || !this.state.enabled) {
            console.log('Notifications disabled or manager not available');
            return;
        }

        // Test different notification types
        const testSequence = [
            'player_hint_receive',
            'player_chat_send', 
            'player_chat_receive',
            'gm_chat_receive'
        ];

        for (let i = 0; i < testSequence.length; i++) {
            setTimeout(() => {
                this.notificationManager.testNotification(testSequence[i]);
            }, i * 1000);
        }
        
        this.emitEvent('notifications:test-started', { componentId: this.id });
    }

    updateNotificationStatus() {
        const status = document.getElementById(`notifications-status-${this.id}`);
        const toggle = document.getElementById(`notification-toggle-${this.id}`);
        
        if (status) {
            const icon = status.querySelector('.status-icon');
            const text = status.querySelector('.status-text');
            
            if (icon) {
                icon.textContent = this.state.enabled ? '🔊' : '🔇';
            }
            
            if (text) {
                text.textContent = this.state.enabled ? 'Enabled' : 'Disabled';
            }
        }
        
        if (toggle) {
            const icon = toggle.querySelector('i');
            if (icon) {
                icon.className = this.state.enabled ? 'fas fa-volume-up' : 'fas fa-volume-mute';
            }
        }
    }

    // Convenience methods for triggering notifications
    async playHintReceived() {
        if (this.notificationManager && this.state.enabled) {
            await this.notificationManager.onHintReceived();
        }
    }

    async playChatSent() {
        if (this.notificationManager && this.state.enabled) {
            await this.notificationManager.onChatSent();
        }
    }

    async playChatReceived() {
        if (this.notificationManager && this.state.enabled) {
            await this.notificationManager.onChatReceived();
        }
    }

    async playGMChatReceived() {
        if (this.notificationManager && this.state.enabled) {
            await this.notificationManager.onGMChatReceived();
        }
    }

    async playVariableTriggered(variableName) {
        if (this.notificationManager && this.state.enabled) {
            await this.notificationManager.onVariableTriggered(variableName);
        }
    }

    async playMediaReceived() {
        if (this.notificationManager && this.state.enabled) {
            await this.notificationManager.onMediaReceived();
        }
    }

    // Handle external notification requests
    async handleNotificationRequest(type, data) {
        switch (type) {
            case 'hint_received':
                await this.playHintReceived();
                break;
            case 'chat_sent':
                await this.playChatSent();
                break;
            case 'chat_received':
                await this.playChatReceived();
                break;
            case 'gm_chat_received':
                await this.playGMChatReceived();
                break;
            case 'variable_triggered':
                await this.playVariableTriggered(data.variableName);
                break;
            case 'media_received':
                await this.playMediaReceived();
                break;
            default:
                console.warn(`Unknown notification type: ${type}`);
        }
    }

    // Update notification settings
    async updateSettings(settings) {
        this.state.settings = { ...this.state.settings, ...settings };
        
        if (this.notificationManager) {
            for (const [type, setting] of Object.entries(settings)) {
                this.notificationManager.updateSetting(type, setting);
            }
        }
        
        this.emitEvent('notifications:settings-updated', { 
            componentId: this.id, 
            settings: this.state.settings 
        });
    }

    // Get current notification settings
    getSettings() {
        if (this.notificationManager) {
            return this.notificationManager.getSettings();
        }
        return this.state.settings;
    }
}

/**
 * Event Bus for Component Interface
 */
class EventBus {
    constructor() {
        this.events = {};
        this.onceEvents = {};
    }

    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    once(event, callback) {
        if (!this.onceEvents[event]) {
            this.onceEvents[event] = [];
        }
        this.onceEvents[event].push(callback);
    }

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

    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event handler for ${event}:`, error);
                }
            });
        }

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

    destroy() {
        this.events = {};
        this.onceEvents = {};
    }
}

// Initialize global component factory
window.componentFactory = new ComponentFactory();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.componentFactory.init();
    });
} else {
    window.componentFactory.init();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ComponentFactory,
        BaseComponent,
        TimerComponent,
        ChatComponent,
        HintsComponent,
        VariablesComponent,
        MediaComponent,
        RoomInfoComponent,
        GameStateComponent,
        NotificationsComponent,
        EventBus
    };
}