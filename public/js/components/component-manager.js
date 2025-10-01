/**
 * Consolidated Component Management System
 * Consolidated from: component-integration.js, component-integration-test.js,
 * rules-editor.js, rules-slideshow.js, components/core/component-registry.js
 *
 * Manages component registration, integration, rules, and slideshow functionality
 */

// Component Registry - Core component system
class ComponentRegistry {
    constructor() {
        this.components = new Map();
        this.instances = new Map();
        this.lifecycleHooks = new Map();
        this.eventBus = new EventTarget();
        this.initialized = false;
    }

    initialize() {
        if (this.initialized) return;

        this.registerDefaultComponents();
        this.setupGlobalEventListeners();
        this.initialized = true;

        this.emit('registry:initialized');
        console.log('Component Registry initialized');
    }

    registerComponent(name, definition) {
        if (!name || !definition) {
            throw new Error('Component name and definition are required');
        }

        this.components.set(name, {
            name,
            ...definition,
            registeredAt: Date.now()
        });

        this.emit('component:registered', { name, definition });
    }

    registerDefaultComponents() {
        // Timer component
        this.registerComponent('timer', {
            template: '<div class="timer-display" data-component="timer">00:00</div>',
            props: ['format', 'showSeconds'],
            methods: {
                updateTime: function(seconds) {
                    this.element.textContent = this.formatTime(seconds);
                },
                formatTime: function(seconds) {
                    const minutes = Math.floor(seconds / 60);
                    const secs = seconds % 60;
                    return `${minutes}:${secs.toString().padStart(2, '0')}`;
                }
            },
            lifecycle: {
                created: function() {
                    console.log('Timer component created');
                },
                mounted: function() {
                    this.updateTime(0);
                }
            }
        });

        // Button component
        this.registerComponent('button', {
            template: '<button class="component-button" data-component="button">Button</button>',
            props: ['text', 'variant', 'disabled'],
            methods: {
                setText: function(text) {
                    this.element.textContent = text;
                },
                setDisabled: function(disabled) {
                    this.element.disabled = disabled;
                }
            }
        });

        // Modal component
        this.registerComponent('modal', {
            template: `
                <div class="modal-overlay" style="display: none;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 class="modal-title">Modal</h3>
                            <button class="modal-close">&times;</button>
                        </div>
                        <div class="modal-body"></div>
                    </div>
                </div>
            `,
            props: ['title', 'content'],
            methods: {
                show: function() {
                    this.element.style.display = 'flex';
                    this.emit('modal:shown');
                },
                hide: function() {
                    this.element.style.display = 'none';
                    this.emit('modal:hidden');
                },
                setContent: function(content) {
                    this.element.querySelector('.modal-body').innerHTML = content;
                }
            },
            lifecycle: {
                mounted: function() {
                    this.element.querySelector('.modal-close').addEventListener('click', () => {
                        this.hide();
                    });
                }
            }
        });
    }

    createInstance(componentName, container, props = {}) {
        const definition = this.components.get(componentName);
        if (!definition) {
            throw new Error(`Component '${componentName}' not found`);
        }

        const instanceId = this.generateInstanceId(componentName);
        const instance = new ComponentInstance(instanceId, definition, container, props);

        this.instances.set(instanceId, instance);
        this.emit('instance:created', { instanceId, componentName });

        return instance;
    }

    getInstance(instanceId) {
        return this.instances.get(instanceId);
    }

    getAllInstances(componentName = null) {
        if (componentName) {
            return Array.from(this.instances.values())
                .filter(instance => instance.componentName === componentName);
        }
        return Array.from(this.instances.values());
    }

    destroyInstance(instanceId) {
        const instance = this.instances.get(instanceId);
        if (instance) {
            instance.destroy();
            this.instances.delete(instanceId);
            this.emit('instance:destroyed', { instanceId });
        }
    }

    generateInstanceId(componentName) {
        return `${componentName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    setupGlobalEventListeners() {
        // Auto-detect and initialize components
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        this.scanForComponents(node);
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    scanForComponents(container = document.body) {
        const components = container.querySelectorAll('[data-component]');
        components.forEach((element) => {
            const componentName = element.dataset.component;
            if (this.components.has(componentName) && !element.dataset.instanceId) {
                try {
                    const instance = this.createInstance(componentName, element);
                    element.dataset.instanceId = instance.id;
                } catch (error) {
                    console.error('Failed to auto-initialize component:', error);
                }
            }
        });
    }

    emit(eventName, data = {}) {
        this.eventBus.dispatchEvent(new CustomEvent(eventName, { detail: data }));
    }

    on(eventName, handler) {
        this.eventBus.addEventListener(eventName, handler);
    }

    off(eventName, handler) {
        this.eventBus.removeEventListener(eventName, handler);
    }
}

// Component Instance - Individual component instance
class ComponentInstance {
    constructor(id, definition, container, props = {}) {
        this.id = id;
        this.componentName = definition.name;
        this.definition = definition;
        this.container = container;
        this.props = { ...props };
        this.element = null;
        this.eventBus = new EventTarget();
        this.destroyed = false;

        this.create();
    }

    create() {
        // Create element from template
        if (this.container.tagName) {
            // Container is an existing element
            this.element = this.container;
            if (this.definition.template) {
                this.element.innerHTML = this.definition.template;
            }
        } else {
            // Container is a selector string
            const targetContainer = document.querySelector(this.container);
            if (!targetContainer) {
                throw new Error(`Container '${this.container}' not found`);
            }
            targetContainer.innerHTML = this.definition.template || '';
            this.element = targetContainer.firstElementChild || targetContainer;
        }

        // Set component attributes
        this.element.dataset.instanceId = this.id;
        this.element.dataset.component = this.componentName;

        // Bind methods
        this.bindMethods();

        // Call lifecycle hooks
        this.callLifecycleHook('created');

        // Apply initial props
        this.applyProps();

        // Mount component
        this.callLifecycleHook('mounted');
    }

    bindMethods() {
        if (this.definition.methods) {
            Object.entries(this.definition.methods).forEach(([methodName, method]) => {
                this[methodName] = method.bind(this);
            });
        }
    }

    applyProps() {
        if (this.definition.props && Array.isArray(this.definition.props)) {
            this.definition.props.forEach(propName => {
                if (this.props.hasOwnProperty(propName)) {
                    this.setProp(propName, this.props[propName]);
                }
            });
        }
    }

    setProp(name, value) {
        this.props[name] = value;

        // Apply prop to element
        if (this.element) {
            this.element.dataset[name] = value;

            // Trigger prop change method if exists
            const methodName = `set${name.charAt(0).toUpperCase()}${name.slice(1)}`;
            if (typeof this[methodName] === 'function') {
                this[methodName](value);
            }
        }

        this.emit('prop:changed', { name, value });
    }

    getProp(name) {
        return this.props[name];
    }

    callLifecycleHook(hookName) {
        if (this.definition.lifecycle && this.definition.lifecycle[hookName]) {
            try {
                this.definition.lifecycle[hookName].call(this);
            } catch (error) {
                console.error(`Error in ${hookName} lifecycle hook:`, error);
            }
        }
    }

    emit(eventName, data = {}) {
        this.eventBus.dispatchEvent(new CustomEvent(eventName, {
            detail: { ...data, instanceId: this.id }
        }));
    }

    on(eventName, handler) {
        this.eventBus.addEventListener(eventName, handler);
    }

    off(eventName, handler) {
        this.eventBus.removeEventListener(eventName, handler);
    }

    destroy() {
        if (this.destroyed) return;

        this.callLifecycleHook('beforeDestroy');

        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }

        this.callLifecycleHook('destroyed');

        this.destroyed = true;
        this.emit('instance:destroyed');
    }
}

// Rules Editor - Rule management system
class RulesEditor {
    constructor(container, roomId) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.roomId = roomId;
        this.rules = [];
        this.currentRule = null;
        this.apiEndpoint = '/api/v1/rooms';

        this.init();
    }

    init() {
        this.createInterface();
        this.setupEventListeners();
        this.loadRules();
    }

    createInterface() {
        this.container.innerHTML = `
            <div class="rules-editor">
                <div class="rules-header">
                    <h3>Room Rules Editor</h3>
                    <button id="add-rule-btn" class="btn btn-primary">Add Rule</button>
                </div>

                <div class="rules-list" id="rules-list">
                    <div class="loading">Loading rules...</div>
                </div>

                <div class="rule-editor-modal" id="rule-editor-modal" style="display: none;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 id="rule-modal-title">Add Rule</h3>
                            <button class="modal-close" id="close-rule-editor">&times;</button>
                        </div>
                        <div class="modal-body">
                            <form id="rule-form">
                                <div class="form-group">
                                    <label for="rule-title">Title:</label>
                                    <input type="text" id="rule-title" required>
                                </div>

                                <div class="form-group">
                                    <label for="rule-content">Content:</label>
                                    <textarea id="rule-content" rows="5" required></textarea>
                                </div>

                                <div class="form-group">
                                    <label for="rule-order">Order:</label>
                                    <input type="number" id="rule-order" min="0" value="0">
                                </div>

                                <div class="form-group">
                                    <label for="rule-media">Media File:</label>
                                    <input type="file" id="rule-media" accept="image/*,video/*">
                                </div>

                                <div class="form-actions">
                                    <button type="submit" class="btn btn-primary">Save Rule</button>
                                    <button type="button" class="btn btn-secondary" id="cancel-rule-edit">Cancel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        document.getElementById('add-rule-btn')?.addEventListener('click', () => this.showRuleEditor());
        document.getElementById('close-rule-editor')?.addEventListener('click', () => this.hideRuleEditor());
        document.getElementById('cancel-rule-edit')?.addEventListener('click', () => this.hideRuleEditor());
        document.getElementById('rule-form')?.addEventListener('submit', (e) => this.handleRuleSubmit(e));
    }

    async loadRules() {
        try {
            const response = await fetch(`${this.apiEndpoint}/${this.roomId}/rules`);
            const result = await response.json();

            if (result.success) {
                this.rules = result.data || [];
                this.renderRulesList();
            } else {
                throw new Error(result.error || 'Failed to load rules');
            }
        } catch (error) {
            console.error('Failed to load rules:', error);
            this.showError('Failed to load rules');
        }
    }

    renderRulesList() {
        const rulesList = document.getElementById('rules-list');

        if (this.rules.length === 0) {
            rulesList.innerHTML = '<div class="empty-state">No rules configured</div>';
            return;
        }

        rulesList.innerHTML = this.rules.map((rule, index) => `
            <div class="rule-item" data-rule-id="${rule.id}">
                <div class="rule-header">
                    <h4>${rule.title}</h4>
                    <div class="rule-actions">
                        <button class="btn btn-sm edit-rule-btn" data-rule-id="${rule.id}">Edit</button>
                        <button class="btn btn-sm btn-danger delete-rule-btn" data-rule-id="${rule.id}">Delete</button>
                    </div>
                </div>
                <div class="rule-content">${rule.content}</div>
                <div class="rule-meta">
                    Order: ${rule.order} ${rule.media_id ? '• Has media' : ''}
                </div>
            </div>
        `).join('');

        // Setup rule item event listeners
        rulesList.addEventListener('click', (e) => {
            if (e.target.classList.contains('edit-rule-btn')) {
                const ruleId = e.target.dataset.ruleId;
                this.editRule(ruleId);
            } else if (e.target.classList.contains('delete-rule-btn')) {
                const ruleId = e.target.dataset.ruleId;
                this.deleteRule(ruleId);
            }
        });
    }

    showRuleEditor(rule = null) {
        this.currentRule = rule;
        const modal = document.getElementById('rule-editor-modal');
        const modalTitle = document.getElementById('rule-modal-title');
        const form = document.getElementById('rule-form');

        modalTitle.textContent = rule ? 'Edit Rule' : 'Add Rule';

        if (rule) {
            document.getElementById('rule-title').value = rule.title;
            document.getElementById('rule-content').value = rule.content;
            document.getElementById('rule-order').value = rule.order;
        } else {
            form.reset();
            document.getElementById('rule-order').value = this.rules.length;
        }

        modal.style.display = 'block';
    }

    hideRuleEditor() {
        document.getElementById('rule-editor-modal').style.display = 'none';
        this.currentRule = null;
    }

    async handleRuleSubmit(e) {
        e.preventDefault();

        const formData = new FormData();
        formData.append('title', document.getElementById('rule-title').value);
        formData.append('content', document.getElementById('rule-content').value);
        formData.append('order', document.getElementById('rule-order').value);

        const mediaFile = document.getElementById('rule-media').files[0];
        if (mediaFile) {
            formData.append('media', mediaFile);
        }

        try {
            let url = `${this.apiEndpoint}/${this.roomId}/rules`;
            let method = 'POST';

            if (this.currentRule) {
                url += `/${this.currentRule.id}`;
                method = 'PUT';
            }

            const response = await fetch(url, {
                method: method,
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                await this.loadRules();
                this.hideRuleEditor();
                this.showSuccess(this.currentRule ? 'Rule updated successfully' : 'Rule created successfully');
            } else {
                throw new Error(result.error || 'Failed to save rule');
            }
        } catch (error) {
            console.error('Failed to save rule:', error);
            this.showError('Failed to save rule: ' + error.message);
        }
    }

    editRule(ruleId) {
        const rule = this.rules.find(r => r.id === ruleId);
        if (rule) {
            this.showRuleEditor(rule);
        }
    }

    async deleteRule(ruleId) {
        if (!confirm('Are you sure you want to delete this rule?')) {
            return;
        }

        try {
            const response = await fetch(`${this.apiEndpoint}/${this.roomId}/rules/${ruleId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                await this.loadRules();
                this.showSuccess('Rule deleted successfully');
            } else {
                throw new Error(result.error || 'Failed to delete rule');
            }
        } catch (error) {
            console.error('Failed to delete rule:', error);
            this.showError('Failed to delete rule: ' + error.message);
        }
    }

    showError(message) {
        if (window.notificationManager) {
            window.notificationManager.error(message);
        } else {
            alert('Error: ' + message);
        }
    }

    showSuccess(message) {
        if (window.notificationManager) {
            window.notificationManager.success(message);
        } else {
            console.log('Success: ' + message);
        }
    }
}

// Rules Slideshow - Display rules in slideshow format
class RulesSlideshow {
    constructor(container, roomId) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.roomId = roomId;
        this.rules = [];
        this.currentSlide = 0;
        this.autoPlay = false;
        this.autoPlayInterval = null;
        this.autoPlayDelay = 5000; // 5 seconds

        this.init();
    }

    init() {
        this.createInterface();
        this.setupEventListeners();
        this.loadRules();
    }

    createInterface() {
        this.container.innerHTML = `
            <div class="rules-slideshow">
                <div class="slideshow-controls">
                    <button id="prev-slide" class="control-btn">❮</button>
                    <button id="play-pause" class="control-btn">▶</button>
                    <button id="next-slide" class="control-btn">❯</button>
                    <span class="slide-counter">
                        <span id="current-slide">0</span> / <span id="total-slides">0</span>
                    </span>
                </div>

                <div class="slideshow-container">
                    <div class="slides-wrapper" id="slides-wrapper">
                        <div class="slide loading-slide">
                            <div class="loading">Loading rules...</div>
                        </div>
                    </div>
                </div>

                <div class="slide-indicators" id="slide-indicators"></div>
            </div>
        `;
    }

    setupEventListeners() {
        document.getElementById('prev-slide')?.addEventListener('click', () => this.previousSlide());
        document.getElementById('next-slide')?.addEventListener('click', () => this.nextSlide());
        document.getElementById('play-pause')?.addEventListener('click', () => this.toggleAutoPlay());

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (this.container.classList.contains('active')) {
                switch (e.key) {
                    case 'ArrowLeft':
                        this.previousSlide();
                        break;
                    case 'ArrowRight':
                    case ' ':
                        this.nextSlide();
                        break;
                    case 'Escape':
                        this.stop();
                        break;
                }
            }
        });
    }

    async loadRules() {
        try {
            const response = await fetch(`/api/v1/rooms/${this.roomId}/rules`);
            const result = await response.json();

            if (result.success) {
                this.rules = (result.data || []).sort((a, b) => a.order - b.order);
                this.renderSlides();
            } else {
                throw new Error(result.error || 'Failed to load rules');
            }
        } catch (error) {
            console.error('Failed to load rules:', error);
            this.showError('Failed to load rules');
        }
    }

    renderSlides() {
        const slidesWrapper = document.getElementById('slides-wrapper');
        const slideIndicators = document.getElementById('slide-indicators');

        if (this.rules.length === 0) {
            slidesWrapper.innerHTML = '<div class="slide empty-slide">No rules configured</div>';
            slideIndicators.innerHTML = '';
            this.updateSlideCounter();
            return;
        }

        // Render slides
        slidesWrapper.innerHTML = this.rules.map((rule, index) => `
            <div class="slide" data-slide="${index}">
                <div class="slide-content">
                    <h2 class="slide-title">${rule.title}</h2>
                    <div class="slide-body">
                        ${rule.media_id && rule.media_path ? this.renderMedia(rule.media_path) : ''}
                        <div class="slide-text">${rule.content}</div>
                    </div>
                </div>
            </div>
        `).join('');

        // Render indicators
        slideIndicators.innerHTML = this.rules.map((_, index) =>
            `<button class="indicator ${index === 0 ? 'active' : ''}" data-slide="${index}"></button>`
        ).join('');

        // Setup indicator click handlers
        slideIndicators.addEventListener('click', (e) => {
            if (e.target.classList.contains('indicator')) {
                this.goToSlide(parseInt(e.target.dataset.slide));
            }
        });

        this.currentSlide = 0;
        this.updateSlideCounter();
        this.showSlide(0);
    }

    renderMedia(mediaPath) {
        const fullPath = mediaPath.startsWith('/') ? mediaPath : `/uploads/${mediaPath}`;

        if (this.isImageFile(mediaPath)) {
            return `<img src="${fullPath}" alt="Rule media" class="slide-media">`;
        } else if (this.isVideoFile(mediaPath)) {
            return `
                <video src="${fullPath}" class="slide-media" controls>
                    Your browser does not support the video tag.
                </video>
            `;
        }

        return '';
    }

    isImageFile(filename) {
        return /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(filename);
    }

    isVideoFile(filename) {
        return /\.(mp4|webm|ogg|mov|avi)$/i.test(filename);
    }

    showSlide(index) {
        const slides = this.container.querySelectorAll('.slide');
        const indicators = this.container.querySelectorAll('.indicator');

        // Hide all slides
        slides.forEach(slide => slide.classList.remove('active'));
        indicators.forEach(indicator => indicator.classList.remove('active'));

        // Show current slide
        if (slides[index]) {
            slides[index].classList.add('active');
        }
        if (indicators[index]) {
            indicators[index].classList.add('active');
        }

        this.currentSlide = index;
        this.updateSlideCounter();
    }

    nextSlide() {
        const nextIndex = (this.currentSlide + 1) % Math.max(1, this.rules.length);
        this.showSlide(nextIndex);
    }

    previousSlide() {
        const prevIndex = this.currentSlide === 0 ?
            Math.max(0, this.rules.length - 1) :
            this.currentSlide - 1;
        this.showSlide(prevIndex);
    }

    goToSlide(index) {
        if (index >= 0 && index < this.rules.length) {
            this.showSlide(index);
        }
    }

    toggleAutoPlay() {
        this.autoPlay = !this.autoPlay;
        const playPauseBtn = document.getElementById('play-pause');

        if (this.autoPlay) {
            this.startAutoPlay();
            if (playPauseBtn) playPauseBtn.textContent = '⏸';
        } else {
            this.stopAutoPlay();
            if (playPauseBtn) playPauseBtn.textContent = '▶';
        }
    }

    startAutoPlay() {
        this.stopAutoPlay(); // Clear any existing interval
        this.autoPlayInterval = setInterval(() => {
            this.nextSlide();
        }, this.autoPlayDelay);
    }

    stopAutoPlay() {
        if (this.autoPlayInterval) {
            clearInterval(this.autoPlayInterval);
            this.autoPlayInterval = null;
        }
    }

    updateSlideCounter() {
        const currentSlideEl = document.getElementById('current-slide');
        const totalSlidesEl = document.getElementById('total-slides');

        if (currentSlideEl) currentSlideEl.textContent = this.currentSlide + 1;
        if (totalSlidesEl) totalSlidesEl.textContent = this.rules.length;
    }

    start() {
        this.container.classList.add('active');
        if (this.rules.length > 0) {
            this.showSlide(0);
        }
    }

    stop() {
        this.container.classList.remove('active');
        this.stopAutoPlay();
        this.autoPlay = false;
        const playPauseBtn = document.getElementById('play-pause');
        if (playPauseBtn) playPauseBtn.textContent = '▶';
    }

    showError(message) {
        console.error('Rules Slideshow:', message);
        const slidesWrapper = document.getElementById('slides-wrapper');
        if (slidesWrapper) {
            slidesWrapper.innerHTML = `<div class="slide error-slide">Error: ${message}</div>`;
        }
    }
}

// Component Integration - Testing and integration utilities
class ComponentIntegration {
    constructor() {
        this.registry = new ComponentRegistry();
        this.testSuite = new ComponentTestSuite();
    }

    initialize() {
        this.registry.initialize();

        // Auto-scan for components when page loads
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.registry.scanForComponents();
            });
        } else {
            this.registry.scanForComponents();
        }
    }

    runTests() {
        return this.testSuite.runAll();
    }
}

// Component Test Suite
class ComponentTestSuite {
    constructor() {
        this.tests = [];
        this.results = [];
    }

    addTest(name, testFn) {
        this.tests.push({ name, testFn });
    }

    async runAll() {
        this.results = [];

        for (const test of this.tests) {
            try {
                const startTime = performance.now();
                await test.testFn();
                const duration = performance.now() - startTime;

                this.results.push({
                    name: test.name,
                    status: 'passed',
                    duration: Math.round(duration)
                });
            } catch (error) {
                this.results.push({
                    name: test.name,
                    status: 'failed',
                    error: error.message,
                    duration: 0
                });
            }
        }

        return this.results;
    }
}

// Export classes
window.ComponentRegistry = ComponentRegistry;
window.ComponentInstance = ComponentInstance;
window.RulesEditor = RulesEditor;
window.RulesSlideshow = RulesSlideshow;
window.ComponentIntegration = ComponentIntegration;

// Global integration instance
if (!window.componentIntegration) {
    window.componentIntegration = new ComponentIntegration();
    window.componentIntegration.initialize();
}

console.log('Component Management system loaded');