const socket = io();

// Connection and DOM elements
let roomId = null;
let roomShortcode = null;
let variables = {};
let hints = [];
let hintType = 'broadcast';
let autoCloseTimerId = null;
let allowManualClose = true;

// Parse URL for room information - supports both long IDs and shortcodes
const pathSegments = window.location.pathname.split('/').filter(segment => segment);

if (pathSegments.length >= 1) {
    // Check if using shortcode route (/p/ABC123)
    if (pathSegments[0] === 'p' && pathSegments[1]) {
        roomShortcode = pathSegments[1].toUpperCase();
        roomId = 'loading'; // Will be resolved
    } else if (pathSegments.length >= 3 && pathSegments[0] === 'room' && pathSegments[2] === 'player') {
        // Traditional long ID route
        roomId = pathSegments[1];
    }
}

// DOM elements cache
const elements = {
    timerDisplay: document.getElementById('timer-display'),
    statusBadge: document.getElementById('status-badge'),
    roomTitle: document.getElementById('room-title'),
    variableDisplay: document.getElementById('variable-display'),
    configDisplay: document.getElementById('config-display'),
    hintContainer: document.getElementById('hint-container'),
    roomInfo: document.getElementById('room-info'),
    // Chat and hint UI
    chatSection: document.getElementById('chat-section'),
    chatLog: document.getElementById('chat-log'),
    chatInput: document.getElementById('chat-input'),
    hintsSection: document.getElementById('hints-section'),
    hintOverlay: document.getElementById('hint-overlay'),
    overlayText: document.getElementById('overlay-hint-text'),
    overlayClose: document.getElementById('hint-overlay-close'),
    lightbox: document.getElementById('lightbox'),
    lightboxContent: document.getElementById('lightbox-content'),
    lightboxHeadline: document.getElementById('lightbox-headline'),
    lightboxClose: document.getElementById('lightbox-close')
};

// Initialize application
initializePlayerApp();

// Main initialization function
function initializePlayerApp() {
    setupSocketListeners();
    loadInitialState();
    setupAnimations();
    setupUiHandlers();

    // Add loading state to status
    updateStatusBadge('connecting', 'Connecting...');
}

// Socket.io event listeners
function setupSocketListeners() {
    socket.on('connect', handleSocketConnected);
    socket.on('disconnect', handleSocketDisconnected);
    socket.on('timer_update', handleTimerUpdate);
    socket.on('timer_complete', () => {
        elements.timerDisplay.textContent = '00:00';
        elements.timerDisplay.style.animation = 'timerCompletePulse 1s infinite';
    });
    socket.on('variableUpdate', handleVariableUpdate);
    socket.on('hintReceived', handleHintReceived);
    socket.on('chat_message', handleChatMessage);
    socket.on('roomState', handleRoomState);
    socket.on('initialState', handleInitialState);
    socket.on('configUpdate', handleConfigUpdate);
    socket.on('clear_chat', handleClearChat);
    socket.on('clear_hints', handleClearHints);
    socket.on('show_lightbox', handleShowLightbox);
}

// Socket connection handlers
function handleSocketConnected() {
    console.log('Connected to server');

    if (roomId && roomId !== 'loading') {
        joinRoom(roomId);
        updateStatusBadge('connected', 'Connected to Room');
    } else if (roomShortcode) {
        resolveShortcodeAndJoin(roomShortcode);
    }
}

function handleSocketDisconnected() {
    console.log('Disconnected from server');
    updateStatusBadge('disconnected', 'Disconnected');
}

// Room management
function joinRoom(id) {
    console.log('Joining room:', id);
    socket.emit('join_room', { roomId: id, clientType: 'player' });

    // Update UI elements
    elements.roomInfo.style.display = 'block';
    elements.roomInfo.innerHTML = `
        <div>PID: <strong>${id}</strong></div>
    `;

    updateRoomTitle(id, 'Loading...');
    loadRoomDetails(id);
    fetchHintConfigAndToggle();
}

async function resolveShortcodeAndJoin(shortcode) {
    try {
        const response = await fetch(`/api/shortcode/${shortcode}`);
        const result = await response.json();

        if (result.success) {
            const room = result.data;
            roomId = room.id;
            joinRoom(roomId);
            updateStatusBadge('connected', `Connected via ${shortcode}`);
        } else {
            updateStatusBadge('error', 'Room not found');
            showNotFound(shortcode);
        }
    } catch (error) {
        console.error('Error resolving shortcode:', error);
        updateStatusBadge('error', 'Connection failed');
    }
}

async function loadRoomDetails(roomId) {
    try {
        const response = await fetch(`/api/rooms/${roomId}`);
        const result = await response.json();

        if (result.success) {
            const room = result.data;
            updateRoomTitle(room.name || 'Unnamed Room', room.shortcode);

            // If we used shortcode route, update URL to show actual room ID
            if (roomShortcode && history.replaceState) {
                history.replaceState(null, null, `/room/${room.id}/player`);
            }
        }
    } catch (error) {
        console.error('Error loading room details:', error);
    }
}

// UI Update functions
function updateStatusBadge(type, text) {
    const badge = elements.statusBadge;
    if (badge) {
        badge.textContent = text;
        badge.className = `status-badge status-${type}`;

        // Add animation class for status changes
        badge.style.animation = 'none';
        setTimeout(() => {
            badge.style.animation = 'pulseGlow 2s infinite';
        }, 10);
    }
}

function updateRoomTitle(name, shortcode) {
    const title = elements.roomTitle;
    if (title) {
        title.textContent = name;
    }

    if (shortcode && elements.roomInfo) {
        elements.roomInfo.innerHTML = `
            <div>PID: <strong>${roomId}</strong></div>
            <div>Code: <strong>${shortcode}</strong></div>
        `;
    }
}

// Real-time update handlers
function handleTimerUpdate(data) {
    if (elements.timerDisplay) {
        elements.timerDisplay.textContent = formatTime(data.remaining);
        addTimerAnimation();
    }
}

function handleVariableUpdate(update) {
    variables[update.name] = {
        'name': update.name,
        'value': update.value,
        'type': update.type || 'string'
    };

    renderVariables();
    addVariableAnimation('variable-display');
}

function handleHintReceived(hint) {
    if (hintType === 'broadcast') {
        showHintOverlay(hint.message);
    }

    hints.unshift({
        id: Date.now(),
        message: hint.message,
        timestamp: new Date().toLocaleTimeString(),
        new: true
    });

    // Keep only last 10 hints
    hints = hints.slice(0, 10);
    renderHints();

    // Clear "new" flag after animation
    setTimeout(() => {
        hints.forEach(h => h.new = false);
        renderHints();
    }, 1000);
}

function handleRoomState(state) {
    console.log('Room state received:', state);
    updateStatusBadge('active', 'Game Active');
}

function handleInitialState(state) {
    console.log('Initial state received:', state);
    updateStatusBadge('ready', 'Ready');
}

function handleConfigUpdate(config) {
    // Update config display
    if (elements.configDisplay) {
        elements.configDisplay.innerHTML = '';
        Object.keys(config).forEach(key => {
            const value = config[key];
            const item = document.createElement('span');
            item.className = 'state-item';
            item.innerHTML = `<strong>${key}:</strong> ${typeof value === 'object' ? JSON.stringify(value, null, 2).substring(0, 20) + '...' : value}`;
            elements.configDisplay.appendChild(item);
        });
    }
}

// Clear chat handler for GM-initiated clear
function handleClearChat() {
    clearChat();
}

// Clear hints handler for GM-initiated clear
function handleClearHints() {
    clearHints();
}

// Lightbox handler for GM-initiated media display
function handleShowLightbox(data) {
    showLightbox(data);
}

// Rendering functions
function renderVariables() {
    const container = elements.variableDisplay;
    if (!container) return;

    container.innerHTML = '';

    if (Object.keys(variables).length === 0) {
        container.innerHTML = '<span class="state-item">No variables set</span>';
        return;
    }

    Object.values(variables).forEach(variable => {
        const item = document.createElement('span');
        item.className = 'state-item';
        item.innerHTML = `<strong>${variable.name}:</strong> ${variable.value}`;
        container.appendChild(item);
    });
}

// Chat handlers and hint config
function setupUiHandlers() {
    // Send chat from player
    const sendBtn = document.getElementById('send-chat');
    if (sendBtn) {
        sendBtn.addEventListener('click', () => {
            const message = elements.chatInput ? elements.chatInput.value.trim() : '';
            if (!message || !roomId) return;
            socket.emit('chat_message', { roomId, sender: 'player', message });
            elements.chatInput.value = '';
        });
    }
    
    // Close hint overlay
    if (elements.overlayClose) {
        elements.overlayClose.addEventListener('click', () => {
            if (elements.hintOverlay) elements.hintOverlay.style.display = 'none';
        });
    }
    
    // Close lightbox
    if (elements.lightboxClose) {
        elements.lightboxClose.addEventListener('click', closeLightbox);
    }
    
    // Close lightbox when clicking outside content
    if (elements.lightbox) {
        elements.lightbox.addEventListener('click', (e) => {
            if (e.target === elements.lightbox && allowManualClose) {
                closeLightbox();
            }
        });
    }
}

function handleChatMessage(payload) {
    const log = elements.chatLog;
    if (!log) return;
    const row = document.createElement('div');
    row.className = 'chat-row';
    const who = payload.sender === 'gm' ? 'GM' : 'Player';
    row.textContent = `[${new Date(payload.timestamp || Date.now()).toLocaleTimeString()}] ${who}: ${payload.message}`;
    log.appendChild(row);
    // scroll container
    const container = log.parentElement;
    if (container) container.scrollTop = container.scrollHeight;
}

async function fetchHintConfigAndToggle() {
    try {
        if (!roomId) return;
        const res = await fetch(`/api/rooms/${roomId}/hints`);
        const data = await res.json();
        const type = (data && data.success && data.data && data.data.type) ? data.data.type : 'broadcast';
        hintType = type === 'chat' ? 'chat' : 'broadcast';
    } catch (e) {
        hintType = 'broadcast';
    }
    // Toggle sections
    if (elements.chatSection) elements.chatSection.style.display = (hintType === 'chat') ? '' : 'none';
    if (elements.hintsSection) elements.hintsSection.style.display = (hintType === 'broadcast') ? '' : 'none';
}

function showHintOverlay(message) {
    if (!elements.hintOverlay || !elements.overlayText) return;
    elements.overlayText.textContent = message;
    elements.hintOverlay.style.display = 'flex';
}

function renderHints() {
    const container = elements.hintContainer;
    if (!container) return;

    container.innerHTML = '';

    if (hints.length === 0) {
        container.innerHTML = `
            <div class="hint-card">
                <p>Welcome to the Quandary Control system!</p>
                <small>Awaiting game state...</small>
            </div>
        `;
        return;
    }

    hints.forEach(hint => {
        const card = document.createElement('div');
        card.className = `hint-card ${hint.new ? 'new' : ''}`;
        card.innerHTML = `
            <p>${hint.message}</p>
            <small>${hint.timestamp}</small>
        `;
        container.appendChild(card);
    });
}

// Clear chat function
function clearChat() {
    const chatLog = elements.chatLog;
    if (chatLog) {
        chatLog.innerHTML = '';
        // Add a message indicating chat was cleared
        const row = document.createElement('div');
        row.className = 'chat-row';
        row.textContent = `[${new Date().toLocaleTimeString()}] System: Chat cleared`;
        row.style.color = '#ff6b6b';
        chatLog.appendChild(row);
    }
}

// Clear hints function
function clearHints() {
    hints = [];
    renderHints();
    // Add a message indicating hints were cleared
    const container = elements.hintContainer;
    if (container) {
        container.innerHTML = `
            <div class="hint-card">
                <p>Hints have been cleared</p>
                <small>${new Date().toLocaleTimeString()}</small>
            </div>
        `;
    }
}

 // Lightbox functions
 function computeAdaptiveFontSize(text) {
     const len = (text || '').trim().length;
     if (len <= 5) return '14vw';
     if (len <= 10) return '12vw';
     if (len <= 25) return '9vw';
     if (len <= 60) return '6.5vw';
     if (len <= 120) return '4.5vw';
     if (len <= 200) return '3.2vw';
     return '2.4vw';
 }
 async function showLightbox(payload) {
    try {
        // Normalize payload
        const {
            mediaId = null,
            headline = '',
            autoCloseEnabled = true,
            autoCloseSeconds = 5
        } = payload || {};

        // Reset previous content and timers
        if (autoCloseTimerId) {
            clearTimeout(autoCloseTimerId);
            autoCloseTimerId = null;
        }
        elements.lightboxContent.innerHTML = '';

        // Manual close permission and X visibility
        allowManualClose = !autoCloseEnabled; // when autoclose ON, disable manual close
        if (elements.lightboxClose) {
            elements.lightboxClose.style.display = autoCloseEnabled ? 'none' : 'block';
        }

        // Text-only display when no mediaId provided
        if (!mediaId) {
            if (elements.lightboxHeadline) elements.lightboxHeadline.textContent = '';
            const fontSize = computeAdaptiveFontSize(headline);
            elements.lightboxContent.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:center;width:90vw;height:70vh;padding:1rem;text-align:center;">
                    <div style="white-space:pre-wrap;word-break:break-word;line-height:1.1;font-weight:700;font-size:${fontSize};">${headline || ''}</div>
                </div>
            `;

            if (autoCloseEnabled && Number(autoCloseSeconds) > 0) {
                autoCloseTimerId = setTimeout(() => closeLightbox(), Number(autoCloseSeconds) * 1000);
            }

            if (elements.lightbox) elements.lightbox.style.display = 'flex';
            return;
        }

        // Fetch media details
        const response = await fetch(`/api/media/${mediaId}`);
        const res = await response.json();

        if (res.success && res.data) {
            const media = res.data;

            if (elements.lightboxHeadline) elements.lightboxHeadline.textContent = headline || '';

            if (media.type === 'image') {
                elements.lightboxContent.innerHTML = `<img src="${media.url}" alt="${media.title || 'Media'}">`;

                if (autoCloseEnabled && Number(autoCloseSeconds) > 0) {
                    autoCloseTimerId = setTimeout(() => closeLightbox(), Number(autoCloseSeconds) * 1000);
                }
            } else if (media.type === 'video') {
                const video = document.createElement('video');
                video.src = media.url;
                video.controls = true;
                video.autoplay = true;

                // Always autoclose after video length
                const setVideoAutoClose = () => {
                    const ms = Math.max(0, (video.duration || 0) * 1000);
                    if (ms > 0) {
                        autoCloseTimerId = setTimeout(() => closeLightbox(), ms);
                    }
                };
                video.addEventListener('loadedmetadata', setVideoAutoClose);
                video.addEventListener('ended', closeLightbox);

                elements.lightboxContent.appendChild(video);
            }

            if (elements.lightbox) elements.lightbox.style.display = 'flex';
        }
    } catch (error) {
        console.error('Failed to load media for lightbox:', error);
    }
}

function closeLightbox() {
    // Clear timers and restore manual close
    if (autoCloseTimerId) {
        clearTimeout(autoCloseTimerId);
        autoCloseTimerId = null;
    }
    allowManualClose = true;

    if (elements.lightbox) {
        elements.lightbox.style.display = 'none';
    }

    // Show close button again for next open by default
    if (elements.lightboxClose) {
        elements.lightboxClose.style.display = 'block';
    }
    
    // Stop any playing videos
    const videos = elements.lightboxContent?.querySelectorAll('video');
    videos?.forEach(video => {
        video.pause();
        video.src = '';
    });
}

// Utility functions
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

function showNotFound(shortcode) {
    document.body.innerHTML = `
        <div style="
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: #ff6b6b;
            font-family: 'Segoe UI', sans-serif;
        ">
            <h1 style="
                font-size: 3rem;
                margin-bottom: 1rem;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            ">
                Room Not Found
            </h1>
            <p style="font-size: 1.2rem; margin-bottom: 2rem;">
                No room found for shortcode: <strong>${shortcode}</strong>
            </p>
            <p style="color: #b3b3b3; margin-bottom: 2rem;">
                Please check your shortcode or ask the game master for a valid one.
            </p>
            <button onclick="window.location.href='/'" style="
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                border: none;
                color: white;
                padding: 1rem 2rem;
                border-radius: 25px;
                font-size: 1rem;
                cursor: pointer;
                transition: transform 0.3s ease;
            " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                ← Back to Admin
            </button>
        </div>
    `;
}

// Animation functions
function setupAnimations() {
    // Add entrance animations
    const cards = document.querySelectorAll('.state-card, .timer-section, .hints-section, .header');
    cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
        card.style.opacity = '0';
        setTimeout(() => card.style.opacity = '1', 100);
    });
}

function addTimerAnimation() {
    const display = elements.timerDisplay;
    if (display) {
        display.style.animation = 'none';
        setTimeout(() => {
            display.style.animation = 'timerPulse 1s ease-in-out'; // Restore pulse without permanent active state
        }, 10); // Small delay to restart animation

        // Keep the timer animation subtle and not overly commanding
        setTimeout(() => {
            display.style.animation = 'none';
        }, 1000); // Remove animation after 1 second
    }
}

function addVariableAnimation(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.style.animation = 'none';
        setTimeout(() => {
            container.style.animation = 'slideInLeft 0.5s ease-out';
        }, 10);
    }
}

// Public functions for button interaction
function requestUpdate() {
    socket.emit('requestInitialState');
    updateStatusBadge('refreshing', 'Refreshing...');

    // Show brief loading animation
    const button = event.target;
    button.style.animation = 'shake 0.5s ease-in-out';
    button.textContent = 'Updating...';

    setTimeout(() => {
        button.style.animation = 'none';
        button.textContent = 'Refresh Status';
    }, 500);
}

// Setup initial state
function loadInitialState() {
    renderVariables();
    renderHints();

    // Auto-refresh status periodically
    setInterval(() => {
        if (socket.connected) {
            updateStatusBadge('connected', 'Connected to Room');
        }
    }, 30000); // Every 30 seconds
}

// Export for global access if needed
window.playerApp = {
    requestUpdate,
    getCurrentRoomId: () => roomId,
    getVariables: () => ({...variables}),
    getHints: () => [...hints]
};