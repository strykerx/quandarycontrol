/**
 * Consolidated Core Application System
 * Consolidated from: app.js
 *
 * Main application initialization and core functionality
 */

class AppCore {
    constructor() {
        this.initialized = false;
        this.modules = new Map();
        this.config = {
            debug: false,
            apiVersion: 'v1',
            socketEnabled: true,
            autoThemeDetection: true
        };
        this.events = new EventTarget();
    }

    async initialize(options = {}) {
        if (this.initialized) {
            console.warn('AppCore already initialized');
            return;
        }

        // Merge configuration
        Object.assign(this.config, options);

        try {
            // Initialize core systems
            await this.initializeCore();

            // Initialize modules based on page context
            await this.initializeModulesForContext();

            // Setup global event listeners
            this.setupGlobalEventListeners();

            // Mark as initialized
            this.initialized = true;

            this.emit('app:initialized');
            console.log('AppCore initialized successfully');
        } catch (error) {
            console.error('Failed to initialize AppCore:', error);
            throw error;
        }
    }

    async initializeCore() {
        // Initialize notification manager if not already done
        if (!window.notificationManager && window.NotificationManager) {
            window.notificationManager = new NotificationManager();
        }

        // Initialize UI state if not already done
        if (!window.uiState && window.UIStateManager) {
            window.uiState = new UIStateManager();
            window.uiState.loadPersistedState();
        }

        // Initialize theme manager if not already done
        if (!window.themeManager && window.UnifiedThemeManager) {
            window.themeManager = new UnifiedThemeManager();
            await window.themeManager.initialize();
        }

        // Initialize component integration if not already done
        if (!window.componentIntegration && window.ComponentIntegration) {
            window.componentIntegration = new ComponentIntegration();
            window.componentIntegration.initialize();
        }
    }

    async initializeModulesForContext() {
        const pathname = window.location.pathname;
        const context = this.detectPageContext(pathname);

        console.log('Detected page context:', context);

        switch (context.type) {
            case 'admin':
                await this.initializeAdminContext();
                break;
            case 'gm':
                await this.initializeGMContext();
                break;
            case 'player':
                await this.initializePlayerContext(context);
                break;
            case 'rules':
                await this.initializeRulesContext();
                break;
            default:
                console.log('No specific context detected, using default initialization');
        }
    }

    detectPageContext(pathname) {
        // Admin pages
        if (pathname.includes('admin') || pathname === '/' || pathname === '/index.html') {
            return { type: 'admin' };
        }

        // GM interface
        if (pathname.includes('gm.html')) {
            return { type: 'gm' };
        }

        // Player interface
        if (pathname.includes('player.html') || pathname.startsWith('/p/')) {
            return {
                type: 'player',
                mode: pathname.includes('bare') ? 'bare' : 'full',
                roomId: this.extractRoomIdFromPath(pathname)
            };
        }

        // Rules editor
        if (pathname.includes('rules-editor.html')) {
            return { type: 'rules' };
        }

        // Android TV
        if (pathname.includes('androidtv.html')) {
            return { type: 'androidtv' };
        }

        return { type: 'unknown' };
    }

    extractRoomIdFromPath(pathname) {
        const segments = pathname.split('/').filter(s => s);

        // Handle shortcode format /p/ABCD
        if (segments[0] === 'p' && segments[1]) {
            return segments[1];
        }

        // Handle direct room ID
        if (segments.length > 0) {
            return segments[0];
        }

        return null;
    }

    async initializeAdminContext() {
        console.log('Initializing admin context');

        // Initialize admin-specific modules
        this.modules.set('admin', {
            type: 'admin',
            initialized: true
        });

        // Setup admin-specific event handlers
        this.setupAdminEventHandlers();
    }

    async initializeGMContext() {
        console.log('Initializing GM context');

        const roomId = this.getRoomIdFromUrl();
        if (roomId) {
            // Initialize variable manager for GM interface
            if (window.VariableManager && !window.variableManager) {
                window.variableManager = new VariableManager(roomId);
                await window.variableManager.initialize();
            }
        }

        this.modules.set('gm', {
            type: 'gm',
            roomId: roomId,
            initialized: true
        });
    }

    async initializePlayerContext(context) {
        console.log('Initializing player context:', context);

        // Player initialization is handled by player-core.js
        // Just register the module
        this.modules.set('player', {
            type: 'player',
            mode: context.mode,
            roomId: context.roomId,
            initialized: true
        });
    }

    async initializeRulesContext() {
        console.log('Initializing rules context');

        this.modules.set('rules', {
            type: 'rules',
            initialized: true
        });
    }

    setupGlobalEventListeners() {
        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.emit('app:focus');
            } else {
                this.emit('app:blur');
            }
        });

        // Handle window resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.emit('app:resize', {
                    width: window.innerWidth,
                    height: window.innerHeight
                });
            }, 250);
        });

        // Handle online/offline status
        window.addEventListener('online', () => {
            this.emit('app:online');
            if (window.notificationManager) {
                window.notificationManager.success('Connection restored');
            }
        });

        window.addEventListener('offline', () => {
            this.emit('app:offline');
            if (window.notificationManager) {
                window.notificationManager.warning('Connection lost');
            }
        });

        // Handle unload
        window.addEventListener('beforeunload', () => {
            this.emit('app:beforeunload');
        });
    }

    setupAdminEventHandlers() {
        // Handle navigation between admin sections
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-admin-nav]')) {
                e.preventDefault();
                const section = e.target.dataset.adminNav;
                this.navigateToSection(section);
            }
        });
    }

    navigateToSection(section) {
        // Update UI state
        if (window.uiState) {
            window.uiState.setCurrentView(section);
        }

        // Update URL without page reload
        const url = new URL(window.location);
        url.searchParams.set('section', section);
        window.history.pushState({ section }, '', url);

        this.emit('app:navigate', { section });
    }

    getRoomIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('room') || urlParams.get('roomId');
    }

    // API helper methods
    async apiRequest(endpoint, options = {}) {
        const baseUrl = `/api/${this.config.apiVersion}`;
        const url = endpoint.startsWith('/') ? `${baseUrl}${endpoint}` : `${baseUrl}/${endpoint}`;

        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const mergedOptions = { ...defaultOptions, ...options };

        try {
            const response = await fetch(url, mergedOptions);
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'API request failed');
            }

            return result;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Event system
    emit(eventName, data = {}) {
        this.events.dispatchEvent(new CustomEvent(eventName, { detail: data }));
    }

    on(eventName, handler) {
        this.events.addEventListener(eventName, handler);
    }

    off(eventName, handler) {
        this.events.removeEventListener(eventName, handler);
    }

    // Module management
    registerModule(name, moduleInstance) {
        this.modules.set(name, moduleInstance);
    }

    getModule(name) {
        return this.modules.get(name);
    }

    getAllModules() {
        return Array.from(this.modules.entries());
    }

    // Utility methods
    showError(message, title = 'Error') {
        if (window.notificationManager) {
            window.notificationManager.error(message, { title });
        } else {
            console.error(`${title}: ${message}`);
            alert(`${title}: ${message}`);
        }
    }

    showSuccess(message, title = 'Success') {
        if (window.notificationManager) {
            window.notificationManager.success(message, { title });
        } else {
            console.log(`${title}: ${message}`);
        }
    }

    showWarning(message, title = 'Warning') {
        if (window.notificationManager) {
            window.notificationManager.warning(message, { title });
        } else {
            console.warn(`${title}: ${message}`);
        }
    }

    // Debug helpers
    enableDebug() {
        this.config.debug = true;
        window.appDebug = {
            app: this,
            modules: this.modules,
            config: this.config
        };
        console.log('Debug mode enabled. Access via window.appDebug');
    }

    disableDebug() {
        this.config.debug = false;
        delete window.appDebug;
        console.log('Debug mode disabled');
    }

    // App state
    getState() {
        return {
            initialized: this.initialized,
            config: { ...this.config },
            modules: Array.from(this.modules.keys()),
            context: this.detectPageContext(window.location.pathname)
        };
    }

    // Cleanup
    destroy() {
        this.emit('app:beforedestroy');

        // Cleanup modules
        this.modules.forEach((module, name) => {
            if (module && typeof module.destroy === 'function') {
                try {
                    module.destroy();
                } catch (error) {
                    console.error(`Error destroying module ${name}:`, error);
                }
            }
        });

        this.modules.clear();
        this.initialized = false;

        this.emit('app:destroyed');
    }
}

// Global app instance
let appInstance = null;

function initializeApp(options = {}) {
    if (appInstance) {
        console.warn('App already initialized');
        return appInstance;
    }

    appInstance = new AppCore();

    // Auto-detect debug mode
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('debug')) {
        options.debug = true;
    }

    // Initialize immediately if DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            appInstance.initialize(options);
        });
    } else {
        appInstance.initialize(options);
    }

    // Make available globally
    window.app = appInstance;

    if (options.debug) {
        appInstance.enableDebug();
    }

    return appInstance;
}

// Auto-initialize
if (!window.app) {
    initializeApp();
}

// Export
window.AppCore = AppCore;
window.initializeApp = initializeApp;

console.log('AppCore system loaded');