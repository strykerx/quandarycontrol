// Admin room management logic with UI State Foundation
document.addEventListener('DOMContentLoaded', () => {
    // Initialize state management foundation
    const { store, events, ui, validator, forms } = window.QuandaryState.initialize();

    // Register form fields with validation
    forms.registerField('room-name', '', [
        { validator: QuandaryState.Validator.required, message: 'Room name is required' },
        { validator: (value) => QuandaryState.Validator.minLength(value, 2), message: 'Room name must be at least 2 characters' },
        { validator: (value) => QuandaryState.Validator.maxLength(value, 100), message: 'Room name must be less than 100 characters' }
    ]);

    forms.registerField('timer-duration', '00:00', [
        { validator: (value) => /^([0-9]{1,2}):([0-5][0-9])$/.test(value) || value === '00:00', message: 'Timer duration must be in MM:SS format (e.g., 05:30)' }
    ]);

    forms.registerField('api-variables', '{}', [
        { validator: QuandaryState.Validator.json, message: 'API Variables must be valid JSON' }
    ]);

    forms.registerField('config', '{}', [
        { validator: QuandaryState.Validator.json, message: 'Configuration must be valid JSON' }
    ]);

    // New: hint system type
    forms.registerField('hint-type', 'broadcast', [
        { validator: QuandaryState.Validator.required, message: 'Hint system type is required' }
    ]);

    // Helper functions for time conversion
    function convertMMSSToSeconds(timeString) {
        if (!timeString || timeString === '00:00') return 0;
        
        const match = timeString.match(/^([0-9]{1,2}):([0-5][0-9])$/);
        if (!match) return 0;
        
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        return (minutes * 60) + seconds;
    }
    
    function convertSecondsToMMSS(totalSeconds) {
        if (totalSeconds <= 0) return '00:00';
        
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // DOM elements cache
    const roomGrid = document.getElementById('room-grid');
    const roomModal = document.getElementById('room-modal');
    const createBtn = document.getElementById('create-room-btn');
    const closeBtn = document.getElementById('close-modal');
    const cancelBtn = document.getElementById('cancel-btn');
    const roomForm = document.getElementById('room-form');

    // Initialize with state management
    initializeAdminApp();
    setupEventListeners();
    setupStateSubscriptions();

    function initializeAdminApp() {
        // Set up form field bindings
        ['room-name', 'timer-duration', 'api-variables', 'config', 'hint-type'].forEach(fieldName => {
            const element = document.getElementById(fieldName);
            if (element) {
                element.addEventListener('input', () => {
                    forms.updateField(fieldName, element.value);
                    updateFieldValidation(fieldName);
                });

                element.addEventListener('blur', () => {
                    forms.validateField(fieldName);
                    updateFieldValidation(fieldName);
                });
            }
        });

        // Load initial data
        loadRooms();
    }

    function setupEventListeners() {
        createBtn.addEventListener('click', () => openModal());
        closeBtn.addEventListener('click', () => closeModal());
        cancelBtn.addEventListener('click', () => closeModal());
        roomForm.addEventListener('submit', handleFormSubmit);

        // Close modal when clicking outside
        roomModal.addEventListener('click', (e) => {
            if (e.target === roomModal) closeModal();
        });
    }

    function setupStateSubscriptions() {
        // React to state changes
        store.subscribe('rooms', renderRoomGridFromState);
        store.subscribe('modal', syncModalState);
        store.subscribe('loading', syncUILoading);

        // Handle form state changes
        events.on('form:reset', resetFormUI);
        events.on('form:dirty', (isDirty) => {
            // Keep save button available; we still validate on submit
            const saveBtn = document.getElementById('save-btn');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Room';
            }
        });

        // Handle validation updates
        events.on('field:updated', ({ fieldName }) => {
            updateFieldValidation(fieldName);
        });
    }

    function updateFieldValidation(fieldName) {
        const element = document.getElementById(fieldName);
        const errors = forms.getFieldErrors(fieldName);

        if (element) {
            element.classList.remove('valid', 'invalid');

            // Clear existing error displays
            const existingError = element.parentNode.querySelector('.field-error');
            if (existingError) {
                existingError.remove();
            }

            if (errors.length > 0) {
                element.classList.add('invalid');
                const errorDiv = document.createElement('div');
                errorDiv.className = 'field-error';
                errorDiv.textContent = errors[0]; // Display first error
                // Remove inline styles - use CSS class instead
                element.parentNode.appendChild(errorDiv);
            } else if (forms.isFieldDirty(fieldName) && forms.validateField(fieldName)) {
                element.classList.add('valid');
            }
        }
    }

    function syncUILoading(state) {
        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) {
            saveBtn.disabled = state.isLoading;
            saveBtn.textContent = state.isLoading ? 'Saving...' : 'Save Room';
        }
    }

    function syncModalState(state) {
        const display = ui.isModalOpen('room-modal') ? 'flex' : 'none';
        if (roomModal.style.display !== display) {
            roomModal.style.display = display;
        }
    }

    function resetFormUI() {
        // Clear all field validation UI
        ['room-name', 'timer-duration', 'api-variables', 'config', 'hint-type'].forEach(fieldName => {
            const element = document.getElementById(fieldName);
            if (element) {
                element.classList.remove('valid', 'invalid');
                const errorDisplay = element.parentNode.querySelector('.field-error');
                if (errorDisplay) {
                    errorDisplay.remove();
                }
            }
        });
    }

    async function loadRooms() {
        ui.showLoader('rooms');
        try {
            const response = await fetch('/api/rooms');
            const result = await response.json();

            if (result.success) {
                store.setState({
                    rooms: result.data,
                    error: null
                });
                ui.handleApiSuccess('Rooms loaded successfully');
            } else {
                const error = new Error(result.error || 'Failed to load rooms');
                store.setState({
                    error: error.message
                });
                ui.handleApiError(error);
            }
        } catch (error) {
            console.error('Error loading rooms:', error);
            store.setState({
                error: error.message
            });
            ui.handleApiError(error);
        } finally {
            ui.hideLoader('rooms');
        }
    }

    function renderRoomGridFromState(state) {
        roomGrid.innerHTML = '';

        const currentRooms = state.rooms || [];

        if (currentRooms.length === 0) {
            roomGrid.innerHTML = `
                <div class="empty-state" style="
                    text-align: center;
                    grid-column: 1 / -1;
                    padding: 2em;
                    color: #6c757d;
                ">
                    <h3>🏗️ No rooms yet</h3>
                    <p>Create your first room to get started!</p>
                </div>
            `;
            return;
        }

        currentRooms.forEach(room => {
            const roomCard = createRoomCard(room);
            roomGrid.appendChild(roomCard);
        });
    }

    function createRoomCard(room) {
        const card = document.createElement('div');
        card.className = 'room-card';

        card.innerHTML = `
            <div class="room-card-header">
                <div>
                    <h3 class="room-name">${room.name}</h3>
                    <p class="room-id">ID: ${room.id}</p>
                    <div class="room-links">
                        <a href="/room/${room.id}/player" class="room-link btn-player">Player View</a>
                        <a href="/room/${room.id}/gm" class="room-link btn-gm">GM View</a>
                    </div>
                </div>
                <div class="room-actions">
                    <button class="btn-edit" onclick="editRoom('${room.id}')">Edit</button>
                    <button class="btn-delete" onclick="deleteRoom('${room.id}')">Delete</button>
                </div>
            </div>
            <div class="room-meta">
                <div><strong>Timer:</strong> ${convertSecondsToMMSS(room.timer_duration)}</div>
                <div><strong>Created:</strong> ${new Date(room.created_at).toLocaleDateString()}</div>
            </div>
        `;

        return card;
    }

    function openModal(room = null) {
        const modalTitle = document.getElementById('modal-title');

        store.setState({
            currentEditingId: room ? room.id : null,
            error: null
        });

        if (room) {
            modalTitle.textContent = 'Edit Room';
            populateForm(room);
            events.emit('room:edit', room.id);
        } else {
            modalTitle.textContent = 'Create New Room';
            forms.resetForm();
            events.emit('room:create');
        }

        ui.showModal('room-modal', { room: room || null });
        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Room'; }
    }

    function closeModal() {
        ui.hideModal('room-modal');
        store.setState({
            currentEditingId: null,
            error: null
        });
        resetFormUI();
        events.emit('modal:room-closed');
    }

    function populateForm(room) {
        forms.updateField('room-name', room.name);
        const timerDurationMMSS = convertSecondsToMMSS(room.timer_duration);
        forms.updateField('timer-duration', timerDurationMMSS);
        forms.updateField('api-variables', room.api_variables || '{}');
        forms.updateField('config', room.config || '{}');

        // Update form elements
        document.getElementById('room-name').value = room.name;
        document.getElementById('timer-duration').value = timerDurationMMSS;
        document.getElementById('api-variables').value = room.api_variables || '{}';
        document.getElementById('config').value = room.config || '{}';

        // Update hint system type from room.hint_config
        (function() {
            let hintType = 'broadcast';
            try {
                const parsed = typeof room.hint_config === 'string'
                    ? JSON.parse(room.hint_config || '{}')
                    : (room.hint_config || {});
                if (parsed && typeof parsed === 'object' && parsed.type) {
                    hintType = parsed.type;
                }
            } catch (e) {}
            forms.updateField('hint-type', hintType);
            const hintTypeEl = document.getElementById('hint-type');
            if (hintTypeEl) hintTypeEl.value = hintType;
        })();

        // Clear any existing validation errors
        resetFormUI();
    }

    async function handleFormSubmit(event) {
        event.preventDefault();

        // Validate form before submission
        if (!forms.validateForm()) {
            ui.handleUserError('form-validation', 'Please correct the highlighted errors before submitting.');
            return;
        }

        // Build API payload with correct keys expected by backend
        const name = (forms.getFieldValue('room-name') || '').trim();
        const timerMMSS = forms.getFieldValue('timer-duration');
        const apiVarsStr = forms.getFieldValue('api-variables') || '{}';
        const configStr = forms.getFieldValue('config') || '{}';

        let api_variables, config;
        try {
            api_variables = apiVarsStr ? JSON.parse(apiVarsStr) : {};
            config = configStr ? JSON.parse(configStr) : {};
        } catch (jsonError) {
            ui.handleUserError('json-validation', 'Invalid JSON in API Variables or Configuration fields.');
            return;
        }

        const payload = {
            name,
            timer_duration: convertMMSSToSeconds(timerMMSS),
            api_variables,
            config,
            hint_config: { type: forms.getFieldValue('hint-type') || 'broadcast' }
        };

        ui.showLoader('form-submit');

        try {
            const isEditing = !!store.getState().currentEditingId;
            console.debug('[Admin] Submitting room payload', payload, { editing: isEditing });
            let response;

            if (isEditing) {
                response = await fetch(`/api/rooms/${store.getState().currentEditingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                response = await fetch('/api/rooms', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            const result = await response.json();
            console.debug('[Admin] Save result', result);

            if (result.success) {
                const currentRooms = store.getState().rooms || [];
                let updatedRooms;

                if (isEditing) {
                    updatedRooms = currentRooms.map(room =>
                        room.id === store.getState().currentEditingId ? result.data : room
                    );
                } else {
                    updatedRooms = [...currentRooms, result.data];
                }

                store.setState({
                    rooms: updatedRooms,
                    error: null
                });

                closeModal();
                ui.handleApiSuccess(`${isEditing ? 'Updated' : 'Created'} room "${payload.name}" successfully`);
                events.emit('room:saved', result.data);

            } else {
                console.error('[Admin] Save failed', result);
                const error = new Error(result.error || 'Failed to save room');
                store.setState({ error: error.message });
                ui.handleApiError(error);
            }
        } catch (error) {
            console.error('Error saving room:', error);
            store.setState({ error: error.message });
            ui.handleApiError(error);
        } finally {
            ui.hideLoader('form-submit');
        }
    }

    // Expose functions globally for HTML onclick handlers with state management
    window.editRoom = (id) => {
        const currentState = store.getState();
        const room = (currentState.rooms || []).find(r => r.id === id);
        if (room) {
            openModal(room);
        } else {
            ui.handleUserError('room-not-found', 'Room not found');
        }
    };

    window.deleteRoom = async (id) => {
        if (!confirm('Are you sure you want to delete this room? This action cannot be undone.')) return;

        ui.showLoader(`delete-room-${id}`);

        try {
            const response = await fetch(`/api/rooms/${id}`, { method: 'DELETE' });
            const result = await response.json();

            if (result.success) {
                const currentState = store.getState();
                const updatedRooms = (currentState.rooms || []).filter(room => room.id !== id);

                store.setState({
                    rooms: updatedRooms,
                    error: null
                });

                ui.handleApiSuccess('Room deleted successfully');
                events.emit('room:deleted', id);

            } else {
                const error = new Error(result.error || 'Failed to delete room');
                store.setState({
                    error: error.message
                });
                ui.handleApiError(error);
            }
        } catch (error) {
            console.error('Error deleting room:', error);
            store.setState({
                error: error.message
            });
            ui.handleApiError(error);
        } finally {
            ui.hideLoader(`delete-room-${id}`);
        }
    };

    // Additional helper functions for future extensibility
    window.getCurrentRooms = () => store.getState().rooms || [];
    window.getRoomById = (id) => (store.getState().rooms || []).find(room => room.id === id);
    window.isCreatingRoom = () => !store.getState().currentEditingId;
    window.isEditingRoom = () => !!store.getState().currentEditingId;

    // Auto-close controls
    window.adminApp = {
        toggleAutoClose(enabled) {
            store.setState({
                autoCloseSettings: {
                    ...store.getState().autoCloseSettings,
                    enabled: enabled
                }
            });
        },

        setAutoCloseSeconds(seconds) {
            const parsed = parseInt(seconds);
            if (!isNaN(parsed)) {
                store.setState({
                    autoCloseSettings: {
                        ...store.getState().autoCloseSettings,
                        seconds: parsed
                    }
                });
            }
        },

        sendLightboxCommand() {
            const roomId = document.querySelector('.room-card')?.getAttribute('data-room-id');
            if (roomId) {
                // For now, we'll use a simple implementation
                // In a real implementation, this would open the lightbox with media
                alert('Lightbox command sent to room: ' + roomId);
            } else {
                ui.handleUserError('lightbox', 'No room available for lightbox display');
            }
        }
    };

    // Enhanced Variable Management System
    let currentVariables = {};
    let editingVariableIndex = -1;

    // Initialize variable management on DOM load
    document.addEventListener('DOMContentLoaded', () => {
        // Get DOM references
        const variableModal = document.getElementById('variable-modal');
        const variablesListEl = document.getElementById('variables-list');
        
        // Initialize systems
        initializeVariableManagement();
        renderVariablesList();
        
        // Event listeners
        manageVariablesBtn?.addEventListener('click', openVariableModal);
        addVariableBtn?.addEventListener('click', openVariableFormModal);
    });
    const variableFormModal = document.getElementById('variable-form-modal');
    const manageVariablesBtn = document.getElementById('manage-variables-btn');
    const addVariableBtn = document.getElementById('add-variable-btn');
    const saveVariablesBtn = document.getElementById('save-variables-btn');
    const cancelVariableBtn = document.getElementById('cancel-variable-btn');
    const closeVariableModalBtn = document.getElementById('close-variable-modal');
    const closeVariableFormModalBtn = document.getElementById('close-variable-form-modal');
    const cancelVariableFormBtn = document.getElementById('cancel-variable-form-btn');
    const saveVariableFormBtn = document.getElementById('save-variable-form-btn');
    const variableForm = document.getElementById('variable-form');
    const variablesListEl = document.getElementById('variables-list');

    function initializeVariableManagement() {
        // Load variables from the textarea on modal open
        manageVariablesBtn.addEventListener('click', openVariableModal);
        addVariableBtn.addEventListener('click', openVariableFormModal);
        saveVariablesBtn.addEventListener('click', saveVariableChanges);
        cancelVariableBtn.addEventListener('click', closeVariableModal);
        closeVariableModalBtn.addEventListener('click', closeVariableModal);
        closeVariableFormModalBtn.addEventListener('click', closeVariableFormModal);
        cancelVariableFormBtn.addEventListener('click', closeVariableFormModal);
        saveVariableFormBtn.addEventListener('click', saveVariable);

        // Variable form event listeners
        variableForm.addEventListener('submit', handleVariableFormSubmit);

        // Close modals when clicking outside
        if (variableModal) {
            variableModal.addEventListener('click', (e) => {
                if (e.target === variableModal) closeVariableModal();
            });
        }
        if (variableFormModal) {
            variableFormModal.addEventListener('click', (e) => {
                if (e.target === variableFormModal) closeVariableFormModal();
            });
        }
    }

    function openVariableModal() {
        try {
            // Parse current JSON from textarea
            const apiVariablesTextarea = document.getElementById('api-variables');
            const jsonContent = apiVariablesTextarea.value.trim() || '{}';
            currentVariables = JSON.parse(jsonContent);

            renderVariablesList();
            ui.showModal('variable-modal');
        } catch (error) {
            ui.handleUserError('json-parse', 'Invalid JSON in API Variables field. Please correct it first.');
            console.error('Error parsing JSON:', error);
        }
    }

    function closeVariableModal() {
        ui.hideModal('variable-modal');
        currentVariables = {};
        editingVariableIndex = -1;
    }

    function openVariableFormModal(index = -1) {
        const title = document.getElementById('variable-form-title');
        editingVariableIndex = index;

        if (index >= 0) {
            // Editing existing variable
            const varNames = Object.keys(currentVariables);
            const varName = varNames[index];
            const varData = currentVariables[varName];

            document.getElementById('variable-name').value = varName;
            document.getElementById('variable-type').value = inferVariableType(varData);
            document.getElementById('variable-value').value = typeof varData === 'string' ? varData : JSON.stringify(varData, null, 2);
            title.textContent = 'Edit Variable';
        } else {
            // Adding new variable
            variableForm.reset();
            title.textContent = 'Add Variable';
            document.getElementById('variable-type').value = 'string';
            document.getElementById('variable-value').value = '';
        }

        ui.showModal('variable-form-modal');
    }

    function closeVariableFormModal() {
        ui.hideModal('variable-form-modal');
        editingVariableIndex = -1;
        resetVariableForm();
    }

    function saveVariableChanges() {
        try {
            // Update the textarea with the current variables
            const jsonString = JSON.stringify(currentVariables, null, 2);
            document.getElementById('api-variables').value = jsonString;
            forms.updateField('api-variables', jsonString);

            ui.handleApiSuccess('Variables updated successfully');
            closeVariableModal();
        } catch (error) {
            ui.handleUserError('json-generation', 'Failed to generate valid JSON. Please check your variables.');
            console.error('Error generating JSON:', error);
        }
    }

    function handleVariableFormSubmit(event) {
        event.preventDefault();
        saveVariable();
    }

    function saveVariable() {
        const name = document.getElementById('variable-name').value.trim();
        const type = document.getElementById('variable-type').value;
        const value = document.getElementById('variable-value').value.trim();

        if (!name) {
            ui.handleUserError('variable-name', 'Variable name is required');
            return;
        }

        // Check for duplicate names
        const varNames = Object.keys(currentVariables);
        if (editingVariableIndex === -1 || varNames[editingVariableIndex] !== name) {
            if (varNames.includes(name)) {
                ui.handleUserError('variable-name', 'Variable name must be unique');
                return;
            }
        }

        let processedValue;
        try {
            processedValue = parseVariableValue(type, value);
        } catch (error) {
            ui.handleUserError('variable-value', error.message);
            return;
        }

        // Save the variable
        if (editingVariableIndex >= 0) {
            // Update existing
            const oldName = varNames[editingVariableIndex];
            if (oldName !== name) {
                delete currentVariables[oldName];
            }
        }

        currentVariables[name] = processedValue;

        renderVariablesList();
        closeVariableFormModal();
        ui.handleApiSuccess(`Variable "${name}" saved successfully`);
    }

    function parseVariableValue(type, value) {
        switch (type) {
            case 'string':
                return value;
            case 'number':
                const num = Number(value);
                if (isNaN(num)) throw new Error('Value must be a valid number');
                return num;
            case 'boolean':
                if (value.toLowerCase() === 'true') return true;
                if (value.toLowerCase() === 'false') return false;
                throw new Error('Value must be "true" or "false" for boolean type');
            case 'array':
            case 'object':
                try {
                    return JSON.parse(value);
                } catch (e) {
                    throw new Error(`Invalid JSON for ${type} type: ${e.message}`);
                }
            default:
                return value;
        }
    }

    function inferVariableType(value) {
        if (typeof value === 'boolean') return 'boolean';
        if (typeof value === 'number') return 'number';
        if (Array.isArray(value)) return 'array';
        if (value !== null && typeof value === 'object') return 'object';
        return 'string';
    }

    function renderVariablesList() {
        const variablesListEl = document.getElementById('variables-list');
        if (!variablesListEl) return;

        variablesListEl.innerHTML = '';

        const varNames = Object.keys(currentVariables);

        if (varNames.length === 0) {
            variablesListEl.innerHTML = `
                <div class="variable-empty-state">
                    <h3>📊 No variables yet</h3>
                    <p>Add your first variable to get started!</p>
                </div>
            `;
            return;
        }

        varNames.forEach((name, index) => {
            const value = currentVariables[name];
            const variableCard = createVariableCard(name, value, index);
            variablesListEl.appendChild(variableCard);
        });
    }

    function createVariableCard(name, value, index) {
        const card = document.createElement('div');
        card.className = 'variable-card';

        const valueDisplay = typeof value === 'string' ? value :
                           typeof value === 'boolean' || typeof value === 'number' ? value.toString() :
                           JSON.stringify(value, null, 2);

        card.innerHTML = `
            <div class="variable-info">
                <div class="variable-card-meta">
                    <h4 class="variable-name">${name}</h4>
                    <span class="variable-type">${inferVariableType(value).toUpperCase()}</span>
                </div>
                <div class="variable-value">${valueDisplay}</div>
            </div>
            <div class="variable-actions">
                <button class="btn-edit-var" onclick="window.editVariable(${index})">✏️ Edit</button>
                <button class="btn-delete-var" onclick="window.deleteVariable(${index})">🗑️ Delete</button>
            </div>
        `;

        return card;
    }

    function resetVariableForm() {
        if (variableForm) {
            variableForm.reset();
        }
    }

    // Global functions for variable management
    window.editVariable = (index) => openVariableFormModal(index);
    window.deleteVariable = (index) => {
        const varNames = Object.keys(currentVariables);
        const name = varNames[index];

        if (confirm(`Are you sure you want to delete the variable "${name}"?`)) {
            delete currentVariables[name];
            renderVariablesList();
            ui.handleApiSuccess(`Variable "${name}" deleted successfully`);
        }
    };

    // Action Management System
    let currentActions = [];
    let editingActionIndex = -1;

    // Action modal DOM elements
    const actionModal = document.getElementById('action-modal');
    const actionFormModal = document.getElementById('action-form-modal');
    const manageActionsBtn = document.getElementById('manage-actions-btn');
    const addActionBtn = document.getElementById('add-action-btn');
    const saveActionsBtn = document.getElementById('save-actions-btn');
    const cancelActionBtn = document.getElementById('cancel-action-btn');
    const closeActionModalBtn = document.getElementById('close-action-modal');
    const closeActionFormModalBtn = document.getElementById('close-action-form-modal');
    const cancelActionFormBtn = document.getElementById('cancel-action-form-btn');
    const saveActionFormBtn = document.getElementById('save-action-form-btn');
    const actionForm = document.getElementById('action-form');
    const actionsListEl = document.getElementById('actions-list');

    function initializeActionManagement() {
        // Load actions from the config textarea on modal open
        manageActionsBtn.addEventListener('click', openActionModal);
        addActionBtn.addEventListener('click', openActionFormModal);
        saveActionsBtn.addEventListener('click', saveActionChanges);
        cancelActionBtn.addEventListener('click', closeActionModal);
        closeActionModalBtn.addEventListener('click', closeActionModal);
        closeActionFormModalBtn.addEventListener('click', closeActionFormModal);
        cancelActionFormBtn.addEventListener('click', closeActionFormModal);
        saveActionFormBtn.addEventListener('click', saveAction);

        // Action form event listeners
        actionForm.addEventListener('submit', handleActionFormSubmit);

        // Close modals when clicking outside
        if (actionModal) {
            actionModal.addEventListener('click', (e) => {
                if (e.target === actionModal) closeActionModal();
            });
        }
        if (actionFormModal) {
            actionFormModal.addEventListener('click', (e) => {
                if (e.target === actionFormModal) closeActionFormModal();
            });
        }
    }

    function openActionModal() {
        try {
            // Parse current actions from config textarea
            const configTextarea = document.getElementById('config');
            const jsonContent = configTextarea.value.trim() || '{}';
            const configObj = JSON.parse(jsonContent);

            // Extract actions from config, default to empty array
            currentActions = configObj.actions || [];
            if (!Array.isArray(currentActions)) {
                currentActions = [];
            }

            renderActionsList();
            ui.showModal('action-modal');
        } catch (error) {
            ui.handleUserError('json-parse', 'Invalid JSON in Configuration field. Please correct it first.');
            console.error('Error parsing JSON:', error);
        }
    }

    function closeActionModal() {
        ui.hideModal('action-modal');
        currentActions = [];
        editingActionIndex = -1;
    }

    function openActionFormModal(index = -1) {
        const title = document.getElementById('action-form-title');
        editingActionIndex = index;

        if (index >= 0) {
            // Editing existing action
            const action = currentActions[index];

            document.getElementById('action-name').value = action.name;
            document.getElementById('action-type').value = action.type;
            document.getElementById('action-description').value = action.description || '';
            document.getElementById('action-enabled').checked = action.enabled !== false;
            title.textContent = 'Edit Action';
        } else {
            // Adding new action
            actionForm.reset();
            document.getElementById('action-type').value = 'message';
            document.getElementById('action-enabled').checked = true;
            title.textContent = 'Add Action';
        }

        ui.showModal('action-form-modal');
    }

    function closeActionFormModal() {
        ui.hideModal('action-form-modal');
        editingActionIndex = -1;
        resetActionForm();
    }

    function saveActionChanges() {
        try {
            // Get current config and update actions
            const configTextarea = document.getElementById('config');
            let configObj = {};
            try {
                const jsonContent = configTextarea.value.trim() || '{}';
                configObj = JSON.parse(jsonContent);
            } catch (e) {
                configObj = {};
            }

            configObj.actions = currentActions;

            // Update the textarea with the updated config
            const jsonString = JSON.stringify(configObj, null, 2);
            configTextarea.value = jsonString;
            forms.updateField('config', jsonString);

            ui.handleApiSuccess('Actions updated successfully');
            closeActionModal();
        } catch (error) {
            ui.handleUserError('json-generation', 'Failed to generate valid JSON. Please check your actions.');
            console.error('Error generating JSON:', error);
        }
    }

    function handleActionFormSubmit(event) {
        event.preventDefault();
        saveAction();
    }

    function saveAction() {
        const name = document.getElementById('action-name').value.trim();
        const type = document.getElementById('action-type').value;
        const description = document.getElementById('action-description').value.trim();
        const enabled = document.getElementById('action-enabled').checked;

        if (!name) {
            ui.handleUserError('action-name', 'Action name is required');
            return;
        }

        // Check for duplicate names
        if (editingActionIndex === -1 || currentActions[editingActionIndex]?.name !== name) {
            if (currentActions.some(action => action.name === name)) {
                ui.handleUserError('action-name', 'Action name must be unique');
                return;
            }
        }

        // Create action object
        const actionId = editingActionIndex >= 0 ? currentActions[editingActionIndex].id : generateActionId();
        const actionObj = {
            id: actionId,
            name: name,
            type: type,
            description: description,
            enabled: enabled,
            config: {} // Can be extended for type-specific configuration
        };

        if (editingActionIndex >= 0) {
            // Update existing action
            currentActions[editingActionIndex] = actionObj;
        } else {
            // Add new action
            currentActions.push(actionObj);
        }

        renderActionsList();
        closeActionFormModal();
        ui.handleApiSuccess(`Action "${name}" saved successfully`);
    }

    function generateActionId() {
        return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    function renderActionsList() {
        const actionsListEl = document.getElementById('actions-list');
        if (!actionsListEl) return;

        actionsListEl.innerHTML = '';

        if (currentActions.length === 0) {
            actionsListEl.innerHTML = `
                <div class="action-empty-state">
                    <h3>🚀 No actions yet</h3>
                    <p>Add your first action to configure room behavior!</p>
                </div>
            `;
            return;
        }

        currentActions.forEach((action, index) => {
            const actionCard = createActionCard(action, index);
            actionsListEl.appendChild(actionCard);
        });
    }

    function createActionCard(action, index) {
        const card = document.createElement('div');
        card.className = 'action-card';

        const typeDisplayName = getActionTypeDisplayName(action.type);
        const statusClass = action.enabled !== false ? 'enabled' : 'disabled';
        const statusText = action.enabled !== false ? 'Enabled' : 'Disabled';

        card.innerHTML = `
            <div class="action-info">
                <div class="action-card-meta">
                    <h4 class="action-name">${action.name}</h4>
                    <span class="action-type">${action.type.toUpperCase()}</span>
                    <span class="action-status ${statusClass}">${statusText}</span>
                </div>
                <div class="action-description">${action.description || 'No description'}</div>
            </div>
            <div class="action-actions">
                <button class="btn-edit-action" onclick="window.editAction(${index})">✏️ Edit</button>
                <button class="btn-delete-action" onclick="window.deleteAction(${index})">🗑️ Delete</button>
            </div>
        `;

        return card;
    }

    function getActionTypeDisplayName(type) {
        const displayNames = {
            message: 'Display Message',
            state_change: 'Change Game State',
            timer: 'Set Timer',
            notification: 'Send Notification',
            sound: 'Play Sound'
        };
        return displayNames[type] || type;
    }

    function resetActionForm() {
        if (actionForm) {
            actionForm.reset();
        }
    }

    // Global functions for action management
    window.editAction = (index) => openActionFormModal(index);
    window.deleteAction = (index) => {
        const action = currentActions[index];

        if (confirm(`Are you sure you want to delete the action "${action.name}"?`)) {
            currentActions.splice(index, 1);
            renderActionsList();
            ui.handleApiSuccess(`Action "${action.name}" deleted successfully`);
        }
    };

    initializeVariableManagement();
    initializeActionManagement();

    // Owner Customization Panel Management
    let ownerSettings = {};
    let hasUnsavedChanges = false;

    // Owner Customization DOM Elements
    const ownerCustomizationModal = document.getElementById('owner-customization-modal');
    const settingsTabs = document.querySelectorAll('.settings-tab');
    const settingsSections = document.querySelectorAll('.settings-section');
    const saveOwnerSettingsBtn = document.getElementById('save-owner-settings-btn');
    const cancelOwnerCustomizationBtn = document.getElementById('cancel-owner-customization-btn');
    const resetDefaultsBtn = document.getElementById('reset-defaults-btn');
    const closeOwnerCustomizationModalBtn = document.getElementById('close-owner-customization-modal');

    function initializeOwnerCustomization() {
        if (!ownerCustomizationModal) return;

        // Load saved settings or use defaults
        loadOwnerSettings();

        // Register validation for settings fields
        registerSettingsValidation();

        // Set up event listeners
        settingsTabs.forEach(tab => {
            tab.addEventListener('click', () => switchSettingsTab(tab.dataset.tab));
        });

        saveOwnerSettingsBtn.addEventListener('click', saveOwnerSettings);
        cancelOwnerCustomizationBtn.addEventListener('click', () => closeOwnerCustomizationModal());
        resetDefaultsBtn.addEventListener('click', resetToDefaults);
        closeOwnerCustomizationModalBtn.addEventListener('click', () => closeOwnerCustomizationModal());

        // Add change tracking to all form inputs
        document.querySelectorAll('#owner-customization-modal input, #owner-customization-modal textarea, #owner-customization-modal select').forEach(input => {
            const fieldName = `settings-${input.id}`;
            if (input.type === 'checkbox') {
                input.addEventListener('change', () => {
                    markAsDirty();
                    validateSettingsField(input.id);
                });
            } else {
                input.addEventListener('input', () => {
                    markAsDirty();
                    validateSettingsField(input.id);
                });
            }
        });

        // Modal close on outside click
        ownerCustomizationModal.addEventListener('click', (e) => {
            if (e.target === ownerCustomizationModal) {
                closeOwnerCustomizationModal();
            }
        });
    }

    function loadOwnerSettings() {
        try {
            const saved = localStorage.getItem('quandary_owner_settings');
            if (saved) {
                ownerSettings = JSON.parse(saved);
            } else {
                // Set default values
                ownerSettings = {
                    appName: 'Quandary',
                    maxRooms: 10,
                    enableAnalytics: true,
                    defaultTimerDuration: 300,
                    defaultRoomConfig: '{"theme": "default"}',
                    autoStartTimer: true,
                    primaryColor: '#667eea',
                    secondaryColor: '#764ba2',
                    accentColor: '#ff6b6b',
                    darkMode: false,
                    fontFamily: "'Roboto', sans-serif",
                    sessionTimeout: 60,
                    requirePassword: false,
                    enableTwoFactor: false,
                    apiRateLimit: 100,
                    emailNotifications: true,
                    roomCreationAlerts: true,
                    errorAlerts: true,
                    dailyReports: false
                };
            }

            // Populate form with settings
            populateSettingsForm();
        } catch (error) {
            console.error('Error loading owner settings:', error);
            ui.handleUserError('settings-load', 'Failed to load saved settings. Using defaults.');
            resetToDefaults();
        }
    }

    function populateSettingsForm() {
        // System Settings
        document.getElementById('app-name').value = ownerSettings.appName || 'Quandary';
        document.getElementById('max-rooms').value = ownerSettings.maxRooms || 10;
        document.getElementById('enable-analytics').checked = ownerSettings.enableAnalytics !== false;

        // Default Settings
        const defaultTimerSeconds = ownerSettings.defaultTimerDuration || 300;
        document.getElementById('default-timer').value = convertSecondsToMMSS(defaultTimerSeconds);
        document.getElementById('default-room-config').value = JSON.stringify(ownerSettings.defaultRoomConfig || {}, null, 2);
        document.getElementById('auto-start-timer').checked = ownerSettings.autoStartTimer !== false;

        // Theme Settings
        document.getElementById('primary-color').value = ownerSettings.primaryColor || '#667eea';
        document.getElementById('secondary-color').value = ownerSettings.secondaryColor || '#764ba2';
        document.getElementById('accent-color').value = ownerSettings.accentColor || '#ff6b6b';
        document.getElementById('dark-mode').checked = ownerSettings.darkMode || false;
        document.getElementById('font-family').value = ownerSettings.fontFamily || "Arial, sans-serif";

        // Security Settings
        document.getElementById('session-timeout').value = ownerSettings.sessionTimeout || 60;
        document.getElementById('require-password').checked = ownerSettings.requirePassword || false;
        document.getElementById('enable-2fa').checked = ownerSettings.enableTwoFactor || false;
        document.getElementById('api-rate-limit').value = ownerSettings.apiRateLimit || 100;

        // Notification Settings
        document.getElementById('email-notifications').checked = ownerSettings.emailNotifications !== false;
        document.getElementById('room-creation-alerts').checked = ownerSettings.roomCreationAlerts !== false;
        document.getElementById('error-alerts').checked = ownerSettings.errorAlerts !== false;
        document.getElementById('daily-reports').checked = ownerSettings.dailyReports || false;
    }

    function switchSettingsTab(tabId) {
        // Remove active class from all tabs and sections
        settingsTabs.forEach(tab => tab.classList.remove('active'));
        settingsSections.forEach(section => section.classList.remove('active'));

        // Add active class to selected tab and section
        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
        document.getElementById(`${tabId}-tab`).classList.add('active');
    }

    function gatherSettingsFromForm() {
        const newSettings = {};

        try {
            // System Settings
            newSettings.appName = document.getElementById('app-name').value.trim();
            newSettings.maxRooms = parseInt(document.getElementById('max-rooms').value);
            newSettings.enableAnalytics = document.getElementById('enable-analytics').checked;

            // Default Settings
            const defaultTimerMMSS = document.getElementById('default-timer').value;
            newSettings.defaultTimerDuration = convertMMSSToSeconds(defaultTimerMMSS);
            try {
                newSettings.defaultRoomConfig = JSON.parse(document.getElementById('default-room-config').value);
            } catch (e) {
                throw new Error('Invalid JSON in Default Room Configuration');
            }
            newSettings.autoStartTimer = document.getElementById('auto-start-timer').checked;

            // Theme Settings
            newSettings.primaryColor = document.getElementById('primary-color').value;
            newSettings.secondaryColor = document.getElementById('secondary-color').value;
            newSettings.accentColor = document.getElementById('accent-color').value;
            newSettings.darkMode = document.getElementById('dark-mode').checked;
            newSettings.fontFamily = document.getElementById('font-family').value;

            // Security Settings
            newSettings.sessionTimeout = parseInt(document.getElementById('session-timeout').value);
            newSettings.requirePassword = document.getElementById('require-password').checked;
            newSettings.enableTwoFactor = document.getElementById('enable-2fa').checked;
            newSettings.apiRateLimit = parseInt(document.getElementById('api-rate-limit').value);

            // Notification Settings
            newSettings.emailNotifications = document.getElementById('email-notifications').checked;
            newSettings.roomCreationAlerts = document.getElementById('room-creation-alerts').checked;
            newSettings.errorAlerts = document.getElementById('error-alerts').checked;
            newSettings.dailyReports = document.getElementById('daily-reports').checked;

            return newSettings;
        } catch (error) {
            ui.handleUserError('settings-validation', error.message);
            return null;
        }
    }

    function saveOwnerSettings() {
        const newSettings = gatherSettingsFromForm();

        if (!newSettings) {
            return; // Validation failed
        }

        // Validate critical settings
        if (newSettings.maxRooms < 1 || newSettings.maxRooms > 100) {
            ui.handleUserError('validation', 'Maximum rooms must be between 1 and 100');
            return;
        }

        if (newSettings.sessionTimeout < 5 || newSettings.sessionTimeout > 480) {
            ui.handleUserError('validation', 'Session timeout must be between 5 and 480 minutes');
            return;
        }

        if (newSettings.apiRateLimit < 10 || newSettings.apiRateLimit > 1000) {
            ui.handleUserError('validation', 'API rate limit must be between 10 and 1000 requests');
            return;
        }

        try {
            // Save to localStorage
            localStorage.setItem('quandary_owner_settings', JSON.stringify(newSettings));
            ownerSettings = newSettings;
            hasUnsavedChanges = false;

            // Apply settings to UI
            applySettingsToUI(newSettings);

            ui.handleApiSuccess('Settings saved successfully');
            closeOwnerCustomizationModal();

        } catch (error) {
            console.error('Error saving settings:', error);
            ui.handleUserError('settings-save', 'Failed to save settings');
        }
    }

    function applySettingsToUI(settings) {
        // Update CSS custom properties
        if (settings.primaryColor) {
            document.documentElement.style.setProperty('--primary-color', settings.primaryColor);
        }
        if (settings.accentColor) {
            document.documentElement.style.setProperty('--accent-color', settings.accentColor);
        }
        if (settings.secondaryColor) {
            document.documentElement.style.setProperty('--secondary-color', settings.secondaryColor);
        }
        if (settings.fontFamily) {
            document.body.style.fontFamily = settings.fontFamily;
        }

        // Handle dark mode
        if (settings.darkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }

    function resetToDefaults() {
        if (confirm('Are you sure you want to reset all settings to defaults?')) {
            ownerSettings = {
                appName: 'Quandary',
                maxRooms: 10,
                enableAnalytics: true,
                defaultTimerDuration: 300,
                defaultRoomConfig: '{"theme": "default"}',
                autoStartTimer: true,
                primaryColor: '#667eea',
                secondaryColor: '#764ba2',
                accentColor: '#ff6b6b',
                darkMode: false,
                fontFamily: "Arial, sans-serif",
                sessionTimeout: 60,
                requirePassword: false,
                enableTwoFactor: false,
                apiRateLimit: 100,
                emailNotifications: true,
                roomCreationAlerts: true,
                errorAlerts: true,
                dailyReports: false
            };

            populateSettingsForm();
            hasUnsavedChanges = true;
            ui.handleApiSuccess('Settings reset to defaults');
        }
    }

    function openOwnerCustomizationModal() {
        // Check if room modal or other modals are open and close them
        if (ui.isModalOpen('room-modal')) closeModal();
        if (ui.isModalOpen('variable-modal')) closeVariableModal();
        if (ui.isModalOpen('action-modal')) closeActionModal();

        // Reset to first tab
        switchSettingsTab('system');

        hasUnsavedChanges = false;
        ui.showModal('owner-customization-modal');
        events.emit('modal:owner-customization-opened');
    }

    function closeOwnerCustomizationModal() {
        if (hasUnsavedChanges && !confirm('You have unsaved changes. Are you sure you want to close?')) {
            return;
        }

        ui.hideModal('owner-customization-modal');
        hasUnsavedChanges = false;
        events.emit('modal:owner-customization-closed');
    }

    function registerSettingsValidation() {
        // Create a separate validator for settings
        const settingsValidator = new FieldValidator();

        // App Name validation
        settingsValidator.addRule('app-name', QuandaryState.Validator.required, 'Application name is required');
        settingsValidator.addRule('app-name', (value) => value.length >= 2, 'Application name must be at least 2 characters');
        settingsValidator.addRule('app-name', (value) => value.length <= 50, 'Application name must be less than 50 characters');

        // Max Rooms validation
        settingsValidator.addRule('max-rooms', QuandaryState.Validator.float, 'Maximum rooms must be a number');
        settingsValidator.addRule('max-rooms', (value) => value >= 1 && value <= 100, 'Maximum rooms must be between 1 and 100');

        // Default Timer validation
        settingsValidator.addRule('default-timer', (value) => /^([0-9]{1,2}):([0-5][0-9])$/.test(value) || value === '00:00', 'Default timer must be in MM:SS format (e.g., 05:30)');
        settingsValidator.addRule('default-timer', (value) => {
            const seconds = convertMMSSToSeconds(value);
            return seconds >= 0 && seconds <= 3600;
        }, 'Default timer must be between 00:00 and 60:00');

        // Session Timeout validation
        settingsValidator.addRule('session-timeout', QuandaryState.Validator.numeric, 'Session timeout must be a number');
        settingsValidator.addRule('session-timeout', (value) => value >= 5 && value <= 480, 'Session timeout must be between 5 and 480 minutes');

        // API Rate Limit validation
        settingsValidator.addRule('api-rate-limit', QuandaryState.Validator.numeric, 'API rate limit must be a number');
        settingsValidator.addRule('api-rate-limit', (value) => value >= 10 && value <= 1000, 'API rate limit must be between 10 and 1000');

        // Default Room Config validation
        settingsValidator.addRule('default-room-config', QuandaryState.Validator.json, 'Default room configuration must be valid JSON');

        // Store validator globally for use in validation
        window.settingsValidator = settingsValidator;
    }

    function validateSettingsField(fieldId) {
        const element = document.getElementById(fieldId);
        if (!element) return;

        const value = element.type === 'checkbox' ? element.checked : element.value;
        const errors = [];

        // Get errors from our settings validator
        const result = window.settingsValidator.validate({ [fieldId]: value });
        errors.push(...result.errors[fieldId]);

        // Clear existing error displays
        const existingError = element.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }

        element.classList.remove('valid', 'invalid');

        if (errors.length > 0) {
            element.classList.add('invalid');
            const errorDiv = document.createElement('div');
            errorDiv.className = 'field-error';
            errorDiv.textContent = errors[0];
            errorDiv.style.cssText = `
                color: #dc3545;
                font-size: 0.875em;
                margin-top: 0.25em;
                display: block;
            `;
            element.parentNode.appendChild(errorDiv);
        } else {
            element.classList.add('valid');
        }

        return errors.length === 0;
    }

    function markAsDirty() {
        hasUnsavedChanges = true;
    }

    // Add button to open settings panel
    function addSettingsButton() {
        const actionsHeader = document.querySelector('.actions-header');
        if (actionsHeader) {
            const settingsBtn = document.createElement('button');
            settingsBtn.className = 'btn-secondary';
            settingsBtn.id = 'open-owner-settings-btn';
            settingsBtn.innerHTML = '⚙️ Owner Settings';
            settingsBtn.addEventListener('click', openOwnerCustomizationModal);

            actionsHeader.appendChild(settingsBtn);
        }
    }

    // Initialize owner customization functions
    initializeOwnerCustomization();
    addSettingsButton();

    // Event listener for keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && ui.isModalOpen('room-modal')) {
            closeModal();
        } else if (e.key === 'Escape' && ui.isModalOpen('variable-modal')) {
            closeVariableModal();
        } else if (e.key === 'Escape' && ui.isModalOpen('variable-form-modal')) {
            closeVariableFormModal();
        } else if (e.key === 'Escape' && ui.isModalOpen('action-modal')) {
            closeActionModal();
        } else if (e.key === 'Escape' && ui.isModalOpen('action-form-modal')) {
            closeActionFormModal();
        } else if (e.key === 'Escape' && ui.isModalOpen('owner-customization-modal')) {
            closeOwnerCustomizationModal();
        }
    });
});