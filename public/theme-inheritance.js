/**
 * Theme Inheritance and Override System
 * Enables themes to extend and customize other themes
 */

class ThemeInheritanceManager {
    constructor() {
        this.inheritanceMap = new Map();
        this.themeHierarchy = new Map();
        this.overrideCache = new Map();
        this.eventBus = new EventBus();
        this.initialized = false;
        this.config = {
            enableInheritance: true,
            enableOverrides: true,
            enableCaching: true,
            cacheTimeout: 300000, // 5 minutes
            maxInheritanceDepth: 5,
            overridePriority: ['child', 'parent', 'grandparent']
        };
    }

    /**
     * Initialize the inheritance manager
     */
    async init() {
        if (this.initialized) return;

        try {
            console.log('Initializing Theme Inheritance Manager...');
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Build inheritance hierarchy
            await this.buildInheritanceHierarchy();
            
            this.initialized = true;
            console.log('Theme Inheritance Manager initialized successfully');
            
            // Emit initialization event
            this.eventBus.emit('inheritance:initialized', {
                hierarchy: this.themeHierarchy,
                inheritanceMap: this.inheritanceMap
            });
            
        } catch (error) {
            console.error('Failed to initialize Theme Inheritance Manager:', error);
            throw error;
        }
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Listen for theme registration
        this.eventBus.on('theme:registered', (data) => {
            this.handleThemeRegistered(data);
        });

        // Listen for theme loading
        this.eventBus.on('theme:loaded', (data) => {
            this.handleThemeLoaded(data);
        });

        // Listen for theme activation
        this.eventBus.on('theme:activated', (data) => {
            this.handleThemeActivated(data);
        });

        // Listen for configuration updates
        this.eventBus.on('theme:config-updated', (data) => {
            this.handleConfigUpdated(data);
        });

        // Listen for inheritance requests
        this.eventBus.on('inheritance:resolve-requested', (data) => {
            this.resolveInheritance(data.themeId).then(resolved => {
                this.eventBus.emit('inheritance:resolved', {
                    themeId: data.themeId,
                    resolved
                });
            }).catch(error => {
                this.eventBus.emit('inheritance:resolve-failed', {
                    themeId: data.themeId,
                    error: error.message
                });
            });
        });

        // Listen for override requests
        this.eventBus.on('override:apply-requested', (data) => {
            this.applyOverrides(data.themeId, data.overrides).then(result => {
                this.eventBus.emit('override:applied', {
                    themeId: data.themeId,
                    result
                });
            }).catch(error => {
                this.eventBus.emit('override:apply-failed', {
                    themeId: data.themeId,
                    error: error.message
                });
            });
        });
    }

    /**
     * Build inheritance hierarchy
     */
    async buildInheritanceHierarchy() {
        if (!window.themeRegistry) {
            console.warn('Theme registry not available, skipping hierarchy build');
            return;
        }

        const themes = window.themeRegistry.getThemes();
        
        for (const theme of themes) {
            const parentTheme = theme.config?.parent_theme;
            if (parentTheme) {
                await this.registerInheritance(theme.id, parentTheme);
            }
        }
        
        console.log('Inheritance hierarchy built');
    }

    /**
     * Handle theme registration
     * @param {Object} data - Registration data
     */
    async handleThemeRegistered(data) {
        const { themeId, theme } = data;
        const parentTheme = theme.metadata?.parent_theme || theme.config?.parent_theme;
        
        if (parentTheme) {
            await this.registerInheritance(themeId, parentTheme);
        }
    }

    /**
     * Handle theme loading
     * @param {Object} data - Loading data
     */
    async handleThemeLoaded(data) {
        const { themeId, theme } = data;
        
        // Clear cache for this theme
        this.overrideCache.delete(themeId);
        
        // Resolve inheritance for loaded theme
        if (this.config.enableInheritance) {
            try {
                await this.resolveInheritance(themeId);
            } catch (error) {
                console.error(`Failed to resolve inheritance for ${themeId}:`, error);
            }
        }
    }

    /**
     * Handle theme activation
     * @param {Object} data - Activation data
     */
    async handleThemeActivated(data) {
        const { themeId, theme } = data;
        
        // Apply inherited styles and configuration
        if (this.config.enableInheritance) {
            try {
                await this.applyInheritedStyles(themeId);
                await this.applyInheritedConfig(themeId);
            } catch (error) {
                console.error(`Failed to apply inheritance for ${themeId}:`, error);
            }
        }
    }

    /**
     * Handle configuration update
     * @param {Object} data - Configuration update data
     */
    async handleConfigUpdated(data) {
        const { themeId, config } = data;
        
        // Clear cache for this theme
        this.overrideCache.delete(themeId);
        
        // Re-resolve inheritance
        if (this.config.enableInheritance) {
            try {
                await this.resolveInheritance(themeId);
            } catch (error) {
                console.error(`Failed to re-resolve inheritance for ${themeId}:`, error);
            }
        }
    }

    /**
     * Register inheritance relationship
     * @param {string} childThemeId - Child theme ID
     * @param {string} parentThemeId - Parent theme ID
     */
    async registerInheritance(childThemeId, parentThemeId) {
        // Check for circular inheritance
        if (this.wouldCreateCircularInheritance(childThemeId, parentThemeId)) {
            throw new Error(`Circular inheritance detected: ${childThemeId} -> ${parentThemeId}`);
        }
        
        // Check inheritance depth
        const depth = this.getInheritanceDepth(parentThemeId);
        if (depth >= this.config.maxInheritanceDepth) {
            throw new Error(`Maximum inheritance depth (${this.config.maxInheritanceDepth}) exceeded`);
        }
        
        // Register inheritance
        this.inheritanceMap.set(childThemeId, parentThemeId);
        
        // Update hierarchy
        this.updateHierarchy(childThemeId, parentThemeId);
        
        console.log(`Inheritance registered: ${childThemeId} -> ${parentThemeId}`);
        
        // Emit inheritance registered event
        this.eventBus.emit('inheritance:registered', {
            childThemeId,
            parentThemeId
        });
    }

    /**
     * Check if inheritance would create a circular reference
     * @param {string} childThemeId - Child theme ID
     * @param {string} parentThemeId - Parent theme ID
     */
    wouldCreateCircularInheritance(childThemeId, parentThemeId) {
        const visited = new Set();
        
        const checkCircular = (themeId) => {
            if (visited.has(themeId)) {
                return themeId === childThemeId;
            }
            
            visited.add(themeId);
            
            const parent = this.inheritanceMap.get(themeId);
            if (parent) {
                return checkCircular(parent);
            }
            
            return false;
        };
        
        return checkCircular(parentThemeId);
    }

    /**
     * Get inheritance depth for a theme
     * @param {string} themeId - Theme ID
     */
    getInheritanceDepth(themeId) {
        let depth = 0;
        let currentThemeId = themeId;
        
        while (currentThemeId) {
            const parent = this.inheritanceMap.get(currentThemeId);
            if (parent) {
                depth++;
                currentThemeId = parent;
            } else {
                break;
            }
        }
        
        return depth;
    }

    /**
     * Update theme hierarchy
     * @param {string} childThemeId - Child theme ID
     * @param {string} parentThemeId - Parent theme ID
     */
    updateHierarchy(childThemeId, parentThemeId) {
        // Get parent hierarchy
        const parentHierarchy = this.themeHierarchy.get(parentThemeId) || [];
        
        // Create child hierarchy
        const childHierarchy = [childThemeId, ...parentHierarchy];
        
        // Update hierarchy
        this.themeHierarchy.set(childThemeId, childHierarchy);
        
        // Update all children's hierarchies
        this.updateChildrenHierarchies(childThemeId);
    }

    /**
     * Update children's hierarchies when parent changes
     * @param {string} parentThemeId - Parent theme ID
     */
    updateChildrenHierarchies(parentThemeId) {
        const children = this.getChildren(parentThemeId);
        
        for (const childId of children) {
            const parentHierarchy = this.themeHierarchy.get(parentThemeId) || [];
            const childHierarchy = [childId, ...parentHierarchy];
            this.themeHierarchy.set(childId, childHierarchy);
            
            // Recursively update children
            this.updateChildrenHierarchies(childId);
        }
    }

    /**
     * Get children of a theme
     * @param {string} parentThemeId - Parent theme ID
     */
    getChildren(parentThemeId) {
        const children = [];
        
        for (const [childId, parentId] of this.inheritanceMap) {
            if (parentId === parentThemeId) {
                children.push(childId);
            }
        }
        
        return children;
    }

    /**
     * Resolve inheritance for a theme
     * @param {string} themeId - Theme ID
     */
    async resolveInheritance(themeId) {
        if (!this.config.enableInheritance) {
            return { themeId, resolved: {} };
        }
        
        // Check cache
        if (this.config.enableCaching && this.overrideCache.has(themeId)) {
            const cached = this.overrideCache.get(themeId);
            if (Date.now() - cached.timestamp < this.config.cacheTimeout) {
                return cached.data;
            }
        }
        
        try {
            const hierarchy = this.themeHierarchy.get(themeId) || [themeId];
            const resolved = await this.resolveThemeHierarchy(hierarchy);
            
            // Cache result
            if (this.config.enableCaching) {
                this.overrideCache.set(themeId, {
                    data: { themeId, resolved },
                    timestamp: Date.now()
                });
            }
            
            return { themeId, resolved };
            
        } catch (error) {
            console.error(`Failed to resolve inheritance for ${themeId}:`, error);
            throw error;
        }
    }

    /**
     * Resolve theme hierarchy
     * @param {Array} hierarchy - Theme hierarchy array
     */
    async resolveThemeHierarchy(hierarchy) {
        const resolved = {
            variables: {},
            components: {},
            assets: {},
            features: {},
            layout: {},
            typography: {},
            animations: {},
            accessibility: {},
            performance: {},
            compatibility: {},
            development: {}
        };
        
        // Resolve from parent to child (child overrides parent)
        for (let i = hierarchy.length - 1; i >= 0; i--) {
            const themeId = hierarchy[i];
            const theme = window.themeRegistry?.getTheme(themeId);
            
            if (theme && theme.config) {
                await this.mergeThemeConfig(resolved, theme.config, themeId);
            }
        }
        
        return resolved;
    }

    /**
     * Merge theme configuration
     * @param {Object} resolved - Resolved configuration
     * @param {Object} config - Theme configuration to merge
     * @param {string} themeId - Theme ID
     */
    async mergeThemeConfig(resolved, config, themeId) {
        // Merge variables
        if (config.variables) {
            resolved.variables = { ...resolved.variables, ...config.variables };
        }
        
        // Merge components
        if (config.components) {
            for (const [componentId, componentConfig] of Object.entries(config.components)) {
                if (!resolved.components[componentId]) {
                    resolved.components[componentId] = {};
                }
                resolved.components[componentId] = {
                    ...resolved.components[componentId],
                    ...componentConfig
                };
            }
        }
        
        // Merge assets
        if (config.assets) {
            resolved.assets = { ...resolved.assets, ...config.assets };
        }
        
        // Merge features
        if (config.features) {
            resolved.features = { ...resolved.features, ...config.features };
        }
        
        // Merge layout
        if (config.layout) {
            resolved.layout = { ...resolved.layout, ...config.layout };
        }
        
        // Merge typography
        if (config.typography) {
            resolved.typography = { ...resolved.typography, ...config.typography };
        }
        
        // Merge animations
        if (config.animations) {
            resolved.animations = { ...resolved.animations, ...config.animations };
        }
        
        // Merge accessibility
        if (config.accessibility) {
            resolved.accessibility = { ...resolved.accessibility, ...config.accessibility };
        }
        
        // Merge performance
        if (config.performance) {
            resolved.performance = { ...resolved.performance, ...config.performance };
        }
        
        // Merge compatibility
        if (config.compatibility) {
            resolved.compatibility = { ...resolved.compatibility, ...config.compatibility };
        }
        
        // Merge development
        if (config.development) {
            resolved.development = { ...resolved.development, ...config.development };
        }
    }

    /**
     * Apply inherited styles
     * @param {string} themeId - Theme ID
     */
    async applyInheritedStyles(themeId) {
        const { resolved } = await this.resolveInheritance(themeId);
        
        const root = document.documentElement;
        
        // Apply inherited variables
        if (resolved.variables) {
            Object.entries(resolved.variables).forEach(([property, value]) => {
                root.style.setProperty(`--${property}`, value);
            });
        }
        
        console.log(`Inherited styles applied for ${themeId}`);
    }

    /**
     * Apply inherited configuration
     * @param {string} themeId - Theme ID
     */
    async applyInheritedConfig(themeId) {
        const { resolved } = await this.resolveInheritance(themeId);
        
        // Update theme configuration in registry
        if (window.themeRegistry) {
            await window.themeRegistry.updateThemeConfig(themeId, resolved);
        }
        
        console.log(`Inherited configuration applied for ${themeId}`);
    }

    /**
     * Apply overrides to a theme
     * @param {string} themeId - Theme ID
     * @param {Object} overrides - Override configuration
     */
    async applyOverrides(themeId, overrides) {
        if (!this.config.enableOverrides) {
            return { success: false, message: 'Overrides disabled' };
        }
        
        try {
            // Get current theme configuration
            const theme = window.themeRegistry?.getTheme(themeId);
            if (!theme) {
                throw new Error(`Theme ${themeId} not found`);
            }
            
            // Apply overrides based on priority
            const overriddenConfig = this.applyOverridePriority(theme.config, overrides);
            
            // Update theme configuration
            if (window.themeRegistry) {
                await window.themeRegistry.updateThemeConfig(themeId, overriddenConfig);
            }
            
            // Clear cache
            this.overrideCache.delete(themeId);
            
            console.log(`Overrides applied for ${themeId}`);
            
            return { success: true, themeId, overriddenConfig };
            
        } catch (error) {
            console.error(`Failed to apply overrides for ${themeId}:`, error);
            throw error;
        }
    }

    /**
     * Apply override priority
     * @param {Object} baseConfig - Base configuration
     * @param {Object} overrides - Override configuration
     */
    applyOverridePriority(baseConfig, overrides) {
        const result = { ...baseConfig };
        
        // Apply overrides in priority order
        for (const priority of this.config.overridePriority) {
            if (overrides[priority]) {
                this.deepMerge(result, overrides[priority]);
            }
        }
        
        return result;
    }

    /**
     * Deep merge objects
     * @param {Object} target - Target object
     * @param {Object} source - Source object
     */
    deepMerge(target, source) {
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!target[key]) {
                    target[key] = {};
                }
                this.deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
    }

    /**
     * Get inheritance chain for a theme
     * @param {string} themeId - Theme ID
     */
    getInheritanceChain(themeId) {
        const chain = [];
        let currentThemeId = themeId;
        
        while (currentThemeId) {
            chain.push(currentThemeId);
            currentThemeId = this.inheritanceMap.get(currentThemeId);
        }
        
        return chain;
    }

    /**
     * Get theme hierarchy
     * @param {string} themeId - Theme ID
     */
    getThemeHierarchy(themeId) {
        return this.themeHierarchy.get(themeId) || [themeId];
    }

    /**
     * Check if theme inherits from another
     * @param {string} childThemeId - Child theme ID
     * @param {string} parentThemeId - Parent theme ID
     */
    inheritsFrom(childThemeId, parentThemeId) {
        const chain = this.getInheritanceChain(childThemeId);
        return chain.includes(parentThemeId);
    }

    /**
     * Get all descendants of a theme
     * @param {string} parentThemeId - Parent theme ID
     */
    getDescendants(parentThemeId) {
        const descendants = [];
        const children = this.getChildren(parentThemeId);
        
        for (const childId of children) {
            descendants.push(childId);
            descendants.push(...this.getDescendants(childId));
        }
        
        return descendants;
    }

    /**
     * Remove inheritance relationship
     * @param {string} childThemeId - Child theme ID
     */
    removeInheritance(childThemeId) {
        const parentThemeId = this.inheritanceMap.get(childThemeId);
        if (parentThemeId) {
            this.inheritanceMap.delete(childThemeId);
            
            // Rebuild hierarchy
            this.themeHierarchy.clear();
            for (const [child, parent] of this.inheritanceMap) {
                this.updateHierarchy(child, parent);
            }
            
            // Clear cache
            this.overrideCache.delete(childThemeId);
            
            console.log(`Inheritance removed: ${childThemeId} -> ${parentThemeId}`);
            
            // Emit inheritance removed event
            this.eventBus.emit('inheritance:removed', {
                childThemeId,
                parentThemeId
            });
        }
    }

    /**
     * Clear inheritance cache
     */
    clearCache() {
        this.overrideCache.clear();
        console.log('Inheritance cache cleared');
    }

    /**
     * Get inheritance statistics
     */
    getStatistics() {
        const stats = {
            totalThemes: this.inheritanceMap.size,
            maxDepth: 0,
            averageDepth: 0,
            themesWithInheritance: 0,
            cacheSize: this.overrideCache.size,
            inheritanceChains: []
        };
        
        // Calculate depth statistics
        const depths = [];
        for (const themeId of this.inheritanceMap.keys()) {
            const depth = this.getInheritanceDepth(themeId);
            depths.push(depth);
            stats.maxDepth = Math.max(stats.maxDepth, depth);
        }
        
        if (depths.length > 0) {
            stats.averageDepth = depths.reduce((sum, depth) => sum + depth, 0) / depths.length;
            stats.themesWithInheritance = depths.length;
        }
        
        // Collect inheritance chains
        for (const themeId of this.inheritanceMap.keys()) {
            stats.inheritanceChains.push({
                themeId,
                chain: this.getInheritanceChain(themeId),
                depth: this.getInheritanceDepth(themeId)
            });
        }
        
        return stats;
    }

    /**
     * Destroy inheritance manager
     */
    destroy() {
        // Clear collections
        this.inheritanceMap.clear();
        this.themeHierarchy.clear();
        this.overrideCache.clear();
        
        // Destroy event bus
        this.eventBus.destroy();
        
        this.initialized = false;
        console.log('Theme Inheritance Manager destroyed');
    }
}

/**
 * Event Bus for Inheritance Manager
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

// Initialize global inheritance manager
window.themeInheritanceManager = new ThemeInheritanceManager();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.themeInheritanceManager.init();
    });
} else {
    window.themeInheritanceManager.init();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ThemeInheritanceManager,
        EventBus
    };
}