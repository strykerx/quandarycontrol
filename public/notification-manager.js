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
      console.log(`[NotificationManager] Loading settings for room: ${this.roomId}`);
      const response = await fetch(`/api/rooms/${this.roomId}/notifications/settings`);
      if (!response.ok) throw new Error('Failed to load notification settings');

      const result = await response.json();
      console.log('[NotificationManager] Settings response:', result);

      if (!result.success) throw new Error(result.error);

      // Clear existing settings
      this.notificationSettings.clear();

      // Load new settings
      for (const setting of result.data) {
        console.log('[NotificationManager] Loading setting:', setting);
        this.notificationSettings.set(setting.setting_type, {
          audioId: setting.audio_id,
          filePath: setting.file_path,
          enabled: setting.enabled,
          volume: (setting.settings && setting.settings.volume) || this.defaultVolume,
          ...setting.settings
        });
      }

      console.log('[NotificationManager] Loaded settings map:', this.notificationSettings);

      // Pre-load audio files
      await this.preloadAudioFiles();
    } catch (error) {
      console.error('[NotificationManager] Error loading notification settings:', error);
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
    console.log(`[NotificationManager] playNotification called for type: ${type}`);
    console.log(`[NotificationManager] isInitialized: ${this.isInitialized}`);

    if (!this.isInitialized) {
      console.warn('[NotificationManager] Not initialized, cannot play notification');
      return;
    }

    const setting = this.notificationSettings.get(type);
    console.log(`[NotificationManager] Setting for ${type}:`, setting);

    if (!setting) {
      console.log(`[NotificationManager] No setting configured for type: ${type}`);
      return;
    }

    if (!setting.enabled) {
      console.log(`[NotificationManager] Notification disabled for type: ${type}`);
      return;
    }

    if (!setting.filePath) {
      console.log(`[NotificationManager] No file path configured for type: ${type}`);
      return;
    }

    try {
      let audio = this.audioCache.get(setting.filePath);
      console.log(`[NotificationManager] Audio from cache for ${setting.filePath}:`, audio);

      if (!audio) {
        console.log(`[NotificationManager] Loading audio file: ${setting.filePath}`);
        audio = await this.loadAudioFile(setting.filePath);
      }

      // Clone audio for concurrent playback
      const audioClone = audio.cloneNode();
      audioClone.volume = options.volume !== undefined ? options.volume : setting.volume;

      console.log(`[NotificationManager] Playing audio with volume: ${audioClone.volume}`);

      // Play the notification
      await audioClone.play();
      console.log(`[NotificationManager] ✓ Successfully played notification: ${type}`);
    } catch (error) {
      console.error(`[NotificationManager] ✗ Error playing notification ${type}:`, error);
    }
  }

  async testNotification(type) {
    console.log(`Testing notification: ${type}`);
    await this.playNotification(type, { volume: 0.5 });
  }

  // Convenience methods for different notification types
  async onHintReceived() {
    console.log('[NotificationManager] onHintReceived called');
    await this.playNotification('player_hint_receive');
  }

  async onChatSent() {
    console.log('[NotificationManager] onChatSent called');
    await this.playNotification('player_chat_send');
  }

  async onChatReceived() {
    console.log('[NotificationManager] onChatReceived called');
    await this.playNotification('player_chat_receive');
  }

  async onGMChatReceived() {
    console.log('[NotificationManager] onGMChatReceived called');
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