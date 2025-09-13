class NotificationManager {
  constructor() {
    this.audioCache = new Map();
    this.notificationSettings = new Map();
    this.isInitialized = false;
    this.defaultVolume = 0.7;
  }

  async initialize(roomId) {
    if (this.isInitialized) return;
    
    this.roomId = roomId;
    try {
      await this.loadNotificationSettings();
      this.isInitialized = true;
      console.log('NotificationManager initialized');
    } catch (error) {
      console.error('Failed to initialize NotificationManager:', error);
    }
  }

  async loadNotificationSettings() {
    try {
      const response = await fetch(`/api/rooms/${this.roomId}/notifications/settings`);
      if (!response.ok) throw new Error('Failed to load notification settings');
      
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      
      // Clear existing settings
      this.notificationSettings.clear();
      
      // Load new settings
      for (const setting of result.data) {
        this.notificationSettings.set(setting.setting_type, {
          audioId: setting.audio_id,
          filePath: setting.file_path,
          enabled: setting.enabled,
          volume: setting.settings.volume || this.defaultVolume,
          ...setting.settings
        });
      }
      
      // Pre-load audio files
      await this.preloadAudioFiles();
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  }

  async preloadAudioFiles() {
    for (const [type, setting] of this.notificationSettings) {
      if (setting.filePath && setting.enabled) {
        await this.loadAudioFile(setting.filePath);
      }
    }
  }

  async loadAudioFile(filePath) {
    if (this.audioCache.has(filePath)) {
      return this.audioCache.get(filePath);
    }

    return new Promise((resolve, reject) => {
      const audio = new Audio(filePath);
      
      audio.addEventListener('canplaythrough', () => {
        this.audioCache.set(filePath, audio);
        resolve(audio);
      });
      
      audio.addEventListener('error', (error) => {
        console.warn(`Failed to load audio file: ${filePath}`, error);
        reject(error);
      });
      
      audio.load();
    });
  }

  async playNotification(type, options = {}) {
    if (!this.isInitialized) {
      console.warn('NotificationManager not initialized');
      return;
    }

    const setting = this.notificationSettings.get(type);
    if (!setting || !setting.enabled || !setting.filePath) {
      console.log(`No notification configured for type: ${type}`);
      return;
    }

    try {
      let audio = this.audioCache.get(setting.filePath);
      
      if (!audio) {
        audio = await this.loadAudioFile(setting.filePath);
      }

      // Clone audio for concurrent playback
      const audioClone = audio.cloneNode();
      audioClone.volume = options.volume !== undefined ? options.volume : setting.volume;
      
      // Play the notification
      await audioClone.play();
      console.log(`Played notification: ${type}`);
    } catch (error) {
      console.error(`Error playing notification ${type}:`, error);
    }
  }

  async testNotification(type) {
    console.log(`Testing notification: ${type}`);
    await this.playNotification(type, { volume: 0.5 });
  }

  // Convenience methods for different notification types
  async onHintReceived() {
    await this.playNotification('player_hint_receive');
  }

  async onChatSent() {
    await this.playNotification('player_chat_send');
  }

  async onChatReceived() {
    await this.playNotification('player_chat_receive');
  }

  async onGMChatReceived() {
    await this.playNotification('gm_chat_receive');
  }

  async onVariableTriggered(variableName) {
    // Check for specific variable triggers
    const specificType = `variable_trigger_${variableName}`;
    if (this.notificationSettings.has(specificType)) {
      await this.playNotification(specificType);
    } else {
      // Fall back to generic variable trigger
      await this.playNotification('variable_trigger');
    }
  }

  async onMediaReceived() {
    await this.playNotification('player_media_received');
  }

  // Update notification settings
  updateSetting(type, setting) {
    this.notificationSettings.set(type, setting);
    
    // Pre-load new audio file if needed
    if (setting.filePath && setting.enabled) {
      this.loadAudioFile(setting.filePath);
    }
  }

  // Get current settings for UI
  getSettings() {
    const settings = {};
    for (const [type, setting] of this.notificationSettings) {
      settings[type] = { ...setting };
    }
    return settings;
  }

  // Enable/disable notifications globally
  setEnabled(enabled) {
    for (const [type, setting] of this.notificationSettings) {
      setting.enabled = enabled;
    }
  }
}

// Create global instance
window.notificationManager = new NotificationManager();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NotificationManager;
}