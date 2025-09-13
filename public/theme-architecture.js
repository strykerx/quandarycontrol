/**
 * Plug-and-Play Theme Architecture
 * Implements separated component logic and visual styling system
 */

class ThemeArchitecture {
    constructor() {
        this.components = new Map();
        this.themes = new Map();
        this.activeTheme = null;
        this.componentRegistry = new ComponentRegistry();
        this.themeLoader = new ThemeLoader();
        this.eventBus = new EventBus();
        
        this.init();
    }

    init() {
        // Initialize core system
        this.setupEventListeners();
        this.registerCoreComponents();
        this.loadAvailableThemes();
        
        console.log('Theme Architecture initialized');
    }

    setupEventListeners() {
        // Listen for theme changes
        this.eventBus.on('theme:changed', (themeData) => {
            this.applyTheme(themeData);
        });

        // Listen for component registration
        this.eventBus.on('component:registered', (componentData) => {
            this.registerComponent(componentData);
        });
    }

    registerCoreComponents() {
        // Register built-in components with their logic separated from styling
        const coreComponents = [
            {
                id: 'timer',
                name: 'Timer',
                logic: TimerComponentLogic,
                defaultConfig: {
                    format: 'mm:ss',
                    showControls: true,
                    updateInterval: 1000
                }
            },
            {
                id: 'chat',
                name: 'Chat',
                logic: ChatComponentLogic,
                defaultConfig: {
                    maxMessages: 50,
                    showTimestamps: true,
                    allowUserInput: true
                }
            },
            {
                id: 'hints',
                name: 'Hints',
                logic: HintsComponentLogic,
                defaultConfig: {
                    maxHints: 10,
                    showNavigation: true,
                    autoCycle: false
                }
            },
            {
                id: 'variables',
                name: 'Variables',
                logic: VariablesComponentLogic,
                defaultConfig: {
                    updateInterval: 1000
                }
            },
            {
                id: 'media',
                name: 'Media',
                logic: MediaComponentLogic,
                defaultConfig: {
                    supportedFormats: ['jpg', 'png', 'gif', 'mp4', 'mp3']
                }
            },
            {
                id: 'room-info',
                name: 'Room Info',
                logic: RoomInfoComponentLogic,
                defaultConfig: {
                    showProgress: true
                }
            },
            {
                id: 'game-state',
                name: 'Game State',
                logic: GameStateComponentLogic,
                defaultConfig: {
                    showScore: true,
                    updateInterval: 1000
                }
            }
        ];

        coreComponents.forEach(component => {
            this.componentRegistry.register(component);
        });
    }

    async loadAvailableThemes() {
        try {
            const themes = await this.themeLoader.loadAllThemes();
            themes.forEach(theme => {
                this.themes.set(theme.id, theme);
            });
            
            this.eventBus.emit('themes:loaded', themes);
        } catch (error) {
            console.error('Failed to load themes:', error);
        }
    }

    async applyTheme(themeId) {
        const theme = this.themes.get(themeId);
        if (!theme) {
            throw new Error(`Theme ${themeId} not found`);
        }

        // Load theme assets
        const themeAssets = await this.themeLoader.loadThemeAssets(theme);
        
        // Apply theme configuration
        this.activeTheme = {
            ...theme,
            assets: themeAssets
        };

        // Apply CSS custom properties
        this.applyThemeVariables(theme.variables || {});
        
        // Apply component styles
        this.applyComponentStyles(theme.componentStyles || {});

        // Notify components of theme change
        this.eventBus.emit('theme:applied', this.activeTheme);
        
        console.log(`Theme ${theme.name} applied successfully`);
    }

    applyThemeVariables(variables) {
        const root = document.documentElement;
        
        Object.entries(variables).forEach(([key, value]) => {
            root.style.setProperty(`--${key}`, value);
        });
    }

    applyComponentStyles(componentStyles) {
        Object.entries(componentStyles).forEach(([componentId, styles]) => {
            const component = this.components.get(componentId);
            if (component) {
                component.applyStyles(styles);
            }
        });
    }

    registerComponent(componentData) {
        const component = new ThemeComponent(componentData);
        this.components.set(component.id, component);
        
        this.eventBus.emit('component:registered', component);
    }

    getComponent(componentId) {
        return this.components.get(componentId);
    }

    createComponent(componentId, config = {}) {
        const componentDefinition = this.componentRegistry.get(componentId);
        if (!componentDefinition) {
            throw new Error(`Component ${componentId} not found`);
        }

        const mergedConfig = {
            ...componentDefinition.defaultConfig,
            ...config
        };

        const component = new ThemeComponent({
            id: componentId,
            logic: componentDefinition.logic,
            config: mergedConfig
        });

        this.components.set(componentId, component);
        return component;
    }
}

/**
 * Component Registry - Manages available component types
 */
class ComponentRegistry {
    constructor() {
        this.components = new Map();
    }

    register(componentDefinition) {
        if (!componentDefinition.id || !componentDefinition.logic) {
            throw new Error('Component definition must include id and logic');
        }

        this.components.set(componentDefinition.id, componentDefinition);
        console.log(`Component ${componentDefinition.id} registered`);
    }

    get(componentId) {
        return this.components.get(componentId);
    }

    getAll() {
        return Array.from(this.components.values());
    }

    unregister(componentId) {
        this.components.delete(componentId);
    }
}

/**
 * Theme Loader - Handles theme loading and asset management
 */
class ThemeLoader {
    constructor() {
        this.cache = new Map();
    }

    async loadAllThemes() {
        try {
            const response = await fetch('/api/themes');
            const result = await response.json();
            
            if (result.success) {
                return result.data;
            } else {
                throw new Error(result.error || 'Failed to load themes');
            }
        } catch (error) {
            console.error('Error loading themes:', error);
            return [];
        }
    }

    async loadThemeAssets(theme) {
        const cacheKey = `theme-${theme.id}-assets`;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const assets = {};
            
            // Load CSS
            if (theme.assets?.css) {
                const cssResponse = await fetch(theme.assets.css);
                assets.css = await cssResponse.text();
            }
            
            // Load JavaScript
            if (theme.assets?.js) {
                const jsResponse = await fetch(theme.assets.js);
                assets.js = await jsResponse.text();
            }
            
            // Load configuration
            if (theme.assets?.config) {
                const configResponse = await fetch(theme.assets.config);
                assets.config = await configResponse.json();
            }

            this.cache.set(cacheKey, assets);
            return assets;
        } catch (error) {
            console.error(`Error loading assets for theme ${theme.id}:`, error);
            return {};
        }
    }

    clearCache() {
        this.cache.clear();
    }
}

/**
 * Theme Component - Individual component with separated logic and styling
 */
class ThemeComponent {
    constructor({ id, logic, config = {} }) {
        this.id = id;
        this.logic = new logic(config);
        this.config = config;
        this.element = null;
        this.styles = null;
        this.eventBus = new EventBus();
        
        this.init();
    }

    init() {
        // Initialize component logic
        if (this.logic.init) {
            this.logic.init();
        }
        
        // Set up event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Listen for config changes
        this.eventBus.on('config:changed', (newConfig) => {
            this.updateConfig(newConfig);
        });

        // Listen for theme changes
        this.eventBus.on('theme:changed', (themeData) => {
            this.onThemeChanged(themeData);
        });
    }

    render(container) {
        if (!this.element) {
            this.element = this.logic.render();
        }
        
        if (container) {
            container.appendChild(this.element);
        }
        
        return this.element;
    }

    applyStyles(styles) {
        this.styles = styles;
        
        if (this.element) {
            // Apply styles to component element
            Object.entries(styles).forEach(([property, value]) => {
                this.element.style[property] = value;
            });
        }
        
        // Notify logic of style changes
        if (this.logic.onStyleApplied) {
            this.logic.onStyleApplied(styles);
        }
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        if (this.logic.onConfigChanged) {
            this.logic.onConfigChanged(this.config);
        }
    }

    onThemeChanged(themeData) {
        if (this.logic.onThemeChanged) {
            this.logic.onThemeChanged(themeData);
        }
    }

    destroy() {
        if (this.logic.destroy) {
            this.logic.destroy();
        }
        
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        this.eventBus.destroy();
    }
}

/**
 * Event Bus - Simple event system for component communication
 */
class EventBus {
    constructor() {
        this.events = {};
    }

    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    off(event, callback) {
        if (!this.events[event]) return;
        
        const index = this.events[event].indexOf(callback);
        if (index > -1) {
            this.events[event].splice(index, 1);
        }
    }

    emit(event, data) {
        if (!this.events[event]) return;
        
        this.events[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event handler for ${event}:`, error);
            }
        });
    }

    destroy() {
        this.events = {};
    }
}

/**
 * Component Logic Classes - Separated from styling
 */

class TimerComponentLogic {
    constructor(config) {
        this.config = config;
        this.timer = null;
        this.display = null;
        this.startTime = null;
        this.elapsed = 0;
        this.isRunning = false;
    }

    init() {
        // Initialize timer logic
        this.setupTimer();
    }

    setupTimer() {
        // Timer setup logic without styling concerns
        this.updateDisplay();
    }

    start() {
        if (!this.isRunning) {
            this.startTime = Date.now() - this.elapsed;
            this.isRunning = true;
            this.tick();
        }
    }

    stop() {
        this.isRunning = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    reset() {
        this.stop();
        this.elapsed = 0;
        this.updateDisplay();
    }

    tick() {
        if (this.isRunning) {
            this.elapsed = Date.now() - this.startTime;
            this.updateDisplay();
            this.timer = setTimeout(() => this.tick(), this.config.updateInterval);
        }
    }

    updateDisplay() {
        if (this.display) {
            const time = this.formatTime(this.elapsed);
            this.display.textContent = time;
        }
    }

    formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    render() {
        const container = document.createElement('div');
        container.className = 'timer-component';
        
        this.display = document.createElement('div');
        this.display.className = 'timer-display';
        container.appendChild(this.display);
        
        if (this.config.showControls) {
            const controls = document.createElement('div');
            controls.className = 'timer-controls';
            
            const startBtn = document.createElement('button');
            startBtn.textContent = 'Start';
            startBtn.addEventListener('click', () => this.start());
            controls.appendChild(startBtn);
            
            const stopBtn = document.createElement('button');
            stopBtn.textContent = 'Stop';
            stopBtn.addEventListener('click', () => this.stop());
            controls.appendChild(stopBtn);
            
            const resetBtn = document.createElement('button');
            resetBtn.textContent = 'Reset';
            resetBtn.addEventListener('click', () => this.reset());
            controls.appendChild(resetBtn);
            
            container.appendChild(controls);
        }
        
        return container;
    }

    onConfigChanged(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.updateDisplay();
    }

    onStyleApplied(styles) {
        // Handle style changes if needed
    }

    onThemeChanged(themeData) {
        // Handle theme changes if needed
    }

    destroy() {
        this.stop();
        if (this.timer) {
            clearTimeout(this.timer);
        }
    }
}

class ChatComponentLogic {
    constructor(config) {
        this.config = config;
        this.messages = [];
        this.socket = null;
        this.roomId = null;
        this.chatLog = null;
        this.input = null;
    }

    init() {
        this.setupSocketConnection();
        this.setupChatInterface();
    }

    setupSocketConnection() {
        // Socket connection logic
        if (window.socket) {
            this.socket = window.socket;
            this.setupSocketListeners();
        }
    }

    setupSocketListeners() {
        this.socket.on('chat_message', (data) => {
            this.addMessage(data);
        });

        this.socket.on('clear_chat', () => {
            this.clearChat();
        });
    }

    setupChatInterface() {
        // Chat interface setup logic
    }

    addMessage(data) {
        this.messages.push(data);
        
        if (this.messages.length > this.config.maxMessages) {
            this.messages.shift();
        }
        
        this.updateChatDisplay();
    }

    updateChatDisplay() {
        if (this.chatLog) {
            this.chatLog.innerHTML = '';
            
            this.messages.forEach(message => {
                const messageEl = document.createElement('div');
                messageEl.className = `chat-message ${message.sender}`;
                
                let content = message.message;
                if (this.config.showTimestamps && message.timestamp) {
                    const timestamp = new Date(message.timestamp).toLocaleTimeString();
                    content += ` [${timestamp}]`;
                }
                
                messageEl.textContent = content;
                this.chatLog.appendChild(messageEl);
            });
            
            this.chatLog.scrollTop = this.chatLog.scrollHeight;
        }
    }

    clearChat() {
        this.messages = [];
        this.updateChatDisplay();
    }

    sendMessage(message) {
        if (this.socket && this.roomId && message.trim()) {
            const messageData = {
                roomId: this.roomId,
                sender: 'player',
                message: message.trim(),
                timestamp: new Date().toISOString()
            };
            
            this.socket.emit('chat_message', messageData);
        }
    }

    render() {
        const container = document.createElement('div');
        container.className = 'chat-component';
        
        const header = document.createElement('div');
        header.className = 'chat-header';
        header.textContent = 'Chat';
        container.appendChild(header);
        
        this.chatLog = document.createElement('div');
        this.chatLog.className = 'chat-log';
        container.appendChild(this.chatLog);
        
        if (this.config.allowUserInput) {
            const inputContainer = document.createElement('div');
            inputContainer.className = 'chat-input-container';
            
            this.input = document.createElement('input');
            this.input.type = 'text';
            this.input.className = 'chat-input';
            this.input.placeholder = 'Type a message...';
            inputContainer.appendChild(this.input);
            
            const sendBtn = document.createElement('button');
            sendBtn.className = 'chat-submit';
            sendBtn.textContent = 'Send';
            sendBtn.addEventListener('click', () => {
                this.sendMessage(this.input.value);
                this.input.value = '';
            });
            inputContainer.appendChild(sendBtn);
            
            container.appendChild(inputContainer);
        }
        
        return container;
    }

    onConfigChanged(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.updateChatDisplay();
    }

    onStyleApplied(styles) {
        // Handle style changes
    }

    onThemeChanged(themeData) {
        // Handle theme changes
    }

    destroy() {
        if (this.socket) {
            this.socket.off('chat_message');
            this.socket.off('clear_chat');
        }
    }
}

class HintsComponentLogic {
    constructor(config) {
        this.config = config;
        this.hints = [];
        this.currentIndex = 0;
    }

    init() {
        this.setupHints();
    }

    setupHints() {
        // Hints setup logic
    }

    addHint(hint) {
        this.hints.push(hint);
        
        if (this.hints.length > this.config.maxHints) {
            this.hints.shift();
        }
        
        this.updateHintsDisplay();
    }

    updateHintsDisplay() {
        // Update hints display logic
    }

    render() {
        const container = document.createElement('div');
        container.className = 'hints-component';
        
        const header = document.createElement('div');
        header.className = 'hints-header';
        header.textContent = 'Hints';
        container.appendChild(header);
        
        const hintContainer = document.createElement('div');
        hintContainer.className = 'hint-container';
        container.appendChild(hintContainer);
        
        if (this.config.showNavigation) {
            const navigation = document.createElement('div');
            navigation.className = 'hint-navigation';
            
            const prevBtn = document.createElement('button');
            prevBtn.textContent = 'Previous';
            prevBtn.addEventListener('click', () => this.showPreviousHint());
            navigation.appendChild(prevBtn);
            
            const nextBtn = document.createElement('button');
            nextBtn.textContent = 'Next';
            nextBtn.addEventListener('click', () => this.showNextHint());
            navigation.appendChild(nextBtn);
            
            container.appendChild(navigation);
        }
        
        return container;
    }

    showPreviousHint() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.updateHintsDisplay();
        }
    }

    showNextHint() {
        if (this.currentIndex < this.hints.length - 1) {
            this.currentIndex++;
            this.updateHintsDisplay();
        }
    }

    onConfigChanged(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    onStyleApplied(styles) {
        // Handle style changes
    }

    onThemeChanged(themeData) {
        // Handle theme changes
    }

    destroy() {
        // Cleanup
    }
}

class VariablesComponentLogic {
    constructor(config) {
        this.config = config;
        this.variables = {};
        this.updateInterval = null;
    }

    init() {
        this.setupVariables();
        this.startUpdates();
    }

    setupVariables() {
        // Variables setup logic
    }

    startUpdates() {
        if (this.config.updateInterval > 0) {
            this.updateInterval = setInterval(() => {
                this.updateVariables();
            }, this.config.updateInterval);
        }
    }

    updateVariables() {
        // Update variables logic
        this.updateVariablesDisplay();
    }

    updateVariablesDisplay() {
        // Update variables display logic
    }

    render() {
        const container = document.createElement('div');
        container.className = 'variables-component';
        
        const header = document.createElement('div');
        header.className = 'variables-header';
        header.textContent = 'Variables';
        container.appendChild(header);
        
        const display = document.createElement('div');
        display.className = 'variable-display';
        container.appendChild(display);
        
        return container;
    }

    onConfigChanged(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        // Restart updates with new interval
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.startUpdates();
    }

    onStyleApplied(styles) {
        // Handle style changes
    }

    onThemeChanged(themeData) {
        // Handle theme changes
    }

    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }
}

class MediaComponentLogic {
    constructor(config) {
        this.config = config;
        this.currentMedia = null;
    }

    init() {
        this.setupMediaHandling();
    }

    setupMediaHandling() {
        // Media handling logic
    }

    showMedia(mediaUrl) {
        // Show media logic
    }

    render() {
        const container = document.createElement('div');
        container.className = 'media-component';
        
        return container;
    }

    onConfigChanged(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    onStyleApplied(styles) {
        // Handle style changes
    }

    onThemeChanged(themeData) {
        // Handle theme changes
    }

    destroy() {
        // Cleanup
    }
}

class RoomInfoComponentLogic {
    constructor(config) {
        this.config = config;
        this.roomInfo = {};
    }

    init() {
        this.setupRoomInfo();
    }

    setupRoomInfo() {
        // Room info setup logic
    }

    updateRoomInfo(info) {
        this.roomInfo = { ...this.roomInfo, ...info };
        this.updateRoomInfoDisplay();
    }

    updateRoomInfoDisplay() {
        // Update room info display logic
    }

    render() {
        const container = document.createElement('div');
        container.className = 'room-info-component';
        
        const title = document.createElement('div');
        title.className = 'room-title';
        container.appendChild(title);
        
        const info = document.createElement('div');
        info.className = 'room-info';
        container.appendChild(info);
        
        if (this.config.showProgress) {
            const progress = document.createElement('div');
            progress.className = 'room-progress';
            container.appendChild(progress);
        }
        
        return container;
    }

    onConfigChanged(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    onStyleApplied(styles) {
        // Handle style changes
    }

    onThemeChanged(themeData) {
        // Handle theme changes
    }

    destroy() {
        // Cleanup
    }
}

class GameStateComponentLogic {
    constructor(config) {
        this.config = config;
        this.gameState = {};
        this.updateInterval = null;
    }

    init() {
        this.setupGameState();
        this.startUpdates();
    }

    setupGameState() {
        // Game state setup logic
    }

    startUpdates() {
        if (this.config.updateInterval > 0) {
            this.updateInterval = setInterval(() => {
                this.updateGameState();
            }, this.config.updateInterval);
        }
    }

    updateGameState() {
        // Update game state logic
        this.updateGameStateDisplay();
    }

    updateGameStateDisplay() {
        // Update game state display logic
    }

    render() {
        const container = document.createElement('div');
        container.className = 'game-state-component';
        
        if (this.config.showScore) {
            const score = document.createElement('div');
            score.className = 'game-score';
            container.appendChild(score);
        }
        
        const status = document.createElement('div');
        status.className = 'game-status';
        container.appendChild(status);
        
        const config = document.createElement('div');
        config.className = 'config-display';
        container.appendChild(config);
        
        return container;
    }

    onConfigChanged(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        // Restart updates with new interval
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.startUpdates();
    }

    onStyleApplied(styles) {
        // Handle style changes
    }

    onThemeChanged(themeData) {
        // Handle theme changes
    }

    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }
}

// Initialize global theme architecture
window.themeArchitecture = new ThemeArchitecture();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeArchitecture;
}