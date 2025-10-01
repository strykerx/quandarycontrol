/**
 * Unified Theme Management System
 * Consolidated from: theme-registry.js, theme-architecture.js, theme-component-interface.js,
 * theme-configurator.js, theme-gallery.js, theme-inheritance.js
 *
 * Manages theme loading, configuration, inheritance, and component interfaces
 * while keeping individual theme files in /themes/ directory separate
 */

// Event Bus for theme system communication
class EventBus {
    constructor() {
        this.events = new Map();
    }

    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push(callback);
    }

    emit(event, data) {
        if (this.events.has(event)) {
            this.events.get(event).forEach(callback => callback(data));
        }
    }

    off(event, callback) {
        if (this.events.has(event)) {
            const callbacks = this.events.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }
}

// Theme Registry - Core theme management
class ThemeRegistry {
    constructor() {
        this.themes = new Map();
        this.activeTheme = null;
        this.eventBus = new EventBus();
        this.initialized = false;
        this.loadingPromises = new Map();
        this.themeLoaders = new Map();
        this.validators = new Map();
        this.config = {
            defaultTheme: 'example-theme',
            enableHotReload: true,
            enableCache: true,
            cacheTimeout: 300000, // 5 minutes
            themePath: '/themes',
            allowedFileTypes: ['.css', '.js', '.html'],
            maxFileSize: 1024 * 1024 // 1MB
        };
    }

    async initialize() {
        if (this.initialized) return;

        try {
            await this.loadAvailableThemes();
            await this.loadDefaultTheme();
            this.setupEventListeners();
            this.initialized = true;
            this.eventBus.emit('registry:initialized');
        } catch (error) {
            console.error('Failed to initialize theme registry:', error);
            throw error;
        }
    }

    async loadAvailableThemes() {
        try {
            const response = await fetch('/api/v1/themes');
            const result = await response.json();

            if (result.success) {
                result.data.forEach(theme => {
                    this.themes.set(theme.id, {
                        ...theme,
                        loaded: false,
                        assets: new Map()
                    });
                });
            }
        } catch (error) {
            console.error('Failed to load available themes:', error);
        }
    }

    async loadTheme(themeId, options = {}) {
        if (this.loadingPromises.has(themeId)) {
            return this.loadingPromises.get(themeId);
        }

        const loadPromise = this._loadThemeInternal(themeId, options);
        this.loadingPromises.set(themeId, loadPromise);

        try {
            const result = await loadPromise;
            this.loadingPromises.delete(themeId);
            return result;
        } catch (error) {
            this.loadingPromises.delete(themeId);
            throw error;
        }
    }

    async _loadThemeInternal(themeId, options) {
        const theme = this.themes.get(themeId);
        if (!theme) {
            throw new Error(`Theme '${themeId}' not found`);
        }

        if (theme.loaded && !options.force) {
            return theme;
        }

        try {
            // Load theme assets
            const assetsResponse = await fetch(`/api/v1/themes/${themeId}/assets`);
            const assetsResult = await assetsResponse.json();

            if (assetsResult.success) {
                await this.loadThemeAssets(theme, assetsResult.data);
            }

            theme.loaded = true;
            theme.loadedAt = Date.now();

            this.eventBus.emit('theme:loaded', { themeId, theme });
            return theme;
        } catch (error) {
            console.error(`Failed to load theme '${themeId}':`, error);
            throw error;
        }
    }

    async loadThemeAssets(theme, assets) {
        const loadPromises = assets.map(async (asset) => {
            if (this.config.allowedFileTypes.includes(asset.name.substring(asset.name.lastIndexOf('.')))) {
                try {
                    const response = await fetch(asset.path);
                    if (response.ok) {
                        const content = await response.text();
                        theme.assets.set(asset.name, {
                            content,
                            size: asset.size,
                            modified: asset.modified,
                            path: asset.path
                        });
                    }
                } catch (error) {
                    console.warn(`Failed to load asset ${asset.name}:`, error);
                }
            }
        });

        await Promise.allSettled(loadPromises);
    }

    async activateTheme(themeId) {
        try {
            const theme = await this.loadTheme(themeId);

            if (this.activeTheme && this.activeTheme.id !== themeId) {
                await this.deactivateCurrentTheme();
            }

            await this.applyTheme(theme);
            this.activeTheme = theme;

            this.eventBus.emit('theme:activated', { themeId, theme });
            return theme;
        } catch (error) {
            console.error(`Failed to activate theme '${themeId}':`, error);
            throw error;
        }
    }

    async applyTheme(theme) {
        // Apply CSS
        if (theme.assets.has('style.css')) {
            this.applyThemeCSS(theme.assets.get('style.css').content, theme.id);
        }

        // Apply JavaScript
        if (theme.assets.has('script.js')) {
            this.applyThemeScript(theme.assets.get('script.js').content, theme.id);
        }

        // Apply theme to room if we have room context
        if (window.ROOM_ID) {
            try {
                const response = await fetch(`/api/v1/rooms/${window.ROOM_ID}/theme`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ themeId: theme.id })
                });

                if (!response.ok) {
                    console.warn('Failed to apply theme to room');
                }
            } catch (error) {
                console.warn('Failed to apply theme to room:', error);
            }
        }
    }

    applyThemeCSS(css, themeId) {
        // Remove previous theme CSS
        const existingStyle = document.getElementById(`theme-style-${this.activeTheme?.id}`);
        if (existingStyle) {
            existingStyle.remove();
        }

        // Add new theme CSS
        const styleElement = document.createElement('style');
        styleElement.id = `theme-style-${themeId}`;
        styleElement.textContent = css;
        document.head.appendChild(styleElement);
    }

    applyThemeScript(script, themeId) {
        try {
            // Create isolated execution context for theme script
            const scriptFunction = new Function('theme', script);
            scriptFunction.call(null, { id: themeId, eventBus: this.eventBus });
        } catch (error) {
            console.error(`Error executing theme script for '${themeId}':`, error);
        }
    }

    async deactivateCurrentTheme() {
        if (!this.activeTheme) return;

        const themeId = this.activeTheme.id;

        // Remove theme CSS
        const styleElement = document.getElementById(`theme-style-${themeId}`);
        if (styleElement) {
            styleElement.remove();
        }

        this.eventBus.emit('theme:deactivated', { themeId });
        this.activeTheme = null;
    }

    async loadDefaultTheme() {
        const defaultThemeId = this.config.defaultTheme;
        if (this.themes.has(defaultThemeId)) {
            await this.activateTheme(defaultThemeId);
        }
    }

    setupEventListeners() {
        // Listen for theme changes from other parts of the application
        this.eventBus.on('theme:change-request', async (data) => {
            try {
                await this.activateTheme(data.themeId);
            } catch (error) {
                console.error('Failed to change theme:', error);
                this.eventBus.emit('theme:change-failed', { error });
            }
        });
    }

    getTheme(themeId) {
        return this.themes.get(themeId);
    }

    getActiveTheme() {
        return this.activeTheme;
    }

    getAllThemes() {
        return Array.from(this.themes.values());
    }
}

// Theme Configurator - Theme customization and settings
class ThemeConfigurator {
    constructor(registry) {
        this.registry = registry;
        this.customizations = new Map();
        this.persistentStorage = localStorage;
    }

    async loadCustomizations(themeId) {
        const key = `theme_customizations_${themeId}`;
        try {
            const stored = this.persistentStorage.getItem(key);
            if (stored) {
                const customizations = JSON.parse(stored);
                this.customizations.set(themeId, customizations);
                return customizations;
            }
        } catch (error) {
            console.warn('Failed to load theme customizations:', error);
        }
        return {};
    }

    saveCustomizations(themeId, customizations) {
        const key = `theme_customizations_${themeId}`;
        try {
            this.customizations.set(themeId, customizations);
            this.persistentStorage.setItem(key, JSON.stringify(customizations));
            this.registry.eventBus.emit('theme:customizations-saved', { themeId, customizations });
        } catch (error) {
            console.error('Failed to save theme customizations:', error);
        }
    }

    applyCustomizations(themeId, customizations) {
        const theme = this.registry.getTheme(themeId);
        if (!theme) return;

        // Apply CSS custom properties
        if (customizations.cssVariables) {
            const root = document.documentElement;
            Object.entries(customizations.cssVariables).forEach(([property, value]) => {
                root.style.setProperty(property, value);
            });
        }

        // Apply component overrides
        if (customizations.components) {
            this.applyComponentCustomizations(customizations.components);
        }
    }

    applyComponentCustomizations(componentCustomizations) {
        Object.entries(componentCustomizations).forEach(([componentName, settings]) => {
            const elements = document.querySelectorAll(`[data-component="${componentName}"]`);
            elements.forEach(element => {
                if (settings.styles) {
                    Object.assign(element.style, settings.styles);
                }
                if (settings.attributes) {
                    Object.entries(settings.attributes).forEach(([attr, value]) => {
                        element.setAttribute(attr, value);
                    });
                }
            });
        });
    }
}

// Theme Gallery - Theme browsing and selection interface
class ThemeGallery {
    constructor(registry, configurator) {
        this.registry = registry;
        this.configurator = configurator;
        this.container = null;
        this.initialized = false;
    }

    async initialize(containerSelector) {
        this.container = document.querySelector(containerSelector);
        if (!this.container) {
            throw new Error(`Gallery container '${containerSelector}' not found`);
        }

        await this.render();
        this.setupEventListeners();
        this.initialized = true;
    }

    async render() {
        if (!this.container) return;

        const themes = this.registry.getAllThemes();
        const activeTheme = this.registry.getActiveTheme();

        this.container.innerHTML = `
            <div class="theme-gallery">
                <div class="gallery-header">
                    <h3>Theme Gallery</h3>
                    <div class="gallery-controls">
                        <button id="refresh-themes" class="btn btn-secondary">Refresh</button>
                    </div>
                </div>
                <div class="gallery-grid">
                    ${themes.map(theme => this.renderThemeCard(theme, activeTheme?.id === theme.id)).join('')}
                </div>
            </div>
        `;
    }

    renderThemeCard(theme, isActive) {
        return `
            <div class="theme-card ${isActive ? 'active' : ''}" data-theme-id="${theme.id}">
                <div class="theme-preview">
                    <div class="preview-content">
                        <h4>${theme.name}</h4>
                        <p>${theme.description || 'No description available'}</p>
                    </div>
                </div>
                <div class="theme-info">
                    <div class="theme-meta">
                        <span class="author">by ${theme.author || 'Unknown'}</span>
                        <span class="version">v${theme.version || '1.0.0'}</span>
                    </div>
                    <div class="theme-actions">
                        <button class="btn btn-primary activate-theme"
                                data-theme-id="${theme.id}"
                                ${isActive ? 'disabled' : ''}>
                            ${isActive ? 'Active' : 'Activate'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        if (!this.container) return;

        // Theme activation
        this.container.addEventListener('click', async (e) => {
            if (e.target.classList.contains('activate-theme')) {
                const themeId = e.target.dataset.themeId;
                try {
                    await this.registry.activateTheme(themeId);
                    await this.render(); // Re-render to update active states
                } catch (error) {
                    console.error('Failed to activate theme:', error);
                }
            }

            if (e.target.id === 'refresh-themes') {
                await this.registry.loadAvailableThemes();
                await this.render();
            }
        });

        // Listen for theme changes
        this.registry.eventBus.on('theme:activated', () => {
            if (this.initialized) {
                this.render();
            }
        });
    }
}

// Theme Component Interface - Integration with other systems
class ThemeComponentInterface {
    constructor(registry) {
        this.registry = registry;
        this.componentAdapters = new Map();
        this.interfaceConfig = {
            autoDetectComponents: true,
            componentSelector: '[data-theme-component]',
            updateOnThemeChange: true
        };
    }

    initialize() {
        this.setupDefaultAdapters();
        if (this.interfaceConfig.autoDetectComponents) {
            this.detectAndRegisterComponents();
        }
        this.setupEventListeners();
    }

    setupDefaultAdapters() {
        // Timer component adapter
        this.registerComponentAdapter('timer', {
            selector: '.timer-display, [data-component="timer"]',
            applyTheme: (elements, theme) => {
                elements.forEach(el => {
                    el.setAttribute('data-theme', theme.id);
                    if (theme.config?.timer) {
                        Object.assign(el.style, theme.config.timer.styles || {});
                    }
                });
            }
        });

        // Button component adapter
        this.registerComponentAdapter('buttons', {
            selector: '.btn, button[data-theme-component]',
            applyTheme: (elements, theme) => {
                elements.forEach(el => {
                    el.setAttribute('data-theme', theme.id);
                    if (theme.config?.buttons) {
                        Object.assign(el.style, theme.config.buttons.styles || {});
                    }
                });
            }
        });
    }

    registerComponentAdapter(componentName, adapter) {
        this.componentAdapters.set(componentName, adapter);
    }

    detectAndRegisterComponents() {
        const components = document.querySelectorAll(this.interfaceConfig.componentSelector);
        components.forEach(component => {
            const componentName = component.dataset.themeComponent;
            if (componentName && !this.componentAdapters.has(componentName)) {
                this.registerAutoDetectedComponent(componentName, component);
            }
        });
    }

    registerAutoDetectedComponent(componentName, sampleElement) {
        this.registerComponentAdapter(componentName, {
            selector: `[data-theme-component="${componentName}"]`,
            applyTheme: (elements, theme) => {
                elements.forEach(el => {
                    el.setAttribute('data-theme', theme.id);
                });
            }
        });
    }

    applyThemeToComponents(theme) {
        this.componentAdapters.forEach((adapter, componentName) => {
            try {
                const elements = document.querySelectorAll(adapter.selector);
                if (elements.length > 0) {
                    adapter.applyTheme(elements, theme);
                }
            } catch (error) {
                console.warn(`Failed to apply theme to ${componentName} components:`, error);
            }
        });
    }

    setupEventListeners() {
        this.registry.eventBus.on('theme:activated', (data) => {
            if (this.interfaceConfig.updateOnThemeChange) {
                this.applyThemeToComponents(data.theme);
            }
        });
    }
}

// Theme Inheritance System
class ThemeInheritanceManager {
    constructor(registry) {
        this.registry = registry;
        this.inheritanceChains = new Map();
    }

    resolveThemeInheritance(themeId) {
        const theme = this.registry.getTheme(themeId);
        if (!theme || !theme.config?.extends) {
            return theme;
        }

        const chain = this.buildInheritanceChain(themeId);
        return this.mergeThemeChain(chain);
    }

    buildInheritanceChain(themeId, visited = new Set()) {
        if (visited.has(themeId)) {
            throw new Error(`Circular inheritance detected: ${Array.from(visited).join(' -> ')} -> ${themeId}`);
        }

        const theme = this.registry.getTheme(themeId);
        if (!theme) {
            throw new Error(`Theme '${themeId}' not found in inheritance chain`);
        }

        visited.add(themeId);
        const chain = [theme];

        if (theme.config?.extends) {
            const parentChain = this.buildInheritanceChain(theme.config.extends, new Set(visited));
            chain.push(...parentChain);
        }

        return chain;
    }

    mergeThemeChain(chain) {
        if (chain.length === 1) {
            return chain[0];
        }

        // Start with the base theme (last in chain) and merge forward
        const baseTheme = JSON.parse(JSON.stringify(chain[chain.length - 1]));

        for (let i = chain.length - 2; i >= 0; i--) {
            this.mergeThemeProperties(baseTheme, chain[i]);
        }

        return baseTheme;
    }

    mergeThemeProperties(target, source) {
        // Deep merge theme properties
        Object.keys(source).forEach(key => {
            if (key === 'assets') {
                // Merge asset maps
                source.assets.forEach((value, assetKey) => {
                    target.assets.set(assetKey, value);
                });
            } else if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                target[key] = target[key] || {};
                Object.assign(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        });
    }
}

// Initialize and export the unified theme system
class UnifiedThemeManager {
    constructor() {
        this.registry = new ThemeRegistry();
        this.configurator = new ThemeConfigurator(this.registry);
        this.gallery = new ThemeGallery(this.registry, this.configurator);
        this.componentInterface = new ThemeComponentInterface(this.registry);
        this.inheritanceManager = new ThemeInheritanceManager(this.registry);
        this.initialized = false;
    }

    async initialize(options = {}) {
        if (this.initialized) return;

        try {
            await this.registry.initialize();
            this.componentInterface.initialize();

            if (options.galleryContainer) {
                await this.gallery.initialize(options.galleryContainer);
            }

            this.initialized = true;
            console.log('Unified Theme Manager initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Unified Theme Manager:', error);
            throw error;
        }
    }

    // Public API methods
    async activateTheme(themeId) {
        const resolvedTheme = this.inheritanceManager.resolveThemeInheritance(themeId);
        return await this.registry.activateTheme(resolvedTheme.id);
    }

    getActiveTheme() {
        return this.registry.getActiveTheme();
    }

    getAllThemes() {
        return this.registry.getAllThemes();
    }

    customize(themeId, customizations) {
        this.configurator.saveCustomizations(themeId, customizations);
        this.configurator.applyCustomizations(themeId, customizations);
    }

    on(event, callback) {
        this.registry.eventBus.on(event, callback);
    }

    off(event, callback) {
        this.registry.eventBus.off(event, callback);
    }
}

// Export the unified theme manager
window.UnifiedThemeManager = UnifiedThemeManager;

// Auto-initialize if not already done
if (!window.themeManager) {
    window.themeManager = new UnifiedThemeManager();

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.themeManager.initialize();
        });
    } else {
        window.themeManager.initialize();
    }
}

console.log('Unified Theme Manager loaded successfully');