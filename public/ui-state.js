/**
 * Quandary Admin UI State Management Foundation
 * Provides centralized state management, validation, and component communication
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
        this.state = { ...this.state, ...processedUpdates };

        // Add to history for undo functionality
        this.history.push({
            action: 'update',
            previousState,
            newState: { ...this.state },
            timestamp: Date.now()
        });

        // Trim history if needed
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }

        // Notify listeners
        this.listeners.forEach((callback, key) => {
            if (typeof callback === 'function') {
                callback(this.state, previousState);
            }
        });
    }

    subscribe(key, callback) {
        this.listeners.set(key, callback);

        // Return unsubscribe function
        return () => this.listeners.delete(key);
    }

    addMiddleware(middleware) {
        this.middlewares.push(middleware);
    }

    undo() {
        if (this.history.length === 0) return false;

        const lastAction = this.history.pop();
        this.state = lastAction.previousState;

        // Notify listeners
        this.listeners.forEach(callback => callback(this.state));
        return true;
    }

    reset(initialState = {}) {
        this.state = { ...initialState };
        this.listeners.forEach(callback => callback(this.state, null));
    }
}

// Validation Framework
class Validator {
    static required(value) {
        return value !== null && value !== undefined && String(value).trim() !== '';
    }

    static minLength(value, min) {
        return String(value).length >= min;
    }

    static maxLength(value, max) {
        return String(value).length <= max;
    }

    static numeric(value) {
        return !isNaN(Number(value)) && isFinite(value);
    }

    // Alias for numeric; ensures admin.js references to Validator.float() work
    static float(value) {
        return Validator.numeric(value);
    }

    static email(value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value);
    }

    static json(value) {
        try {
            JSON.parse(value);
            return true;
        } catch {
            return false;
        }
    }

    static positiveNumber(value) {
        return Validator.numeric(value) && Number(value) > 0;
    }

    // Allow zero or positive numbers (used by admin.js timer validation)
    static nonNegativeNumber(value) {
        return Validator.numeric(value) && Number(value) >= 0;
    }
}

class FieldValidator {
    constructor() {
        this.validations = {};
        this.errors = {};
    }

    addRule(field, rule, message) {
        if (!this.validations[field]) {
            this.validations[field] = [];
        }
        this.validations[field].push({ rule, message });
    }

    validate(data) {
        this.errors = {};
        let isValid = true;

        Object.keys(data).forEach(field => {
            if (this.validations[field]) {
                this.validations[field].forEach(({ rule, message }) => {
                    if (!rule(data[field])) {
                        if (!this.errors[field]) {
                            this.errors[field] = [];
                        }
                        this.errors[field].push(message);
                        isValid = false;
                    }
                });
            }
        });

        return { isValid, errors: this.errors };
    }

    getFieldErrors(field) {
        return this.errors[field] || [];
    }

    hasFieldErrors(field) {
        return this.errors[field] && this.errors[field].length > 0;
    }

    getAllErrors() {
        return this.errors;
    }
}

// Component Communication System
class EventEmitter {
    constructor() {
        this.events = {};
    }

    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);

        // Return unsubscribe function
        return () => this.off(event, callback);
    }

    off(event, callback) {
        if (!this.events[event]) return;
        this.events[event] = this.events[event].filter(cb => cb !== callback);
    }

    emit(event, ...args) {
        if (!this.events[event]) return;
        this.events[event].forEach(callback => {
            try {
                callback(...args);
            } catch (error) {
                console.error(`Error in event listener for '${event}':`, error);
            }
        });
    }

    once(event, callback) {
        const onceCallback = (...args) => {
            callback(...args);
            this.off(event, onceCallback);
        };
        this.on(event, onceCallback);
        return () => this.off(event, onceCallback);
    }

    clear() {
        this.events = {};
    }
}

// User Interface State Manager
class UIManager {
    constructor(stateStore, eventEmitter) {
        this.store = stateStore;
        this.events = eventEmitter;
        this.notifications = [];

        this.initializeState();
        this.attachEventListeners();
    }

    initializeState() {
        this.store.setState({
            ui: {
                modals: [],
                // Use array for persistence safety; methods coerce to Set when needed
                loaders: [],
                notifications: [],
                errors: null,
                successMessage: null
            }
        });
    }

    attachEventListeners() {
        // Handle API errors
        this.events.on('api:error', this.handleApiError.bind(this));
        this.events.on('api:success', this.handleApiSuccess.bind(this));
        this.events.on('ui:notify', this.showNotification.bind(this));
    }

    showModal(modalId, options = {}) {
        this.store.setState({
            ui: {
                ...this.store.state.ui,
                modals: [...this.store.state.ui.modals, { id: modalId, options }]
            }
        });

        this.events.emit('modal:opened', modalId);
    }

    hideModal(modalId) {
        this.store.setState({
            ui: {
                ...this.store.state.ui,
                modals: this.store.state.ui.modals.filter(modal => modal.id !== modalId)
            }
        });

        this.events.emit('modal:closed', modalId);
    }

    isModalOpen(modalId) {
        return this.store.state.ui.modals.some(modal => modal.id === modalId);
    }

    showLoader(key) {
        const raw = this.store.state.ui && this.store.state.ui.loaders;
        const set = raw instanceof Set ? new Set(Array.from(raw)) : Array.isArray(raw) ? new Set(raw) : new Set();
        set.add(key);

        this.store.setState({
            ui: { ...this.store.state.ui, loaders: Array.from(set) }
        });
    }

    hideLoader(key) {
        const raw = this.store.state.ui && this.store.state.ui.loaders;
        const set = raw instanceof Set ? new Set(Array.from(raw)) : Array.isArray(raw) ? new Set(raw) : new Set();
        set.delete(key);

        this.store.setState({
            ui: { ...this.store.state.ui, loaders: Array.from(set) }
        });
    }

    isLoading(key) {
        const raw = this.store.state.ui && this.store.state.ui.loaders;
        const set = raw instanceof Set ? raw : Array.isArray(raw) ? new Set(raw) : new Set();
        if (!key) return set.size > 0;
        return set.has(key);
    }

    handleApiError(error) {
        this.showNotification({
            type: 'error',
            message: error.message || 'An error occurred',
            duration: 5000
        });

        this.store.setState({
            ui: {
                ...this.store.state.ui,
                errors: error
            }
        });
    }

    handleUserError(field, message) {
        this.showNotification({
            type: 'error',
            message: `${field}: ${message}`,
            duration: 3000
        });
    }

    handleApiSuccess(message) {
        this.showNotification({
            type: 'success',
            message,
            duration: 3000
        });

        this.store.setState({
            ui: {
                ...this.store.state.ui,
                successMessage: message,
                errors: null
            }
        });

        // Clear success message after delay
        setTimeout(() => {
            this.store.setState({
                ui: { ...this.store.state.ui, successMessage: null }
            });
        }, 3000);
    }

    showNotification({ type, message, duration = 3000 }) {
        const notification = {
            id: Date.now(),
            type,
            message,
            duration,
            timestamp: Date.now()
        };

        const notifications = [...this.store.state.ui.notifications, notification];

        this.store.setState({
            ui: { ...this.store.state.ui, notifications }
        });

        // Auto-remove notification
        setTimeout(() => {
            this.hideNotification(notification.id);
        }, duration);

        return notification.id;
    }

    hideNotification(id) {
        const notifications = this.store.state.ui.notifications.filter(n => n.id !== id);
        this.store.setState({
            ui: { ...this.store.state.ui, notifications }
        });
    }
}

// Form Manager for complex form handling
class FormManager {
    constructor(validator, uiManager, eventEmitter) {
        this.validator = validator;
        this.ui = uiManager;
        this.events = eventEmitter;
        this.formState = {};
        this.isDirty = false;
    }

    registerField(fieldName, initialValue = '', rules = [], options = {}) {
        this.formState[fieldName] = {
            value: initialValue,
            initialValue: initialValue,
            errors: [],
            isValid: true,
            isDirty: false,
            options
        };

        // Add validation rules
        rules.forEach(rule => {
            this.validator.addRule(fieldName, rule.validator, rule.message);
        });
    }

    updateField(fieldName, value) {
        if (!this.formState[fieldName]) return;

        const wasDirty = this.isDirty;
        const fieldState = this.formState[fieldName];

        fieldState.value = value;
        fieldState.isDirty = value !== fieldState.initialValue;

        // Update overall form dirty state
        this.isDirty = Object.values(this.formState).some(field => field.isDirty);

        if (!wasDirty && this.isDirty) {
            this.events.emit('form:dirty', true);
        }

        this.events.emit('field:updated', { fieldName, value, isDirty: fieldState.isDirty });
    }

    getFieldValue(fieldName) {
        return this.formState[fieldName]?.value || '';
    }

    validateField(fieldName) {
        const fieldState = this.formState[fieldName];
        if (!fieldState) return true;

        const { errors } = this.validator.validate({ [fieldName]: fieldState.value });
        fieldState.errors = errors[fieldName] || [];
        fieldState.isValid = fieldState.errors.length === 0;

        return fieldState.isValid;
    }

    validateForm() {
        const formData = Object.fromEntries(
            Object.entries(this.formState).map(([key, field]) => [key, field.value])
        );

        const result = this.validator.validate(formData);

        // Update field validation states
        Object.keys(this.formState).forEach(fieldName => {
            this.formState[fieldName].errors = result.errors[fieldName] || [];
            this.formState[fieldName].isValid = this.formState[fieldName].errors.length === 0;
        });

        return result.isValid;
    }

    getFormData() {
        return Object.fromEntries(
            Object.entries(this.formState).map(([key, field]) => [key, field.value])
        );
    }

    resetForm() {
        Object.values(this.formState).forEach(field => {
            field.value = field.initialValue;
            field.errors = [];
            field.isValid = true;
            field.isDirty = false;
        });

        this.isDirty = false;
        this.events.emit('form:reset');
    }

    hasErrors() {
        return Object.values(this.formState).some(field => field.errors.length > 0);
    }

    getFieldErrors(fieldName) {
        return this.formState[fieldName]?.errors || [];
    }

    isFieldDirty(fieldName) {
        return this.formState[fieldName]?.isDirty || false;
    }
}

// Persistence Layer for temporary state storage
class StatePersistence {
    constructor(storage = sessionStorage) {
        this.storage = storage;
        this.key = 'quandary_admin_state';
    }

    save(state) {
        try {
            const serialized = JSON.stringify({
                data: state,
                timestamp: Date.now()
            });
            this.storage.setItem(this.key, serialized);
        } catch (error) {
            console.warn('Failed to save state to storage:', error);
        }
    }

    load() {
        try {
            const item = this.storage.getItem(this.key);
            if (!item) return null;

            const parsed = JSON.parse(item);

            // Check if state is too old (24 hours)
            const age = Date.now() - parsed.timestamp;
            if (age > 24 * 60 * 60 * 1000) {
                this.clear();
                return null;
            }

            return parsed.data;
        } catch (error) {
            console.warn('Failed to load state from storage:', error);
            return null;
        }
    }

    clear() {
        this.storage.removeItem(this.key);
    }

    hasStoredState() {
        return this.storage.getItem(this.key) !== null;
    }
}

// Initialize the foundation
const initializeStateFoundation = () => {
    // Create core components
    const stateStore = new StateStore({
        rooms: [],
        currentEditingId: null,
        isLoading: false,
        error: null,
        autoCloseSettings: {
            enabled: true,
            seconds: 5
        }
    });

    const eventEmitter = new EventEmitter();
    const uiManager = new UIManager(stateStore, eventEmitter);
    const fieldValidator = new FieldValidator();
    const formManager = new FormManager(fieldValidator, uiManager, eventEmitter);
    const statePersistence = new StatePersistence();

    // Create API handler middleware
    const apiMiddleware = (updates, prevState, nextState) => {
        if (updates.error || nextState.error) {
            eventEmitter.emit('api:error', updates.error || nextState.error);
        }
        return updates;
    };

    stateStore.addMiddleware(apiMiddleware);

    // Load persisted state if available
    const persistedState = statePersistence.load();
    if (persistedState) {
        stateStore.setState(persistedState);
    }

    // Auto-save state on changes
    stateStore.subscribe('persistence', (newState) => {
        statePersistence.save(newState);
    });

    return {
        store: stateStore,
        events: eventEmitter,
        ui: uiManager,
        validator: fieldValidator,
        forms: formManager,
        persistence: statePersistence
    };
};

// Export for global access
window.QuandaryState = {
    StateStore,
    EventEmitter,
    UIManager,
    FieldValidator,
    FormManager,
    StatePersistence,
    Validator,
    initialize: initializeStateFoundation
};

console.log('🗄️ Quandary UI State Management Foundation loaded');