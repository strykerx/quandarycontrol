/**
 * Variable Management System
 * Handles variables, triggers, and actions for rooms
 */
class VariableManager {
    constructor() {
        this.currentRoomId = null;
        this.variables = {};
        this.triggers = [];
        this.currentTrigger = null;
        this.currentActionType = null;
        this.triggerActions = [];
        this.editingVariable = null; // Track which variable we're editing

        this.init();
    }

    init() {
        this.bindEvents();
    }
    
    async loadAudioFiles() {
        try {
            if (!this.currentRoomId) return [];
            
            const response = await fetch(`/api/rooms/${this.currentRoomId}/notifications/audio`);
            const data = await response.json();
            
            if (data.success) {
                return data.data;
            }
            return [];
        } catch (error) {
            console.error('Error loading audio files:', error);
            return [];
        }
    }
    
    async loadMediaFiles() {
        try {
            if (!this.currentRoomId) return [];
            
            const response = await fetch(`/api/rooms/${this.currentRoomId}/media`);
            const data = await response.json();
            
            if (data.success) {
                return data.data;
            }
            return [];
        } catch (error) {
            console.error('Error loading media files:', error);
            return [];
        }
    }

    // Modal helper functions
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('show');
            document.body.style.overflow = '';
        }
    }

    showToast(message, type = 'success') {
        // Simple toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#28a745' : '#dc3545'};
            color: white;
            padding: 12px 24px;
            border-radius: 4px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    bindEvents() {
        // Tab switching
        document.querySelectorAll('.variable-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Variable management
        document.getElementById('add-variable-btn')?.addEventListener('click', () => this.openVariableForm());
        document.getElementById('save-variables-btn')?.addEventListener('click', () => this.saveAllChanges());

        // Trigger management
        document.getElementById('add-trigger-btn')?.addEventListener('click', () => this.openTriggerForm());
        document.getElementById('save-trigger-form-btn')?.addEventListener('click', (e) => this.saveTrigger(e));

        // Action management for triggers
        document.getElementById('add-action-to-trigger')?.addEventListener('click', () => this.openActionSelection());
        
        // Action type selection
        document.querySelectorAll('.action-type-card').forEach(card => {
            card.addEventListener('click', (e) => this.selectActionType(e.currentTarget.dataset.action));
        });

        // Modal close handlers
        document.getElementById('close-trigger-form-modal')?.addEventListener('click', () => this.closeTriggerForm());
        document.getElementById('cancel-trigger-form-btn')?.addEventListener('click', () => this.closeTriggerForm());
        document.getElementById('close-action-selection-modal')?.addEventListener('click', () => this.closeActionSelection());
        document.getElementById('close-action-config-modal')?.addEventListener('click', () => this.closeActionConfig());
        document.getElementById('cancel-action-config-btn')?.addEventListener('click', () => this.closeActionConfig());
        document.getElementById('save-action-config-btn')?.addEventListener('click', (e) => this.saveActionConfig(e));
        
        // Variable form handlers
        document.getElementById('save-variable-form-btn')?.addEventListener('click', (e) => this.saveVariableForm(e));
        document.getElementById('variable-form')?.addEventListener('submit', (e) => this.saveVariableForm(e));
        document.getElementById('close-variable-form-modal')?.addEventListener('click', () => this.closeVariableForm());
        document.getElementById('cancel-variable-form-btn')?.addEventListener('click', () => this.closeVariableForm());
        
        // Modal backdrop click handlers
        document.getElementById('variable-form-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'variable-form-modal') {
                this.closeVariableForm();
            }
        });

        // Main variable modal close handlers
        document.getElementById('close-variable-modal')?.addEventListener('click', () => this.hideModal('variable-modal'));
        document.getElementById('cancel-variable-btn')?.addEventListener('click', () => this.hideModal('variable-modal'));
        
        // Modal backdrop click for main variable modal
        document.getElementById('variable-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'variable-modal') {
                this.hideModal('variable-modal');
            }
        });
    }

    setCurrentRoom(roomId) {
        this.currentRoomId = roomId;
        this.loadRoomData();
    }

    async loadRoomData() {
        if (!this.currentRoomId) return;

        try {
            // Load variables from room's api_variables field
            const roomResponse = await fetch(`/api/rooms/${this.currentRoomId}`);
            let roomData = null;

            if (roomResponse.ok) {
                roomData = await roomResponse.json();
                this.variables = {};

                if (roomData.success && roomData.data && roomData.data.api_variables) {
                    try {
                        const apiVariables = JSON.parse(roomData.data.api_variables);
                        Object.entries(apiVariables).forEach(([name, value]) => {
                            // Determine type from the value
                            let type = 'string';
                            if (typeof value === 'object' && value !== null) {
                                if (value.type && value.value !== undefined) {
                                    // This is a structured variable (like system variables)
                                    this.variables[name] = value;
                                    return;
                                } else if (Array.isArray(value)) {
                                    type = 'array';
                                } else {
                                    type = 'object';
                                }
                            } else if (typeof value === 'boolean') {
                                type = 'boolean';
                            } else if (typeof value === 'number') {
                                type = 'number';
                            }

                            // For simple variables, create the structure
                            this.variables[name] = {
                                type: type,
                                value: value
                            };
                        });
                    } catch (e) {
                        console.warn('Error parsing api_variables:', e);
                    }
                }
            }

            // Add default timer variables
            this.addDefaultTimerVariables();

            // Load triggers from room config (use the same roomData we already fetched)
            if (roomData && roomData.success && roomData.data && roomData.data.config) {
                try {
                    const config = JSON.parse(roomData.data.config);
                    this.triggers = config.triggers || [];
                } catch (e) {
                    this.triggers = [];
                }
            } else {
                this.triggers = [];
            }
            
            this.render();
        } catch (error) {
            console.error('Error loading room data:', error);
        }
    }

    addDefaultTimerVariables() {
        const defaultTimers = {
            'timer_main': { type: 'number', value: 0, system: true },
            'timer_secondary': { type: 'number', value: 0, system: true },
            'timer_main_remaining': { type: 'number', value: 0, system: true },
            'timer_secondary_remaining': { type: 'number', value: 0, system: true }
        };

        Object.entries(defaultTimers).forEach(([name, config]) => {
            if (!this.variables[name]) {
                this.variables[name] = config;
            }
        });
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.variable-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.variable-tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });

        // Render content for the active tab
        if (tabName === 'api-docs') {
            this.renderApiDocumentation();
        }
    }

    render() {
        this.renderVariables();
        this.renderTriggers();
        this.renderApiDocumentation();
    }

    renderVariables() {
        const container = document.getElementById('variables-list');
        if (!container) return;

        container.innerHTML = '';

        Object.entries(this.variables).forEach(([name, config]) => {
            const variableDiv = document.createElement('div');
            variableDiv.className = `variable-item ${config.system ? 'system-variable' : ''}`;
            
            const triggerCount = this.triggers.filter(t => t.variable === name).length;
            
            variableDiv.innerHTML = `
                <div class="variable-info-section">
                    <div class="variable-name">
                        ${name}
                        ${config.system ? '<span class="system-variable-badge">SYSTEM</span>' : ''}
                    </div>
                    <div class="variable-type-value">
                        <span class="variable-type">${config.type}</span>
                        <span class="variable-value">${JSON.stringify(config.value)}</span>
                    </div>
                    <div class="variable-triggers-count">
                        ${triggerCount} trigger(s) watching this variable
                    </div>
                </div>
                <div class="variable-actions">
                    ${!config.system ? `
                        <button class="btn-edit-variable" data-variable="${name}">Edit</button>
                        <button class="btn-delete-variable" data-variable="${name}">Delete</button>
                    ` : '<span class="system-variable-badge">Read-Only</span>'}
                </div>
            `;

            container.appendChild(variableDiv);
        });

        // Bind edit and delete handlers
        container.querySelectorAll('.btn-edit-variable').forEach(btn => {
            btn.addEventListener('click', (e) => this.editVariable(e.target.dataset.variable));
        });
        
        container.querySelectorAll('.btn-delete-variable').forEach(btn => {
            btn.addEventListener('click', (e) => this.deleteVariable(e.target.dataset.variable));
        });
    }

    renderTriggers() {
        const container = document.getElementById('triggers-list');
        if (!container) return;

        container.innerHTML = '';

        if (this.triggers.length === 0) {
            container.innerHTML = '<p class="text-center text-muted">No triggers configured. Click "Add Trigger" to create your first automation rule.</p>';
            return;
        }

        this.triggers.forEach((trigger, index) => {
            const triggerDiv = document.createElement('div');
            triggerDiv.className = 'trigger-item';
            
            const actionTags = trigger.actions.map(action => 
                `<span class="action-tag">${action.type.replace('_', ' ')}</span>`
            ).join('');
            
            triggerDiv.innerHTML = `
                <div class="trigger-header">
                    <div class="trigger-name">${trigger.name}</div>
                    <div class="trigger-actions">
                        <button class="btn-edit-trigger" data-trigger="${index}">Edit</button>
                        <button class="btn-delete-trigger" data-trigger="${index}">Delete</button>
                    </div>
                </div>
                <div class="trigger-condition">
                    When <strong>${trigger.variable}</strong> ${trigger.condition.replace('_', ' ')} <strong>${trigger.value}</strong>
                </div>
                <div class="trigger-actions-preview">
                    ${actionTags}
                </div>
            `;

            container.appendChild(triggerDiv);
        });

        // Bind edit and delete handlers for triggers
        container.querySelectorAll('.btn-edit-trigger').forEach(btn => {
            btn.addEventListener('click', (e) => this.editTrigger(parseInt(e.target.dataset.trigger)));
        });
        
        container.querySelectorAll('.btn-delete-trigger').forEach(btn => {
            btn.addEventListener('click', (e) => this.deleteTrigger(parseInt(e.target.dataset.trigger)));
        });
    }

    renderApiDocumentation() {
        const container = document.getElementById('api-endpoints');
        if (!container) return;

        const roomId = this.currentRoomId || '{roomId}';
        const variables = Object.keys(this.variables);
        
        container.innerHTML = `
            <!-- Get All Variables -->
            <div class="api-endpoint">
                <div class="api-endpoint-header">
                    <span class="http-method get">GET</span>
                    <span class="api-endpoint-url">/api/rooms/${roomId}/variables</span>
                </div>
                <div class="api-endpoint-body">
                    <p>Retrieve all variables for this room</p>
                    <div class="api-example">
                        <div class="api-example-title">Example Response:</div>
                        <pre>{
  "success": true,
  "data": [
    {
      "name": "door_open",
      "type": "boolean",
      "value": false
    }
  ]
}</pre>
                    </div>
                </div>
            </div>

            <!-- Set Variable Value -->
            <div class="api-endpoint">
                <div class="api-endpoint-header">
                    <span class="http-method post">POST</span>
                    <span class="api-endpoint-url">/api/rooms/${roomId}/variables/{variableName}</span>
                </div>
                <div class="api-endpoint-body">
                    <p>Update a specific variable's value</p>
                    <div class="api-example">
                        <div class="api-example-title">Example Request:</div>
                        <pre>curl -X POST /api/rooms/${roomId}/variables/door_open \\
  -H "Content-Type: application/json" \\
  -d '{"value": true, "type": "boolean"}'</pre>
                    </div>
                </div>
            </div>

            <!-- Create Variable -->
            <div class="api-endpoint">
                <div class="api-endpoint-header">
                    <span class="http-method post">POST</span>
                    <span class="api-endpoint-url">/api/rooms/${roomId}/variables</span>
                </div>
                <div class="api-endpoint-body">
                    <p>Create a new variable</p>
                    <div class="api-example">
                        <div class="api-example-title">Example Request:</div>
                        <pre>curl -X POST /api/rooms/${roomId}/variables \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "puzzle_solved",
    "type": "boolean",
    "value": false
  }'</pre>
                    </div>
                </div>
            </div>

            ${variables.length > 0 ? `
            <!-- Variable-specific Examples -->
            <div class="api-endpoint">
                <div class="api-endpoint-header">
                    <span class="http-method post">POST</span>
                    <span class="api-endpoint-url">Variable-Specific Examples</span>
                </div>
                <div class="api-endpoint-body">
                    <p>Examples for your current variables:</p>
                    ${variables.map(varName => `
                        <div class="api-example">
                            <div class="api-example-title">Set ${varName}:</div>
                            <pre>curl -X POST /api/rooms/${roomId}/variables/${varName} \\
  -H "Content-Type: application/json" \\
  -d '{"value": ${this.getExampleValue(this.variables[varName].type)}}'</pre>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
        `;
    }

    getExampleValue(type) {
        switch (type) {
            case 'boolean': return 'true';
            case 'number': return '42';
            case 'string': return '"example"';
            case 'array': return '[1, 2, 3]';
            case 'object': return '{"key": "value"}';
            default: return '"example"';
        }
    }

    openVariableForm(variableName = null) {
        // Track which variable we're editing
        this.editingVariable = variableName;

        // Reuse existing variable form modal
        if (variableName) {
            document.getElementById('variable-form-title').textContent = 'Edit Variable';
            document.getElementById('variable-name').value = variableName;
            document.getElementById('variable-name').disabled = true; // Disable name editing
            document.getElementById('variable-type').value = this.variables[variableName].type;
            document.getElementById('variable-value').value = JSON.stringify(this.variables[variableName].value);
            document.getElementById('save-variable-form-btn').textContent = 'Update Variable';
        } else {
            document.getElementById('variable-form-title').textContent = 'Add Variable';
            document.getElementById('variable-name').value = '';
            document.getElementById('variable-name').disabled = false;
            document.getElementById('variable-type').value = 'string';
            document.getElementById('variable-value').value = '';
            document.getElementById('save-variable-form-btn').textContent = 'Add Variable';
        }

        this.showModal('variable-form-modal');
    }

    closeVariableForm() {
        this.hideModal('variable-form-modal');
        this.editingVariable = null;
        // Reset form button text
        document.getElementById('save-variable-form-btn').textContent = 'Add Variable';
        // Re-enable name field
        document.getElementById('variable-name').disabled = false;
    }

    openTriggerForm() {
        // Populate variable dropdown
        const select = document.getElementById('trigger-variable');
        select.innerHTML = '<option value="">Select a variable...</option>';
        
        Object.keys(this.variables).forEach(varName => {
            const option = document.createElement('option');
            option.value = varName;
            option.textContent = varName;
            select.appendChild(option);
        });

        // Clear form
        document.getElementById('trigger-name').value = '';
        document.getElementById('trigger-condition').value = 'equals';
        document.getElementById('trigger-value').value = '';
        document.getElementById('trigger-actions-container').innerHTML = '';
        this.triggerActions = [];

        this.showModal('trigger-form-modal');
    }

    closeTriggerForm() {
        this.hideModal('trigger-form-modal');
        this.currentTrigger = null;
        this.triggerActions = [];
    }

    openActionSelection() {
        this.showModal('action-selection-modal');
    }

    closeActionSelection() {
        this.hideModal('action-selection-modal');
    }

    selectActionType(actionType) {
        this.currentActionType = actionType;
        this.hideModal('action-selection-modal');
        this.openActionConfig(actionType);
    }

    async openActionConfig(actionType) {
        const title = document.getElementById('action-config-title');
        const fields = document.getElementById('action-config-fields');
        
        title.textContent = `Configure ${actionType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Action`;
        
        // Show loading message first
        fields.innerHTML = '<div class="loading">Loading...</div>';
        this.showModal('action-config-modal');
        
        // Load the actual fields
        fields.innerHTML = await this.getActionConfigFields(actionType);
        
        // Set up event listeners for the new elements
        this.setupActionConfigEventListeners();
    }

    async getActionConfigFields(actionType) {
        switch (actionType) {
            case 'play_sound':
                const audioFiles = await this.loadAudioFiles();
                const audioOptions = audioFiles.map(file => 
                    `<option value="${file.id}">${file.original_name}</option>`
                ).join('');
                
                return `
                    <div class="form-group">
                        <label for="sound-file">Sound File</label>
                        <select id="sound-file" class="form-input">
                            ${audioOptions}
                            <option value="upload_new">Upload New File...</option>
                        </select>
                    </div>
                    ${audioFiles.length === 0 ? `
                    <div class="alert alert-warning">
                        <p>No audio files found. Click "Upload New File..." to add sound files for notifications.</p>
                    </div>
                    ` : ''}
                    <div class="form-group">
                        <label for="sound-volume">Volume (0-100)</label>
                        <input type="range" id="sound-volume" class="form-input" min="0" max="100" value="50">
                        <span id="volume-display">50</span>%
                    </div>
                    <div class="form-group" id="audio-upload-section" style="display: none;">
                        <label for="audio-file-input">Upload Audio File</label>
                        <input type="file" id="audio-file-input" class="form-input" accept="audio/*">
                        <button type="button" id="upload-audio-btn" class="btn btn-secondary">Upload</button>
                    </div>
                `;
            case 'show_media':
                const mediaFiles = await this.loadMediaFiles();
                const mediaOptions = mediaFiles.map(file => 
                    `<option value="${file.url}">${file.title || file.url.split('/').pop()}</option>`
                ).join('');
                
                return `
                    <div class="form-group">
                        <label for="media-file">Media File</label>
                        <select id="media-file" class="form-input">
                            ${mediaOptions}
                            <option value="custom">Custom URL...</option>
                        </select>
                    </div>
                    ${mediaFiles.length === 0 ? `
                    <div class="alert alert-warning">
                        <p>No media files found. Upload media files first through the room management interface.</p>
                    </div>
                    ` : ''}
                    <div class="form-group" id="custom-media-url" style="display: none;">
                        <label for="custom-media-input">Custom Media URL</label>
                        <input type="text" id="custom-media-input" class="form-input" placeholder="uploads/image.jpg">
                    </div>
                    <div class="form-group">
                        <label for="media-duration">Display Duration (seconds)</label>
                        <input type="number" id="media-duration" class="form-input" value="5">
                    </div>
                `;
            case 'set_variable':
                return `
                    <div class="form-group">
                        <label for="target-variable">Target Variable</label>
                        <select id="target-variable" class="form-input">
                            ${Object.keys(this.variables).map(name => 
                                `<option value="${name}">${name}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="new-value">New Value</label>
                        <input type="text" id="new-value" class="form-input" placeholder="Enter new value">
                    </div>
                `;
            case 'timer_control':
                return `
                    <div class="form-group">
                        <label for="timer-action">Timer Action</label>
                        <select id="timer-action" class="form-input">
                            <option value="start">Start Timer</option>
                            <option value="pause">Pause Timer</option>
                            <option value="stop">Stop Timer</option>
                            <option value="add">Add Time</option>
                            <option value="subtract">Subtract Time</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="timer-amount">Time Amount (seconds)</label>
                        <input type="number" id="timer-amount" class="form-input" value="60">
                    </div>
                `;
            case 'send_webhook':
                return `
                    <div class="form-group">
                        <label for="webhook-url">Webhook URL</label>
                        <input type="url" id="webhook-url" class="form-input" placeholder="https://example.com/webhook">
                    </div>
                    <div class="form-group">
                        <label for="webhook-method">HTTP Method</label>
                        <select id="webhook-method" class="form-input">
                            <option value="POST">POST</option>
                            <option value="GET">GET</option>
                            <option value="PUT">PUT</option>
                        </select>
                    </div>
                `;
            case 'show_message':
                return `
                    <div class="form-group">
                        <label for="message-text">Message Text</label>
                        <textarea id="message-text" class="form-input" rows="3" placeholder="Enter message to display"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="message-duration">Display Duration (seconds)</label>
                        <input type="number" id="message-duration" class="form-input" value="3">
                    </div>
                `;
            default:
                return '<p>Configuration options for this action type are not yet implemented.</p>';
        }
    }

    closeActionConfig() {
        this.hideModal('action-config-modal');
    }

    saveActionConfig(e) {
        e.preventDefault();
        
        const actionConfig = this.collectActionConfig();
        if (!actionConfig) return;
        
        this.triggerActions.push(actionConfig);
        this.renderTriggerActions();
        this.closeActionConfig();
    }

    collectActionConfig() {
        const actionType = this.currentActionType;
        const config = { type: actionType };
        
        switch (actionType) {
            case 'play_sound':
                config.file = document.getElementById('sound-file')?.value;
                config.volume = document.getElementById('sound-volume')?.value;
                break;
            case 'show_media':
                const mediaFileValue = document.getElementById('media-file')?.value;
                if (mediaFileValue === 'custom') {
                    config.file = document.getElementById('custom-media-input')?.value;
                } else {
                    config.file = mediaFileValue;
                }
                config.duration = document.getElementById('media-duration')?.value;
                break;
            case 'set_variable':
                config.variable = document.getElementById('target-variable')?.value;
                config.value = document.getElementById('new-value')?.value;
                break;
            case 'timer_control':
                config.action = document.getElementById('timer-action')?.value;
                config.amount = document.getElementById('timer-amount')?.value;
                break;
            case 'send_webhook':
                config.url = document.getElementById('webhook-url')?.value;
                config.method = document.getElementById('webhook-method')?.value;
                break;
            case 'show_message':
                config.text = document.getElementById('message-text')?.value;
                config.duration = document.getElementById('message-duration')?.value;
                break;
        }
        
        return config;
    }

    renderTriggerActions() {
        const container = document.getElementById('trigger-actions-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.triggerActions.forEach((action, index) => {
            const actionDiv = document.createElement('div');
            actionDiv.className = 'trigger-action-item';
            
            actionDiv.innerHTML = `
                <div class="action-details">
                    <div class="action-type">${action.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
                    <div class="action-config">${this.getActionDescription(action)}</div>
                </div>
                <button class="btn-remove-action" data-index="${index}">×</button>
            `;
            
            container.appendChild(actionDiv);
        });
        
        // Bind remove handlers
        container.querySelectorAll('.btn-remove-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.triggerActions.splice(index, 1);
                this.renderTriggerActions();
            });
        });
    }

    getActionDescription(action) {
        switch (action.type) {
            case 'play_sound':
                return `Play ${action.file} at ${action.volume}% volume`;
            case 'show_media':
                return `Show ${action.file} for ${action.duration}s`;
            case 'set_variable':
                return `Set ${action.variable} = ${action.value}`;
            case 'timer_control':
                return `${action.action} timer by ${action.amount}s`;
            case 'send_webhook':
                return `${action.method} ${action.url}`;
            case 'show_message':
                return `Display "${action.text}" for ${action.duration}s`;
            default:
                return 'Custom action';
        }
    }

    saveTrigger(e) {
        e.preventDefault();
        
        const triggerData = {
            name: document.getElementById('trigger-name').value,
            variable: document.getElementById('trigger-variable').value,
            condition: document.getElementById('trigger-condition').value,
            value: document.getElementById('trigger-value').value,
            actions: [...this.triggerActions]
        };
        
        if (!triggerData.name || !triggerData.variable || !triggerData.value) {
            alert('Please fill in all required fields');
            return;
        }
        
        if (triggerData.actions.length === 0) {
            alert('Please add at least one action to the trigger');
            return;
        }
        
        if (this.currentTrigger !== null) {
            // Update existing trigger
            this.triggers[this.currentTrigger] = triggerData;
        } else {
            // Add new trigger
            this.triggers.push(triggerData);
        }
        
        this.renderTriggers();
        this.closeTriggerForm();
    }

    editVariable(variableName) {
        this.openVariableForm(variableName);
    }

    deleteVariable(variableName) {
        if (confirm(`Are you sure you want to delete the variable "${variableName}"?`)) {
            delete this.variables[variableName];
            this.renderVariables();
        }
    }

    editTrigger(triggerIndex) {
        const trigger = this.triggers[triggerIndex];
        if (!trigger) return;

        // Populate the form with existing trigger data
        document.getElementById('trigger-name').value = trigger.name;
        document.getElementById('trigger-variable').innerHTML = '<option value="">Select a variable...</option>';
        
        Object.keys(this.variables).forEach(varName => {
            const option = document.createElement('option');
            option.value = varName;
            option.textContent = varName;
            option.selected = varName === trigger.variable;
            document.getElementById('trigger-variable').appendChild(option);
        });

        document.getElementById('trigger-condition').value = trigger.condition;
        document.getElementById('trigger-value').value = trigger.value;
        
        // Set up the actions
        this.triggerActions = [...trigger.actions];
        this.renderTriggerActions();

        // Store the trigger index for updating
        this.currentTrigger = triggerIndex;

        this.showModal('trigger-form-modal');
    }

    deleteTrigger(triggerIndex) {
        const trigger = this.triggers[triggerIndex];
        if (!trigger) return;

        if (confirm(`Are you sure you want to delete the trigger "${trigger.name}"?`)) {
            this.triggers.splice(triggerIndex, 1);
            this.renderTriggers();
        }
    }

    async saveAllChanges() {
        if (!this.currentRoomId) {
            alert('No room selected');
            return;
        }

        try {
            // Get current room data to check what variables existed before
            const roomResponse = await fetch(`/api/rooms/${this.currentRoomId}`);
            const roomData = await roomResponse.json();

            let roomConfig = {};
            let existingApiVariables = {};

            if (roomData.success && roomData.data) {
                // Parse existing config
                if (roomData.data.config) {
                    try {
                        roomConfig = JSON.parse(roomData.data.config);
                    } catch (e) {
                        roomConfig = {};
                    }
                }

                // Parse existing api_variables to see what was there before
                if (roomData.data.api_variables) {
                    try {
                        existingApiVariables = JSON.parse(roomData.data.api_variables);
                    } catch (e) {
                        existingApiVariables = {};
                    }
                }
            }

            // Create new variables object with only current variables (excluding system ones)
            const newVariables = {};
            Object.entries(this.variables).forEach(([name, config]) => {
                if (!config.system) {
                    // For custom variables, save just the value
                    newVariables[name] = config.value;
                } else {
                    // For system variables, preserve them as-is
                    newVariables[name] = config;
                }
            });

            // Find variables that were deleted (existed before but not now)
            const deletedVariables = Object.keys(existingApiVariables).filter(name => {
                // Don't delete system variables or variables that still exist
                return !this.variables[name] || (!this.variables[name].system && !newVariables[name]);
            });

            // Note: API doesn't have DELETE endpoint for individual variables
            // Variables are deleted by not including them in the newVariables object
            // when we update the room's api_variables field below

            // Add triggers to room config
            roomConfig.triggers = this.triggers;

            // Update both API variables and config
            const response = await fetch(`/api/rooms/${this.currentRoomId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    api_variables: newVariables,
                    config: roomConfig
                })
            });

            if (response.ok) {
                // Update the textarea in the main form
                const apiTextarea = document.getElementById('api-variables');
                if (apiTextarea) {
                    apiTextarea.value = JSON.stringify(newVariables, null, 2);
                }

                const configTextarea = document.getElementById('config');
                if (configTextarea) {
                    configTextarea.value = JSON.stringify(roomConfig, null, 2);
                }

                this.hideModal('variable-modal');
                this.showToast('Variables and triggers saved successfully', 'success');
            } else {
                throw new Error('Failed to save changes');
            }
        } catch (error) {
            console.error('Error saving changes:', error);
            this.showToast('Error saving changes', 'error');
        }
    }

    async saveVariableForm(e) {
        e.preventDefault();
        e.stopPropagation();

        const form = document.getElementById('variable-form');
        const formData = new FormData(form);

        // Get variable name - if editing, use the stored name since the field is disabled
        const variableName = this.editingVariable || formData.get('variableName')?.trim();
        const variableType = formData.get('variableType');
        const variableValue = formData.get('variableValue');

        if (!variableName) {
            this.showToast('Variable name is required', 'error');
            return;
        }

        // Only check if variable exists when adding new (not editing)
        if (!this.editingVariable && this.variables[variableName]) {
            this.showToast('Variable already exists', 'error');
            return;
        }

        // Parse value based on type
        let parsedValue;
        try {
            switch (variableType) {
                case 'boolean':
                    parsedValue = variableValue === 'true';
                    break;
                case 'number':
                    parsedValue = parseFloat(variableValue) || 0;
                    break;
                case 'array':
                    parsedValue = JSON.parse(variableValue || '[]');
                    break;
                case 'object':
                    parsedValue = JSON.parse(variableValue || '{}');
                    break;
                default:
                    parsedValue = variableValue || '';
            }
        } catch (error) {
            this.showToast('Invalid value format for type ' + variableType, 'error');
            return;
        }

        try {
            // Use POST for both editing and creating - API doesn't have separate PUT endpoint
            const url = this.editingVariable
                ? `/api/rooms/${this.currentRoomId}/variables/${variableName}`
                : `/api/rooms/${this.currentRoomId}/variables`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: variableName,
                    type: variableType,
                    value: parsedValue
                })
            });

            const result = await response.json();

            if (result.success) {
                // Add to local variables for display
                this.variables[variableName] = {
                    type: variableType,
                    value: parsedValue
                };

                // Update the variables list display
                this.renderVariables();

                // Close the modal
                this.hideModal('variable-form-modal');

                // Clear the form and editing state
                form.reset();
                this.editingVariable = null;

                const action = this.editingVariable ? 'updated' : 'saved';
                this.showToast(`Variable "${variableName}" ${action} successfully`, 'success');
            } else {
                this.showToast(`Failed to save variable: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error saving variable:', error);
            this.showToast('Error saving variable to database', 'error');
        }
    }
    
    setupActionConfigEventListeners() {
        // Handle volume slider display
        const volumeSlider = document.getElementById('sound-volume');
        const volumeDisplay = document.getElementById('volume-display');
        if (volumeSlider && volumeDisplay) {
            volumeSlider.addEventListener('input', (e) => {
                volumeDisplay.textContent = e.target.value;
            });
        }
        
        // Handle sound file selection
        const soundFileSelect = document.getElementById('sound-file');
        const uploadSection = document.getElementById('audio-upload-section');
        if (soundFileSelect && uploadSection) {
            soundFileSelect.addEventListener('change', (e) => {
                if (e.target.value === 'upload_new') {
                    uploadSection.style.display = 'block';
                } else {
                    uploadSection.style.display = 'none';
                }
            });
        }
        
        // Handle audio file upload
        const uploadBtn = document.getElementById('upload-audio-btn');
        const fileInput = document.getElementById('audio-file-input');
        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener('click', () => this.uploadAudioFile());
        }
        
        // Handle media file selection
        const mediaFileSelect = document.getElementById('media-file');
        const customMediaSection = document.getElementById('custom-media-url');
        if (mediaFileSelect && customMediaSection) {
            mediaFileSelect.addEventListener('change', (e) => {
                if (e.target.value === 'custom') {
                    customMediaSection.style.display = 'block';
                } else {
                    customMediaSection.style.display = 'none';
                }
            });
        }
    }
    
    async uploadAudioFile() {
        const fileInput = document.getElementById('audio-file-input');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showToast('Please select an audio file', 'error');
            return;
        }
        
        if (!file.type.startsWith('audio/')) {
            this.showToast('Please select a valid audio file', 'error');
            return;
        }
        
        try {
            const formData = new FormData();
            formData.append('audio', file);
            
            const response = await fetch(`/api/rooms/${this.currentRoomId}/notifications/audio`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast('Audio file uploaded successfully', 'success');
                
                // Refresh the sound file dropdown
                const soundFileSelect = document.getElementById('sound-file');
                const audioFiles = await this.loadAudioFiles();
                const audioOptions = audioFiles.map(file => 
                    `<option value="${file.id}">${file.original_name}</option>`
                ).join('');
                
                soundFileSelect.innerHTML = audioOptions + '<option value="upload_new">Upload New File...</option>';
                
                // Select the newly uploaded file
                soundFileSelect.value = result.data.id;
                
                // Hide upload section
                document.getElementById('audio-upload-section').style.display = 'none';
                
                // Clear file input
                fileInput.value = '';
                
            } else {
                this.showToast('Failed to upload audio file: ' + result.error, 'error');
            }
            
        } catch (error) {
            console.error('Error uploading audio file:', error);
            this.showToast('Error uploading audio file', 'error');
        }
    }
}

// Initialize the variable manager
console.log('Initializing VariableManager...');
const variableManager = new VariableManager();

// Export for use in admin.js
window.variableManager = variableManager;
console.log('VariableManager initialized and attached to window');