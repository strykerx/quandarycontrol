/**
 * Theme Registry and Loader System
 * Manages theme registration, loading, and lifecycle
 */

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
            supportedFormats: ['json', 'js', 'css', 'html']
        };
        
        this.registerDefaultLoaders();
        this.registerDefaultValidators();
    }

    /**
     * Initialize the theme registry
     */
    async init() {
        if (this.initialized) return;

        try {
            console.log('Initializing Theme Registry...');
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Load available themes
            await this.discoverThemes();
            
            // Load default theme
            await this.loadDefaultTheme();
            
            this.initialized = true;
            console.log('Theme Registry initialized successfully');
            
            // Emit initialization event
            this.eventBus.emit('registry:initialized', {
                themes: Array.from(this.themes.keys()),
                activeTheme: this.activeTheme?.id
            });
            
        } catch (error) {
            console.error('Failed to initialize Theme Registry:', error);
            throw error;
        }
    }

    /**
     * Register default theme loaders
     */
    registerDefaultLoaders() {
        // JSON theme loader
        this.registerLoader('json', new JsonThemeLoader());
        
        // JavaScript theme loader
        this.registerLoader('js', new JsThemeLoader());
        
        // CSS theme loader
        this.registerLoader('css', new CssThemeLoader());
        
        // HTML theme loader
        this.registerLoader('html', new HtmlThemeLoader());
    }

    /**
     * Register default validators
     */
    registerDefaultValidators() {
        // Theme configuration validator
        this.registerValidator('config', new ThemeConfigValidator());
        
        // Theme structure validator
        this.registerValidator('structure', new ThemeStructureValidator());
        
        // Theme compatibility validator
        this.registerValidator('compatibility', new ThemeCompatibilityValidator());
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Listen for theme load requests
        this.eventBus.on('theme:load-requested', (data) => {
            this.loadTheme(data.themeId).catch(error => {
                console.error(`Failed to load theme ${data.themeId}:`, error);
                this.eventBus.emit('theme:load-failed', {
                    themeId: data.themeId,
                    error: error.message
                });
            });
        });

        // Listen for theme activation requests
        this.eventBus.on('theme:activate-requested', (data) => {
            this.activateTheme(data.themeId).catch(error => {
                console.error(`Failed to activate theme ${data.themeId}:`, error);
                this.eventBus.emit('theme:activation-failed', {
                    themeId: data.themeId,
                    error: error.message
                });
            });
        });

        // Listen for theme deactivation requests
        this.eventBus.on('theme:deactivate-requested', (data) => {
            this.deactivateTheme(data.themeId).catch(error => {
                console.error(`Failed to deactivate theme ${data.themeId}:`, error);
                this.eventBus.emit('theme:deactivation-failed', {
                    themeId: data.themeId,
                    error: error.message
                });
            });
        });

        // Listen for theme unload requests
        this.eventBus.on('theme:unload-requested', (data) => {
            this.unloadTheme(data.themeId).catch(error => {
                console.error(`Failed to unload theme ${data.themeId}:`, error);
                this.eventBus.emit('theme:unload-failed', {
                    themeId: data.themeId,
                    error: error.message
                });
            });
        });

        // Listen for hot reload events
        if (this.config.enableHotReload) {
            this.setupHotReload();
        }
    }

    /**
     * Set up hot reload
     */
    setupHotReload() {
        // Set up file system watcher (simplified for browser environment)
        if (typeof window !== 'undefined' && window.EventSource) {
            try {
                const eventSource = new EventSource('/theme-events');
                
                eventSource.addEventListener('theme-changed', (event) => {
                    const data = JSON.parse(event.data);
                    this.handleThemeChange(data);
                });
                
                eventSource.addEventListener('error', (error) => {
                    console.warn('Hot reload event source error:', error);
                });
                
                console.log('Hot reload enabled');
            } catch (error) {
                console.warn('Failed to set up hot reload:', error);
            }
        }
    }

    /**
     * Handle theme change (hot reload)
     * @param {Object} data - Theme change data
     */
    async handleThemeChange(data) {
        console.log('Theme change detected:', data);
        
        const theme = this.themes.get(data.themeId);
        if (theme) {
            try {
                // Reload theme
                await this.reloadTheme(data.themeId);
                
                // If theme is active, reactivate it
                if (this.activeTheme && this.activeTheme.id === data.themeId) {
                    await this.activateTheme(data.themeId);
                }
                
                this.eventBus.emit('theme:reloaded', {
                    themeId: data.themeId,
                    changes: data.changes
                });
                
            } catch (error) {
                console.error(`Failed to handle theme change for ${data.themeId}:`, error);
            }
        }
    }

    /**
     * Discover available themes
     */
    async discoverThemes() {
        try {
            const response = await fetch('/api/themes/list');
            const themeList = await response.json();
            
            for (const themeId of themeList) {
                try {
                    await this.registerTheme(themeId);
                } catch (error) {
                    console.warn(`Failed to register theme ${themeId}:`, error);
                }
            }
            
            console.log(`Discovered ${themeList.length} themes`);
            
        } catch (error) {
            console.warn('Failed to discover themes:', error);
            
            // Fallback: try to load known themes
            const knownThemes = ['example-theme', 'windows-95', 'modern-theme'];
            for (const themeId of knownThemes) {
                try {
                    await this.registerTheme(themeId);
                } catch (error) {
                    console.warn(`Failed to register theme ${themeId}:`, error);
                }
            }
        }
    }

    /**
     * Register theme
     * @param {string} themeId - Theme ID
     */
    async registerTheme(themeId) {
        if (this.themes.has(themeId)) {
            console.warn(`Theme ${themeId} already registered`);
            return;
        }

        try {
            // Load theme metadata
            const metadata = await this.loadThemeMetadata(themeId);
            
            // Validate theme
            await this.validateTheme(themeId, metadata);
            
            // Create theme object
            const theme = {
                id: themeId,
                metadata,
                loaded: false,
                activated: false,
                loadTime: null,
                activationTime: null,
                assets: {},
                dependencies: [],
                config: null
            };
            
            this.themes.set(themeId, theme);
            
            console.log(`Theme ${themeId} registered`);
            
            // Emit registration event
            this.eventBus.emit('theme:registered', { themeId, theme });
            
        } catch (error) {
            console.error(`Failed to register theme ${themeId}:`, error);
            throw error;
        }
    }

    /**
     * Load theme metadata
     * @param {string} themeId - Theme ID
     */
    async loadThemeMetadata(themeId) {
        const configPath = `${this.config.themePath}/${themeId}/theme-config.json`;
        
        try {
            const response = await fetch(configPath);
            if (!response.ok) {
                throw new Error(`Failed to load theme config: ${response.status}`);
            }
            
            const config = await response.json();
            return config;
            
        } catch (error) {
            console.error(`Failed to load theme metadata for ${themeId}:`, error);
            throw error;
        }
    }

    /**
     * Validate theme
     * @param {string} themeId - Theme ID
     * @param {Object} metadata - Theme metadata
     */
    async validateTheme(themeId, metadata) {
        // Run all validators
        for (const [validatorName, validator] of this.validators) {
            try {
                await validator.validate(themeId, metadata);
            } catch (error) {
                console.error(`Theme ${themeId} failed validation (${validatorName}):`, error);
                throw error;
            }
        }
    }

    /**
     * Load theme
     * @param {string} themeId - Theme ID
     */
    async loadTheme(themeId) {
        if (this.loadingPromises.has(themeId)) {
            return this.loadingPromises.get(themeId);
        }

        const loadPromise = this._loadThemeInternal(themeId);
        this.loadingPromises.set(themeId, loadPromise);
        
        try {
            const theme = await loadPromise;
            this.loadingPromises.delete(themeId);
            return theme;
        } catch (error) {
            this.loadingPromises.delete(themeId);
            throw error;
        }
    }

    /**
     * Internal theme loading implementation
     * @param {string} themeId - Theme ID
     */
    async _loadThemeInternal(themeId) {
        const theme = this.themes.get(themeId);
        if (!theme) {
            throw new Error(`Theme ${themeId} not registered`);
        }

        if (theme.loaded) {
            console.log(`Theme ${themeId} already loaded`);
            return theme;
        }

        try {
            console.log(`Loading theme ${themeId}...`);
            
            // Load theme assets
            await this.loadThemeAssets(themeId);
            
            // Load theme configuration
            await this.loadThemeConfiguration(themeId);
            
            // Load theme dependencies
            await this.loadThemeDependencies(themeId);
            
            // Mark theme as loaded
            theme.loaded = true;
            theme.loadTime = Date.now();
            
            console.log(`Theme ${themeId} loaded successfully`);
            
            // Emit load event
            this.eventBus.emit('theme:loaded', { themeId, theme });
            
            return theme;
            
        } catch (error) {
            console.error(`Failed to load theme ${themeId}:`, error);
            throw error;
        }
    }

    /**
     * Load theme assets
     * @param {string} themeId - Theme ID
     */
    async loadThemeAssets(themeId) {
        const theme = this.themes.get(themeId);
        const assets = theme.metadata.assets || {};
        
        const loadPromises = [];
        
        // Load CSS assets
        if (assets.css) {
            loadPromises.push(this.loadCssAsset(themeId, assets.css));
        }
        
        // Load JavaScript assets
        if (assets.js) {
            loadPromises.push(this.loadJsAsset(themeId, assets.js));
        }
        
        // Load HTML template
        if (assets.template) {
            loadPromises.push(this.loadHtmlAsset(themeId, assets.template));
        }
        
        // Load configuration
        if (assets.config) {
            loadPromises.push(this.loadConfigAsset(themeId, assets.config));
        }
        
        await Promise.all(loadPromises);
    }

    /**
     * Load CSS asset
     * @param {string} themeId - Theme ID
     * @param {string} cssPath - CSS file path
     */
    async loadCssAsset(themeId, cssPath) {
        try {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssPath;
            link.dataset.themeId = themeId;
            link.dataset.assetType = 'css';
            
            document.head.appendChild(link);
            
            const theme = this.themes.get(themeId);
            theme.assets.css = link;
            
            console.log(`CSS asset loaded for theme ${themeId}`);
            
        } catch (error) {
            console.error(`Failed to load CSS asset for theme ${themeId}:`, error);
            throw error;
        }
    }

    /**
     * Load JavaScript asset
     * @param {string} themeId - Theme ID
     * @param {string} jsPath - JavaScript file path
     */
    async loadJsAsset(themeId, jsPath) {
        return new Promise((resolve, reject) => {
            try {
                const script = document.createElement('script');
                script.src = jsPath;
                script.dataset.themeId = themeId;
                script.dataset.assetType = 'js';
                
                script.onload = () => {
                    const theme = this.themes.get(themeId);
                    theme.assets.js = script;
                    
                    console.log(`JavaScript asset loaded for theme ${themeId}`);
                    resolve();
                };
                
                script.onerror = (error) => {
                    console.error(`Failed to load JavaScript asset for theme ${themeId}:`, error);
                    reject(error);
                };
                
                document.head.appendChild(script);
                
            } catch (error) {
                console.error(`Failed to load JavaScript asset for theme ${themeId}:`, error);
                reject(error);
            }
        });
    }

    /**
     * Load HTML asset
     * @param {string} themeId - Theme ID
     * @param {string} htmlPath - HTML file path
     */
    async loadHtmlAsset(themeId, htmlPath) {
        try {
            const response = await fetch(htmlPath);
            const htmlContent = await response.text();
            
            const theme = this.themes.get(themeId);
            theme.assets.html = htmlContent;
            
            console.log(`HTML asset loaded for theme ${themeId}`);
            
        } catch (error) {
            console.error(`Failed to load HTML asset for theme ${themeId}:`, error);
            throw error;
        }
    }

    /**
     * Load configuration asset
     * @param {string} themeId - Theme ID
     * @param {string} configPath - Configuration file path
     */
    async loadConfigAsset(themeId, configPath) {
        try {
            const response = await fetch(configPath);
            const config = await response.json();
            
            const theme = this.themes.get(themeId);
            theme.assets.config = config;
            
            console.log(`Configuration asset loaded for theme ${themeId}`);
            
        } catch (error) {
            console.error(`Failed to load configuration asset for theme ${themeId}:`, error);
            throw error;
        }
    }

    /**
     * Load theme configuration
     * @param {string} themeId - Theme ID
     */
    async loadThemeConfiguration(themeId) {
        const theme = this.themes.get(themeId);
        theme.config = theme.assets.config || theme.metadata;
    }

    /**
     * Load theme dependencies
     * @param {string} themeId - Theme ID
     */
    async loadThemeDependencies(themeId) {
        const theme = this.themes.get(themeId);
        const dependencies = theme.config.dependencies || [];
        
        for (const dependency of dependencies) {
            try {
                await this.loadTheme(dependency);
                theme.dependencies.push(dependency);
            } catch (error) {
                console.error(`Failed to load dependency ${dependency} for theme ${themeId}:`, error);
                throw error;
            }
        }
    }

    /**
     * Activate theme
     * @param {string} themeId - Theme ID
     */
    async activateTheme(themeId) {
        const theme = this.themes.get(themeId);
        if (!theme) {
            throw new Error(`Theme ${themeId} not registered`);
        }

        if (!theme.loaded) {
            await this.loadTheme(themeId);
        }

        try {
            console.log(`Activating theme ${themeId}...`);
            
            // Deactivate current theme
            if (this.activeTheme && this.activeTheme.id !== themeId) {
                await this.deactivateTheme(this.activeTheme.id);
            }
            
            // Apply theme styles
            await this.applyThemeStyles(themeId);
            
            // Initialize theme components
            await this.initializeThemeComponents(themeId);
            
            // Mark theme as active
            this.activeTheme = theme;
            theme.activated = true;
            theme.activationTime = Date.now();
            
            console.log(`Theme ${themeId} activated successfully`);
            
            // Emit activation event
            this.eventBus.emit('theme:activated', { themeId, theme });
            
            return theme;
            
        } catch (error) {
            console.error(`Failed to activate theme ${themeId}:`, error);
            throw error;
        }
    }

    /**
     * Apply theme styles
     * @param {string} themeId - Theme ID
     */
    async applyThemeStyles(themeId) {
        const theme = this.themes.get(themeId);
        const variables = theme.config.variables || {};
        
        const root = document.documentElement;
        
        // Apply CSS custom properties
        Object.entries(variables).forEach(([property, value]) => {
            root.style.setProperty(`--${property}`, value);
        });
        
        // Apply theme class to body
        document.body.className = `theme-${themeId}`;
        
        console.log(`Theme styles applied for ${themeId}`);
    }

    /**
     * Initialize theme components
     * @param {string} themeId - Theme ID
     */
    async initializeThemeComponents(themeId) {
        const theme = this.themes.get(themeId);
        const components = theme.config.components || {};
        
        // Initialize theme-specific components if available
        if (window[`${themeId}Theme`]) {
            try {
                const themeInstance = new window[`${themeId}Theme`]();
                await themeInstance.init();
                theme.instance = themeInstance;
            } catch (error) {
                console.error(`Failed to initialize theme instance for ${themeId}:`, error);
            }
        }
        
        console.log(`Theme components initialized for ${themeId}`);
    }

    /**
     * Deactivate theme
     * @param {string} themeId - Theme ID
     */
    async deactivateTheme(themeId) {
        const theme = this.themes.get(themeId);
        if (!theme) {
            throw new Error(`Theme ${themeId} not registered`);
        }

        if (!theme.activated) {
            console.log(`Theme ${themeId} not activated`);
            return;
        }

        try {
            console.log(`Deactivating theme ${themeId}...`);
            
            // Clean up theme instance
            if (theme.instance) {
                if (theme.instance.destroy) {
                    theme.instance.destroy();
                }
                theme.instance = null;
            }
            
            // Remove theme styles
            this.removeThemeStyles(themeId);
            
            // Mark theme as deactivated
            theme.activated = false;
            theme.activationTime = null;
            
            console.log(`Theme ${themeId} deactivated successfully`);
            
            // Emit deactivation event
            this.eventBus.emit('theme:deactivated', { themeId, theme });
            
        } catch (error) {
            console.error(`Failed to deactivate theme ${themeId}:`, error);
            throw error;
        }
    }

    /**
     * Remove theme styles
     * @param {string} themeId - Theme ID
     */
    removeThemeStyles(themeId) {
        const theme = this.themes.get(themeId);
        
        // Remove theme class from body
        document.body.classList.remove(`theme-${themeId}`);
        
        // Remove CSS custom properties
        if (theme.config.variables) {
            const root = document.documentElement;
            Object.keys(theme.config.variables).forEach(property => {
                root.style.removeProperty(`--${property}`);
            });
        }
        
        console.log(`Theme styles removed for ${themeId}`);
    }

    /**
     * Unload theme
     * @param {string} themeId - Theme ID
     */
    async unloadTheme(themeId) {
        const theme = this.themes.get(themeId);
        if (!theme) {
            throw new Error(`Theme ${themeId} not registered`);
        }

        if (theme.activated) {
            await this.deactivateTheme(themeId);
        }

        try {
            console.log(`Unloading theme ${themeId}...`);
            
            // Remove theme assets
            this.removeThemeAssets(themeId);
            
            // Mark theme as unloaded
            theme.loaded = false;
            theme.loadTime = null;
            theme.assets = {};
            theme.dependencies = [];
            theme.config = null;
            
            console.log(`Theme ${themeId} unloaded successfully`);
            
            // Emit unload event
            this.eventBus.emit('theme:unloaded', { themeId, theme });
            
        } catch (error) {
            console.error(`Failed to unload theme ${themeId}:`, error);
            throw error;
        }
    }

    /**
     * Remove theme assets
     * @param {string} themeId - Theme ID
     */
    removeThemeAssets(themeId) {
        const theme = this.themes.get(themeId);
        
        // Remove CSS assets
        if (theme.assets.css) {
            theme.assets.css.remove();
        }
        
        // Remove JavaScript assets
        if (theme.assets.js) {
            theme.assets.js.remove();
        }
        
        console.log(`Theme assets removed for ${themeId}`);
    }

    /**
     * Reload theme
     * @param {string} themeId - Theme ID
     */
    async reloadTheme(themeId) {
        const wasActive = this.activeTheme && this.activeTheme.id === themeId;
        
        // Unload theme
        await this.unloadTheme(themeId);
        
        // Reload theme metadata
        await this.loadThemeMetadata(themeId);
        
        // Load theme again
        await this.loadTheme(themeId);
        
        // Reactivate if it was active
        if (wasActive) {
            await this.activateTheme(themeId);
        }
        
        console.log(`Theme ${themeId} reloaded`);
    }

    /**
     * Load default theme
     */
    async loadDefaultTheme() {
        try {
            await this.activateTheme(this.config.defaultTheme);
        } catch (error) {
            console.error(`Failed to load default theme ${this.config.defaultTheme}:`, error);
            
            // Try to load any available theme
            const availableThemes = Array.from(this.themes.keys());
            if (availableThemes.length > 0) {
                const fallbackTheme = availableThemes[0];
                console.log(`Falling back to theme ${fallbackTheme}`);
                await this.activateTheme(fallbackTheme);
            }
        }
    }

    /**
     * Register theme loader
     * @param {string} format - File format
     * @param {Object} loader - Loader instance
     */
    registerLoader(format, loader) {
        this.themeLoaders.set(format, loader);
        console.log(`Theme loader registered for format: ${format}`);
    }

    /**
     * Register theme validator
     * @param {string} name - Validator name
     * @param {Object} validator - Validator instance
     */
    registerValidator(name, validator) {
        this.validators.set(name, validator);
        console.log(`Theme validator registered: ${name}`);
    }

    /**
     * Get theme
     * @param {string} themeId - Theme ID
     */
    getTheme(themeId) {
        return this.themes.get(themeId);
    }

    /**
     * Get all themes
     */
    getThemes() {
        return Array.from(this.themes.values());
    }

    /**
     * Get active theme
     */
    getActiveTheme() {
        return this.activeTheme;
    }

    /**
     * Check if theme is loaded
     * @param {string} themeId - Theme ID
     */
    isThemeLoaded(themeId) {
        const theme = this.themes.get(themeId);
        return theme ? theme.loaded : false;
    }

    /**
     * Check if theme is activated
     * @param {string} themeId - Theme ID
     */
    isThemeActivated(themeId) {
        const theme = this.themes.get(themeId);
        return theme ? theme.activated : false;
    }

    /**
     * Get theme configuration
     * @param {string} themeId - Theme ID
     */
    getThemeConfig(themeId) {
        const theme = this.themes.get(themeId);
        return theme ? theme.config : null;
    }

    /**
     * Update theme configuration
     * @param {string} themeId - Theme ID
     * @param {Object} newConfig - New configuration
     */
    async updateThemeConfig(themeId, newConfig) {
        const theme = this.themes.get(themeId);
        if (!theme) {
            throw new Error(`Theme ${themeId} not registered`);
        }

        theme.config = { ...theme.config, ...newConfig };
        
        // If theme is active, apply changes
        if (theme.activated) {
            await this.applyThemeStyles(themeId);
        }
        
        this.eventBus.emit('theme:config-updated', { themeId, config: theme.config });
    }

    /**
     * Destroy theme registry
     */
    destroy() {
        // Unload all themes
        const themeIds = Array.from(this.themes.keys());
        for (const themeId of themeIds) {
            try {
                this.unloadTheme(themeId);
            } catch (error) {
                console.error(`Failed to unload theme ${themeId}:`, error);
            }
        }
        
        // Clear collections
        this.themes.clear();
        this.loadingPromises.clear();
        this.themeLoaders.clear();
        this.validators.clear();
        
        // Destroy event bus
        this.eventBus.destroy();
        
        this.initialized = false;
        console.log('Theme Registry destroyed');
    }
}

/**
 * JSON Theme Loader
 */
class JsonThemeLoader {
    async load(themeId, path) {
        try {
            const response = await fetch(path);
            return await response.json();
        } catch (error) {
            console.error(`Failed to load JSON theme ${themeId}:`, error);
            throw error;
        }
    }
}

/**
 * JavaScript Theme Loader
 */
class JsThemeLoader {
    async load(themeId, path) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = path;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
}

/**
 * CSS Theme Loader
 */
class CssThemeLoader {
    async load(themeId, path) {
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = path;
            link.onload = resolve;
            link.onerror = reject;
            document.head.appendChild(link);
        });
    }
}

/**
 * HTML Theme Loader
 */
class HtmlThemeLoader {
    async load(themeId, path) {
        try {
            const response = await fetch(path);
            return await response.text();
        } catch (error) {
            console.error(`Failed to load HTML theme ${themeId}:`, error);
            throw error;
        }
    }
}

/**
 * Theme Configuration Validator
 */
class ThemeConfigValidator {
    async validate(themeId, metadata) {
        const required = ['name', 'version', 'description'];
        
        for (const field of required) {
            if (!metadata[field]) {
                throw new Error(`Required field '${field}' missing in theme configuration`);
            }
        }
        
        // Validate version format
        if (!/^\d+\.\d+\.\d+$/.test(metadata.version)) {
            throw new Error('Version must be in format x.y.z');
        }
        
        console.log(`Theme ${themeId} configuration validated`);
    }
}

/**
 * Theme Structure Validator
 */
class ThemeStructureValidator {
    async validate(themeId, metadata) {
        const requiredFiles = ['index.html', 'style.css', 'theme-config.json'];
        
        for (const file of requiredFiles) {
            if (!metadata.assets || !metadata.assets[file.replace('.json', '')]) {
                throw new Error(`Required file '${file}' missing in theme assets`);
            }
        }
        
        console.log(`Theme ${themeId} structure validated`);
    }
}

/**
 * Theme Compatibility Validator
 */
class ThemeCompatibilityValidator {
    async validate(themeId, metadata) {
        // Check compatibility with current browser
        if (metadata.compatibility && metadata.compatibility.browsers) {
            const userAgent = navigator.userAgent;
            const isCompatible = metadata.compatibility.browsers.some(browser => {
                return userAgent.toLowerCase().includes(browser.toLowerCase());
            });
            
            if (!isCompatible) {
                console.warn(`Theme ${themeId} may not be compatible with current browser`);
            }
        }
        
        console.log(`Theme ${themeId} compatibility validated`);
    }
}

/**
 * Event Bus for Theme Registry
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

// Initialize global theme registry
window.themeRegistry = new ThemeRegistry();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.themeRegistry.init();
    });
} else {
    window.themeRegistry.init();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ThemeRegistry,
        JsonThemeLoader,
        JsThemeLoader,
        CssThemeLoader,
        HtmlThemeLoader,
        ThemeConfigValidator,
        ThemeStructureValidator,
        ThemeCompatibilityValidator,
        EventBus
    };
}