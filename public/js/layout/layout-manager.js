/**
 * Consolidated Layout Management System
 * Consolidated from: layout-builder-enhanced.js, layout-customizer.js, layout-validator.js, admin-layout-controls.js
 *
 * Provides comprehensive layout building, customization, and validation tools
 */

// Layout Schema Validator
class LayoutValidator {
    constructor() {
        this.schema = {
            type: 'object',
            required: ['layouts'],
            properties: {
                layouts: {
                    type: 'object',
                    patternProperties: {
                        '^[a-zA-Z0-9_-]+$': {
                            type: 'object',
                            properties: {
                                grid: {
                                    type: 'object',
                                    properties: {
                                        template: { type: 'string' },
                                        gap: { type: 'string' },
                                        rows: { type: 'string' }
                                    }
                                },
                                components: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            type: { type: 'string' },
                                            position: { type: 'object' },
                                            config: { type: 'object' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };

        this.validationRules = [
            this.validateLayoutStructure.bind(this),
            this.validateGridTemplates.bind(this),
            this.validateComponentPositions.bind(this),
            this.validateBreakpoints.bind(this)
        ];
    }

    validate(layoutConfig) {
        const errors = [];
        const warnings = [];

        // Basic structure validation
        if (!layoutConfig || typeof layoutConfig !== 'object') {
            errors.push('Layout configuration must be an object');
            return { valid: false, errors, warnings };
        }

        // Run all validation rules
        this.validationRules.forEach(rule => {
            try {
                const result = rule(layoutConfig);
                if (result.errors) errors.push(...result.errors);
                if (result.warnings) warnings.push(...result.warnings);
            } catch (error) {
                errors.push(`Validation rule error: ${error.message}`);
            }
        });

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    validateLayoutStructure(config) {
        const errors = [];
        const warnings = [];

        if (!config.layouts || typeof config.layouts !== 'object') {
            errors.push('Layout must contain a "layouts" object');
            return { errors, warnings };
        }

        const layoutKeys = Object.keys(config.layouts);
        if (layoutKeys.length === 0) {
            errors.push('At least one layout must be defined');
        }

        if (!config.layouts.default) {
            warnings.push('No default layout defined');
        }

        // Validate each layout
        layoutKeys.forEach(layoutName => {
            const layout = config.layouts[layoutName];
            if (!layout || typeof layout !== 'object') {
                errors.push(`Layout "${layoutName}" must be an object`);
            }
        });

        return { errors, warnings };
    }

    validateGridTemplates(config) {
        const errors = [];
        const warnings = [];

        Object.entries(config.layouts || {}).forEach(([layoutName, layout]) => {
            if (layout.grid) {
                if (!layout.grid.template) {
                    errors.push(`Layout "${layoutName}" grid must have a template`);
                }

                // Validate CSS grid template syntax
                if (layout.grid.template && !this.isValidGridTemplate(layout.grid.template)) {
                    warnings.push(`Layout "${layoutName}" has potentially invalid grid template: ${layout.grid.template}`);
                }
            }
        });

        return { errors, warnings };
    }

    validateComponentPositions(config) {
        const errors = [];
        const warnings = [];

        Object.entries(config.layouts || {}).forEach(([layoutName, layout]) => {
            if (layout.components && Array.isArray(layout.components)) {
                layout.components.forEach((component, index) => {
                    if (!component.type) {
                        errors.push(`Component ${index} in layout "${layoutName}" must have a type`);
                    }

                    if (!component.position) {
                        warnings.push(`Component ${index} in layout "${layoutName}" has no position defined`);
                    }
                });
            }
        });

        return { errors, warnings };
    }

    validateBreakpoints(config) {
        const errors = [];
        const warnings = [];

        const validBreakpoints = ['mobile', 'tablet', 'desktop'];

        Object.entries(config.layouts || {}).forEach(([layoutName, layout]) => {
            if (layout.breakpoints) {
                Object.keys(layout.breakpoints).forEach(breakpoint => {
                    if (!validBreakpoints.includes(breakpoint)) {
                        warnings.push(`Unknown breakpoint "${breakpoint}" in layout "${layoutName}"`);
                    }
                });
            }
        });

        return { errors, warnings };
    }

    isValidGridTemplate(template) {
        // Basic validation for CSS grid template
        if (typeof template !== 'string') return false;

        // Check for common valid patterns
        const validPatterns = [
            /^(\d+fr\s*)+$/,  // 1fr 2fr 1fr
            /^(\d+px\s*)+$/,  // 200px 1fr 100px
            /^(minmax\([^)]+\)\s*)+$/, // minmax patterns
            /^(repeat\([^)]+\)\s*)+$/, // repeat patterns
            /^[\w\-\s()fr%px]+$/ // General pattern
        ];

        return validPatterns.some(pattern => pattern.test(template.trim()));
    }
}

// Layout Builder with Enhanced Features
class LayoutBuilder {
    constructor(container) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        if (!this.container) {
            throw new Error('Layout builder container not found');
        }

        this.validator = new LayoutValidator();
        this.currentLayout = {
            layouts: {
                default: {
                    grid: { template: '1fr', gap: '20px' },
                    components: []
                }
            }
        };

        this.selectedComponent = null;
        this.draggedElement = null;
        this.tools = new Map();
        this.previewMode = false;

        this.init();
    }

    init() {
        this.createBuilderInterface();
        this.setupEventListeners();
        this.registerDefaultTools();
        this.render();
    }

    createBuilderInterface() {
        this.container.innerHTML = `
            <div class="layout-builder">
                <div class="builder-toolbar">
                    <div class="tool-group">
                        <button class="tool-btn" data-tool="select" title="Select">↖</button>
                        <button class="tool-btn" data-tool="text" title="Add Text">T</button>
                        <button class="tool-btn" data-tool="image" title="Add Image">🖼</button>
                        <button class="tool-btn" data-tool="video" title="Add Video">🎬</button>
                        <button class="tool-btn" data-tool="timer" title="Add Timer">⏱</button>
                    </div>
                    <div class="control-group">
                        <button id="preview-btn" class="control-btn">Preview</button>
                        <button id="save-btn" class="control-btn">Save</button>
                        <button id="load-btn" class="control-btn">Load</button>
                    </div>
                </div>

                <div class="builder-main">
                    <div class="builder-canvas" id="canvas">
                        <div class="grid-overlay" id="grid-overlay"></div>
                        <div class="components-layer" id="components-layer"></div>
                    </div>

                    <div class="properties-panel" id="properties-panel">
                        <h3>Properties</h3>
                        <div class="property-groups">
                            <div class="property-group">
                                <h4>Grid Settings</h4>
                                <label>Template: <input type="text" id="grid-template" placeholder="1fr 2fr 1fr"></label>
                                <label>Gap: <input type="text" id="grid-gap" placeholder="20px"></label>
                                <label>Rows: <input type="text" id="grid-rows" placeholder="auto"></label>
                            </div>

                            <div class="property-group" id="component-properties" style="display: none;">
                                <h4>Component Properties</h4>
                                <div id="component-props-content"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="builder-status">
                    <span id="status-text">Ready</span>
                    <span id="validation-status"></span>
                </div>
            </div>
        `;

        this.elements = {
            toolbar: this.container.querySelector('.builder-toolbar'),
            canvas: this.container.querySelector('#canvas'),
            gridOverlay: this.container.querySelector('#grid-overlay'),
            componentsLayer: this.container.querySelector('#components-layer'),
            propertiesPanel: this.container.querySelector('#properties-panel'),
            gridTemplate: this.container.querySelector('#grid-template'),
            gridGap: this.container.querySelector('#grid-gap'),
            gridRows: this.container.querySelector('#grid-rows'),
            statusText: this.container.querySelector('#status-text'),
            validationStatus: this.container.querySelector('#validation-status'),
            componentProperties: this.container.querySelector('#component-properties'),
            componentPropsContent: this.container.querySelector('#component-props-content')
        };
    }

    setupEventListeners() {
        // Tool selection
        this.elements.toolbar.addEventListener('click', (e) => {
            if (e.target.classList.contains('tool-btn')) {
                this.selectTool(e.target.dataset.tool);
            }
        });

        // Grid property changes
        ['input', 'change'].forEach(event => {
            this.elements.gridTemplate.addEventListener(event, () => this.updateGridProperties());
            this.elements.gridGap.addEventListener(event, () => this.updateGridProperties());
            this.elements.gridRows.addEventListener(event, () => this.updateGridProperties());
        });

        // Canvas interactions
        this.elements.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.elements.canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));

        // Control buttons
        document.getElementById('preview-btn')?.addEventListener('click', () => this.togglePreview());
        document.getElementById('save-btn')?.addEventListener('click', () => this.saveLayout());
        document.getElementById('load-btn')?.addEventListener('click', () => this.showLoadDialog());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    registerDefaultTools() {
        this.tools.set('select', {
            name: 'Select',
            cursor: 'default',
            onActivate: () => this.setStatus('Select mode - click components to select'),
            onClick: (e) => this.selectComponentAt(e)
        });

        this.tools.set('text', {
            name: 'Text',
            cursor: 'text',
            onActivate: () => this.setStatus('Click to add text component'),
            onClick: (e) => this.addTextComponent(e)
        });

        this.tools.set('image', {
            name: 'Image',
            cursor: 'crosshair',
            onActivate: () => this.setStatus('Click to add image component'),
            onClick: (e) => this.addImageComponent(e)
        });

        this.tools.set('video', {
            name: 'Video',
            cursor: 'crosshair',
            onActivate: () => this.setStatus('Click to add video component'),
            onClick: (e) => this.addVideoComponent(e)
        });

        this.tools.set('timer', {
            name: 'Timer',
            cursor: 'crosshair',
            onActivate: () => this.setStatus('Click to add timer component'),
            onClick: (e) => this.addTimerComponent(e)
        });
    }

    selectTool(toolName) {
        this.currentTool = toolName;

        // Update UI
        this.elements.toolbar.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === toolName);
        });

        // Apply tool
        const tool = this.tools.get(toolName);
        if (tool) {
            this.elements.canvas.style.cursor = tool.cursor;
            if (tool.onActivate) tool.onActivate();
        }
    }

    handleCanvasClick(e) {
        const tool = this.tools.get(this.currentTool);
        if (tool && tool.onClick) {
            tool.onClick(e);
        }
    }

    handleCanvasMouseMove(e) {
        if (this.currentTool !== 'select') {
            this.updateGridHighlight(e);
        }
    }

    updateGridHighlight(e) {
        const rect = this.elements.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Calculate grid position based on current template
        const gridPos = this.calculateGridPosition(x, y);

        // Update grid overlay highlight
        this.highlightGridCell(gridPos);
    }

    calculateGridPosition(x, y) {
        // This is a simplified calculation
        // In reality, you'd need to parse the grid template and calculate actual positions
        const cellWidth = this.elements.canvas.clientWidth / 3; // Assuming 3 columns for now
        const cellHeight = 100; // Fixed height for now

        return {
            column: Math.floor(x / cellWidth) + 1,
            row: Math.floor(y / cellHeight) + 1
        };
    }

    highlightGridCell(gridPos) {
        // Remove existing highlights
        this.elements.gridOverlay.querySelectorAll('.grid-highlight').forEach(el => el.remove());

        // Add new highlight
        const highlight = document.createElement('div');
        highlight.className = 'grid-highlight';
        highlight.style.gridColumn = gridPos.column;
        highlight.style.gridRow = gridPos.row;
        this.elements.gridOverlay.appendChild(highlight);
    }

    addTextComponent(e) {
        const gridPos = this.calculateGridPosition(
            e.clientX - this.elements.canvas.getBoundingClientRect().left,
            e.clientY - this.elements.canvas.getBoundingClientRect().top
        );

        const component = {
            id: this.generateId(),
            type: 'text',
            position: { gridColumn: gridPos.column, gridRow: gridPos.row },
            config: {
                content: 'New Text Component',
                fontSize: '16px',
                color: '#000000',
                textAlign: 'left'
            }
        };

        this.addComponent(component);
    }

    addImageComponent(e) {
        const gridPos = this.calculateGridPosition(
            e.clientX - this.elements.canvas.getBoundingClientRect().left,
            e.clientY - this.elements.canvas.getBoundingClientRect().top
        );

        const component = {
            id: this.generateId(),
            type: 'image',
            position: { gridColumn: gridPos.column, gridRow: gridPos.row },
            config: {
                src: '/uploads/placeholder.jpg',
                alt: 'Image component',
                width: '100%',
                height: 'auto'
            }
        };

        this.addComponent(component);
    }

    addVideoComponent(e) {
        const gridPos = this.calculateGridPosition(
            e.clientX - this.elements.canvas.getBoundingClientRect().left,
            e.clientY - this.elements.canvas.getBoundingClientRect().top
        );

        const component = {
            id: this.generateId(),
            type: 'video',
            position: { gridColumn: gridPos.column, gridRow: gridPos.row },
            config: {
                src: '/uploads/sample.mp4',
                controls: true,
                autoplay: false,
                width: '100%'
            }
        };

        this.addComponent(component);
    }

    addTimerComponent(e) {
        const gridPos = this.calculateGridPosition(
            e.clientX - this.elements.canvas.getBoundingClientRect().left,
            e.clientY - this.elements.canvas.getBoundingClientRect().top
        );

        const component = {
            id: this.generateId(),
            type: 'timer',
            position: { gridColumn: gridPos.column, gridRow: gridPos.row },
            config: {
                format: 'mm:ss',
                fontSize: '24px',
                color: '#000000',
                showLabel: true
            }
        };

        this.addComponent(component);
    }

    addComponent(component) {
        const currentLayout = this.currentLayout.layouts.default;
        currentLayout.components.push(component);
        this.renderComponent(component);
        this.selectComponent(component.id);
        this.validateLayout();
    }

    renderComponent(component) {
        const element = document.createElement('div');
        element.className = 'layout-component';
        element.dataset.componentId = component.id;
        element.dataset.componentType = component.type;

        // Apply position
        if (component.position) {
            Object.entries(component.position).forEach(([prop, value]) => {
                element.style[prop] = value;
            });
        }

        // Render component content based on type
        switch (component.type) {
            case 'text':
                element.innerHTML = `<div class="text-component">${component.config.content}</div>`;
                break;
            case 'image':
                element.innerHTML = `<img src="${component.config.src}" alt="${component.config.alt}">`;
                break;
            case 'video':
                element.innerHTML = `<video src="${component.config.src}" ${component.config.controls ? 'controls' : ''}></video>`;
                break;
            case 'timer':
                element.innerHTML = `<div class="timer-component">00:00</div>`;
                break;
        }

        // Add selection handler
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectComponent(component.id);
        });

        this.elements.componentsLayer.appendChild(element);
    }

    selectComponent(componentId) {
        // Remove previous selection
        this.elements.componentsLayer.querySelectorAll('.selected').forEach(el => {
            el.classList.remove('selected');
        });

        // Select new component
        const element = this.elements.componentsLayer.querySelector(`[data-component-id="${componentId}"]`);
        if (element) {
            element.classList.add('selected');
            this.selectedComponent = componentId;
            this.showComponentProperties(componentId);
        }
    }

    showComponentProperties(componentId) {
        const component = this.findComponent(componentId);
        if (!component) return;

        this.elements.componentProperties.style.display = 'block';
        this.elements.componentPropsContent.innerHTML = this.renderComponentProperties(component);
    }

    renderComponentProperties(component) {
        let html = `<p><strong>Type:</strong> ${component.type}</p>`;

        Object.entries(component.config).forEach(([key, value]) => {
            html += `
                <label>
                    ${key}:
                    <input type="text" data-prop="${key}" value="${value}" class="component-prop-input">
                </label>
            `;
        });

        return html;
    }

    findComponent(componentId) {
        return this.currentLayout.layouts.default.components.find(c => c.id === componentId);
    }

    updateGridProperties() {
        const template = this.elements.gridTemplate.value || '1fr';
        const gap = this.elements.gridGap.value || '20px';
        const rows = this.elements.gridRows.value || 'auto';

        this.currentLayout.layouts.default.grid = {
            template,
            gap,
            rows
        };

        this.applyGridStyles();
        this.validateLayout();
    }

    applyGridStyles() {
        const grid = this.currentLayout.layouts.default.grid;
        this.elements.componentsLayer.style.display = 'grid';
        this.elements.componentsLayer.style.gridTemplateColumns = grid.template;
        this.elements.componentsLayer.style.gap = grid.gap;
        if (grid.rows) {
            this.elements.componentsLayer.style.gridTemplateRows = grid.rows;
        }
    }

    validateLayout() {
        const validation = this.validator.validate(this.currentLayout);

        if (validation.valid) {
            this.elements.validationStatus.textContent = '✓ Valid';
            this.elements.validationStatus.className = 'validation-success';
        } else {
            this.elements.validationStatus.textContent = `✗ ${validation.errors.length} errors`;
            this.elements.validationStatus.className = 'validation-error';
            this.elements.validationStatus.title = validation.errors.join(', ');
        }
    }

    togglePreview() {
        this.previewMode = !this.previewMode;
        this.container.classList.toggle('preview-mode', this.previewMode);

        const previewBtn = document.getElementById('preview-btn');
        if (previewBtn) {
            previewBtn.textContent = this.previewMode ? 'Edit' : 'Preview';
        }
    }

    saveLayout() {
        const validation = this.validator.validate(this.currentLayout);

        if (!validation.valid) {
            alert(`Cannot save invalid layout:\n${validation.errors.join('\n')}`);
            return;
        }

        // Emit save event
        this.container.dispatchEvent(new CustomEvent('layoutSave', {
            detail: { layout: this.currentLayout }
        }));

        this.setStatus('Layout saved successfully');
    }

    loadLayout(layoutConfig) {
        const validation = this.validator.validate(layoutConfig);

        if (!validation.valid) {
            throw new Error(`Invalid layout: ${validation.errors.join(', ')}`);
        }

        this.currentLayout = layoutConfig;
        this.render();
    }

    render() {
        // Clear canvas
        this.elements.componentsLayer.innerHTML = '';

        // Update grid properties inputs
        const grid = this.currentLayout.layouts.default.grid;
        this.elements.gridTemplate.value = grid.template || '';
        this.elements.gridGap.value = grid.gap || '';
        this.elements.gridRows.value = grid.rows || '';

        // Apply grid styles
        this.applyGridStyles();

        // Render components
        this.currentLayout.layouts.default.components.forEach(component => {
            this.renderComponent(component);
        });

        // Validate
        this.validateLayout();
    }

    handleKeyboard(e) {
        if (e.key === 'Delete' && this.selectedComponent) {
            this.deleteComponent(this.selectedComponent);
        }
        if (e.key === 'Escape') {
            this.selectTool('select');
        }
    }

    deleteComponent(componentId) {
        const components = this.currentLayout.layouts.default.components;
        const index = components.findIndex(c => c.id === componentId);

        if (index > -1) {
            components.splice(index, 1);
            const element = this.elements.componentsLayer.querySelector(`[data-component-id="${componentId}"]`);
            if (element) {
                element.remove();
            }
            this.selectedComponent = null;
            this.elements.componentProperties.style.display = 'none';
            this.validateLayout();
        }
    }

    setStatus(message) {
        this.elements.statusText.textContent = message;
    }

    generateId() {
        return `component_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    showLoadDialog() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const layoutConfig = JSON.parse(event.target.result);
                        this.loadLayout(layoutConfig);
                        this.setStatus('Layout loaded successfully');
                    } catch (error) {
                        alert('Invalid layout file: ' + error.message);
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }

    getLayout() {
        return { ...this.currentLayout };
    }
}

// Layout Customizer - Room-specific layout management
class LayoutCustomizer {
    constructor(roomId) {
        this.roomId = roomId;
        this.apiEndpoint = '/api/v1/rooms';
        this.currentLayout = null;
        this.validator = new LayoutValidator();
    }

    async loadRoomLayout() {
        try {
            const response = await fetch(`${this.apiEndpoint}/${this.roomId}/layout`);
            const result = await response.json();

            if (result.success) {
                this.currentLayout = result.data;
                return this.currentLayout;
            } else {
                throw new Error(result.error || 'Failed to load layout');
            }
        } catch (error) {
            console.error('Failed to load room layout:', error);
            throw error;
        }
    }

    async saveRoomLayout(layoutConfig) {
        const validation = this.validator.validate(layoutConfig);

        if (!validation.valid) {
            throw new Error(`Invalid layout: ${validation.errors.join(', ')}`);
        }

        try {
            const response = await fetch(`${this.apiEndpoint}/${this.roomId}/layout`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ layout: layoutConfig })
            });

            const result = await response.json();

            if (result.success) {
                this.currentLayout = layoutConfig;
                return result;
            } else {
                throw new Error(result.error || 'Failed to save layout');
            }
        } catch (error) {
            console.error('Failed to save room layout:', error);
            throw error;
        }
    }

    async loadPresets() {
        try {
            const response = await fetch('/api/v1/layout/presets');
            const result = await response.json();

            if (result.success) {
                return result.data;
            } else {
                throw new Error(result.error || 'Failed to load presets');
            }
        } catch (error) {
            console.error('Failed to load layout presets:', error);
            throw error;
        }
    }

    async applyPreset(presetName) {
        const presets = await this.loadPresets();
        const preset = presets[presetName];

        if (!preset) {
            throw new Error(`Preset '${presetName}' not found`);
        }

        return await this.saveRoomLayout(preset.layout);
    }

    validateLayout(layoutConfig) {
        return this.validator.validate(layoutConfig);
    }
}

// Admin Layout Controls - Interface for layout management
class AdminLayoutControls {
    constructor(container, roomId) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.roomId = roomId;
        this.customizer = new LayoutCustomizer(roomId);
        this.builder = null;

        this.init();
    }

    init() {
        this.createInterface();
        this.setupEventListeners();
        this.loadCurrentLayout();
    }

    createInterface() {
        this.container.innerHTML = `
            <div class="admin-layout-controls">
                <div class="controls-header">
                    <h3>Layout Management</h3>
                    <div class="control-actions">
                        <button id="load-presets-btn" class="btn btn-secondary">Load Presets</button>
                        <button id="open-builder-btn" class="btn btn-primary">Open Builder</button>
                        <button id="apply-layout-btn" class="btn btn-success">Apply to Room</button>
                    </div>
                </div>

                <div class="layout-preview" id="layout-preview">
                    <div class="preview-placeholder">No layout loaded</div>
                </div>

                <div class="presets-panel" id="presets-panel" style="display: none;">
                    <h4>Layout Presets</h4>
                    <div class="presets-grid" id="presets-grid"></div>
                </div>

                <div class="builder-modal" id="builder-modal" style="display: none;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>Layout Builder</h3>
                            <button class="modal-close" id="close-builder-btn">&times;</button>
                        </div>
                        <div class="modal-body" id="builder-container"></div>
                    </div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        document.getElementById('load-presets-btn')?.addEventListener('click', () => this.showPresets());
        document.getElementById('open-builder-btn')?.addEventListener('click', () => this.openBuilder());
        document.getElementById('apply-layout-btn')?.addEventListener('click', () => this.applyCurrentLayout());
        document.getElementById('close-builder-btn')?.addEventListener('click', () => this.closeBuilder());
    }

    async loadCurrentLayout() {
        try {
            const layout = await this.customizer.loadRoomLayout();
            this.displayLayoutPreview(layout);
        } catch (error) {
            console.error('Failed to load current layout:', error);
        }
    }

    async showPresets() {
        try {
            const presets = await this.customizer.loadPresets();
            const presetsPanel = document.getElementById('presets-panel');
            const presetsGrid = document.getElementById('presets-grid');

            presetsGrid.innerHTML = '';

            Object.entries(presets).forEach(([presetName, preset]) => {
                const presetCard = document.createElement('div');
                presetCard.className = 'preset-card';
                presetCard.innerHTML = `
                    <h5>${preset.name}</h5>
                    <p>${preset.description}</p>
                    <button class="btn btn-small apply-preset-btn" data-preset="${presetName}">Apply</button>
                `;
                presetsGrid.appendChild(presetCard);
            });

            presetsPanel.style.display = 'block';

            // Setup preset apply handlers
            presetsGrid.addEventListener('click', (e) => {
                if (e.target.classList.contains('apply-preset-btn')) {
                    this.applyPreset(e.target.dataset.preset);
                }
            });
        } catch (error) {
            console.error('Failed to show presets:', error);
        }
    }

    async applyPreset(presetName) {
        try {
            await this.customizer.applyPreset(presetName);
            await this.loadCurrentLayout();
            document.getElementById('presets-panel').style.display = 'none';
        } catch (error) {
            console.error('Failed to apply preset:', error);
            alert('Failed to apply preset: ' + error.message);
        }
    }

    openBuilder() {
        const modal = document.getElementById('builder-modal');
        const builderContainer = document.getElementById('builder-container');

        modal.style.display = 'block';

        if (!this.builder) {
            this.builder = new LayoutBuilder(builderContainer);

            // Load current layout into builder
            if (this.customizer.currentLayout) {
                this.builder.loadLayout(this.customizer.currentLayout);
            }
        }
    }

    closeBuilder() {
        document.getElementById('builder-modal').style.display = 'none';
    }

    async applyCurrentLayout() {
        if (!this.builder) {
            alert('No layout to apply. Please use the builder first.');
            return;
        }

        try {
            const layout = this.builder.getLayout();
            await this.customizer.saveRoomLayout(layout);
            this.displayLayoutPreview(layout);
            this.closeBuilder();

            // Notify other systems
            window.dispatchEvent(new CustomEvent('layoutApplied', {
                detail: { roomId: this.roomId, layout }
            }));
        } catch (error) {
            console.error('Failed to apply layout:', error);
            alert('Failed to apply layout: ' + error.message);
        }
    }

    displayLayoutPreview(layout) {
        const preview = document.getElementById('layout-preview');
        if (!layout || !layout.layouts || !layout.layouts.default) {
            preview.innerHTML = '<div class="preview-placeholder">No layout configured</div>';
            return;
        }

        const grid = layout.layouts.default.grid;
        const components = layout.layouts.default.components || [];

        preview.innerHTML = `
            <div class="preview-grid" style="
                display: grid;
                grid-template-columns: ${grid.template || '1fr'};
                gap: ${grid.gap || '10px'};
                min-height: 200px;
                border: 1px dashed #ccc;
                padding: 10px;
            ">
                ${components.map(component => `
                    <div class="preview-component ${component.type}" style="
                        grid-column: ${component.position?.gridColumn || 'auto'};
                        grid-row: ${component.position?.gridRow || 'auto'};
                        background: #f0f0f0;
                        padding: 8px;
                        border-radius: 4px;
                        text-align: center;
                    ">
                        ${component.type}: ${component.config?.content || component.config?.src || 'Component'}
                    </div>
                `).join('')}
            </div>
        `;
    }
}

// Export classes
window.LayoutValidator = LayoutValidator;
window.LayoutBuilder = LayoutBuilder;
window.LayoutCustomizer = LayoutCustomizer;
window.AdminLayoutControls = AdminLayoutControls;

console.log('Layout Management system loaded');