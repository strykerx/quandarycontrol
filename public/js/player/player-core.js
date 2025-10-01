/**
 * Consolidated Player System
 * Consolidated from: player.js, player-bare.js
 *
 * Handles player interface for escape room participants
 * Supports both full and minimal (bare) player modes
 */

class PlayerCore {
    constructor(options = {}) {
        this.options = {
            mode: 'full', // 'full' or 'bare'
            autoConnect: true,
            enableChat: true,
            enableLightbox: true,
            enableNotifications: true,
            debugMode: false,
            ...options
        };

        // Core state
        this.socket = null;
        this.roomId = null;
        this.roomShortcode = null;
        this.variables = {};
        this.hints = [];
        this.hintType = 'broadcast';
        this.connected = false;

        // UI elements
        this.elements = {};
        this.autoCloseTimerId = null;
        this.allowManualClose = true;

        // Initialize
        this.parseUrlParams();
        if (this.options.autoConnect) {
            this.initialize();
        }
    }

    parseUrlParams() {
        const pathSegments = window.location.pathname.split('/').filter(segment => segment);

        if (pathSegments.length >= 1) {
            // Check if using shortcode route (/p/ABC123)
            if (pathSegments[0] === 'p' && pathSegments[1]) {
                this.roomShortcode = pathSegments[1];
                console.log('Using shortcode:', this.roomShortcode);
            } else {
                // Direct room ID
                this.roomId = pathSegments[0];
                console.log('Using room ID:', this.roomId);
            }
        }

        // Check URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('mode')) {
            this.options.mode = urlParams.get('mode');
        }
        if (urlParams.has('debug')) {
            this.options.debugMode = true;
        }
    }

    async initialize() {
        try {
            this.log('Initializing Player Core...');

            // Resolve room ID if using shortcode
            if (this.roomShortcode && !this.roomId) {
                await this.resolveRoomFromShortcode();
            }

            if (!this.roomId) {
                throw new Error('No room ID available');
            }

            // Set global room ID for other systems
            window.ROOM_ID = this.roomId;

            // Initialize socket connection
            this.initializeSocket();

            // Initialize UI based on mode
            if (this.options.mode === 'bare') {
                this.initializeBareMode();
            } else {
                this.initializeFullMode();
            }

            // Load room data
            await this.loadRoomData();

            this.log('Player Core initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Player Core:', error);
            this.showError('Failed to connect to room. Please check the URL and try again.');
        }
    }

    async resolveRoomFromShortcode() {
        try {
            const response = await fetch(`/api/shortcode/${this.roomShortcode}`);
            const result = await response.json();

            if (result.success && result.data) {
                this.roomId = result.data.id;
                this.log(`Resolved shortcode ${this.roomShortcode} to room ID: ${this.roomId}`);
            } else {
                throw new Error('Invalid room shortcode');
            }
        } catch (error) {
            console.error('Failed to resolve room shortcode:', error);
            throw error;
        }
    }

    initializeSocket() {
        if (typeof io === 'undefined') {
            throw new Error('Socket.IO not available');
        }

        this.socket = io();
        window.socket = this.socket;

        // Connection events
        this.socket.on('connect', () => {
            this.connected = true;
            this.log('Socket connected');
            this.socket.emit('join_room', { roomId: this.roomId, clientType: 'player' });
        });

        this.socket.on('disconnect', () => {
            this.connected = false;
            this.log('Socket disconnected');
            this.showConnectionStatus('Disconnected');
        });

        this.socket.on('connect_error', (error) => {
            this.log('Socket connection error:', error);
            this.showError('Connection error. Trying to reconnect...');
        });

        // Room events
        this.socket.on('roomJoined', (data) => {
            this.log('Joined room:', data);
            this.showConnectionStatus('Connected');
        });

        this.socket.on('timer_update', (data) => {
            this.handleTimerUpdate(data);
        });

        this.socket.on('variableUpdate', (data) => {
            this.handleVariableUpdate(data);
        });

        this.socket.on('show_lightbox', (data) => {
            if (this.options.enableLightbox) {
                this.showLightbox(data);
            }
        });

        this.socket.on('hintReceived', (data) => {
            if (this.options.enableNotifications) {
                this.handleHintReceived(data);
            }
        });

        // Chat events (if enabled)
        if (this.options.enableChat) {
            this.socket.on('chat_message', (data) => {
                this.handleChatMessage(data);
            });
        }
    }

    initializeFullMode() {
        this.log('Initializing full player mode');

        // Get DOM elements
        this.elements = {
            timerDisplay: document.getElementById('timer'),
            secondaryTimerDisplay: document.getElementById('secondary-timer'),
            connectionStatus: document.getElementById('connection-status'),
            chatContainer: document.getElementById('chat-container'),
            chatMessages: document.getElementById('chat-messages'),
            chatInput: document.getElementById('chat-input'),
            chatSend: document.getElementById('chat-send'),
            hintsContainer: document.getElementById('hints'),
            lightboxOverlay: document.getElementById('lightbox-overlay'),
            lightboxContent: document.getElementById('lightbox-content'),
            lightboxClose: document.getElementById('lightbox-close'),
            errorContainer: document.getElementById('error-container')
        };

        // Setup event listeners
        this.setupFullModeEventListeners();

        // Initialize chat if available
        if (this.elements.chatInput && this.elements.chatSend && this.options.enableChat) {
            this.initializeChat();
        }

        // Initialize lightbox if available
        if (this.elements.lightboxOverlay && this.options.enableLightbox) {
            this.initializeLightbox();
        }
    }

    initializeBareMode() {
        this.log('Initializing bare player mode');

        // Minimal DOM elements for bare mode
        this.elements = {
            timerDisplay: document.querySelector('.timer-display') || document.getElementById('timer'),
            connectionStatus: document.querySelector('.connection-status'),
            lightboxOverlay: document.querySelector('.lightbox-overlay'),
            errorContainer: document.querySelector('.error-container')
        };

        // Minimal functionality - just timer and lightbox
        if (this.options.enableLightbox && this.elements.lightboxOverlay) {
            this.initializeLightbox();
        }
    }

    setupFullModeEventListeners() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // ESC to close lightbox
            if (e.key === 'Escape' && this.elements.lightboxOverlay) {
                this.closeLightbox();
            }

            // Enter to send chat message
            if (e.key === 'Enter' && e.target === this.elements.chatInput) {
                e.preventDefault();
                this.sendChatMessage();
            }
        });

        // Window focus/blur for connection management
        window.addEventListener('focus', () => {
            if (!this.connected) {
                this.socket?.connect();
            }
        });
    }

    async loadRoomData() {
        try {
            const response = await fetch(`/api/rooms/${this.roomId}`);
            const result = await response.json();

            if (result.success && result.data) {
                const room = result.data;
                this.log('Room data loaded:', room);

                // Update page title
                if (room.name) {
                    document.title = `${room.name} - Quandary Player`;
                }

                // Parse hint configuration
                try {
                    const hintConfig = JSON.parse(room.hint_config || '{}');
                    this.hintType = hintConfig.type || 'broadcast';
                } catch (e) {
                    console.warn('Invalid hint config:', e);
                }

                // Parse variables
                try {
                    this.variables = JSON.parse(room.api_variables || '{}');
                } catch (e) {
                    console.warn('Invalid variables:', e);
                }
            }
        } catch (error) {
            console.error('Failed to load room data:', error);
        }
    }

    // Timer handling
    handleTimerUpdate(data) {
        this.log('Timer update:', data);

        // Update main timer
        if (this.elements.timerDisplay && data.timeRemaining !== undefined) {
            this.elements.timerDisplay.textContent = this.formatTime(data.timeRemaining);

            // Add visual states based on time remaining
            this.elements.timerDisplay.classList.toggle('timer-warning', data.timeRemaining <= 300); // 5 minutes
            this.elements.timerDisplay.classList.toggle('timer-critical', data.timeRemaining <= 60); // 1 minute
        }

        // Update secondary timer
        if (this.elements.secondaryTimerDisplay && data.secondaryTimeRemaining !== undefined) {
            this.elements.secondaryTimerDisplay.textContent = this.formatTime(data.secondaryTimeRemaining);
            this.elements.secondaryTimerDisplay.style.display = data.secondaryEnabled ? 'block' : 'none';
        }
    }

    formatTime(seconds) {
        if (seconds < 0) seconds = 0;
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    // Variable handling
    handleVariableUpdate(data) {
        if (data.roomId === this.roomId) {
            this.variables[data.name] = data.value;
            this.log(`Variable updated: ${data.name} = ${data.value}`);

            // Emit custom event for other systems
            window.dispatchEvent(new CustomEvent('variableUpdate', {
                detail: { name: data.name, value: data.value, roomId: data.roomId }
            }));
        }
    }

    // Chat functionality
    initializeChat() {
        if (this.elements.chatSend) {
            this.elements.chatSend.addEventListener('click', () => this.sendChatMessage());
        }

        if (this.elements.chatInput) {
            this.elements.chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.sendChatMessage();
                }
            });
        }
    }

    sendChatMessage() {
        if (!this.elements.chatInput || !this.connected) return;

        const message = this.elements.chatInput.value.trim();
        if (message) {
            this.socket.emit('chat_message', {
                roomId: this.roomId,
                message: message,
                sender: 'player',
                timestamp: Date.now()
            });

            this.elements.chatInput.value = '';
        }
    }

    handleChatMessage(data) {
        if (!this.elements.chatMessages) return;

        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${data.sender}`;

        const timestamp = new Date(data.timestamp).toLocaleTimeString();
        messageElement.innerHTML = `
            <div class="message-header">
                <span class="sender">${data.sender}</span>
                <span class="timestamp">${timestamp}</span>
            </div>
            <div class="message-content">${this.escapeHtml(data.message)}</div>
        `;

        this.elements.chatMessages.appendChild(messageElement);
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    }

    // Hint handling
    handleHintReceived(data) {
        this.log('Hint received:', data);

        if (this.hintType === 'broadcast') {
            this.showNotification('Hint', data.hint, 'info');
        } else if (this.hintType === 'chat') {
            this.handleChatMessage({
                sender: 'gm',
                message: data.hint,
                timestamp: Date.now()
            });
        }

        // Store hint
        this.hints.push({
            ...data,
            timestamp: Date.now()
        });
    }

    // Lightbox functionality
    initializeLightbox() {
        if (this.elements.lightboxClose) {
            this.elements.lightboxClose.addEventListener('click', () => this.closeLightbox());
        }

        if (this.elements.lightboxOverlay) {
            this.elements.lightboxOverlay.addEventListener('click', (e) => {
                if (e.target === this.elements.lightboxOverlay) {
                    this.closeLightbox();
                }
            });
        }

        // Test function for debugging
        window.testLightbox = () => {
            this.showLightbox({
                mediaId: null,
                headline: 'TEST LIGHTBOX',
                autoCloseEnabled: false
            });
        };
    }

    showLightbox(data) {
        if (!this.elements.lightboxOverlay || !this.elements.lightboxContent) {
            this.log('Lightbox elements not available');
            return;
        }

        this.log('Showing lightbox:', data);

        // Clear any existing auto-close timer
        if (this.autoCloseTimerId) {
            clearTimeout(this.autoCloseTimerId);
            this.autoCloseTimerId = null;
        }

        let content = '';

        if (data.mediaId && data.mediaPath) {
            const mediaPath = data.mediaPath.startsWith('/') ? data.mediaPath : `/uploads/${data.mediaPath}`;

            if (this.isImageFile(data.mediaPath)) {
                content += `<img src="${mediaPath}" alt="Lightbox Media" style="max-width: 100%; max-height: 80vh;">`;
            } else if (this.isVideoFile(data.mediaPath)) {
                content += `
                    <video controls autoplay style="max-width: 100%; max-height: 80vh;">
                        <source src="${mediaPath}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                `;
            }
        }

        if (data.headline) {
            content += `<h2>${this.escapeHtml(data.headline)}</h2>`;
        }

        if (data.message) {
            content += `<p>${this.escapeHtml(data.message)}</p>`;
        }

        this.elements.lightboxContent.innerHTML = content;
        this.elements.lightboxOverlay.style.display = 'flex';

        // Set up auto-close if enabled
        if (data.autoCloseEnabled && data.autoCloseDuration > 0) {
            this.allowManualClose = false;
            this.autoCloseTimerId = setTimeout(() => {
                this.closeLightbox();
                this.allowManualClose = true;
            }, data.autoCloseDuration * 1000);
        } else {
            this.allowManualClose = true;
        }

        // Emit custom event
        window.dispatchEvent(new CustomEvent('lightboxShown', { detail: data }));
    }

    closeLightbox() {
        if (!this.allowManualClose) return;

        if (this.elements.lightboxOverlay) {
            this.elements.lightboxOverlay.style.display = 'none';
        }

        if (this.autoCloseTimerId) {
            clearTimeout(this.autoCloseTimerId);
            this.autoCloseTimerId = null;
        }

        // Emit custom event
        window.dispatchEvent(new CustomEvent('lightboxClosed'));
        this.log('Lightbox closed');
    }

    // Utility methods
    isImageFile(filename) {
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
        return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext));
    }

    isVideoFile(filename) {
        const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
        return videoExtensions.some(ext => filename.toLowerCase().endsWith(ext));
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showConnectionStatus(status) {
        if (this.elements.connectionStatus) {
            this.elements.connectionStatus.textContent = status;
            this.elements.connectionStatus.className = `connection-status ${status.toLowerCase()}`;
        }
        this.log('Connection status:', status);
    }

    showError(message) {
        console.error('Player error:', message);

        if (this.elements.errorContainer) {
            this.elements.errorContainer.textContent = message;
            this.elements.errorContainer.style.display = 'block';
        } else {
            // Fallback to alert
            alert(message);
        }
    }

    showNotification(title, message, type = 'info') {
        // Use notification manager if available
        if (window.notificationManager) {
            window.notificationManager.show(message, { title, type });
            return;
        }

        // Fallback notification
        console.log(`[${type.toUpperCase()}] ${title}: ${message}`);

        // Simple visual notification
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <strong>${title}</strong><br>
            ${message}
        `;

        // Basic styling
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: type === 'error' ? '#f44336' : '#2196f3',
            color: 'white',
            padding: '15px',
            borderRadius: '5px',
            zIndex: '10000',
            maxWidth: '300px'
        });

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    log(...args) {
        if (this.options.debugMode) {
            console.log('[PlayerCore]', ...args);
        }
    }

    // Public API
    getState() {
        return {
            connected: this.connected,
            roomId: this.roomId,
            roomShortcode: this.roomShortcode,
            variables: { ...this.variables },
            hints: [...this.hints],
            mode: this.options.mode
        };
    }

    sendCustomMessage(type, data) {
        if (this.connected && this.socket) {
            this.socket.emit(type, { ...data, roomId: this.roomId });
        }
    }

    destroy() {
        if (this.socket) {
            this.socket.disconnect();
        }

        if (this.autoCloseTimerId) {
            clearTimeout(this.autoCloseTimerId);
        }

        // Clean up global references
        if (window.socket === this.socket) {
            delete window.socket;
        }

        this.log('Player Core destroyed');
    }
}

// Auto-initialize based on page context
function initializePlayer() {
    // Determine mode based on URL or page
    let mode = 'full';
    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.has('bare') || document.body.classList.contains('bare-mode')) {
        mode = 'bare';
    }

    // Initialize player
    const player = new PlayerCore({
        mode: mode,
        debugMode: urlParams.has('debug')
    });

    // Make available globally
    window.playerCore = player;

    return player;
}

// Export classes
window.PlayerCore = PlayerCore;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePlayer);
} else {
    initializePlayer();
}

console.log('Player Core system loaded');