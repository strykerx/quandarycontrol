// Theme Configurator JavaScript

class ThemeConfigurator {
    constructor() {
        this.currentTheme = null;
        this.currentThemeData = null;
        this.currentRoomId = null;
        this.currentRoomName = null;
        this.isModified = false;
        this.initializeEventListeners();
        this.loadAvailableThemes();
    }

    initializeEventListeners() {
        // Theme configurator button
        document.getElementById('theme-configurator-btn')?.addEventListener('click', () => {
            this.showThemeConfigurator();
        });

        // Close modal
        document.getElementById('close-theme-configurator-modal')?.addEventListener('click', () => {
            this.hideThemeConfigurator();
        });

        // Theme selector
        document.getElementById('theme-selector')?.addEventListener('change', async (e) => {
            const selectedTheme = e.target.value;
            this.loadTheme(selectedTheme);
            
            // If we have a room selected and a theme is chosen, apply it automatically
            if (this.currentRoomId && selectedTheme) {
                await this.applyThemeToRoom();
            }
        });

        // Tab navigation
        document.querySelectorAll('.theme-editor-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Form inputs - track changes
        const formInputs = ['theme-name-edit', 'theme-version-edit', 'theme-description-edit', 'theme-author-edit', 'theme-json-editor'];
        formInputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', () => {
                    this.markAsModified();
                });
            }
        });

        // Action buttons
        document.getElementById('cancel-theme-config-btn')?.addEventListener('click', () => {
            this.hideThemeConfigurator();
        });

        document.getElementById('save-theme-config-btn')?.addEventListener('click', () => {
            this.saveTheme();
        });

        document.getElementById('save-as-theme-btn')?.addEventListener('click', () => {
            this.saveAsNewTheme();
        });

        // JSON validation
        document.getElementById('theme-json-editor')?.addEventListener('blur', () => {
            this.validateJSON();
        });
    }

    async loadAvailableThemes() {
        try {
            const response = await fetch('/api/themes');
            const result = await response.json();
            
            if (result.success) {
                this.populateThemeSelectors(result.data);
            } else {
                console.error('Failed to load themes:', result.error);
            }
        } catch (error) {
            console.error('Error loading themes:', error);
        }
    }

    populateThemeSelectors(themes) {
        const themeSelector = document.getElementById('theme-selector');
        const roomThemeSelector = document.getElementById('room-theme');
        
        if (themeSelector) {
            themeSelector.innerHTML = '<option value="">-- Select a Theme --</option>';
            themes.forEach(theme => {
                const option = document.createElement('option');
                option.value = theme.name;
                option.textContent = `${theme.description || theme.name} (${theme.name})`;
                themeSelector.appendChild(option);
            });
        }

        if (roomThemeSelector) {
            roomThemeSelector.innerHTML = '';
            themes.forEach(theme => {
                const option = document.createElement('option');
                option.value = theme.name;
                option.textContent = theme.description || theme.name;
                roomThemeSelector.appendChild(option);
            });
        }
    }

    openForRoom(roomId, roomName) {
        this.currentRoomId = roomId;
        this.currentRoomName = roomName;
        this.showThemeConfigurator();
        this.loadRoomTheme();
    }

    showThemeConfigurator() {
        const modal = document.getElementById('theme-configurator-modal');
        if (modal) {
            modal.style.display = 'flex';
            this.loadAvailableThemes(); // Refresh themes
            
            // Update modal title if we have room info
            const modalTitle = modal.querySelector('.modal-header h2');
            if (modalTitle && this.currentRoomName) {
                modalTitle.textContent = `🎭 Configure Theme - ${this.currentRoomName}`;
            }
        }
    }

    hideThemeConfigurator() {
        const modal = document.getElementById('theme-configurator-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.resetForm();
    }

    async loadRoomTheme() {
        if (!this.currentRoomId) return;

        try {
            // Get room data to find current theme
            const response = await fetch(`/api/rooms/${this.currentRoomId}`);
            const result = await response.json();
            
            if (result.success) {
                const room = result.data;
                let config = {};
                try {
                    config = JSON.parse(room.config || '{}');
                } catch (error) {
                    console.warn('Failed to parse room config:', error);
                }
                
                const themeName = config.theme || 'example-theme';
                
                // Set the theme selector to the room's current theme
                const themeSelector = document.getElementById('theme-selector');
                if (themeSelector) {
                    themeSelector.value = themeName;
                    this.loadTheme(themeName);
                }
            }
        } catch (error) {
            console.error('Error loading room theme:', error);
        }
    }

    async loadTheme(themeName) {
        if (!themeName) {
            this.hideEditorSection();
            return;
        }

        try {
            const response = await fetch(`/themes/${themeName}/theme-config.json`);
            if (response.ok) {
                const themeData = await response.json();
                this.currentTheme = themeName;
                this.currentThemeData = themeData;
                this.populateForm(themeData);
                this.showEditorSection();
                this.enableSaveButtons();
            } else {
                throw new Error('Theme not found');
            }
        } catch (error) {
            console.error('Error loading theme:', error);
            alert('Failed to load theme configuration');
        }
    }

    populateForm(themeData) {
        // Basic info tab
        document.getElementById('theme-name-edit').value = themeData.name || '';
        document.getElementById('theme-version-edit').value = themeData.version || '';
        document.getElementById('theme-description-edit').value = themeData.description || '';
        document.getElementById('theme-author-edit').value = themeData.author || '';

        // Components tab
        this.populateComponentsConfig(themeData.components || {});

        // JSON editor tab
        document.getElementById('theme-json-editor').value = JSON.stringify(themeData, null, 2);
        
        this.isModified = false;
    }

    populateComponentsConfig(components) {
        const componentsList = document.getElementById('components-list');
        if (!componentsList) return;

        componentsList.innerHTML = '';

        const componentTypes = [
            { key: 'timer', name: 'Timer', description: 'Game timer display' },
            { key: 'chat', name: 'Chat', description: 'Two-way chat interface' },
            { key: 'hints', name: 'Hints', description: 'Hint display system' },
            { key: 'variables', name: 'Variables', description: 'Room variable display' },
            { key: 'media', name: 'Media', description: 'Media lightbox component' },
            { key: 'room-info', name: 'Room Info', description: 'Room information display' },
            { key: 'game-state', name: 'Game State', description: 'Game state and progress' }
        ];

        componentTypes.forEach(comp => {
            const componentConfig = components[comp.key] || {};
            const div = document.createElement('div');
            div.className = 'component-config-item';
            
            div.innerHTML = `
                <div class="component-header">
                    <h5>${comp.name}</h5>
                    <label class="checkbox-label">
                        <input type="checkbox" data-component="${comp.key}" ${componentConfig.enabled !== false ? 'checked' : ''}> Enabled
                    </label>
                </div>
                <p class="component-description">${comp.description}</p>
                <div class="component-settings" data-component="${comp.key}">
                    <!-- Component-specific settings would go here -->
                </div>
            `;

            componentsList.appendChild(div);
        });

        // Add event listeners for component toggles
        componentsList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.markAsModified();
            });
        });
    }

    showEditorSection() {
        const editorSection = document.getElementById('theme-editor-section');
        if (editorSection) {
            editorSection.style.display = 'block';
        }
    }

    hideEditorSection() {
        const editorSection = document.getElementById('theme-editor-section');
        if (editorSection) {
            editorSection.style.display = 'none';
        }
    }

    switchTab(tabName) {
        // Remove active class from all tabs and content
        document.querySelectorAll('.theme-editor-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.theme-editor-tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // Add active class to clicked tab and corresponding content
        document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
        document.getElementById(`${tabName}-tab`)?.classList.add('active');
    }

    markAsModified() {
        this.isModified = true;
        this.enableSaveButtons();
    }

    enableSaveButtons() {
        document.getElementById('save-theme-config-btn').disabled = false;
        document.getElementById('save-as-theme-btn').disabled = false;
    }

    validateJSON() {
        const jsonEditor = document.getElementById('theme-json-editor');
        const validationDiv = document.getElementById('json-validation');
        
        if (!jsonEditor || !validationDiv) return;

        try {
            JSON.parse(jsonEditor.value);
            validationDiv.innerHTML = '<div class="validation-success">✅ Valid JSON</div>';
        } catch (error) {
            validationDiv.innerHTML = `<div class="validation-error">❌ Invalid JSON: ${error.message}</div>`;
        }
    }

    async saveTheme() {
        if (!this.currentTheme) return;

        try {
            const formData = this.collectFormData();
            const response = await fetch(`/api/themes/${this.currentTheme}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();
            if (result.success) {
                alert('Theme saved successfully!');
                this.isModified = false;
                await this.applyThemeToRoom();
            } else {
                throw new Error(result.error || 'Failed to save theme');
            }
        } catch (error) {
            console.error('Error saving theme:', error);
            alert('Failed to save theme: ' + error.message);
        }
    }

    async saveAsNewTheme() {
        const newThemeName = prompt('Enter new theme name:');
        if (!newThemeName) return;

        try {
            const formData = this.collectFormData();
            formData.name = newThemeName;

            const response = await fetch('/api/themes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();
            if (result.success) {
                alert('New theme created successfully!');
                this.loadAvailableThemes();
                this.currentTheme = newThemeName;
                document.getElementById('theme-selector').value = newThemeName;
            } else {
                throw new Error(result.error || 'Failed to create theme');
            }
        } catch (error) {
            console.error('Error creating theme:', error);
            alert('Failed to create theme: ' + error.message);
        }
    }

    collectFormData() {
        const activeTab = document.querySelector('.theme-editor-tab.active')?.dataset.tab;
        
        if (activeTab === 'json') {
            // If on JSON tab, use JSON editor content
            try {
                return JSON.parse(document.getElementById('theme-json-editor').value);
            } catch (error) {
                throw new Error('Invalid JSON in editor');
            }
        } else {
            // Collect from form fields
            const components = {};
            document.querySelectorAll('#components-list input[type="checkbox"]').forEach(checkbox => {
                components[checkbox.dataset.component] = {
                    enabled: checkbox.checked
                };
            });

            return {
                name: document.getElementById('theme-name-edit').value,
                version: document.getElementById('theme-version-edit').value,
                description: document.getElementById('theme-description-edit').value,
                author: document.getElementById('theme-author-edit').value,
                created_at: this.currentThemeData?.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
                components: components
            };
        }
    }

    async applyThemeToRoom() {
        if (!this.currentRoomId || !this.currentTheme) return;

        try {
            // Get current room data
            const roomResponse = await fetch(`/api/rooms/${this.currentRoomId}`);
            const roomResult = await roomResponse.json();
            
            if (!roomResult.success) {
                throw new Error('Failed to get room data');
            }

            const room = roomResult.data;
            let config = {};
            try {
                config = JSON.parse(room.config || '{}');
            } catch (error) {
                console.warn('Failed to parse room config:', error);
            }

            // Update room config with new theme
            config.theme = this.currentTheme;

            // Save updated room
            const updateResponse = await fetch(`/api/rooms/${this.currentRoomId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: room.name,
                    timer_duration: room.timer_duration,
                    api_variables: JSON.parse(room.api_variables || '{}'),
                    config: config,
                    hint_config: JSON.parse(room.hint_config || '{}'),
                    theme: this.currentTheme
                })
            });

            const updateResult = await updateResponse.json();
            if (!updateResult.success) {
                throw new Error('Failed to update room theme');
            }

            console.log(`Theme ${this.currentTheme} applied to room ${this.currentRoomId}`);
        } catch (error) {
            console.error('Error applying theme to room:', error);
        }
    }

    resetForm() {
        this.currentTheme = null;
        this.currentThemeData = null;
        this.currentRoomId = null;
        this.currentRoomName = null;
        this.isModified = false;
        
        document.getElementById('theme-selector').value = '';
        this.hideEditorSection();
        
        // Reset form fields
        document.getElementById('theme-name-edit').value = '';
        document.getElementById('theme-version-edit').value = '';
        document.getElementById('theme-description-edit').value = '';
        document.getElementById('theme-author-edit').value = '';
        document.getElementById('theme-json-editor').value = '';
        
        // Reset modal title
        const modalTitle = document.querySelector('#theme-configurator-modal .modal-header h2');
        if (modalTitle) {
            modalTitle.textContent = '🎭 Theme Configurator';
        }
        
        // Disable save buttons
        document.getElementById('save-theme-config-btn').disabled = true;
        document.getElementById('save-as-theme-btn').disabled = true;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.themeConfigurator = new ThemeConfigurator();
});