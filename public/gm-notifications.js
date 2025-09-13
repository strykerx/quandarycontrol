class GMNotificationManager {
    constructor() {
        this.roomId = null;
        this.audioFiles = [];
        this.notificationSettings = [];
        this.selectedFiles = [];
        this.defaultSettings = [
            {
                setting_type: 'player_hint_receive',
                label: 'Player Receives Hint',
                description: 'Sound when a player receives a hint'
            },
            {
                setting_type: 'player_chat_send',
                label: 'Player Sends Chat',
                description: 'Sound when a player sends a chat message'
            },
            {
                setting_type: 'player_chat_receive',
                label: 'Player Receives Chat',
                description: 'Sound when a player receives a chat response'
            },
            {
                setting_type: 'player_media_received',
                label: 'Player Receives Media',
                description: 'Sound when media is displayed to the player via lightbox'
            },
            {
                setting_type: 'gm_chat_receive',
                label: 'GM Receives Chat',
                description: 'Sound when the GM receives a chat from players'
            },
            {
                setting_type: 'variable_trigger',
                label: 'Variable Triggered',
                description: 'Sound when a game variable is triggered'
            }
        ];
    }

    initialize(roomId) {
        this.roomId = roomId;
        this.setupEventListeners();
        this.loadAudioFiles();
        this.loadNotificationSettings();
    }

    setupEventListeners() {
        // Audio upload
        const triggerUpload = document.getElementById('trigger-audio-upload');
        const confirmUpload = document.getElementById('confirm-audio-upload');
        const audioUpload = document.getElementById('audio-upload');

        if (triggerUpload) {
            triggerUpload.addEventListener('click', () => {
                if (audioUpload) audioUpload.click();
            });
        }

        if (audioUpload) {
            audioUpload.addEventListener('change', (e) => {
                this.handleFileSelection(e.target.files);
            });
        }

        if (confirmUpload) {
            confirmUpload.addEventListener('click', () => {
                this.uploadSelectedFiles();
            });
        }

        // Notification settings
        const saveSettings = document.getElementById('save-notification-settings');
        const testAll = document.getElementById('test-all-notifications');
        const reloadSettings = document.getElementById('reload-notification-settings');

        if (saveSettings) {
            saveSettings.addEventListener('click', () => {
                this.saveNotificationSettings();
            });
        }

        if (testAll) {
            testAll.addEventListener('click', () => {
                this.testAllNotifications();
            });
        }

        if (reloadSettings) {
            reloadSettings.addEventListener('click', () => {
                this.loadNotificationSettings();
            });
        }
    }

    handleFileSelection(files) {
        this.selectedFiles = Array.from(files);
        this.displaySelectedFiles();
    }

    displaySelectedFiles() {
        const fileList = document.getElementById('audio-file-list');
        if (!fileList) return;

        if (this.selectedFiles.length === 0) {
            fileList.innerHTML = '<div class="no-files">No files selected</div>';
            return;
        }

        fileList.innerHTML = this.selectedFiles.map((file, index) => `
            <div class="file-item">
                <span class="file-name">${file.name}</span>
                <span class="file-size">${this.formatFileSize(file.size)}</span>
                <button class="remove-file nav-button secondary" onclick="gmNotificationManager.removeSelectedFile(${index})">
                    Remove
                </button>
            </div>
        `).join('');
    }

    removeSelectedFile(index) {
        this.selectedFiles.splice(index, 1);
        this.displaySelectedFiles();
    }

    async uploadSelectedFiles() {
        if (this.selectedFiles.length === 0) {
            this.showUploadStatus('No files selected', 'error');
            return;
        }

        this.showUploadStatus('Uploading files...', 'info');

        try {
            for (const file of this.selectedFiles) {
                const formData = new FormData();
                formData.append('audio', file);

                const response = await fetch(`/api/rooms/${this.roomId}/notifications/audio`, {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();
                if (!result.success) {
                    throw new Error(result.error);
                }
            }

            this.showUploadStatus(`Successfully uploaded ${this.selectedFiles.length} files`, 'success');
            this.selectedFiles = [];
            this.displaySelectedFiles();
            this.loadAudioFiles();

        } catch (error) {
            this.showUploadStatus(`Upload failed: ${error.message}`, 'error');
        }
    }

    showUploadStatus(message, type = 'info') {
        const status = document.getElementById('audio-upload-status');
        if (!status) return;

        status.innerHTML = `
            <div class="upload-message upload-${type}">
                ${message}
            </div>
        `;

        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                status.innerHTML = '';
            }, 5000);
        }
    }

    async loadAudioFiles() {
        try {
            const response = await fetch(`/api/rooms/${this.roomId}/notifications/audio`);
            const result = await response.json();

            if (result.success) {
                this.audioFiles = result.data;
                this.displayAudioLibrary();
            } else {
                console.error('Failed to load audio files:', result.error);
            }
        } catch (error) {
            console.error('Error loading audio files:', error);
        }
    }

    displayAudioLibrary() {
        const library = document.getElementById('audio-library');
        if (!library) return;

        if (this.audioFiles.length === 0) {
            library.innerHTML = '<div class="no-audio">No audio files uploaded</div>';
            return;
        }

        library.innerHTML = this.audioFiles.map(audio => `
            <div class="audio-item">
                <div class="audio-info">
                    <span class="audio-name">${audio.original_name}</span>
                    <span class="audio-size">${this.formatFileSize(audio.file_size)}</span>
                </div>
                <div class="audio-controls">
                    <button class="nav-button secondary" onclick="gmNotificationManager.playAudio('${audio.file_path}')">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="nav-button secondary" onclick="gmNotificationManager.deleteAudio('${audio.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    async playAudio(filePath) {
        try {
            const audio = new Audio(filePath);
            audio.volume = 0.5;
            await audio.play();
        } catch (error) {
            console.error('Error playing audio:', error);
            alert('Could not play audio file');
        }
    }

    async deleteAudio(audioId) {
        if (!confirm('Are you sure you want to delete this audio file?')) {
            return;
        }

        try {
            const response = await fetch(`/api/rooms/${this.roomId}/notifications/audio/${audioId}`, {
                method: 'DELETE'
            });

            const result = await response.json();
            if (result.success) {
                this.loadAudioFiles();
                this.loadNotificationSettings();
            } else {
                alert(`Failed to delete audio: ${result.error}`);
            }
        } catch (error) {
            console.error('Error deleting audio:', error);
            alert('Failed to delete audio file');
        }
    }

    async loadNotificationSettings() {
        try {
            const response = await fetch(`/api/rooms/${this.roomId}/notifications/settings`);
            const result = await response.json();

            if (result.success) {
                this.notificationSettings = result.data;
                this.displayNotificationSettings();
            } else {
                console.error('Failed to load notification settings:', result.error);
                // Create default settings if none exist
                this.createDefaultSettings();
            }
        } catch (error) {
            console.error('Error loading notification settings:', error);
            this.createDefaultSettings();
        }
    }

    createDefaultSettings() {
        this.notificationSettings = this.defaultSettings.map(setting => ({
            ...setting,
            audio_id: null,
            enabled: true,
            settings: { volume: 0.7 }
        }));
        this.displayNotificationSettings();
    }

    displayNotificationSettings() {
        const settings = document.getElementById('notification-settings');
        if (!settings) return;

        const settingsHTML = this.defaultSettings.map(defaultSetting => {
            const currentSetting = this.notificationSettings.find(s => 
                s.setting_type === defaultSetting.setting_type
            ) || {
                setting_type: defaultSetting.setting_type,
                audio_id: null,
                enabled: true,
                settings: { volume: 0.7 }
            };

            return `
                <div class="notification-setting-item">
                    <div class="setting-header">
                        <h4>${defaultSetting.label}</h4>
                        <label class="setting-toggle">
                            <input type="checkbox" 
                                   data-setting-type="${defaultSetting.setting_type}" 
                                   data-field="enabled"
                                   ${currentSetting.enabled ? 'checked' : ''}>
                            <span>Enabled</span>
                        </label>
                    </div>
                    <p class="setting-description">${defaultSetting.description}</p>
                    
                    <div class="setting-controls">
                        <div class="setting-control">
                            <label>Audio File:</label>
                            <select data-setting-type="${defaultSetting.setting_type}" data-field="audio_id">
                                <option value="">None</option>
                                ${this.audioFiles.map(audio => `
                                    <option value="${audio.id}" ${currentSetting.audio_id === audio.id ? 'selected' : ''}>
                                        ${audio.original_name}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div class="setting-control">
                            <label>Volume:</label>
                            <input type="range" 
                                   min="0" max="1" step="0.1" 
                                   value="${currentSetting.settings?.volume || 0.7}"
                                   data-setting-type="${defaultSetting.setting_type}" 
                                   data-field="volume">
                            <span class="volume-display">${Math.round((currentSetting.settings?.volume || 0.7) * 100)}%</span>
                        </div>
                        
                        <button class="nav-button secondary test-setting" 
                                data-setting-type="${defaultSetting.setting_type}"
                                ${!currentSetting.enabled || !currentSetting.audio_id ? 'disabled' : ''}>
                            Test
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        settings.innerHTML = settingsHTML;

        // Add event listeners to controls
        this.setupSettingEventListeners();
    }

    setupSettingEventListeners() {
        const settings = document.getElementById('notification-settings');
        if (!settings) return;

        // Volume sliders
        settings.querySelectorAll('input[type="range"]').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const display = e.target.nextElementSibling;
                if (display) {
                    display.textContent = Math.round(e.target.value * 100) + '%';
                }
                this.updateSettingField(e.target);
            });
        });

        // Checkboxes and selects
        settings.querySelectorAll('input[type="checkbox"], select').forEach(control => {
            control.addEventListener('change', (e) => {
                this.updateSettingField(e.target);
            });
        });

        // Test buttons
        settings.querySelectorAll('.test-setting').forEach(button => {
            button.addEventListener('click', (e) => {
                const settingType = e.target.dataset.settingType;
                this.testNotification(settingType);
            });
        });
    }

    updateSettingField(element) {
        const settingType = element.dataset.settingType;
        const field = element.dataset.field;
        let value = element.value;

        if (element.type === 'checkbox') {
            value = element.checked;
        } else if (element.type === 'range') {
            value = parseFloat(value);
        }

        // Find or create setting
        let setting = this.notificationSettings.find(s => s.setting_type === settingType);
        if (!setting) {
            setting = {
                setting_type: settingType,
                audio_id: null,
                enabled: true,
                settings: {}
            };
            this.notificationSettings.push(setting);
        }

        // Update field
        if (field === 'enabled' || field === 'audio_id') {
            setting[field] = value;
        } else if (field === 'volume') {
            setting.settings = setting.settings || {};
            setting.settings.volume = value;
        }

        // Update test button state
        this.updateTestButtonState(settingType);
    }

    updateTestButtonState(settingType) {
        const testButton = document.querySelector(`[data-setting-type="${settingType}"].test-setting`);
        if (!testButton) return;

        const setting = this.notificationSettings.find(s => s.setting_type === settingType);
        const enabled = setting && setting.enabled && setting.audio_id;
        
        testButton.disabled = !enabled;
    }

    async testNotification(settingType) {
        const setting = this.notificationSettings.find(s => s.setting_type === settingType);
        if (!setting || !setting.enabled || !setting.audio_id) {
            alert('Please select an audio file and enable the notification first');
            return;
        }

        const audioFile = this.audioFiles.find(a => a.id === setting.audio_id);
        if (!audioFile) {
            alert('Audio file not found');
            return;
        }

        try {
            const audio = new Audio(audioFile.file_path);
            audio.volume = setting.settings?.volume || 0.7;
            await audio.play();
        } catch (error) {
            console.error('Error testing notification:', error);
            alert('Could not play notification sound');
        }
    }

    async saveNotificationSettings() {
        try {
            // Clean the settings data to ensure compatibility with SQLite
            const cleanedSettings = this.notificationSettings.map(setting => ({
                setting_type: setting.setting_type,
                audio_id: setting.audio_id || null,
                enabled: Boolean(setting.enabled),
                settings: setting.settings || {}
            }));

            console.log('Saving notification settings:', cleanedSettings);

            const response = await fetch(`/api/rooms/${this.roomId}/notifications/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    settings: cleanedSettings
                })
            });

            const result = await response.json();
            if (result.success) {
                alert('Notification settings saved successfully');
            } else {
                alert(`Failed to save settings: ${result.error}`);
            }
        } catch (error) {
            console.error('Error saving notification settings:', error);
            alert('Failed to save notification settings');
        }
    }

    async testAllNotifications() {
        const enabledSettings = this.notificationSettings.filter(s => s.enabled && s.audio_id);
        
        if (enabledSettings.length === 0) {
            alert('No enabled notifications to test');
            return;
        }

        for (let i = 0; i < enabledSettings.length; i++) {
            setTimeout(() => {
                this.testNotification(enabledSettings[i].setting_type);
            }, i * 1000);
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Create global instance
const gmNotificationManager = new GMNotificationManager();
window.gmNotificationManager = gmNotificationManager;