/**
 * Theme Manager - Handles CSS variable-based theme system
 * Provides functionality to switch between predefined themes and apply them dynamically
 */
class ThemeManager {
    constructor() {
        this.themes = {};
        this.currentTheme = 'default';
        this.settings = {};
        this.initialized = false;
    }

    /**
     * Initialize the theme manager
     * @param {string} configPath - Path to theme configuration file
     */
    async init(configPath = '/theme-config.json') {
        if (this.initialized) return;

        try {
            const response = await fetch(configPath);
            const config = await response.json();
            
            this.themes = config.themes;
            this.settings = config.settings;
            
            // Load saved theme from localStorage if persistence is enabled
            if (this.settings.persistThemeChoice) {
                const savedTheme = localStorage.getItem('quandary-theme');
                if (savedTheme && this.themes[savedTheme]) {
                    this.currentTheme = savedTheme;
                }
            } else {
                this.currentTheme = this.settings.defaultTheme || 'default';
            }
            
            // Apply the current theme
            this.applyTheme(this.currentTheme);
            
            this.initialized = true;
            console.log(`ThemeManager initialized with theme: ${this.currentTheme}`);
            
            // Dispatch event to notify that theme manager is ready
            window.dispatchEvent(new CustomEvent('themeManagerReady', {
                detail: { currentTheme: this.currentTheme, themes: this.themes }
            }));
            
        } catch (error) {
            console.error('Failed to initialize ThemeManager:', error);
            // Fallback to default theme
            this.applyTheme('default');
        }
    }

    /**
     * Apply a theme by updating CSS custom properties
     * @param {string} themeName - Name of the theme to apply
     */
    applyTheme(themeName) {
        if (!this.themes[themeName]) {
            console.warn(`Theme "${themeName}" not found, falling back to default`);
            themeName = 'default';
        }

        const theme = this.themes[themeName];
        const root = document.documentElement;

        // Apply color variables
        if (theme.colors) {
            Object.entries(theme.colors).forEach(([property, value]) => {
                root.style.setProperty(`--${property}`, value);
            });
        }

        // Apply gradient variables
        if (theme.gradients) {
            Object.entries(theme.gradients).forEach(([property, value]) => {
                root.style.setProperty(`--${property}`, value);
            });
        }

        // Update current theme
        this.currentTheme = themeName;

        // Save to localStorage if persistence is enabled
        if (this.settings.persistThemeChoice) {
            localStorage.setItem('quandary-theme', themeName);
        }

        // Dispatch theme change event
        window.dispatchEvent(new CustomEvent('themeChanged', {
            detail: { themeName, theme }
        }));

        console.log(`Applied theme: ${themeName}`);
    }

    /**
     * Get list of available themes
     * @returns {Array} Array of theme objects with name and description
     */
    getAvailableThemes() {
        return Object.entries(this.themes).map(([key, theme]) => ({
            id: key,
            name: theme.name,
            description: theme.description
        }));
    }

    /**
     * Get current theme name
     * @returns {string} Current theme name
     */
    getCurrentTheme() {
        return this.currentTheme;
    }

    /**
     * Get theme details by name
     * @param {string} themeName - Name of the theme
     * @returns {Object|null} Theme object or null if not found
     */
    getTheme(themeName) {
        return this.themes[themeName] || null;
    }

    /**
     * Check if theme switching is enabled
     * @returns {boolean} True if theme switching is enabled
     */
    isThemeSwitchingEnabled() {
        return this.settings.enableThemeSwitching !== false;
    }

    /**
     * Check if live preview is enabled
     * @returns {boolean} True if live preview is enabled
     */
    isLivePreviewEnabled() {
        return this.settings.enableLivePreview !== false;
    }

    /**
     * Create a theme selector dropdown element
     * @param {string} containerId - ID of container element to append the selector to
     * @param {Function} onChange - Callback function when theme changes
     */
    createThemeSelector(containerId, onChange = null) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container with ID "${containerId}" not found`);
            return;
        }

        const themes = this.getAvailableThemes();
        
        // Create selector container
        const selectorContainer = document.createElement('div');
        selectorContainer.className = 'theme-selector-container';
        
        // Create label
        const label = document.createElement('label');
        label.textContent = 'Theme:';
        label.htmlFor = 'theme-select';
        label.className = 'theme-selector-label';
        
        // Create select element
        const select = document.createElement('select');
        select.id = 'theme-select';
        select.className = 'theme-selector-select';
        
        // Add theme options
        themes.forEach(theme => {
            const option = document.createElement('option');
            option.value = theme.id;
            option.textContent = theme.name;
            option.selected = theme.id === this.currentTheme;
            select.appendChild(option);
        });
        
        // Add change event listener
        select.addEventListener('change', (e) => {
            const selectedTheme = e.target.value;
            this.applyTheme(selectedTheme);
            
            if (onChange && typeof onChange === 'function') {
                onChange(selectedTheme);
            }
        });
        
        // Append elements to container
        selectorContainer.appendChild(label);
        selectorContainer.appendChild(select);
        container.appendChild(selectorContainer);
        
        return selectorContainer;
    }

    /**
     * Add theme selector styles to the document
     */
    addThemeSelectorStyles() {
        if (document.getElementById('theme-selector-styles')) {
            return; // Styles already added
        }

        const style = document.createElement('style');
        style.id = 'theme-selector-styles';
        style.textContent = `
            .theme-selector-container {
                display: flex;
                align-items: center;
                gap: var(--spacing-sm, 0.5rem);
                margin: var(--spacing-md, 1rem) 0;
            }
            
            .theme-selector-label {
                font-weight: var(--font-weight-medium, 500);
                color: var(--text-light, #ffffff);
                font-size: var(--font-size-base, 1rem);
            }
            
            .theme-selector-select {
                padding: var(--spacing-sm, 0.5rem) var(--spacing-md, 1rem);
                border-radius: var(--border-radius-small, 8px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                background: var(--bg-medium, #1a1a1a);
                color: var(--text-light, #ffffff);
                font-size: var(--font-size-base, 1rem);
                cursor: pointer;
                transition: all var(--transition-normal, 0.3s) ease;
                min-width: 150px;
            }
            
            .theme-selector-select:hover {
                border-color: var(--primary-color, #667eea);
                background: var(--bg-light, #2a2a2a);
            }
            
            .theme-selector-select:focus {
                outline: none;
                border-color: var(--primary-color, #667eea);
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
            }
            
            .theme-selector-select option {
                background: var(--bg-medium, #1a1a1a);
                color: var(--text-light, #ffffff);
            }
            
            /* Fallback styles for legacy browsers */
            .theme-selector-select {
                background-color: #1a1a1a;
                color: #ffffff;
            }
        `;
        
        document.head.appendChild(style);
    }
}

// Create global instance
window.themeManager = new ThemeManager();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.themeManager.init();
    });
} else {
    window.themeManager.init();
}