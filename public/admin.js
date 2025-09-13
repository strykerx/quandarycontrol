// Global function to open layout builder for specific room
window.openLayoutBuilder = function(roomId, roomName) {
    console.log('Opening layout builder for room:', roomId, roomName);
    
    if (!roomId) {
        alert('No room ID provided');
        return;
    }
    
    // Store room info for potential use
    sessionStorage.setItem('layoutBuilder.roomId', roomId);
    sessionStorage.setItem('layoutBuilder.roomName', roomName);
    
    // Open layout builder with room ID parameter in new tab
    const url = `/layout-builder.html?roomId=${encodeURIComponent(roomId)}`;
    window.open(url, '_blank');
};

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

    forms.registerField('secondary-timer-enabled', false, []);
    
    forms.registerField('secondary-timer-duration', '00:00', [
        { validator: (value) => /^([0-9]{1,2}):([0-5][0-9])$/.test(value) || value === '00:00', message: 'Secondary timer duration must be in MM:SS format (e.g., 05:30)' }
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
    
    // Setup event delegation for dynamically created room cards
    setupRoomCardEventDelegation();

    function initializeAdminApp() {
        // Set up form field bindings
        ['room-name', 'timer-duration', 'secondary-timer-enabled', 'secondary-timer-duration', 'api-variables', 'config', 'hint-type'].forEach(fieldName => {
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

    function setupRoomCardEventDelegation() {
        // Handle layout builder button clicks with event delegation
        document.addEventListener('click', function(e) {
            if (e.target && e.target.classList.contains('btn-layout-builder')) {
                e.preventDefault();
                
                const roomId = e.target.dataset.roomId;
                const roomName = e.target.dataset.roomName || 'Unknown Room';
                
                console.log('Layout builder button clicked for room:', roomId, roomName);
                
                if (roomId) {
                    openLayoutBuilder(roomId, roomName);
                } else {
                    alert('Room ID not found');
                }
            }
        });
    }

    function setupEventListeners() {
        createBtn.addEventListener('click', () => openModal());
        closeBtn.addEventListener('click', () => closeModal());
        cancelBtn.addEventListener('click', () => closeModal());
        roomForm.addEventListener('submit', handleFormSubmit);
        
        // Secondary timer checkbox handling
        const secondaryTimerEnabled = document.getElementById('secondary-timer-enabled');
        const secondaryTimerDurationGroup = document.getElementById('secondary-timer-duration-group');
        
        if (secondaryTimerEnabled && secondaryTimerDurationGroup) {
            function toggleSecondaryTimerDuration() {
                if (secondaryTimerEnabled.checked) {
                    secondaryTimerDurationGroup.style.display = 'block';
                } else {
                    secondaryTimerDurationGroup.style.display = 'none';
                }
            }
            
            secondaryTimerEnabled.addEventListener('change', () => {
                forms.updateField('secondary-timer-enabled', secondaryTimerEnabled.checked);
                toggleSecondaryTimerDuration();
            });
            
            // Initialize state
            toggleSecondaryTimerDuration();
        }

        // Layout builder button
        const layoutBuilderBtn = document.getElementById('layout-builder-btn');
        if (layoutBuilderBtn) {
            layoutBuilderBtn.addEventListener('click', () => {
                window.location.href = '/layout-builder.html';
            });
        }

        // Theme gallery button
        const themeGalleryBtn = document.getElementById('theme-gallery-btn');
        if (themeGalleryBtn) {
            themeGalleryBtn.addEventListener('click', () => {
                openThemeGallery();
            });
        }

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
        ['room-name', 'timer-duration', 'secondary-timer-enabled', 'secondary-timer-duration', 'api-variables', 'config', 'hint-type'].forEach(fieldName => {
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
        card.dataset.roomId = room.id;

        card.innerHTML = `
            <div class="room-card-header">
                <div>
                    <h3 class="room-name">${room.name}</h3>
                    <p class="room-id">ID: ${room.id}</p>
                    <div class="room-links">
                        <a href="/room/${room.id}/player" class="room-link btn-player">Player View</a>
                        <a href="/room/${room.id}/gm" class="room-link btn-gm">GM View</a>
                        <a href="/room/${room.id}/rules-editor" class="room-link btn-rules-edit">Edit Rules</a>
                        <a href="/room/${room.id}/rules-slideshow" class="room-link btn-rules-start">Start Rules</a>
                    </div>
                </div>
            </div>
            <div class="room-meta">
                <div><strong>Timer:</strong> ${convertSecondsToMMSS(room.timer_duration)}</div>
                <div><strong>Created:</strong> ${new Date(room.created_at).toLocaleDateString()}</div>
            </div>
            <div class="room-card-footer">
                <div class="room-actions">
                    <button class="btn-edit" onclick="editRoom('${room.id}')">Edit</button>
                    <button class="btn-delete" onclick="deleteRoom('${room.id}')">Delete</button>
                </div>
            </div>
            <div class="room-config-actions">
                <button class="btn-config-theme" onclick="configureRoomTheme('${room.id}', '${room.name}')">
                    🎭 Configure Theme
                </button>
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
        
        // Secondary timer fields
        const secondaryTimerEnabled = Boolean(room.secondary_timer_enabled);
        const secondaryTimerDurationMMSS = convertSecondsToMMSS(room.secondary_timer_duration || 0);
        forms.updateField('secondary-timer-enabled', secondaryTimerEnabled);
        forms.updateField('secondary-timer-duration', secondaryTimerDurationMMSS);
        
        forms.updateField('api-variables', room.api_variables || '{}');
        forms.updateField('config', room.config || '{}');

        // Update form elements
        document.getElementById('room-name').value = room.name;
        document.getElementById('timer-duration').value = timerDurationMMSS;
        
        // Update secondary timer elements
        const secondaryTimerEnabledEl = document.getElementById('secondary-timer-enabled');
        const secondaryTimerDurationEl = document.getElementById('secondary-timer-duration');
        const secondaryTimerDurationGroup = document.getElementById('secondary-timer-duration-group');
        
        if (secondaryTimerEnabledEl) {
            secondaryTimerEnabledEl.checked = secondaryTimerEnabled;
        }
        if (secondaryTimerDurationEl) {
            secondaryTimerDurationEl.value = secondaryTimerDurationMMSS;
        }
        if (secondaryTimerDurationGroup) {
            secondaryTimerDurationGroup.style.display = secondaryTimerEnabled ? 'block' : 'none';
        }
        
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
        const secondaryTimerEnabled = forms.getFieldValue('secondary-timer-enabled') || false;
        const secondaryTimerMMSS = forms.getFieldValue('secondary-timer-duration');
        const apiVarsStr = forms.getFieldValue('api-variables') || '{}';
        const configStr = forms.getFieldValue('config') || '{}';
        const selectedTheme = document.getElementById('room-theme')?.value || 'example-theme';

        let api_variables, config;
        try {
            api_variables = apiVarsStr ? JSON.parse(apiVarsStr) : {};
            config = configStr ? JSON.parse(configStr) : {};
        } catch (jsonError) {
            ui.handleUserError('json-validation', 'Invalid JSON in API Variables or Configuration fields.');
            return;
        }

        // Include theme in config
        config.theme = selectedTheme;

        const payload = {
            name,
            timer_duration: convertMMSSToSeconds(timerMMSS),
            secondary_timer_enabled: secondaryTimerEnabled ? 1 : 0,
            secondary_timer_duration: convertMMSSToSeconds(secondaryTimerMMSS),
            api_variables,
            config,
            hint_config: { type: forms.getFieldValue('hint-type') || 'broadcast' },
            theme: selectedTheme
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

    // Configure room theme function
    window.configureRoomTheme = (roomId, roomName) => {
        console.log('Opening theme configurator for room:', roomId, roomName);
        if (window.themeConfigurator) {
            window.themeConfigurator.openForRoom(roomId, roomName);
        } else {
            console.error('Theme configurator not loaded');
        }
    };

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
    
    // Per-room layout configuration function
    window.configureRoomLayout = (roomId, roomName) => {
        // Set the current room ID for layout configuration
        window.currentEditingRoomId = roomId;
        
        // Update the layout modal title
        const layoutModal = document.getElementById('layout-modal');
        if (layoutModal) {
            const modalTitle = layoutModal.querySelector('.modal-header h2');
            if (modalTitle) {
                modalTitle.textContent = `🎨 Layout Configuration for "${roomName}"`;
            }
            // Directly show the modal
            layoutModal.style.display = 'block';
            
            // Initialize previews when modal becomes visible
            const initPreview = () => {
                initializeLayoutPreviews();
                layoutModal.removeEventListener('shown', initPreview);
            };
            layoutModal.addEventListener('shown', initPreview);
        }
        
        // Load the room's current layout configuration
        loadRoomLayoutConfiguration(roomId);
        
        // Set up room-specific layout controls
        setupRoomLayoutControls(roomId);
    };
    
    // Load room-specific layout configuration
    async function loadRoomLayoutConfiguration(roomId) {
        try {
            const response = await fetch(`/api/rooms/${roomId}/layout`);
            const result = await response.json();
            
            if (result.success && result.data) {
                const layoutConfig = result.data;
                
                // Apply the room's layout configuration to the form
                applyRoomLayoutToForm(layoutConfig);
                
                // Show notification that room layout was loaded
                if (window.adminLayoutControls && window.adminLayoutControls.showNotification) {
                    window.adminLayoutControls.showNotification(`Loaded layout configuration for room`, 'info');
                }
            } else {
                // No custom layout found, use defaults
                console.log('No custom layout found for room, using defaults');
            }
        } catch (error) {
            console.error('Error loading room layout configuration:', error);
            // Silently fail and use defaults
        }
    }
    
    // Apply room layout configuration to form
    function applyRoomLayoutToForm(layoutConfig) {
        if (!layoutConfig || !layoutConfig.layouts) return;
        
        const layouts = layoutConfig.layouts;
        
        // Apply default layout configuration
        if (layouts.default && layouts.default.grid) {
            const gridConfig = layouts.default.grid;
            const templateField = document.getElementById('default-grid-template');
            const gapField = document.getElementById('default-gap-size');
            
            if (templateField && gridConfig.template) {
                templateField.value = gridConfig.template;
            }
            if (gapField && gridConfig.gap) {
                const gapValue = gridConfig.gap.replace('px', '');
                gapField.value = gapValue;
                const gapDisplay = document.getElementById('default-gap-value');
                if (gapDisplay) {
                    gapDisplay.textContent = gridConfig.gap;
                }
            }
        }
        
        // Apply mobile layout configuration
        if (layouts.mobile && layouts.mobile.flex) {
            const flexConfig = layouts.mobile.flex;
            const directionField = document.getElementById('mobile-stack-direction');
            const breakpointField = document.getElementById('mobile-breakpoint');
            
            if (directionField && flexConfig.direction) {
                directionField.value = flexConfig.direction;
            }
            if (breakpointField && flexConfig.breakpoint) {
                breakpointField.value = flexConfig.breakpoint;
            }
        }
        
        // Apply compact layout configuration
        if (layouts.compact) {
            const compactConfig = layouts.compact;
            const spacingField = document.getElementById('compact-spacing');
            const hideNonEssentialField = document.getElementById('compact-hide-nonessential');
            
            if (spacingField && compactConfig.grid && compactConfig.grid.spacing) {
                const spacingValue = compactConfig.grid.spacing.replace('px', '');
                spacingField.value = spacingValue;
                const spacingDisplay = document.getElementById('compact-spacing-value');
                if (spacingDisplay) {
                    spacingDisplay.textContent = compactConfig.grid.spacing;
                }
            }
            if (hideNonEssentialField && compactConfig.hideNonEssential !== undefined) {
                hideNonEssentialField.checked = compactConfig.hideNonEssential;
            }
        }
        
        // Apply custom layout configuration
        if (layouts.custom || Object.keys(layouts).length > 3) {
            const customField = document.getElementById('custom-layout-json');
            if (customField) {
                customField.value = JSON.stringify(layoutConfig, null, 2);
                
                // Switch to custom tab
                const customTab = document.querySelector('[data-layout="custom"]');
                if (customTab) {
                    customTab.click();
                }
            }
        }
        
        // Update layout previews
        if (window.updateLayoutPreview) {
            const activeTab = document.querySelector('.layout-tab.active');
            if (activeTab) {
                window.updateLayoutPreview(activeTab.dataset.layout);
            }
        }
    }
    
    // Set up room-specific layout controls
    function setupRoomLayoutControls(roomId) {
        // Update the room selector in the layout modal
        const roomSelector = document.getElementById('preview-room-selector');
        if (roomSelector) {
            roomSelector.value = roomId;
            
            // Trigger change event to update the current room in layout controls
            const event = new Event('change', { bubbles: true });
            roomSelector.dispatchEvent(event);
        }
        
        // Update the apply layout button to target this specific room
        const applyLayoutBtn = document.getElementById('apply-layout-to-room');
        if (applyLayoutBtn) {
            // Remove any existing event listeners
            applyLayoutBtn.replaceWith(applyLayoutBtn.cloneNode(true));
            
            // Get the fresh reference
            const freshApplyBtn = document.getElementById('apply-layout-to-room');
            
            // Add room-specific event listener
            freshApplyBtn.addEventListener('click', () => {
                applyLayoutToSpecificRoom(roomId);
            });
        }
    }
    
    // Apply layout to a specific room
    async function applyLayoutToSpecificRoom(roomId) {
        if (!roomId) {
            if (window.adminLayoutControls && window.adminLayoutControls.showNotification) {
                window.adminLayoutControls.showNotification('No room specified for layout application', 'error');
            }
            return;
        }
        
        const activeTab = document.querySelector('.layout-tab.active');
        if (!activeTab) return;
        
        const layoutType = activeTab.dataset.layout;
        let layoutConfig;
        
        // Use the layout controls instance if available
        if (window.adminLayoutControls && window.adminLayoutControls.gatherLayoutConfiguration) {
            layoutConfig = window.adminLayoutControls.gatherLayoutConfiguration(layoutType);
        } else {
            // Fallback to local implementation
            layoutConfig = gatherLayoutConfiguration(layoutType);
        }
        
        if (!layoutConfig) {
            if (window.adminLayoutControls && window.adminLayoutControls.showNotification) {
                window.adminLayoutControls.showNotification('Invalid layout configuration', 'error');
            }
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
                if (window.adminLayoutControls && window.adminLayoutControls.showNotification) {
                    window.adminLayoutControls.showNotification('Layout applied to room successfully!', 'success');
                }
                
                // Close the layout modal
                const layoutModal = document.getElementById('layout-modal');
                if (layoutModal) {
                    layoutModal.style.display = 'none';
                }
            } else {
                if (window.adminLayoutControls && window.adminLayoutControls.showNotification) {
                    window.adminLayoutControls.showNotification(`Failed to apply layout: ${result.error}`, 'error');
                }
            }
        } catch (error) {
            console.error('Error applying layout to room:', error);
            if (window.adminLayoutControls && window.adminLayoutControls.showNotification) {
                window.adminLayoutControls.showNotification('Error applying layout to room', 'error');
            }
        }
    }
    
    // Fallback layout configuration gathering function
    function gatherLayoutConfiguration(layoutType) {
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
        
        // Check if required elements exist
        if (!variableModal) {
            console.warn('Variable modal not found in DOM');
            return;
        }
        
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

    // Initialize Theme Manager
    document.addEventListener('DOMContentLoaded', function() {
        // Wait for theme manager to be ready
        window.addEventListener('themeManagerReady', function(e) {
            const themeManager = window.themeManager;
            
            // Add theme selector styles
            themeManager.addThemeSelectorStyles();
            
            // Create theme selector in the admin interface
            themeManager.createThemeSelector('theme-selector-container', function(selectedTheme) {
                // Update theme info when theme changes
                const themeInfo = document.getElementById('theme-info');
                const theme = themeManager.getTheme(selectedTheme);
                if (theme && themeInfo) {
                    themeInfo.textContent = `Current theme: ${theme.name} - ${theme.description}`;
                }
                
                // If live preview is enabled, show a notification
                if (themeManager.isLivePreviewEnabled()) {
                    // Create a temporary notification
                    const notification = document.createElement('div');
                    notification.style.cssText = `
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        background: var(--bg-medium);
                        color: var(--text-light);
                        padding: 1rem;
                        border-radius: var(--border-radius);
                        box-shadow: var(--shadow);
                        z-index: 1000;
                        animation: slideIn 0.3s ease-out;
                    `;
                    notification.textContent = `Theme changed to ${theme.name}`;
                    document.body.appendChild(notification);
                    
                    // Remove notification after 3 seconds
                    setTimeout(() => {
                        notification.style.animation = 'slideOut 0.3s ease-out';
                        setTimeout(() => {
                            document.body.removeChild(notification);
                        }, 300);
                    }, 3000);
                }
            });
            
            // Update initial theme info
            const themeInfo = document.getElementById('theme-info');
            const currentTheme = themeManager.getCurrentTheme();
            const theme = themeManager.getTheme(currentTheme);
            if (theme && themeInfo) {
                themeInfo.textContent = `Current theme: ${theme.name} - ${theme.description}`;
            }
        });
    });
    
    // Layout Management Functionality
    document.addEventListener('DOMContentLoaded', function() {
        const manageLayoutBtn = document.getElementById('manage-layout-btn');
        const layoutModal = document.getElementById('layout-modal');
        const closeLayoutModal = document.getElementById('close-layout-modal');
        const cancelLayoutBtn = document.getElementById('cancel-layout-btn');
        const saveLayoutBtn = document.getElementById('save-layout-btn');
        const validateLayoutBtn = document.getElementById('validate-layout-btn');
        const loadPresetBtn = document.getElementById('load-preset-btn');
        const layoutPreset = document.getElementById('layout-preset');
        const openLayoutBuilderBtn = document.getElementById('open-layout-builder');
        
        // Layout tab switching
        const layoutTabs = document.querySelectorAll('.layout-tab');
        const layoutSections = document.querySelectorAll('.layout-section');
        
        // Range input value displays
        const defaultGapSize = document.getElementById('default-gap-size');
        const defaultGapValue = document.getElementById('default-gap-value');
        const compactSpacing = document.getElementById('compact-spacing');
        const compactSpacingValue = document.getElementById('compact-spacing-value');
        
        // Initialize layout manager
        if (manageLayoutBtn) {
            manageLayoutBtn.addEventListener('click', openLayoutModal);
        }
        
        if (closeLayoutModal) {
            closeLayoutModal.addEventListener('click', closeLayoutModalHandler);
        }
        
        if (cancelLayoutBtn) {
            cancelLayoutBtn.addEventListener('click', closeLayoutModalHandler);
        }
        
        if (saveLayoutBtn) {
            saveLayoutBtn.addEventListener('click', saveLayoutConfiguration);
        }

        // Open standalone Layout Builder (passes roomId when available)
        if (openLayoutBuilderBtn) {
            openLayoutBuilderBtn.addEventListener('click', function () {
                const rid = window.currentEditingRoomId || (typeof getCurrentRoomId === 'function' ? getCurrentRoomId() : null);
                const url = rid ? `/layout-builder.html?roomId=${encodeURIComponent(rid)}` : '/layout-builder.html';
                window.location.href = url;
            });
        }
        
        if (validateLayoutBtn) {
            validateLayoutBtn.addEventListener('click', validateCustomLayout);
        }
        
        if (loadPresetBtn) {
            loadPresetBtn.addEventListener('click', loadLayoutPreset);
        }
        
        if (layoutPreset) {
            layoutPreset.addEventListener('change', updateLayoutInfo);
        }
        
        // Layout tab switching
        layoutTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetLayout = tab.dataset.layout;
                switchLayoutTab(targetLayout);
            });
        });
        
        // Range input value updates
        if (defaultGapSize && defaultGapValue) {
            defaultGapSize.addEventListener('input', () => {
                defaultGapValue.textContent = defaultGapSize.value + 'px';
                updateLayoutPreview('default');
            });
        }
        
        if (compactSpacing && compactSpacingValue) {
            compactSpacing.addEventListener('input', () => {
                compactSpacingValue.textContent = compactSpacing.value + 'px';
                updateLayoutPreview('compact');
            });
        }
        
        // Configuration change listeners
        const configInputs = [
            'default-grid-template', 'mobile-stack-direction', 'mobile-breakpoint',
            'compact-hide-nonessential', 'custom-layout-json'
        ];
        
        configInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('change', () => {
                    const layoutType = inputId.split('-')[0];
                    updateLayoutPreview(layoutType);
                });
                
                if (input.type === 'textarea' || input.type === 'text') {
                    input.addEventListener('input', () => {
                        const layoutType = inputId.split('-')[0];
                        updateLayoutPreview(layoutType);
                    });
                }
            }
        });
        
        function openLayoutModal() {
            layoutModal.style.display = 'block';
            initializeLayoutPreviews();
            updateLayoutInfo();
        }
        
        function closeLayoutModalHandler() {
            layoutModal.style.display = 'none';
        }
        
        function switchLayoutTab(layoutType) {
            // Update tab states
            layoutTabs.forEach(tab => {
                tab.classList.toggle('active', tab.dataset.layout === layoutType);
            });
            
            // Update section visibility
            layoutSections.forEach(section => {
                section.classList.toggle('active', section.id === `${layoutType}-layout`);
            });
            
            // Update preview for the active layout
            updateLayoutPreview(layoutType);
        }
        
        function initializeLayoutPreviews() {
            // Generate preview content for each layout type
            updateLayoutPreview('default');
            updateLayoutPreview('mobile');
            updateLayoutPreview('compact');
            updateLayoutPreview('custom');
        }
        
        function updateLayoutPreview(layoutType) {
            const previewElement = document.getElementById(`${layoutType}-preview`);
            if (!previewElement) return;
            
            let previewHTML = '';
            
            switch (layoutType) {
                case 'default':
                    const gridTemplate = document.getElementById('default-grid-template')?.value || '1fr 2fr';
                    const gapSize = document.getElementById('default-gap-size')?.value || '10';
                    previewHTML = generateGridLayoutPreview(gridTemplate, gapSize);
                    break;
                    
                case 'mobile':
                    const stackDirection = document.getElementById('mobile-stack-direction')?.value || 'column';
                    const breakpoint = document.getElementById('mobile-breakpoint')?.value || '768px';
                    previewHTML = generateMobileLayoutPreview(stackDirection, breakpoint);
                    break;
                    
                case 'compact':
                    const spacing = document.getElementById('compact-spacing')?.value || '8';
                    const hideNonEssential = document.getElementById('compact-hide-nonessential')?.checked || true;
                    previewHTML = generateCompactLayoutPreview(spacing, hideNonEssential);
                    break;
                    
                case 'custom':
                    const customJson = document.getElementById('custom-layout-json')?.value || '{}';
                    previewHTML = generateCustomLayoutPreview(customJson);
                    break;
            }
            
            previewElement.innerHTML = previewHTML;
        }
        
        function generateGridLayoutPreview(gridTemplate, gapSize) {
            const columns = gridTemplate.split(' ').length;
            return `
                <div class="preview-grid" style="
                    display: grid;
                    grid-template-columns: ${gridTemplate};
                    gap: ${gapSize}px;
                    height: 200px;
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 8px;
                    padding: 10px;
                ">
                    <div class="preview-item" style="background: rgba(102, 126, 234, 0.3); border-radius: 4px; display: flex; align-items: center; justify-content: center;">Sidebar</div>
                    <div class="preview-item" style="background: rgba(118, 75, 162, 0.3); border-radius: 4px; display: flex; align-items: center; justify-content: center;">Main Content</div>
                    ${columns > 2 ? '<div class="preview-item" style="background: rgba(255, 107, 107, 0.3); border-radius: 4px; display: flex; align-items: center; justify-content: center;">Extra</div>' : ''}
                </div>
            `;
        }
        
        function generateMobileLayoutPreview(stackDirection, breakpoint) {
            return `
                <div class="preview-mobile" style="
                    display: flex;
                    flex-direction: ${stackDirection};
                    gap: 10px;
                    height: 200px;
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 8px;
                    padding: 10px;
                ">
                    <div class="preview-item" style="background: rgba(102, 126, 234, 0.3); border-radius: 4px; flex: 1; display: flex; align-items: center; justify-content: center;">Header</div>
                    <div class="preview-item" style="background: rgba(118, 75, 162, 0.3); border-radius: 4px; flex: 2; display: flex; align-items: center; justify-content: center;">Content</div>
                    <div class="preview-item" style="background: rgba(255, 107, 107, 0.3); border-radius: 4px; flex: 1; display: flex; align-items: center; justify-content: center;">Footer</div>
                </div>
                <div style="margin-top: 10px; font-size: 0.8rem; color: var(--text-muted);">
                    Breakpoint: ${breakpoint}
                </div>
            `;
        }
        
        function generateCompactLayoutPreview(spacing, hideNonEssential) {
            return `
                <div class="preview-compact" style="
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: ${spacing}px;
                    height: 200px;
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 8px;
                    padding: ${spacing}px;
                ">
                    <div class="preview-item" style="background: rgba(102, 126, 234, 0.3); border-radius: 4px; padding: 8px; display: flex; align-items: center; justify-content: center;">Timer</div>
                    <div class="preview-item" style="background: rgba(118, 75, 162, 0.3); border-radius: 4px; padding: 8px; display: flex; align-items: center; justify-content: center;">Main Content</div>
                    ${!hideNonEssential ? '<div class="preview-item" style="background: rgba(255, 107, 107, 0.3); border-radius: 4px; padding: 8px; display: flex; align-items: center; justify-content: center;">Extra Info</div>' : ''}
                </div>
            `;
        }
        
        function generateCustomLayoutPreview(customJson) {
            try {
                const layout = JSON.parse(customJson);
                // For now, show a simple representation
                return `
                    <div class="preview-custom" style="
                        height: 200px;
                        border: 1px solid rgba(255,255,255,0.2);
                        border-radius: 8px;
                        padding: 10px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: rgba(102, 126, 234, 0.1);
                    ">
                        <div style="text-align: center;">
                            <div style="font-size: 1.2rem; margin-bottom: 10px;">Custom Layout</div>
                            <div style="font-size: 0.9rem; color: var(--text-muted);">
                                ${layout.layouts ? 'Valid layout configuration' : 'Basic custom layout'}
                            </div>
                        </div>
                    </div>
                `;
            } catch (error) {
                return `
                    <div class="preview-custom" style="
                        height: 200px;
                        border: 1px solid rgba(255, 107, 107, 0.5);
                        border-radius: 8px;
                        padding: 10px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: rgba(255, 107, 107, 0.1);
                    ">
                        <div style="text-align: center; color: var(--text-muted);">
                            <div style="font-size: 1.2rem; margin-bottom: 10px;">Invalid JSON</div>
                            <div style="font-size: 0.9rem;">Please check your layout configuration</div>
                        </div>
                    </div>
                `;
            }
        }
        
        function validateCustomLayout() {
            const customJson = document.getElementById('custom-layout-json')?.value || '{}';
            const resultsDiv = document.getElementById('layout-validation-results');
            
            if (!resultsDiv) return;
            
            try {
                // Use the layout validator if available
                if (window.LayoutValidator) {
                    const result = window.LayoutValidator.validateLayout(customJson);
                    if (result.valid) {
                        resultsDiv.innerHTML = `
                            <div class="validation-success" style="color: #28a745; margin-top: 10px;">
                                ✓ Layout configuration is valid
                            </div>
                        `;
                    } else {
                        resultsDiv.innerHTML = `
                            <div class="validation-error" style="color: #dc3545; margin-top: 10px;">
                                ✗ Layout validation failed:<br>
                                ${result.errors.map(e => `• ${e}`).join('<br>')}
                            </div>
                        `;
                    }
                } else {
                    // Fallback validation
                    JSON.parse(customJson);
                    resultsDiv.innerHTML = `
                        <div class="validation-success" style="color: #28a745; margin-top: 10px;">
                            ✓ JSON is valid
                        </div>
                    `;
                }
            } catch (error) {
                resultsDiv.innerHTML = `
                    <div class="validation-error" style="color: #dc3545; margin-top: 10px;">
                        ✗ Invalid JSON: ${error.message}
                    </div>
                `;
            }
        }
        
        function loadLayoutPreset() {
            const activeTab = document.querySelector('.layout-tab.active');
            const layoutType = activeTab ? activeTab.dataset.layout : 'default';
            
            const presets = {
                default: {
                    gridTemplate: '1fr 2fr',
                    gapSize: '10'
                },
                mobile: {
                    stackDirection: 'column',
                    breakpoint: '768px'
                },
                compact: {
                    spacing: '8',
                    hideNonEssential: true
                },
                custom: {
                    json: JSON.stringify({
                        layouts: {
                            default: {
                                grid: {
                                    template: '1fr 2fr',
                                    gap: '10px'
                                }
                            },
                            mobile: {
                                flex: {
                                    direction: 'column',
                                    breakpoint: '768px'
                                }
                            }
                        }
                    }, null, 2)
                }
            };
            
            const preset = presets[layoutType];
            if (!preset) return;
            
            switch (layoutType) {
                case 'default':
                    if (document.getElementById('default-grid-template')) {
                        document.getElementById('default-grid-template').value = preset.gridTemplate;
                    }
                    if (document.getElementById('default-gap-size')) {
                        document.getElementById('default-gap-size').value = preset.gapSize;
                        if (defaultGapValue) {
                            defaultGapValue.textContent = preset.gapSize + 'px';
                        }
                    }
                    break;
                    
                case 'mobile':
                    if (document.getElementById('mobile-stack-direction')) {
                        document.getElementById('mobile-stack-direction').value = preset.stackDirection;
                    }
                    if (document.getElementById('mobile-breakpoint')) {
                        document.getElementById('mobile-breakpoint').value = preset.breakpoint;
                    }
                    break;
                    
                case 'compact':
                    if (document.getElementById('compact-spacing')) {
                        document.getElementById('compact-spacing').value = preset.spacing;
                        if (compactSpacingValue) {
                            compactSpacingValue.textContent = preset.spacing + 'px';
                        }
                    }
                    if (document.getElementById('compact-hide-nonessential')) {
                        document.getElementById('compact-hide-nonessential').checked = preset.hideNonEssential;
                    }
                    break;
                    
                case 'custom':
                    if (document.getElementById('custom-layout-json')) {
                        document.getElementById('custom-layout-json').value = preset.json;
                    }
                    break;
            }
            
            updateLayoutPreview(layoutType);
        }
        
        function saveLayoutConfiguration() {
            const activeTab = document.querySelector('.layout-tab.active');
            const layoutType = activeTab ? activeTab.dataset.layout : 'default';
            
            let config = {};
            
            switch (layoutType) {
                case 'default':
                    config = {
                        type: 'grid',
                        template: document.getElementById('default-grid-template')?.value || '1fr 2fr',
                        gap: (document.getElementById('default-gap-size')?.value || '10') + 'px'
                    };
                    break;
                    
                case 'mobile':
                    config = {
                        type: 'flex',
                        direction: document.getElementById('mobile-stack-direction')?.value || 'column',
                        breakpoint: document.getElementById('mobile-breakpoint')?.value || '768px'
                    };
                    break;
                    
                case 'compact':
                    config = {
                        type: 'compact',
                        spacing: (document.getElementById('compact-spacing')?.value || '8') + 'px',
                        hideNonEssential: document.getElementById('compact-hide-nonessential')?.checked || true
                    };
                    break;
                    
                case 'custom':
                    try {
                        config = JSON.parse(document.getElementById('custom-layout-json')?.value || '{}');
                    } catch (error) {
                        alert('Invalid JSON in custom layout configuration');
                        return;
                    }
                    break;
            }
            
            // Save to localStorage for now (in a real app, this would be saved to the server)
            localStorage.setItem('quandary-layout-config', JSON.stringify({
                preset: layoutType,
                config: config,
                timestamp: Date.now()
            }));
            
            // Update the preset selector
            if (layoutPreset) {
                layoutPreset.value = layoutType;
            }
            
            // Show success message
            showNotification('Layout configuration saved successfully!', 'success');
            
            // Close modal
            closeLayoutModalHandler();
        }
        
        function updateLayoutInfo() {
            const selectedPreset = layoutPreset?.value || 'default';
            const infoElement = document.getElementById('layout-info');
            
            if (!infoElement) return;
            
            const descriptions = {
                default: 'Default grid layout with sidebar and main content areas',
                mobile: 'Mobile-optimized layout with responsive breakpoints',
                compact: 'Compact layout with reduced spacing and essential components only',
                custom: 'Custom layout configuration with JSON-defined structure'
            };
            
            infoElement.textContent = `Current: ${descriptions[selectedPreset]}`;
        }
        
        function showNotification(message, type = 'info') {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'success' ? 'var(--player-primary)' : 'var(--bg-medium)'};
                color: var(--text-light);
                padding: 1rem;
                border-radius: var(--border-radius);
                box-shadow: var(--shadow);
                z-index: 1000;
                animation: slideIn 0.3s ease-out;
            `;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            // Remove notification after 3 seconds
            setTimeout(() => {
                notification.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(() => {
                    if (document.body.contains(notification)) {
                        document.body.removeChild(notification);
                    }
                }, 300);
            }, 3000);
        }
        
        // Close modal when clicking outside
        window.addEventListener('click', function(event) {
            if (event.target === layoutModal) {
                closeLayoutModalHandler();
            }
        });
        
        // Initialize layout info on load
        updateLayoutInfo();
    });
    
    // Enhanced Layout Configuration with Schema Validation and Real-time Preview
    function initializeEnhancedLayoutControls() {
        // Add real-time validation to custom layout JSON
        const customLayoutJson = document.getElementById('custom-layout-json');
        if (customLayoutJson) {
            let validationTimeout;
            customLayoutJson.addEventListener('input', () => {
                clearTimeout(validationTimeout);
                validationTimeout = setTimeout(() => {
                    validateLayoutConfiguration(customLayoutJson.value);
                }, 500);
            });
        }
        
        // Add live preview toggle
        addLivePreviewControls();
        
        // Initialize WebSocket connection for real-time updates
        initializeLayoutWebSocket();
    }
    
    function addLivePreviewControls() {
        const layoutModal = document.getElementById('layout-modal');
        if (!layoutModal) return;
        
        const modalHeader = layoutModal.querySelector('.modal-header h2');
        if (modalHeader) {
            const livePreviewToggle = document.createElement('div');
            livePreviewToggle.className = 'live-preview-controls';
            livePreviewToggle.style.cssText = `
                display: flex;
                align-items: center;
                gap: 0.5rem;
                font-size: 0.9rem;
                margin-left: auto;
            `;
            livePreviewToggle.innerHTML = `
                <label class="checkbox-label">
                    <input type="checkbox" id="live-preview-toggle" checked>
                    <span>Live Preview</span>
                </label>
                <button id="apply-layout-preview" class="btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.8rem;">
                    Apply to Room
                </button>
            `;
            
            modalHeader.parentNode.appendChild(livePreviewToggle);
            
            // Add event listeners
            const livePreviewCheckbox = document.getElementById('live-preview-toggle');
            const applyLayoutBtn = document.getElementById('apply-layout-preview');
            
            livePreviewCheckbox.addEventListener('change', (e) => {
                window.layoutLivePreviewEnabled = e.target.checked;
                if (e.target.checked) {
                    updateLayoutPreviewInRealTime();
                }
            });
            
            applyLayoutBtn.addEventListener('click', applyLayoutToCurrentRoom);
        }
    }
    
    function validateLayoutConfiguration(jsonString) {
        const resultsDiv = document.getElementById('layout-validation-results');
        if (!resultsDiv) return;
        
        try {
            // Use the layout validator if available
            if (window.LayoutValidator && window.layoutValidator) {
                const result = window.layoutValidator.validateLayout(jsonString);
                displayValidationResults(resultsDiv, result);
            } else {
                // Fallback validation
                const parsed = JSON.parse(jsonString);
                const result = { valid: true, errors: [] };
                
                // Basic validation
                if (!parsed.layouts) {
                    result.valid = false;
                    result.errors.push('Missing "layouts" object');
                }
                
                if (parsed.layouts && !parsed.layouts.default) {
                    result.valid = false;
                    result.errors.push('Missing "default" layout');
                }
                
                displayValidationResults(resultsDiv, result);
            }
        } catch (error) {
            displayValidationResults(resultsDiv, {
                valid: false,
                errors: [`Invalid JSON: ${error.message}`]
            });
        }
    }
    
    function displayValidationResults(container, result) {
        if (result.valid) {
            container.innerHTML = `
                <div class="validation-success" style="color: #28a745; margin-top: 10px; padding: 0.5rem; background: rgba(40, 167, 69, 0.1); border-radius: 4px;">
                    ✓ Layout configuration is valid
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="validation-error" style="color: #dc3545; margin-top: 10px; padding: 0.5rem; background: rgba(220, 53, 69, 0.1); border-radius: 4px;">
                    ✗ Layout validation failed:<br>
                    ${result.errors.map(e => `• ${e}`).join('<br>')}
                </div>
            `;
        }
    }
    
    function updateLayoutPreviewInRealTime() {
        if (!window.layoutLivePreviewEnabled) return;
        
        const activeTab = document.querySelector('.layout-tab.active');
        if (!activeTab) return;
        
        const layoutType = activeTab.dataset.layout;
        const layoutConfig = gatherLayoutConfiguration(layoutType);
        
        if (layoutConfig) {
            // Send preview update to connected rooms via WebSocket
            broadcastLayoutPreview(layoutConfig);
            
            // Update local preview
            updateLayoutPreview(layoutType);
        }
    }
    
    function gatherLayoutConfiguration(layoutType) {
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
    
    function initializeLayoutWebSocket() {
        // Initialize WebSocket connection for real-time layout updates
        if (typeof io !== 'undefined') {
            window.layoutSocket = io();
            
            window.layoutSocket.on('layout_preview', (data) => {
                console.log('Received layout preview update:', data);
                // Handle incoming layout preview updates
            });
            
            window.layoutSocket.on('layout_updated', (data) => {
                console.log('Layout configuration updated:', data);
                showNotification('Layout configuration updated successfully!', 'success');
            });
        }
    }
    
    function broadcastLayoutPreview(layoutConfig) {
        if (window.layoutSocket) {
            window.layoutSocket.emit('layout_preview', {
                layout: layoutConfig,
                timestamp: new Date().toISOString(),
                source: 'admin'
            });
        }
    }
    
    function applyLayoutToCurrentRoom() {
        const activeTab = document.querySelector('.layout-tab.active');
        if (!activeTab) return;
        
        const layoutType = activeTab.dataset.layout;
        const layoutConfig = gatherLayoutConfiguration(layoutType);
        
        if (!layoutConfig) {
            showNotification('Invalid layout configuration', 'error');
            return;
        }
        
        // Get current room ID (this would need to be set when editing a specific room)
        const currentRoomId = window.currentEditingRoomId || getCurrentRoomId();
        
        if (!currentRoomId) {
            showNotification('No room selected for layout application', 'error');
            return;
        }
        
        // Apply layout to room via API
        fetch(`/api/rooms/${currentRoomId}/layout`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ layout: layoutConfig })
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                showNotification('Layout applied to room successfully!', 'success');
                closeLayoutModalHandler();
            } else {
                showNotification(`Failed to apply layout: ${result.error}`, 'error');
            }
        })
        .catch(error => {
            console.error('Error applying layout:', error);
            showNotification('Error applying layout to room', 'error');
        });
    }
    
    function getCurrentRoomId() {
        // Try to get room ID from current context
        const roomCards = document.querySelectorAll('.room-card');
        if (roomCards.length > 0) {
            // Return the first room ID as fallback
            const firstCard = roomCards[0];
            const roomLink = firstCard.querySelector('.room-link');
            if (roomLink) {
                const href = roomLink.getAttribute('href');
                const match = href.match(/\/room\/([^\/]+)\//);
                return match ? match[1] : null;
            }
        }
        return null;
    }

    
    // Enhanced preset management
    function loadLayoutPresetFromServer(presetName) {
        fetch('/api/layout/presets')
            .then(response => response.json())
            .then(result => {
                if (result.success && result.data[presetName]) {
                    const preset = result.data[presetName];
                    applyPresetToForm(preset);
                    showNotification(`Loaded preset: ${preset.name}`, 'success');
                } else {
                    showNotification('Preset not found', 'error');
                }
            })
            .catch(error => {
                console.error('Error loading preset:', error);
                showNotification('Error loading preset', 'error');
            });
    }
    
    function applyPresetToForm(preset) {
        if (!preset.layout) return;
        
        const layout = preset.layout;
        
        // Switch to appropriate tab based on layout type
        if (layout.type) {
            const targetTab = document.querySelector(`[data-layout="${layout.type}"]`);
            if (targetTab) {
                targetTab.click();
            }
        }
        
        // Apply preset configuration to form fields
        if (layout.grid) {
            const templateField = document.getElementById('default-grid-template');
            const gapField = document.getElementById('default-gap-size');
            
            if (templateField && layout.grid.template) {
                templateField.value = layout.grid.template;
            }
            if (gapField && layout.grid.gap) {
                const gapValue = layout.grid.gap.replace('px', '');
                gapField.value = gapValue;
                const gapDisplay = document.getElementById('default-gap-value');
                if (gapDisplay) {
                    gapDisplay.textContent = layout.grid.gap;
                }
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
        
        // Update preview
        updateLayoutPreviewInRealTime();
    }
    
    // Initialize enhanced layout controls
    initializeEnhancedLayoutControls();
    
    // Global flag for live preview
    window.layoutLivePreviewEnabled = true;
});
// Theme preview functionality
document.addEventListener('DOMContentLoaded', function() {
    const previewThemeBtn = document.getElementById('preview-theme-btn');
    const applyThemeBtn = document.getElementById('apply-theme-btn');
    const themePreviewModal = document.getElementById('theme-preview-modal');
    const closePreviewModal = document.getElementById('close-preview-modal');
    const closePreviewBtn = document.getElementById('close-preview-btn');
    const applyPreviewThemeBtn = document.getElementById('apply-preview-theme-btn');
    const themePreviewContent = document.getElementById('theme-preview-content');
    
    if (previewThemeBtn) {
        previewThemeBtn.addEventListener('click', function() {
            const themeManager = window.themeManager;
            const currentTheme = themeManager.getCurrentTheme();
            const theme = themeManager.getTheme(currentTheme);
            
            if (theme) {
                showThemePreview(theme);
            }
        });
    }
    
    if (applyThemeBtn) {
        applyThemeBtn.addEventListener('click', function() {
            const themeManager = window.themeManager;
            const currentTheme = themeManager.getCurrentTheme();
            
            // Show confirmation dialog
            if (confirm(`Are you sure you want to apply the "${themeManager.getTheme(currentTheme).name}" theme to all rooms?`)) {
                // Apply theme to all rooms (this would typically involve an API call)
                applyThemeToAllRooms(currentTheme);
                
                // Show success notification
                showNotification('Theme applied to all rooms successfully!', 'success');
            }
        });
    }
    
    if (closePreviewModal) {
        closePreviewModal.addEventListener('click', closeThemePreview);
    }
    
    if (closePreviewBtn) {
        closePreviewBtn.addEventListener('click', closeThemePreview);
    }
    
    if (applyPreviewThemeBtn) {
        applyPreviewThemeBtn.addEventListener('click', function() {
            const themeManager = window.themeManager;
            const currentTheme = themeManager.getCurrentTheme();
            
            // Apply theme to all rooms
            applyThemeToAllRooms(currentTheme);
            
            // Close preview
            closeThemePreview();
            
            // Show success notification
            showNotification('Theme applied to all rooms successfully!', 'success');
        });
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === themePreviewModal) {
            closeThemePreview();
        }
    });
    
    function showThemePreview(theme) {
        const themePreviewModal = document.getElementById('theme-preview-modal');
        const themePreviewContent = document.getElementById('theme-preview-content');
        
        // Create preview content
        const previewHTML = `
            <div class="theme-preview-container" style="background: var(--bg-dark); color: var(--text-light); padding: 2rem; border-radius: var(--border-radius);">
                <h3 style="margin-top: 0; background: var(--player-primary); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                    ${theme.name} Theme Preview
                </h3>
                <p style="color: var(--text-muted); margin-bottom: 2rem;">${theme.description}</p>
                
                <div class="preview-section" style="margin-bottom: 2rem;">
                    <h4 style="color: var(--accent-color); margin-bottom: 1rem;">Color Palette</h4>
                    <div class="color-palette" style="display: flex; gap: 1rem; flex-wrap: wrap;">
                        ${Object.entries(theme.colors).map(([key, value]) => `
                            <div class="color-swatch" style="text-align: center;">
                                <div class="color-box" style="width: 60px; height: 60px; background: ${value}; border-radius: 8px; margin-bottom: 0.5rem; border: 2px solid rgba(255,255,255,0.1);"></div>
                                <div style="font-size: 0.8rem; color: var(--text-muted);">${key.replace('-', ' ')}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="preview-section" style="margin-bottom: 2rem;">
                    <h4 style="color: var(--accent-color); margin-bottom: 1rem;">UI Elements</h4>
                    <div class="ui-elements" style="display: flex; gap: 1rem; flex-wrap: wrap;">
                        <button class="nav-button" style="background: var(--player-primary); color: var(--text-light); border: none; padding: 0.8rem 1.5rem; border-radius: 30px; cursor: pointer; font-weight: 600;">Primary Button</button>
                        <button class="nav-button secondary" style="background: var(--bg-medium); color: var(--text-muted); border: none; padding: 0.8rem 1.5rem; border-radius: 30px; cursor: pointer; font-weight: 600;">Secondary Button</button>
                        <div class="state-card" style="background: var(--bg-card); backdrop-filter: blur(10px); border-radius: var(--border-radius); padding: 1rem; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: var(--shadow);">
                            <div style="color: var(--accent-color); font-weight: 600;">Sample Card</div>
                            <div style="color: var(--text-muted); font-size: 0.9rem;">This is a sample card with the theme applied</div>
                        </div>
                    </div>
                </div>
                
                <div class="preview-section">
                    <h4 style="color: var(--accent-color); margin-bottom: 1rem;">Typography</h4>
                    <div class="typography-samples">
                        <h1 style="margin: 0 0 0.5rem 0; color: var(--text-light);">Heading 1</h1>
                        <h2 style="margin: 0 0 0.5rem 0; color: var(--text-light);">Heading 2</h2>
                        <p style="margin: 0 0 1rem 0; color: var(--text-light);">This is a paragraph of text with the theme colors applied. It demonstrates how readable the text is with the selected color scheme.</p>
                        <p style="margin: 0; color: var(--text-muted);">This is muted text for secondary information.</p>
                    </div>
                </div>
            </div>
        `;
        
        themePreviewContent.innerHTML = previewHTML;
        themePreviewModal.style.display = 'block';
        
        // Apply the theme to the preview content
        const themeManager = window.themeManager;
        themeManager.applyTheme(themeManager.getCurrentTheme());
    }
    
    function closeThemePreview() {
        const themePreviewModal = document.getElementById('theme-preview-modal');
        themePreviewModal.style.display = 'none';
    }
    
    function applyThemeToAllRooms(themeName) {
        // This function would typically make an API call to apply the theme to all rooms
        // For now, we'll just save it to localStorage and show a notification
        localStorage.setItem('quandary-global-theme', themeName);
        
        // In a real implementation, this would be an API call like:
        // fetch('/api/theme/global', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ theme: themeName })
        // });
    }
    
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? 'var(--player-primary)' : 'var(--bg-medium)'};
            color: var(--text-light);
            padding: 1rem;
            border-radius: var(--border-radius);
            box-shadow: var(--shadow);
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
});