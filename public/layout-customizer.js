/**
 * Layout Customizer System (Phase 4)
 * Provides basic customization panel with color/font controls, CSS variable updates,
 * background image support, and component selection states
 */

class LayoutCustomizer {
    constructor() {
        this.selectedComponent = null;
        this.customizationPanel = null;
        this.cssVariables = new Map();
        this.backgroundImages = new Map();
        this.componentStyles = new Map();
        this.isInitialized = false;
        
        // Default CSS variables
        this.defaultVariables = {
            // Color variables
            '--primary-color': '#667eea',
            '--secondary-color': '#764ba2',
            '--accent-color': '#ff6b6b',
            '--background-color': '#0a0a0a',
            '--surface-color': '#1a1a1a',
            '--card-color': '#2a2a2a',
            '--text-color': '#ffffff',
            '--text-muted': '#b3b3b3',
            '--border-color': 'rgba(255, 255, 255, 0.1)',
            
            // Typography variables
            '--font-family': "'Segoe UI', -apple-system, sans-serif",
            '--font-size-base': '16px',
            '--font-size-lg': '1.2rem',
            '--font-size-xl': '1.5rem',
            '--font-size-2xl': '2rem',
            '--font-size-3xl': '3rem',
            '--font-weight-normal': '400',
            '--font-weight-medium': '500',
            '--font-weight-bold': '700',
            '--line-height-base': '1.5',
            '--line-height-heading': '1.2',
            
            // Spacing variables
            '--spacing-xs': '0.25rem',
            '--spacing-sm': '0.5rem',
            '--spacing-md': '1rem',
            '--spacing-lg': '1.5rem',
            '--spacing-xl': '2rem',
            '--spacing-2xl': '3rem',
            
            // Border and shadow variables
            '--border-radius': '12px',
            '--border-radius-sm': '8px',
            '--border-radius-lg': '16px',
            '--shadow-sm': '0 2px 8px rgba(0,0,0,0.1)',
            '--shadow-md': '0 4px 16px rgba(0,0,0,0.2)',
            '--shadow-lg': '0 8px 32px rgba(0,0,0,0.3)',
            '--shadow-glow': '0 0 20px rgba(102, 126, 234, 0.2)',
            
            // Animation variables
            '--transition-fast': '0.2s ease',
            '--transition-base': '0.3s ease',
            '--transition-slow': '0.5s ease',
            
            // Layout variables
            '--container-max-width': '800px',
            '--grid-gap': '1rem',
            '--component-padding': '1.5rem'
        };
        
        this.init();
    }

    init() {
        if (this.isInitialized) return;
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    initialize() {
        // Initialize CSS variables
        this.initializeCSSVariables();
        
        // Create customization panel
        this.createCustomizationPanel();
        
        // Set up component selection
        this.setupComponentSelection();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load saved customizations
        this.loadSavedCustomizations();
        
        this.isInitialized = true;
        console.log('Layout Customizer System initialized');
    }

    initializeCSSVariables() {
        // Set default CSS variables
        Object.entries(this.defaultVariables).forEach(([variable, value]) => {
            this.cssVariables.set(variable, value);
            this.setCSSVariable(variable, value);
        });
    }

    setCSSVariable(variable, value) {
        document.documentElement.style.setProperty(variable, value);
    }

    createCustomizationPanel() {
        // Create panel container
        this.customizationPanel = document.createElement('div');
        this.customizationPanel.id = 'customization-panel';
        this.customizationPanel.className = 'customization-panel';
        this.customizationPanel.innerHTML = `
            <div class="panel-header">
                <h3>Customization Panel</h3>
                <button class="panel-close" id="close-panel">×</button>
            </div>
            <div class="panel-content">
                <div class="panel-section">
                    <h4>Selected Component</h4>
                    <div class="component-info" id="component-info">
                        <p>No component selected</p>
                    </div>
                </div>
                
                <div class="panel-section">
                    <h4>Colors</h4>
                    <div class="color-controls" id="color-controls">
                        <!-- Color controls will be dynamically added -->
                    </div>
                </div>
                
                <div class="panel-section">
                    <h4>Typography</h4>
                    <div class="typography-controls" id="typography-controls">
                        <!-- Typography controls will be dynamically added -->
                    </div>
                </div>
                
                <div class="panel-section">
                    <h4>Background</h4>
                    <div class="background-controls" id="background-controls">
                        <div class="control-group">
                            <label>Background Image</label>
                            <input type="file" id="bg-image-upload" accept="image/*" class="file-input">
                            <button class="btn-secondary" id="clear-bg-image">Clear</button>
                        </div>
                        <div class="control-group">
                            <label>Background Size</label>
                            <select id="bg-size" class="select-input">
                                <option value="cover">Cover</option>
                                <option value="contain">Contain</option>
                                <option value="auto">Auto</option>
                            </select>
                        </div>
                        <div class="control-group">
                            <label>Background Position</label>
                            <select id="bg-position" class="select-input">
                                <option value="center">Center</option>
                                <option value="top">Top</option>
                                <option value="bottom">Bottom</option>
                                <option value="left">Left</option>
                                <option value="right">Right</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="panel-section">
                    <h4>Spacing</h4>
                    <div class="spacing-controls" id="spacing-controls">
                        <!-- Spacing controls will be dynamically added -->
                    </div>
                </div>
                
                <div class="panel-actions">
                    <button class="btn-primary" id="save-customization">Save</button>
                    <button class="btn-secondary" id="reset-customization">Reset</button>
                    <button class="btn-secondary" id="export-customization">Export</button>
                </div>
            </div>
        `;
        
        // Add panel to body
        document.body.appendChild(this.customizationPanel);
        
        // Set up panel controls
        this.setupPanelControls();
    }

    setupPanelControls() {
        // Close button
        const closeBtn = document.getElementById('close-panel');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hidePanel());
        }
        
        // Save button
        const saveBtn = document.getElementById('save-customization');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveCustomization());
        }
        
        // Reset button
        const resetBtn = document.getElementById('reset-customization');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetCustomization());
        }
        
        // Export button
        const exportBtn = document.getElementById('export-customization');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportCustomization());
        }
        
        // Background image upload
        const bgImageUpload = document.getElementById('bg-image-upload');
        if (bgImageUpload) {
            bgImageUpload.addEventListener('change', (e) => this.handleBackgroundImageUpload(e));
        }
        
        // Clear background image
        const clearBgImage = document.getElementById('clear-bg-image');
        if (clearBgImage) {
            clearBgImage.addEventListener('click', () => this.clearBackgroundImage());
        }
        
        // Background size and position
        const bgSize = document.getElementById('bg-size');
        const bgPosition = document.getElementById('bg-position');
        
        if (bgSize) {
            bgSize.addEventListener('change', (e) => this.updateBackgroundStyle('size', e.target.value));
        }
        
        if (bgPosition) {
            bgPosition.addEventListener('change', (e) => this.updateBackgroundStyle('position', e.target.value));
        }
    }

    setupComponentSelection() {
        // Add click handlers to all positioned components
        document.addEventListener('click', (e) => {
            const component = e.target.closest('.positioned-component');
            if (component) {
                this.selectComponent(component);
            } else if (!e.target.closest('.customization-panel')) {
                this.deselectComponent();
            }
        });
        
        // Add keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.deselectComponent();
            }
        });
    }

    selectComponent(componentElement) {
        // Remove previous selection
        this.deselectComponent();
        
        // Set new selection
        this.selectedComponent = componentElement;
        componentElement.classList.add('selected-component');
        
        // Update panel with component info
        this.updateComponentInfo(componentElement);
        
        // Update controls for selected component
        this.updateControlsForComponent(componentElement);
        
        // Show panel
        this.showPanel();
    }

    deselectComponent() {
        if (this.selectedComponent) {
            this.selectedComponent.classList.remove('selected-component');
            this.selectedComponent = null;
        }
        
        // Update panel
        this.updateComponentInfo(null);
        this.clearComponentControls();
    }

    updateComponentInfo(componentElement) {
        const componentInfo = document.getElementById('component-info');
        if (!componentInfo) return;
        
        if (componentElement) {
            const componentId = componentElement.dataset.componentId;
            const componentType = componentElement.dataset.componentType;
            
            componentInfo.innerHTML = `
                <div class="info-item">
                    <strong>ID:</strong> ${componentId}
                </div>
                <div class="info-item">
                    <strong>Type:</strong> ${componentType}
                </div>
                <div class="info-item">
                    <strong>Class:</strong> ${componentElement.className}
                </div>
            `;
        } else {
            componentInfo.innerHTML = '<p>No component selected</p>';
        }
    }

    updateControlsForComponent(componentElement) {
        // Clear existing controls
        this.clearComponentControls();
        
        if (!componentElement) return;
        
        // Add color controls
        this.createColorControls(componentElement);
        
        // Add typography controls
        this.createTypographyControls(componentElement);
        
        // Add spacing controls
        this.createSpacingControls(componentElement);
    }

    createColorControls(componentElement) {
        const colorControls = document.getElementById('color-controls');
        if (!colorControls) return;
        
        const colorVariables = [
            { variable: '--primary-color', label: 'Primary Color', type: 'color' },
            { variable: '--secondary-color', label: 'Secondary Color', type: 'color' },
            { variable: '--accent-color', label: 'Accent Color', type: 'color' },
            { variable: '--background-color', label: 'Background Color', type: 'color' },
            { variable: '--text-color', label: 'Text Color', type: 'color' }
        ];
        
        colorVariables.forEach(({ variable, label, type }) => {
            const controlGroup = document.createElement('div');
            controlGroup.className = 'control-group';
            
            const currentValue = this.cssVariables.get(variable) || this.defaultVariables[variable];
            
            controlGroup.innerHTML = `
                <label>${label}</label>
                <input type="${type}" 
                       value="${currentValue}" 
                       data-variable="${variable}"
                       class="color-input">
            `;
            
            const input = controlGroup.querySelector('input');
            input.addEventListener('input', (e) => {
                this.updateCSSVariable(variable, e.target.value);
            });
            
            colorControls.appendChild(controlGroup);
        });
    }

    createTypographyControls(componentElement) {
        const typographyControls = document.getElementById('typography-controls');
        if (!typographyControls) return;
        
        const typographyVariables = [
            { variable: '--font-family', label: 'Font Family', type: 'select', options: [
                { value: "'Segoe UI', -apple-system, sans-serif", label: 'Segoe UI' },
                { value: "'Roboto', sans-serif", label: 'Roboto' },
                { value: "'Open Sans', sans-serif", label: 'Open Sans' },
                { value: "'Montserrat', sans-serif", label: 'Montserrat' },
                { value: "'Playfair Display', serif", label: 'Playfair Display' }
            ]},
            { variable: '--font-size-base', label: 'Base Font Size', type: 'range', min: '12', max: '24', unit: 'px' },
            { variable: '--font-weight-bold', label: 'Font Weight', type: 'select', options: [
                { value: '400', label: 'Normal' },
                { value: '500', label: 'Medium' },
                { value: '600', label: 'Semi Bold' },
                { value: '700', label: 'Bold' },
                { value: '800', label: 'Extra Bold' }
            ]},
            { variable: '--line-height-base', label: 'Line Height', type: 'range', min: '1', max: '2', step: '0.1' }
        ];
        
        typographyVariables.forEach(({ variable, label, type, options, min, max, step, unit }) => {
            const controlGroup = document.createElement('div');
            controlGroup.className = 'control-group';
            
            const currentValue = this.cssVariables.get(variable) || this.defaultVariables[variable];
            
            let inputHTML = '';
            
            if (type === 'select') {
                inputHTML = `<select data-variable="${variable}" class="select-input">`;
                options.forEach(option => {
                    const selected = option.value === currentValue ? 'selected' : '';
                    inputHTML += `<option value="${option.value}" ${selected}>${option.label}</option>`;
                });
                inputHTML += `</select>`;
            } else if (type === 'range') {
                const numericValue = parseFloat(currentValue);
                inputHTML = `
                    <input type="range" 
                           min="${min || 0}" 
                           max="${max || 100}" 
                           step="${step || 1}"
                           value="${numericValue}" 
                           data-variable="${variable}"
                           data-unit="${unit || ''}"
                           class="range-input">
                    <span class="range-value">${currentValue}</span>
                `;
            }
            
            controlGroup.innerHTML = `
                <label>${label}</label>
                ${inputHTML}
            `;
            
            const input = controlGroup.querySelector('input, select');
            input.addEventListener('input', (e) => {
                let value = e.target.value;
                if (e.target.dataset.unit) {
                    value += e.target.dataset.unit;
                }
                this.updateCSSVariable(variable, value);
                
                // Update range value display
                if (e.target.classList.contains('range-input')) {
                    const valueDisplay = controlGroup.querySelector('.range-value');
                    if (valueDisplay) {
                        valueDisplay.textContent = value;
                    }
                }
            });
            
            typographyControls.appendChild(controlGroup);
        });
    }

    createSpacingControls(componentElement) {
        const spacingControls = document.getElementById('spacing-controls');
        if (!spacingControls) return;
        
        const spacingVariables = [
            { variable: '--spacing-md', label: 'Medium Spacing', type: 'range', min: '0.5', max: '3', step: '0.25', unit: 'rem' },
            { variable: '--border-radius', label: 'Border Radius', type: 'range', min: '0', max: '24', step: '2', unit: 'px' },
            { variable: '--grid-gap', label: 'Grid Gap', type: 'range', min: '0.5', max: '3', step: '0.25', unit: 'rem' }
        ];
        
        spacingVariables.forEach(({ variable, label, type, min, max, step, unit }) => {
            const controlGroup = document.createElement('div');
            controlGroup.className = 'control-group';
            
            const currentValue = this.cssVariables.get(variable) || this.defaultVariables[variable];
            const numericValue = parseFloat(currentValue);
            
            controlGroup.innerHTML = `
                <label>${label}</label>
                <input type="range" 
                       min="${min}" 
                       max="${max}" 
                       step="${step}"
                       value="${numericValue}" 
                       data-variable="${variable}"
                       data-unit="${unit}"
                       class="range-input">
                <span class="range-value">${currentValue}</span>
            `;
            
            const input = controlGroup.querySelector('input');
            input.addEventListener('input', (e) => {
                const value = e.target.value + e.target.dataset.unit;
                this.updateCSSVariable(variable, value);
                
                // Update range value display
                const valueDisplay = controlGroup.querySelector('.range-value');
                if (valueDisplay) {
                    valueDisplay.textContent = value;
                }
            });
            
            spacingControls.appendChild(controlGroup);
        });
    }

    clearComponentControls() {
        const colorControls = document.getElementById('color-controls');
        const typographyControls = document.getElementById('typography-controls');
        const spacingControls = document.getElementById('spacing-controls');
        
        if (colorControls) colorControls.innerHTML = '';
        if (typographyControls) typographyControls.innerHTML = '';
        if (spacingControls) spacingControls.innerHTML = '';
    }

    updateCSSVariable(variable, value) {
        // Update internal storage
        this.cssVariables.set(variable, value);
        
        // Update CSS
        this.setCSSVariable(variable, value);
        
        // Store component-specific style if component is selected
        if (this.selectedComponent) {
            const componentId = this.selectedComponent.dataset.componentId;
            if (!this.componentStyles.has(componentId)) {
                this.componentStyles.set(componentId, new Map());
            }
            this.componentStyles.get(componentId).set(variable, value);
        }
    }

    handleBackgroundImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageData = e.target.result;
            this.setBackgroundImage(imageData);
        };
        reader.readAsDataURL(file);
    }

    setBackgroundImage(imageData) {
        // Store image data
        this.backgroundImages.set('main', imageData);
        
        // Apply background image
        document.body.style.backgroundImage = `url(${imageData})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundRepeat = 'no-repeat';
        document.body.style.backgroundAttachment = 'fixed';
        
        // Update background controls
        const bgSize = document.getElementById('bg-size');
        const bgPosition = document.getElementById('bg-position');
        
        if (bgSize) bgSize.value = 'cover';
        if (bgPosition) bgPosition.value = 'center';
    }

    clearBackgroundImage() {
        // Remove background image
        this.backgroundImages.delete('main');
        document.body.style.backgroundImage = '';
        
        // Clear file input
        const bgImageUpload = document.getElementById('bg-image-upload');
        if (bgImageUpload) {
            bgImageUpload.value = '';
        }
    }

    updateBackgroundStyle(property, value) {
        switch (property) {
            case 'size':
                document.body.style.backgroundSize = value;
                break;
            case 'position':
                document.body.style.backgroundPosition = value;
                break;
        }
    }

    showPanel() {
        if (this.customizationPanel) {
            this.customizationPanel.classList.add('panel-visible');
        }
    }

    hidePanel() {
        if (this.customizationPanel) {
            this.customizationPanel.classList.remove('panel-visible');
        }
    }

    setupEventListeners() {
        // Listen for layout changes
        window.addEventListener('layoutChange', (e) => {
            // Re-apply customizations after layout change
            this.reapplyCustomizations();
        });
        
        // Listen for component integration events
        window.addEventListener('componentIntegrationReady', () => {
            // Set up component selection for integrated components
            this.setupIntegratedComponentSelection();
        });
    }

    setupIntegratedComponentSelection() {
        // Add selection capability to integrated components
        if (window.componentIntegration) {
            window.componentIntegration.components.forEach((component, id) => {
                component.element.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.selectComponent(component.element);
                });
            });
        }
    }

    saveCustomization() {
        const customizationData = {
            cssVariables: Object.fromEntries(this.cssVariables),
            backgroundImages: Object.fromEntries(this.backgroundImages),
            componentStyles: Object.fromEntries(
                Array.from(this.componentStyles.entries()).map(([id, styles]) => [
                    id, 
                    Object.fromEntries(styles)
                ])
            ),
            timestamp: new Date().toISOString()
        };
        
        // Save to localStorage
        localStorage.setItem('quandary-customization', JSON.stringify(customizationData));
        
        // Show success message
        this.showNotification('Customization saved successfully!', 'success');
    }

    loadSavedCustomizations() {
        try {
            const savedData = localStorage.getItem('quandary-customization');
            if (savedData) {
                const customizationData = JSON.parse(savedData);
                
                // Load CSS variables
                if (customizationData.cssVariables) {
                    Object.entries(customizationData.cssVariables).forEach(([variable, value]) => {
                        this.cssVariables.set(variable, value);
                        this.setCSSVariable(variable, value);
                    });
                }
                
                // Load background images
                if (customizationData.backgroundImages) {
                    Object.entries(customizationData.backgroundImages).forEach(([key, imageData]) => {
                        this.backgroundImages.set(key, imageData);
                        if (key === 'main') {
                            this.setBackgroundImage(imageData);
                        }
                    });
                }
                
                // Load component styles
                if (customizationData.componentStyles) {
                    Object.entries(customizationData.componentStyles).forEach(([componentId, styles]) => {
                        const styleMap = new Map(Object.entries(styles));
                        this.componentStyles.set(componentId, styleMap);
                    });
                }
                
                console.log('Loaded saved customizations');
            }
        } catch (error) {
            console.error('Error loading saved customizations:', error);
        }
    }

    resetCustomization() {
        // Reset to defaults
        this.initializeCSSVariables();
        
        // Clear background images
        this.clearBackgroundImage();
        
        // Clear component styles
        this.componentStyles.clear();
        
        // Clear saved data
        localStorage.removeItem('quandary-customization');
        
        // Update controls
        if (this.selectedComponent) {
            this.updateControlsForComponent(this.selectedComponent);
        }
        
        this.showNotification('Customization reset to defaults', 'info');
    }

    exportCustomization() {
        const customizationData = {
            cssVariables: Object.fromEntries(this.cssVariables),
            backgroundImages: Object.fromEntries(this.backgroundImages),
            componentStyles: Object.fromEntries(
                Array.from(this.componentStyles.entries()).map(([id, styles]) => [
                    id, 
                    Object.fromEntries(styles)
                ])
            ),
            timestamp: new Date().toISOString(),
            version: '1.0'
        };
        
        // Create download link
        const blob = new Blob([JSON.stringify(customizationData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quandary-customization-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('Customization exported successfully!', 'success');
    }

    reapplyCustomizations() {
        // Re-apply all CSS variables
        this.cssVariables.forEach((value, variable) => {
            this.setCSSVariable(variable, value);
        });
        
        // Re-apply background images
        this.backgroundImages.forEach((imageData, key) => {
            if (key === 'main') {
                this.setBackgroundImage(imageData);
            }
        });
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `customization-notification notification-${type}`;
        notification.textContent = message;
        
        // Add notification styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
            max-width: 300px;
        `;
        
        // Set background color based on type
        const colors = {
            success: '#4ade80',
            error: '#f87171',
            info: '#667eea',
            warning: '#fbbf24'
        };
        
        notification.style.backgroundColor = colors[type] || colors.info;
        
        document.body.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Public API
    getCustomizationData() {
        return {
            cssVariables: Object.fromEntries(this.cssVariables),
            backgroundImages: Object.fromEntries(this.backgroundImages),
            componentStyles: Object.fromEntries(
                Array.from(this.componentStyles.entries()).map(([id, styles]) => [
                    id, 
                    Object.fromEntries(styles)
                ])
            )
        };
    }

    applyCustomizationData(data) {
        if (data.cssVariables) {
            Object.entries(data.cssVariables).forEach(([variable, value]) => {
                this.cssVariables.set(variable, value);
                this.setCSSVariable(variable, value);
            });
        }
        
        if (data.backgroundImages) {
            Object.entries(data.backgroundImages).forEach(([key, imageData]) => {
                this.backgroundImages.set(key, imageData);
                if (key === 'main') {
                    this.setBackgroundImage(imageData);
                }
            });
        }
        
        if (data.componentStyles) {
            Object.entries(data.componentStyles).forEach(([componentId, styles]) => {
                const styleMap = new Map(Object.entries(styles));
                this.componentStyles.set(componentId, styleMap);
            });
        }
    }
}

// Initialize layout customizer
document.addEventListener('DOMContentLoaded', () => {
    window.layoutCustomizer = new LayoutCustomizer();
});

// Export for global access
window.LayoutCustomizer = LayoutCustomizer;