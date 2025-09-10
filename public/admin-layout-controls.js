/**
 * Enhanced Admin Layout Controls
 * Provides comprehensive layout configuration with live preview, schema validation, and preset management
 */

class AdminLayoutControls {
    constructor() {
        this.socket = null;
        this.currentRoomId = null;
        this.livePreviewEnabled = true;
        this.validationTimeout = null;
        this.presets = {};
        
        this.init();
    }
    
    init() {
        this.initializeWebSocket();
        this.loadPresets();
        this.setupEventListeners();
        this.enhanceExistingControls();
    }
    
    initializeWebSocket() {
        if (typeof io !== 'undefined') {
            this.socket = io();
            
            this.socket.on('layout_preview', (data) => {
                this.handleLayoutPreview(data);
            });
            
            this.socket.on('layout_updated', (data) => {
                this.handleLayoutUpdate(data);
            });
            
            this.socket.on('layout_validation_result', (result) => {
                this.displayValidationResult(result);
            });
            
            this.socket.on('room_config', (data) => {
                this.handleRoomConfig(data);
            });
        }
    }
    
    async loadPresets() {
        try {
            const response = await fetch('/api/layout/presets');
            const result = await response.json();
            
            if (result.success) {
                this.presets = result.data;
                this.populatePresetSelector();
            }
        } catch (error) {
            console.error('Error loading presets:', error);
        }
    }
    
    setupEventListeners() {
        // Enhanced validation for custom layout JSON
        const customLayoutJson = document.getElementById('custom-layout-json');
        if (customLayoutJson) {
            customLayoutJson.addEventListener('input', (e) => {
                this.debounceValidation(e.target.value);
            });
        }
        
        // Live preview toggle
        document.addEventListener('change', (e) => {
            if (e.target.id === 'live-preview-toggle') {
                this.livePreviewEnabled = e.target.checked;
                if (this.livePreviewEnabled) {
                    this.triggerLivePreview();
                }
            }
        });
        
        // Configuration change listeners
        const configInputs = [
            'default-grid-template', 'default-gap-size',
            'mobile-stack-direction', 'mobile-breakpoint',
            'compact-spacing', 'compact-hide-nonessential'
        ];
        
        configInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('change', () => {
                    if (this.livePreviewEnabled) {
                        this.triggerLivePreview();
                    }
                });
                
                if (input.type === 'range') {
                    input.addEventListener('input', () => {
                        this.updateRangeDisplay(inputId);
                        if (this.livePreviewEnabled) {
                            this.triggerLivePreview();
                        }
                    });
                }
            }
        });
    }
    
    enhanceExistingControls() {
        this.addLivePreviewControls();
        this.enhanceValidationButton();
        this.enhancePresetLoader();
        this.addRoomSelector();
    }
    
    addLivePreviewControls() {
        const layoutModal = document.getElementById('layout-modal');
        if (!layoutModal) return;
        
        const modalHeader = layoutModal.querySelector('.modal-header');
        if (!modalHeader) return;
        
        // Check if controls already exist
        if (modalHeader.querySelector('.live-preview-controls')) return;
        
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'live-preview-controls';
        controlsContainer.innerHTML = `
            <label class="checkbox-label">
                <input type="checkbox" id="live-preview-toggle" checked>
                <span>Live Preview</span>
            </label>
            <select id="preview-room-selector" class="form-input" style="min-width: 150px;">
                <option value="">Select Room for Preview</option>
            </select>
            <button id="apply-layout-to-room" class="btn-secondary">Apply to Room</button>
        `;
        
        modalHeader.appendChild(controlsContainer);
        
        // Add event listeners
        document.getElementById('apply-layout-to-room').addEventListener('click', () => {
            this.applyLayoutToSelectedRoom();
        });
        
        document.getElementById('preview-room-selector').addEventListener('change', (e) => {
            this.currentRoomId = e.target.value;
            if (this.currentRoomId && this.socket) {
                this.socket.emit('join_admin', { roomId: this.currentRoomId });
            }
            
            // If we have a globally set room ID, sync it with the selector
            if (window.currentEditingRoomId && window.currentEditingRoomId !== e.target.value) {
                e.target.value = window.currentEditingRoomId;
                this.currentRoomId = window.currentEditingRoomId;
                if (this.socket) {
                    this.socket.emit('join_admin', { roomId: this.currentRoomId });
                }
            }
        });
        
        this.populateRoomSelector();
    }
    
    enhanceValidationButton() {
        const validateBtn = document.getElementById('validate-layout-btn');
        if (validateBtn) {
            validateBtn.addEventListener('click', () => {
                this.validateCurrentLayout();
            });
        }
    }
    
    enhancePresetLoader() {
        const loadPresetBtn = document.getElementById('load-preset-btn');
        if (loadPresetBtn) {
            loadPresetBtn.addEventListener('click', () => {
                this.showPresetSelector();
            });
        }
    }
    
    addRoomSelector() {
        // Populate room selector with available rooms
        this.populateRoomSelector();
    }
    
    async populateRoomSelector() {
        try {
            const response = await fetch('/api/rooms');
            const result = await response.json();
            
            if (result.success) {
                const selector = document.getElementById('preview-room-selector');
                if (selector) {
                    selector.innerHTML = '<option value="">Select Room for Preview</option>';
                    
                    result.data.forEach(room => {
                        const option = document.createElement('option');
                        option.value = room.id;
                        option.textContent = `${room.name} (${room.shortcode})`;
                        selector.appendChild(option);
                    });
                }
            }
        } catch (error) {
            console.error('Error loading rooms:', error);
        }
    }
    
    populatePresetSelector() {
        // Add preset options to load preset functionality
        const presetNames = Object.keys(this.presets);
        if (presetNames.length > 0) {
            // This could be enhanced with a dropdown or modal
            console.log('Available presets:', presetNames);
        }
    }
    
    debounceValidation(jsonString) {
        clearTimeout(this.validationTimeout);
        this.validationTimeout = setTimeout(() => {
            this.validateLayoutJSON(jsonString);
        }, 500);
    }
    
    validateLayoutJSON(jsonString) {
        try {
            const layout = JSON.parse(jsonString);
            
            if (this.socket) {
                this.socket.emit('validate_layout', { layout });
            } else {
                // Fallback validation
                this.performFallbackValidation(layout);
            }
        } catch (error) {
            this.displayValidationResult({
                valid: false,
                errors: [`Invalid JSON: ${error.message}`]
            });
        }
    }
    
    performFallbackValidation(layout) {
        const result = { valid: true, errors: [] };
        
        if (!layout.layouts || typeof layout.layouts !== 'object') {
            result.valid = false;
            result.errors.push('Layout configuration must contain a "layouts" object');
        }
        
        if (layout.layouts && !layout.layouts.default) {
            result.valid = false;
            result.errors.push('Layout configuration must contain a "default" layout');
        }
        
        // Validate each layout type
        if (layout.layouts) {
            Object.entries(layout.layouts).forEach(([type, config]) => {
                if (!config.grid && !config.flex) {
                    result.valid = false;
                    result.errors.push(`Layout "${type}" must have either grid or flex configuration`);
                }
            });
        }
        
        this.displayValidationResult(result);
    }
    
    displayValidationResult(result) {
        const resultsDiv = document.getElementById('layout-validation-results');
        if (!resultsDiv) return;
        
        if (result.valid) {
            resultsDiv.innerHTML = `
                <div class="validation-success">
                    ✓ Layout configuration is valid
                </div>
            `;
        } else {
            resultsDiv.innerHTML = `
                <div class="validation-error">
                    ✗ Layout validation failed:<br>
                    ${result.errors.map(e => `• ${e}`).join('<br>')}
                </div>
            `;
        }
    }
    
    validateCurrentLayout() {
        const activeTab = document.querySelector('.layout-tab.active');
        if (!activeTab) return;
        
        const layoutType = activeTab.dataset.layout;
        const layoutConfig = this.gatherLayoutConfiguration(layoutType);
        
        if (layoutConfig) {
            this.validateLayoutJSON(JSON.stringify(layoutConfig));
        }
    }
    
    triggerLivePreview() {
        // Use the globally set room ID if available (from per-room config button)
        const roomId = window.currentEditingRoomId || this.currentRoomId;
        
        if (!this.livePreviewEnabled || !roomId) return;
        
        const activeTab = document.querySelector('.layout-tab.active');
        if (!activeTab) return;
        
        const layoutType = activeTab.dataset.layout;
        const layoutConfig = this.gatherLayoutConfiguration(layoutType);
        
        if (layoutConfig && this.socket) {
            this.socket.emit('layout_preview', {
                roomId: roomId,
                layout: layoutConfig,
                source: 'admin'
            });
        }
    }
    
    gatherLayoutConfiguration(layoutType) {
        const config = { layouts: {} };
        
        switch (layoutType) {
            case 'default':
                const gridTemplate = document.getElementById('default-grid-template')?.value;
                const gapSize = document.getElementById('default-gap-size')?.value;
                if (gridTemplate) {
                    config.layouts.default = {
                        grid: {
                            template: gridTemplate,
                            gap: `${gapSize}px`
                        }
                    };
                }
                break;
                
            case 'mobile':
                const stackDirection = document.getElementById('mobile-stack-direction')?.value;
                const breakpoint = document.getElementById('mobile-breakpoint')?.value;
                if (stackDirection) {
                    config.layouts.mobile = {
                        flex: {
                            direction: stackDirection,
                            breakpoint: breakpoint
                        }
                    };
                }
                break;
                
            case 'compact':
                const spacing = document.getElementById('compact-spacing')?.value;
                const hideNonEssential = document.getElementById('compact-hide-nonessential')?.checked;
                config.layouts.compact = {
                    grid: {
                        spacing: `${spacing}px`
                    },
                    hideNonEssential: hideNonEssential
                };
                break;
                
            case 'custom':
                const customJson = document.getElementById('custom-layout-json')?.value;
                if (customJson) {
                    try {
                        return JSON.parse(customJson);
                    } catch (e) {
                        console.warn('Invalid custom layout JSON:', e);
                        return null;
                    }
                }
                break;
        }
        
        return config;
    }
    
    async applyLayoutToSelectedRoom() {
        // Use the globally set room ID if available (from per-room config button)
        const roomId = window.currentEditingRoomId || this.currentRoomId;
        
        if (!roomId) {
            this.showNotification('Please select a room first', 'error');
            return;
        }
        
        const activeTab = document.querySelector('.layout-tab.active');
        if (!activeTab) return;
        
        const layoutType = activeTab.dataset.layout;
        const layoutConfig = this.gatherLayoutConfiguration(layoutType);
        
        if (!layoutConfig) {
            this.showNotification('Invalid layout configuration', 'error');
            return;
        }
        
        try {
            const response = await fetch(`/api/rooms/${roomId}/layout`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ layout: layoutConfig })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification('Layout applied successfully!', 'success');
                
                // Also broadcast via WebSocket
                if (this.socket) {
                    this.socket.emit('apply_layout', {
                        roomId: roomId,
                        layout: layoutConfig
                    });
                }
                
                // Clear the global room ID after successful application
                if (window.currentEditingRoomId) {
                    window.currentEditingRoomId = null;
                }
            } else {
                this.showNotification(`Failed to apply layout: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error applying layout:', error);
            this.showNotification('Error applying layout', 'error');
        }
    }
    
    showPresetSelector() {
        const presetNames = Object.keys(this.presets);
        if (presetNames.length === 0) {
            this.showNotification('No presets available', 'info');
            return;
        }
        
        // Create a simple preset selection dialog
        const presetName = prompt(`Available presets:\n${presetNames.join('\n')}\n\nEnter preset name:`);
        
        if (presetName && this.presets[presetName]) {
            this.loadPreset(presetName);
        } else if (presetName) {
            this.showNotification('Preset not found', 'error');
        }
    }
    
    loadPreset(presetName) {
        const preset = this.presets[presetName];
        if (!preset || !preset.layout) return;
        
        const layout = preset.layout;
        
        // Switch to appropriate tab
        if (layout.type) {
            const targetTab = document.querySelector(`[data-layout="${layout.type}"]`);
            if (targetTab) {
                targetTab.click();
            }
        }
        
        // Apply preset configuration
        this.applyPresetToForm(preset);
        this.showNotification(`Loaded preset: ${preset.name}`, 'success');
    }
    
    applyPresetToForm(preset) {
        const layout = preset.layout;
        
        if (layout.grid) {
            const templateField = document.getElementById('default-grid-template');
            const gapField = document.getElementById('default-gap-size');
            
            if (templateField && layout.grid.template) {
                templateField.value = layout.grid.template;
            }
            if (gapField && layout.grid.gap) {
                const gapValue = layout.grid.gap.replace('px', '');
                gapField.value = gapValue;
                this.updateRangeDisplay('default-gap-size');
            }
        }
        
        if (layout.flex) {
            const directionField = document.getElementById('mobile-stack-direction');
            const breakpointField = document.getElementById('mobile-breakpoint');
            
            if (directionField && layout.flex.direction) {
                directionField.value = layout.flex.direction;
            }
            if (breakpointField && layout.flex.breakpoint) {
                breakpointField.value = layout.flex.breakpoint;
            }
        }
        
        // Trigger live preview if enabled
        if (this.livePreviewEnabled) {
            this.triggerLivePreview();
        }
    }
    
    updateRangeDisplay(inputId) {
        const input = document.getElementById(inputId);
        const display = document.getElementById(inputId.replace('-size', '-value').replace('-spacing', '-spacing-value'));
        
        if (input && display) {
            display.textContent = input.value + 'px';
        }
    }
    
    handleLayoutPreview(data) {
        console.log('Layout preview received:', data);
        // Handle incoming layout preview updates
        this.showNotification(`Layout preview from ${data.source}`, 'info');
    }
    
    handleLayoutUpdate(data) {
        console.log('Layout updated:', data);
        this.showNotification('Layout configuration updated!', 'success');
    }
    
    handleRoomConfig(data) {
        console.log('Room config received:', data);
        // Could populate form with current room layout
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `layout-notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.adminLayoutControls = new AdminLayoutControls();
    });
} else {
    window.adminLayoutControls = new AdminLayoutControls();
}

console.log('🎨 Admin Layout Controls loaded');