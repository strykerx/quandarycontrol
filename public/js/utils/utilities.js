/**
 * Consolidated Utilities System
 * Consolidated from: ui-state.js, variable-manager.js, notification-manager.js
 *
 * Provides state management, variable handling, and notifications
 */

// Core State Store with Reactivity
class StateStore {
    constructor(initialState = {}) {
        this.state = { ...initialState };
        this.listeners = new Map();
        this.middlewares = [];
        this.history = [];
        this.maxHistorySize = 50;
    }

    getState() {
        return JSON.parse(JSON.stringify(this.state));
    }

    setState(updates) {
        const previousState = { ...this.state };
        const newState = { ...this.state, ...updates };

        // Apply middleware
        let processedUpdates = updates;
        this.middlewares.forEach(middleware => {
            processedUpdates = middleware(processedUpdates, previousState, newState);
        });

        // Update state
        Object.assign(this.state, processedUpdates);

        // Add to history
        this.history.push({
            timestamp: Date.now(),
            previousState,
            updates: processedUpdates,
            newState: { ...this.state }
        });

        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }

        // Notify listeners
        this.notifyListeners(processedUpdates, previousState);
    }

    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key).push(callback);

        // Return unsubscribe function
        return () => {
            const callbacks = this.listeners.get(key);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        };
    }

    notifyListeners(updates, previousState) {
        Object.keys(updates).forEach(key => {
            if (this.listeners.has(key)) {
                this.listeners.get(key).forEach(callback => {
                    callback(updates[key], previousState[key], this.state);
                });
            }
        });

        // Notify global listeners
        if (this.listeners.has('*')) {
            this.listeners.get('*').forEach(callback => {
                callback(updates, previousState, this.state);
            });
        }
    }

    addMiddleware(middleware) {
        this.middlewares.push(middleware);
    }

    getHistory() {
        return [...this.history];
    }

    canUndo() {
        return this.history.length > 0;
    }

    undo() {
        if (this.canUndo()) {
            const lastChange = this.history.pop();
            this.state = { ...lastChange.previousState };
            this.notifyListeners(lastChange.previousState, lastChange.newState);
            return true;
        }
        return false;
    }
}

// UI State Manager
class UIStateManager extends StateStore {
    constructor() {
        super({
            currentView: 'dashboard',
            isLoading: false,
            modals: {},
            notifications: [],
            selectedItems: [],
            filters: {},
            sortConfig: { key: null, direction: 'asc' },
            user: null,
            permissions: [],
            theme: 'default'
        });

        this.addMiddleware(this.validationMiddleware.bind(this));
        this.addMiddleware(this.persistenceMiddleware.bind(this));
    }

    validationMiddleware(updates, previousState, newState) {
        // Validate currentView
        if (updates.currentView && !this.isValidView(updates.currentView)) {
            console.warn(`Invalid view: ${updates.currentView}`);
            delete updates.currentView;
        }

        // Validate theme
        if (updates.theme && !this.isValidTheme(updates.theme)) {
            console.warn(`Invalid theme: ${updates.theme}`);
            delete updates.theme;
        }

        return updates;
    }

    persistenceMiddleware(updates, previousState, newState) {
        // Persist certain state to localStorage
        const persistentKeys = ['theme', 'filters', 'sortConfig'];
        const persistentUpdates = {};

        persistentKeys.forEach(key => {
            if (key in updates) {
                persistentUpdates[key] = updates[key];
            }
        });

        if (Object.keys(persistentUpdates).length > 0) {
            try {
                const stored = JSON.parse(localStorage.getItem('ui_state') || '{}');
                const newStored = { ...stored, ...persistentUpdates };
                localStorage.setItem('ui_state', JSON.stringify(newStored));
            } catch (error) {
                console.warn('Failed to persist UI state:', error);
            }
        }

        return updates;
    }

    loadPersistedState() {
        try {
            const stored = JSON.parse(localStorage.getItem('ui_state') || '{}');
            this.setState(stored);
        } catch (error) {
            console.warn('Failed to load persisted UI state:', error);
        }
    }

    isValidView(view) {
        const validViews = ['dashboard', 'rooms', 'themes', 'settings', 'help'];
        return validViews.includes(view);
    }

    isValidTheme(theme) {
        // This would ideally check against available themes
        return typeof theme === 'string' && theme.length > 0;
    }

    // Convenience methods
    setCurrentView(view) {
        this.setState({ currentView: view });
    }

    setLoading(isLoading) {
        this.setState({ isLoading });
    }

    openModal(modalId, data = {}) {
        const modals = { ...this.state.modals };
        modals[modalId] = { open: true, data };
        this.setState({ modals });
    }

    closeModal(modalId) {
        const modals = { ...this.state.modals };
        if (modals[modalId]) {
            modals[modalId].open = false;
        }
        this.setState({ modals });
    }

    addNotification(notification) {
        const notifications = [...this.state.notifications, {
            id: Date.now() + Math.random(),
            timestamp: Date.now(),
            ...notification
        }];
        this.setState({ notifications });
    }

    removeNotification(notificationId) {
        const notifications = this.state.notifications.filter(n => n.id !== notificationId);
        this.setState({ notifications });
    }

    setSelectedItems(items) {
        this.setState({ selectedItems: items });
    }

    updateFilters(filters) {
        this.setState({ filters: { ...this.state.filters, ...filters } });
    }

    setSortConfig(key, direction = 'asc') {
        this.setState({ sortConfig: { key, direction } });
    }
}

// Variable Manager - Room variable handling
class VariableManager {
    constructor(roomId) {
        this.roomId = roomId;
        this.variables = new Map();
        this.listeners = new Map();
        this.socket = null;
        this.apiEndpoint = '/api/v1/rooms';
    }

    async initialize() {
        try {
            await this.loadVariables();
            this.setupSocketConnection();
            console.log('Variable Manager initialized for room:', this.roomId);
        } catch (error) {
            console.error('Failed to initialize Variable Manager:', error);
            throw error;
        }
    }

    async loadVariables() {
        try {
            const response = await fetch(`${this.apiEndpoint}/${this.roomId}/variables`);
            const result = await response.json();

            if (result.success && result.data) {
                Object.entries(result.data).forEach(([name, value]) => {
                    this.variables.set(name, {
                        name,
                        value,
                        type: this.inferType(value),
                        lastUpdated: Date.now(),
                        system: name.startsWith('timer_') || name.startsWith('system_')
                    });
                });
            }
        } catch (error) {
            console.error('Failed to load variables:', error);
            throw error;
        }
    }

    setupSocketConnection() {
        if (typeof io !== 'undefined' && window.ROOM_ID) {
            this.socket = io();
            this.socket.emit('join_room', { roomId: this.roomId, clientType: 'admin' });

            this.socket.on('variableUpdate', (data) => {
                this.handleVariableUpdate(data);
            });

            this.socket.on('connect', () => {
                console.log('Variable Manager socket connected');
            });

            this.socket.on('disconnect', () => {
                console.log('Variable Manager socket disconnected');
            });
        }
    }

    handleVariableUpdate(data) {
        if (data.roomId === this.roomId) {
            const variable = this.variables.get(data.name) || {};
            this.variables.set(data.name, {
                ...variable,
                name: data.name,
                value: data.value,
                type: this.inferType(data.value),
                lastUpdated: Date.now(),
                system: data.name.startsWith('timer_') || data.name.startsWith('system_')
            });

            this.notifyListeners(data.name, data.value, variable.value);
        }
    }

    async updateVariable(name, value, triggerActions = true) {
        try {
            const endpoint = triggerActions ?
                `${this.apiEndpoint}/${this.roomId}/variables/${name}` :
                `${this.apiEndpoint}/${this.roomId}/variables`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, value })
            });

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Failed to update variable');
            }

            // Update local state
            const variable = this.variables.get(name) || {};
            this.variables.set(name, {
                ...variable,
                name,
                value,
                type: this.inferType(value),
                lastUpdated: Date.now()
            });

            return result;
        } catch (error) {
            console.error(`Failed to update variable '${name}':`, error);
            throw error;
        }
    }

    getVariable(name) {
        return this.variables.get(name);
    }

    getAllVariables() {
        return Object.fromEntries(this.variables);
    }

    getSystemVariables() {
        const systemVars = {};
        this.variables.forEach((variable, name) => {
            if (variable.system) {
                systemVars[name] = variable;
            }
        });
        return systemVars;
    }

    getUserVariables() {
        const userVars = {};
        this.variables.forEach((variable, name) => {
            if (!variable.system) {
                userVars[name] = variable;
            }
        });
        return userVars;
    }

    subscribe(variableName, callback) {
        if (!this.listeners.has(variableName)) {
            this.listeners.set(variableName, []);
        }
        this.listeners.get(variableName).push(callback);

        return () => {
            const callbacks = this.listeners.get(variableName);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        };
    }

    notifyListeners(variableName, newValue, oldValue) {
        if (this.listeners.has(variableName)) {
            this.listeners.get(variableName).forEach(callback => {
                callback(newValue, oldValue, variableName);
            });
        }

        // Notify global listeners
        if (this.listeners.has('*')) {
            this.listeners.get('*').forEach(callback => {
                callback(variableName, newValue, oldValue);
            });
        }
    }

    inferType(value) {
        if (typeof value === 'boolean') return 'boolean';
        if (typeof value === 'number') return 'number';
        if (value === null || value === undefined) return 'null';
        return 'string';
    }

    destroy() {
        if (this.socket) {
            this.socket.disconnect();
        }
        this.variables.clear();
        this.listeners.clear();
    }
}

// Notification Manager - Toast and alert notifications
class NotificationManager {
    constructor(container = document.body) {
        this.container = container;
        this.notifications = new Map();
        this.defaultOptions = {
            type: 'info', // info, success, warning, error
            duration: 5000,
            dismissible: true,
            showIcon: true,
            showTimestamp: false,
            position: 'top-right', // top-left, top-center, top-right, bottom-left, bottom-center, bottom-right
            animation: 'slide' // slide, fade, bounce
        };
        this.initialized = false;
    }

    initialize() {
        if (this.initialized) return;

        this.createNotificationContainer();
        this.setupStyles();
        this.initialized = true;
    }

    createNotificationContainer() {
        this.notificationContainer = document.createElement('div');
        this.notificationContainer.className = 'notification-container';
        this.notificationContainer.setAttribute('data-position', this.defaultOptions.position);
        this.container.appendChild(this.notificationContainer);
    }

    setupStyles() {
        if (document.getElementById('notification-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification-container {
                position: fixed;
                z-index: 10000;
                pointer-events: none;
                max-width: 400px;
                margin: 20px;
            }

            .notification-container[data-position^="top"] {
                top: 0;
            }

            .notification-container[data-position^="bottom"] {
                bottom: 0;
            }

            .notification-container[data-position$="-left"] {
                left: 0;
            }

            .notification-container[data-position$="-center"] {
                left: 50%;
                transform: translateX(-50%);
            }

            .notification-container[data-position$="-right"] {
                right: 0;
            }

            .notification {
                background: white;
                border-radius: 6px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                margin-bottom: 10px;
                padding: 16px;
                pointer-events: auto;
                opacity: 0;
                transform: translateX(100%);
                transition: all 0.3s ease;
                border-left: 4px solid #2196F3;
                max-width: 100%;
                word-wrap: break-word;
            }

            .notification.show {
                opacity: 1;
                transform: translateX(0);
            }

            .notification.hide {
                opacity: 0;
                transform: translateX(100%);
                margin-bottom: 0;
                padding: 0;
                max-height: 0;
            }

            .notification.info { border-left-color: #2196F3; }
            .notification.success { border-left-color: #4CAF50; }
            .notification.warning { border-left-color: #FF9800; }
            .notification.error { border-left-color: #F44336; }

            .notification-header {
                display: flex;
                align-items: center;
                margin-bottom: 8px;
            }

            .notification-icon {
                width: 20px;
                height: 20px;
                margin-right: 8px;
                flex-shrink: 0;
            }

            .notification-title {
                font-weight: 600;
                font-size: 14px;
                flex: 1;
            }

            .notification-close {
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                color: #666;
                padding: 0;
                margin-left: 8px;
            }

            .notification-close:hover {
                color: #000;
            }

            .notification-content {
                font-size: 13px;
                color: #666;
                line-height: 1.4;
            }

            .notification-timestamp {
                font-size: 11px;
                color: #999;
                margin-top: 8px;
            }

            .notification-actions {
                margin-top: 12px;
                display: flex;
                gap: 8px;
            }

            .notification-action {
                background: none;
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 12px;
                cursor: pointer;
            }

            .notification-action:hover {
                background: #f5f5f5;
            }
        `;
        document.head.appendChild(styles);
    }

    show(message, options = {}) {
        if (!this.initialized) {
            this.initialize();
        }

        const config = { ...this.defaultOptions, ...options };
        const id = this.generateId();

        const notification = this.createNotificationElement(id, message, config);
        this.notificationContainer.appendChild(notification);

        // Store notification reference
        this.notifications.set(id, {
            element: notification,
            config,
            message,
            createdAt: Date.now()
        });

        // Trigger show animation
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });

        // Auto dismiss if duration is set
        if (config.duration > 0) {
            setTimeout(() => {
                this.dismiss(id);
            }, config.duration);
        }

        return id;
    }

    createNotificationElement(id, message, config) {
        const notification = document.createElement('div');
        notification.className = `notification ${config.type}`;
        notification.setAttribute('data-id', id);

        const header = document.createElement('div');
        header.className = 'notification-header';

        if (config.showIcon) {
            const icon = document.createElement('div');
            icon.className = 'notification-icon';
            icon.innerHTML = this.getIcon(config.type);
            header.appendChild(icon);
        }

        if (config.title) {
            const title = document.createElement('div');
            title.className = 'notification-title';
            title.textContent = config.title;
            header.appendChild(title);
        }

        if (config.dismissible) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'notification-close';
            closeBtn.innerHTML = '×';
            closeBtn.addEventListener('click', () => this.dismiss(id));
            header.appendChild(closeBtn);
        }

        notification.appendChild(header);

        if (message) {
            const content = document.createElement('div');
            content.className = 'notification-content';
            content.textContent = message;
            notification.appendChild(content);
        }

        if (config.showTimestamp) {
            const timestamp = document.createElement('div');
            timestamp.className = 'notification-timestamp';
            timestamp.textContent = new Date().toLocaleTimeString();
            notification.appendChild(timestamp);
        }

        if (config.actions && config.actions.length > 0) {
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'notification-actions';

            config.actions.forEach(action => {
                const button = document.createElement('button');
                button.className = 'notification-action';
                button.textContent = action.label;
                button.addEventListener('click', () => {
                    action.callback(id);
                    if (action.dismissOnClick !== false) {
                        this.dismiss(id);
                    }
                });
                actionsContainer.appendChild(button);
            });

            notification.appendChild(actionsContainer);
        }

        return notification;
    }

    dismiss(id) {
        const notification = this.notifications.get(id);
        if (!notification) return;

        notification.element.classList.remove('show');
        notification.element.classList.add('hide');

        setTimeout(() => {
            if (notification.element.parentNode) {
                notification.element.parentNode.removeChild(notification.element);
            }
            this.notifications.delete(id);
        }, 300);
    }

    dismissAll() {
        this.notifications.forEach((_, id) => this.dismiss(id));
    }

    // Convenience methods
    info(message, options = {}) {
        return this.show(message, { ...options, type: 'info' });
    }

    success(message, options = {}) {
        return this.show(message, { ...options, type: 'success' });
    }

    warning(message, options = {}) {
        return this.show(message, { ...options, type: 'warning' });
    }

    error(message, options = {}) {
        return this.show(message, { ...options, type: 'error', duration: 0 });
    }

    getIcon(type) {
        const icons = {
            info: '&#x2139;&#xFE0F;',
            success: '&#x2714;&#xFE0F;',
            warning: '&#x26A0;&#xFE0F;',
            error: '&#x274C;'
        };
        return icons[type] || icons.info;
    }

    generateId() {
        return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getActiveNotifications() {
        return Array.from(this.notifications.entries()).map(([id, data]) => ({
            id,
            ...data
        }));
    }

    updatePosition(position) {
        if (this.notificationContainer) {
            this.notificationContainer.setAttribute('data-position', position);
        }
        this.defaultOptions.position = position;
    }
}

// Initialize and export utilities
window.StateStore = StateStore;
window.UIStateManager = UIStateManager;
window.VariableManager = VariableManager;
window.NotificationManager = NotificationManager;

// Global instances
if (!window.uiState) {
    window.uiState = new UIStateManager();
    window.uiState.loadPersistedState();
}

if (!window.notificationManager) {
    window.notificationManager = new NotificationManager();
}

// Auto-initialize variable manager for rooms
if (window.ROOM_ID && !window.variableManager) {
    window.variableManager = new VariableManager(window.ROOM_ID);
    window.variableManager.initialize().catch(console.error);
}

console.log('Utilities system loaded successfully');