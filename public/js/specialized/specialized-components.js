/**
 * Consolidated Specialized Components
 * Consolidated from: androidtv.js, advanced-editor.js, gm-notifications.js
 *
 * Provides specialized functionality for Android TV, advanced editing, and GM notifications
 */

// Android TV Interface - Optimized for D-pad navigation
class AndroidTVInterface {
    constructor() {
        this.focusableElements = [];
        this.currentFocus = 0;
        this.navigationEnabled = true;
        this.remoteMapping = {
            // Standard Android TV remote keys
            'ArrowUp': 'KEYCODE_DPAD_UP',
            'ArrowDown': 'KEYCODE_DPAD_DOWN',
            'ArrowLeft': 'KEYCODE_DPAD_LEFT',
            'ArrowRight': 'KEYCODE_DPAD_RIGHT',
            'Enter': 'KEYCODE_DPAD_CENTER',
            'Escape': 'KEYCODE_BACK',
            'Home': 'KEYCODE_HOME'
        };

        this.init();
    }

    init() {
        if (!this.isAndroidTV()) {
            console.log('Android TV interface not needed on this platform');
            return;
        }

        this.setupDpadNavigation();
        this.optimizeForTV();
        this.setupEventListeners();

        console.log('Android TV interface initialized');
    }

    isAndroidTV() {
        // Check if running on Android TV
        const userAgent = navigator.userAgent;
        return userAgent.includes('Android') && (
            userAgent.includes('TV') ||
            userAgent.includes('AFT') || // Fire TV
            window.location.search.includes('androidtv=true')
        );
    }

    setupDpadNavigation() {
        // Add focusable class to interactive elements
        const selectors = [
            'button',
            'input',
            'select',
            'textarea',
            'a[href]',
            '[tabindex]:not([tabindex="-1"])',
            '.focusable'
        ];

        this.focusableElements = Array.from(document.querySelectorAll(selectors.join(',')))
            .filter(el => {
                return !el.disabled &&
                       !el.hidden &&
                       getComputedStyle(el).display !== 'none' &&
                       getComputedStyle(el).visibility !== 'hidden';
            });

        // Add TV-friendly styling
        this.focusableElements.forEach((element, index) => {
            element.classList.add('tv-focusable');
            element.dataset.tvIndex = index;
        });

        // Set initial focus
        if (this.focusableElements.length > 0) {
            this.setFocus(0);
        }
    }

    optimizeForTV() {
        // Add TV-specific CSS classes
        document.body.classList.add('android-tv');

        // Create TV-optimized styles
        this.injectTVStyles();

        // Optimize text sizes and spacing
        this.optimizeTextAndSpacing();

        // Setup overscan safe area
        this.setupOverscanSafeArea();
    }

    injectTVStyles() {
        if (document.getElementById('android-tv-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'android-tv-styles';
        styles.textContent = `
            .android-tv {
                font-size: 18px;
                line-height: 1.6;
                cursor: none;
            }

            .tv-focusable {
                outline: 3px solid transparent;
                transition: all 0.2s ease;
                border-radius: 8px;
            }

            .tv-focusable.tv-focused {
                outline: 3px solid #2196F3;
                transform: scale(1.05);
                z-index: 10;
                position: relative;
            }

            .tv-safe-area {
                margin: 48px;
                padding: 24px;
            }

            .tv-grid {
                display: grid;
                gap: 24px;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            }

            .tv-button {
                padding: 16px 24px;
                font-size: 18px;
                min-height: 56px;
                border-radius: 8px;
                border: 2px solid #ccc;
                background: #fff;
                cursor: pointer;
            }

            .tv-button.tv-focused {
                background: #e3f2fd;
                border-color: #2196F3;
                color: #1976d2;
            }

            .tv-text {
                font-size: 20px;
                line-height: 1.8;
                margin-bottom: 16px;
            }

            .tv-timer {
                font-size: 48px;
                font-weight: bold;
                text-align: center;
                padding: 24px;
                background: #000;
                color: #fff;
                border-radius: 12px;
                font-family: 'Courier New', monospace;
            }

            .tv-notification {
                position: fixed;
                top: 10%;
                left: 10%;
                right: 10%;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 32px;
                font-size: 24px;
                text-align: center;
                border-radius: 12px;
                z-index: 1000;
            }

            .tv-modal {
                background: rgba(0, 0, 0, 0.8);
                padding: 48px;
            }

            .tv-modal .modal-content {
                background: white;
                padding: 48px;
                border-radius: 16px;
                max-width: 80%;
                margin: 0 auto;
            }

            .tv-hidden {
                display: none !important;
            }
        `;
        document.head.appendChild(styles);
    }

    optimizeTextAndSpacing() {
        // Increase font sizes for better readability on TV
        const textElements = document.querySelectorAll('p, span, div, label');
        textElements.forEach(el => {
            if (!el.classList.contains('tv-text')) {
                el.classList.add('tv-text');
            }
        });

        // Optimize buttons
        const buttons = document.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.classList.add('tv-button');
        });

        // Optimize timers
        const timers = document.querySelectorAll('.timer, .timer-display, [data-component="timer"]');
        timers.forEach(timer => {
            timer.classList.add('tv-timer');
        });
    }

    setupOverscanSafeArea() {
        const mainContent = document.querySelector('main, .main-content, .container');
        if (mainContent) {
            mainContent.classList.add('tv-safe-area');
        }
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.handleRemoteInput(e));

        // Handle focus changes
        document.addEventListener('focusin', (e) => this.handleFocusIn(e));

        // Handle element visibility changes
        const observer = new MutationObserver(() => this.refreshFocusableElements());
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class', 'hidden', 'disabled']
        });
    }

    handleRemoteInput(e) {
        if (!this.navigationEnabled) return;

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                this.navigateUp();
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.navigateDown();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.navigateLeft();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.navigateRight();
                break;
            case 'Enter':
                e.preventDefault();
                this.activateCurrentElement();
                break;
            case 'Escape':
                e.preventDefault();
                this.handleBack();
                break;
        }
    }

    navigateUp() {
        const current = this.getCurrentElement();
        const candidates = this.findElementsAbove(current);
        if (candidates.length > 0) {
            const closest = this.findClosestElement(current, candidates);
            this.setFocus(this.focusableElements.indexOf(closest));
        }
    }

    navigateDown() {
        const current = this.getCurrentElement();
        const candidates = this.findElementsBelow(current);
        if (candidates.length > 0) {
            const closest = this.findClosestElement(current, candidates);
            this.setFocus(this.focusableElements.indexOf(closest));
        }
    }

    navigateLeft() {
        const current = this.getCurrentElement();
        const candidates = this.findElementsLeft(current);
        if (candidates.length > 0) {
            const closest = this.findClosestElement(current, candidates);
            this.setFocus(this.focusableElements.indexOf(closest));
        }
    }

    navigateRight() {
        const current = this.getCurrentElement();
        const candidates = this.findElementsRight(current);
        if (candidates.length > 0) {
            const closest = this.findClosestElement(current, candidates);
            this.setFocus(this.focusableElements.indexOf(closest));
        }
    }

    findElementsAbove(element) {
        const rect = element.getBoundingClientRect();
        return this.focusableElements.filter(el => {
            const elRect = el.getBoundingClientRect();
            return elRect.bottom <= rect.top;
        });
    }

    findElementsBelow(element) {
        const rect = element.getBoundingClientRect();
        return this.focusableElements.filter(el => {
            const elRect = el.getBoundingClientRect();
            return elRect.top >= rect.bottom;
        });
    }

    findElementsLeft(element) {
        const rect = element.getBoundingClientRect();
        return this.focusableElements.filter(el => {
            const elRect = el.getBoundingClientRect();
            return elRect.right <= rect.left;
        });
    }

    findElementsRight(element) {
        const rect = element.getBoundingClientRect();
        return this.focusableElements.filter(el => {
            const elRect = el.getBoundingClientRect();
            return elRect.left >= rect.right;
        });
    }

    findClosestElement(current, candidates) {
        const currentRect = current.getBoundingClientRect();
        const currentCenter = {
            x: currentRect.left + currentRect.width / 2,
            y: currentRect.top + currentRect.height / 2
        };

        let closest = candidates[0];
        let closestDistance = Infinity;

        candidates.forEach(candidate => {
            const candidateRect = candidate.getBoundingClientRect();
            const candidateCenter = {
                x: candidateRect.left + candidateRect.width / 2,
                y: candidateRect.top + candidateRect.height / 2
            };

            const distance = Math.sqrt(
                Math.pow(candidateCenter.x - currentCenter.x, 2) +
                Math.pow(candidateCenter.y - currentCenter.y, 2)
            );

            if (distance < closestDistance) {
                closest = candidate;
                closestDistance = distance;
            }
        });

        return closest;
    }

    setFocus(index) {
        // Remove previous focus
        this.focusableElements.forEach(el => el.classList.remove('tv-focused'));

        // Set new focus
        if (index >= 0 && index < this.focusableElements.length) {
            this.currentFocus = index;
            const element = this.focusableElements[index];
            element.classList.add('tv-focused');
            element.focus();

            // Scroll into view if needed
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center'
            });
        }
    }

    getCurrentElement() {
        return this.focusableElements[this.currentFocus];
    }

    activateCurrentElement() {
        const element = this.getCurrentElement();
        if (element) {
            element.click();
        }
    }

    handleBack() {
        // Handle back button (escape key)
        const event = new CustomEvent('androidtv:back');
        document.dispatchEvent(event);
    }

    handleFocusIn(e) {
        const element = e.target;
        if (this.focusableElements.includes(element)) {
            this.currentFocus = this.focusableElements.indexOf(element);
            element.classList.add('tv-focused');
        }
    }

    refreshFocusableElements() {
        // Refresh the list of focusable elements
        setTimeout(() => {
            this.setupDpadNavigation();
        }, 100);
    }

    showTVNotification(message, duration = 3000) {
        const notification = document.createElement('div');
        notification.className = 'tv-notification';
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, duration);
    }

    enableNavigation() {
        this.navigationEnabled = true;
    }

    disableNavigation() {
        this.navigationEnabled = false;
    }
}

// Advanced Editor - Rich text and code editing capabilities
class AdvancedEditor {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.options = {
            mode: 'rich', // 'rich', 'code', 'markdown'
            theme: 'light',
            language: 'javascript',
            readOnly: false,
            autoSave: true,
            autoSaveDelay: 2000,
            ...options
        };

        this.content = '';
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 50;
        this.autoSaveTimer = null;
        this.dirty = false;

        this.init();
    }

    init() {
        this.createEditor();
        this.setupEventListeners();

        if (this.options.autoSave) {
            this.setupAutoSave();
        }
    }

    createEditor() {
        this.container.innerHTML = `
            <div class="advanced-editor">
                <div class="editor-toolbar">
                    <div class="toolbar-group">
                        <button class="toolbar-btn" data-action="bold" title="Bold">B</button>
                        <button class="toolbar-btn" data-action="italic" title="Italic">I</button>
                        <button class="toolbar-btn" data-action="underline" title="Underline">U</button>
                    </div>
                    <div class="toolbar-group">
                        <button class="toolbar-btn" data-action="undo" title="Undo">↶</button>
                        <button class="toolbar-btn" data-action="redo" title="Redo">↷</button>
                    </div>
                    <div class="toolbar-group">
                        <select class="mode-selector" id="editor-mode">
                            <option value="rich">Rich Text</option>
                            <option value="code">Code</option>
                            <option value="markdown">Markdown</option>
                        </select>
                    </div>
                </div>

                <div class="editor-content">
                    <div class="rich-editor" id="rich-editor" contenteditable="true" style="${this.options.mode !== 'rich' ? 'display: none;' : ''}"></div>
                    <textarea class="code-editor" id="code-editor" style="${this.options.mode !== 'code' ? 'display: none;' : ''}"></textarea>
                    <textarea class="markdown-editor" id="markdown-editor" style="${this.options.mode !== 'markdown' ? 'display: none;' : ''}"></textarea>
                </div>

                <div class="editor-status">
                    <span class="status-text" id="editor-status">Ready</span>
                    <span class="word-count" id="word-count">0 words</span>
                </div>
            </div>
        `;

        this.elements = {
            toolbar: this.container.querySelector('.editor-toolbar'),
            richEditor: this.container.querySelector('#rich-editor'),
            codeEditor: this.container.querySelector('#code-editor'),
            markdownEditor: this.container.querySelector('#markdown-editor'),
            modeSelector: this.container.querySelector('#editor-mode'),
            statusText: this.container.querySelector('#editor-status'),
            wordCount: this.container.querySelector('#word-count')
        };

        // Set initial mode
        this.elements.modeSelector.value = this.options.mode;
        this.switchMode(this.options.mode);
    }

    setupEventListeners() {
        // Toolbar actions
        this.elements.toolbar.addEventListener('click', (e) => {
            if (e.target.classList.contains('toolbar-btn')) {
                const action = e.target.dataset.action;
                this.executeAction(action);
            }
        });

        // Mode switching
        this.elements.modeSelector.addEventListener('change', (e) => {
            this.switchMode(e.target.value);
        });

        // Content change detection
        this.elements.richEditor.addEventListener('input', () => this.handleContentChange());
        this.elements.codeEditor.addEventListener('input', () => this.handleContentChange());
        this.elements.markdownEditor.addEventListener('input', () => this.handleContentChange());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }

    setupAutoSave() {
        this.autoSaveTimer = setInterval(() => {
            if (this.dirty) {
                this.saveContent();
            }
        }, this.options.autoSaveDelay);
    }

    switchMode(mode) {
        this.options.mode = mode;

        // Hide all editors
        this.elements.richEditor.style.display = 'none';
        this.elements.codeEditor.style.display = 'none';
        this.elements.markdownEditor.style.display = 'none';

        // Show selected editor
        switch (mode) {
            case 'rich':
                this.elements.richEditor.style.display = 'block';
                break;
            case 'code':
                this.elements.codeEditor.style.display = 'block';
                this.setupCodeEditor();
                break;
            case 'markdown':
                this.elements.markdownEditor.style.display = 'block';
                break;
        }

        this.updateStatus(`Switched to ${mode} mode`);
    }

    setupCodeEditor() {
        // Add syntax highlighting classes
        this.elements.codeEditor.classList.add('code-highlighting');
        this.elements.codeEditor.setAttribute('data-language', this.options.language);
    }

    executeAction(action) {
        switch (action) {
            case 'bold':
                this.formatText('bold');
                break;
            case 'italic':
                this.formatText('italic');
                break;
            case 'underline':
                this.formatText('underline');
                break;
            case 'undo':
                this.undo();
                break;
            case 'redo':
                this.redo();
                break;
        }
    }

    formatText(command) {
        if (this.options.mode === 'rich') {
            document.execCommand(command);
            this.handleContentChange();
        }
    }

    handleContentChange() {
        this.content = this.getCurrentContent();
        this.dirty = true;
        this.addToHistory();
        this.updateWordCount();
        this.updateStatus('Modified');

        // Emit change event
        this.container.dispatchEvent(new CustomEvent('contentchange', {
            detail: { content: this.content, mode: this.options.mode }
        }));
    }

    getCurrentContent() {
        switch (this.options.mode) {
            case 'rich':
                return this.elements.richEditor.innerHTML;
            case 'code':
                return this.elements.codeEditor.value;
            case 'markdown':
                return this.elements.markdownEditor.value;
            default:
                return '';
        }
    }

    setContent(content) {
        switch (this.options.mode) {
            case 'rich':
                this.elements.richEditor.innerHTML = content;
                break;
            case 'code':
                this.elements.codeEditor.value = content;
                break;
            case 'markdown':
                this.elements.markdownEditor.value = content;
                break;
        }
        this.content = content;
        this.dirty = false;
        this.updateWordCount();
    }

    addToHistory() {
        // Remove any history after current index
        this.history = this.history.slice(0, this.historyIndex + 1);

        // Add current state to history
        this.history.push({
            content: this.content,
            mode: this.options.mode,
            timestamp: Date.now()
        });

        // Limit history size
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const state = this.history[this.historyIndex];
            this.setContent(state.content);
            this.updateStatus('Undo');
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const state = this.history[this.historyIndex];
            this.setContent(state.content);
            this.updateStatus('Redo');
        }
    }

    updateWordCount() {
        let text = '';
        switch (this.options.mode) {
            case 'rich':
                text = this.elements.richEditor.textContent || '';
                break;
            case 'code':
            case 'markdown':
                text = this.content;
                break;
        }

        const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length;
        this.elements.wordCount.textContent = `${wordCount} words`;
    }

    updateStatus(message) {
        this.elements.statusText.textContent = message;

        // Clear status after delay
        setTimeout(() => {
            if (this.elements.statusText.textContent === message) {
                this.elements.statusText.textContent = 'Ready';
            }
        }, 2000);
    }

    handleKeyboardShortcuts(e) {
        if (!this.container.contains(document.activeElement)) return;

        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'b':
                    e.preventDefault();
                    this.executeAction('bold');
                    break;
                case 'i':
                    e.preventDefault();
                    this.executeAction('italic');
                    break;
                case 'u':
                    e.preventDefault();
                    this.executeAction('underline');
                    break;
                case 'z':
                    e.preventDefault();
                    if (e.shiftKey) {
                        this.executeAction('redo');
                    } else {
                        this.executeAction('undo');
                    }
                    break;
                case 's':
                    e.preventDefault();
                    this.saveContent();
                    break;
            }
        }
    }

    saveContent() {
        this.dirty = false;
        this.updateStatus('Saved');

        // Emit save event
        this.container.dispatchEvent(new CustomEvent('save', {
            detail: { content: this.content, mode: this.options.mode }
        }));
    }

    getContent() {
        return this.getCurrentContent();
    }

    destroy() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }
    }
}

// GM Notifications - Game Master notification system
class GMNotifications {
    constructor(roomId) {
        this.roomId = roomId;
        this.socket = null;
        this.notifications = [];
        this.audioContext = null;
        this.soundCache = new Map();
        this.config = {
            soundEnabled: true,
            volume: 0.7,
            showToasts: true,
            playOnHint: true,
            playOnChat: true,
            playOnTimer: false
        };

        this.init();
    }

    async init() {
        await this.initializeAudio();
        this.setupSocketConnection();
        this.createNotificationInterface();
        this.loadSettings();

        console.log('GM Notifications initialized for room:', this.roomId);
    }

    async initializeAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Resume audio context on user interaction
            document.addEventListener('click', () => {
                if (this.audioContext.state === 'suspended') {
                    this.audioContext.resume();
                }
            }, { once: true });

            // Preload default sounds
            await this.preloadSounds();
        } catch (error) {
            console.warn('Audio initialization failed:', error);
            this.config.soundEnabled = false;
        }
    }

    async preloadSounds() {
        const defaultSounds = {
            hint: '/sounds/hint.mp3',
            chat: '/sounds/chat.mp3',
            timer: '/sounds/timer.mp3',
            success: '/sounds/success.mp3',
            warning: '/sounds/warning.mp3'
        };

        const loadPromises = Object.entries(defaultSounds).map(async ([key, url]) => {
            try {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                this.soundCache.set(key, audioBuffer);
            } catch (error) {
                console.warn(`Failed to load sound ${key}:`, error);
            }
        });

        await Promise.allSettled(loadPromises);
    }

    setupSocketConnection() {
        if (typeof io !== 'undefined') {
            this.socket = io();
            this.socket.emit('join_room', { roomId: this.roomId, clientType: 'gm' });

            this.socket.on('hintSent', (data) => this.handleHintNotification(data));
            this.socket.on('chat_message', (data) => this.handleChatNotification(data));
            this.socket.on('timer_update', (data) => this.handleTimerNotification(data));
            this.socket.on('playerJoined', (data) => this.handlePlayerJoinedNotification(data));
            this.socket.on('playerLeft', (data) => this.handlePlayerLeftNotification(data));

            this.socket.on('connect', () => {
                this.showNotification('Connected', 'GM notifications active', 'success');
            });

            this.socket.on('disconnect', () => {
                this.showNotification('Disconnected', 'Connection lost', 'warning');
            });
        }
    }

    createNotificationInterface() {
        // Create floating notification area
        const notificationArea = document.createElement('div');
        notificationArea.id = 'gm-notifications';
        notificationArea.className = 'gm-notifications';
        notificationArea.innerHTML = `
            <div class="notification-header">
                <h4>Notifications</h4>
                <button id="clear-notifications" class="clear-btn">Clear</button>
            </div>
            <div class="notification-list" id="notification-list"></div>
        `;

        document.body.appendChild(notificationArea);

        // Setup event listeners
        document.getElementById('clear-notifications')?.addEventListener('click', () => {
            this.clearNotifications();
        });

        // Add styles
        this.injectNotificationStyles();
    }

    injectNotificationStyles() {
        if (document.getElementById('gm-notification-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'gm-notification-styles';
        styles.textContent = `
            .gm-notifications {
                position: fixed;
                top: 20px;
                right: 20px;
                width: 300px;
                max-height: 400px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 10000;
                overflow: hidden;
            }

            .notification-header {
                background: #2196f3;
                color: white;
                padding: 12px 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .notification-header h4 {
                margin: 0;
                font-size: 14px;
            }

            .clear-btn {
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                font-size: 12px;
            }

            .clear-btn:hover {
                text-decoration: underline;
            }

            .notification-list {
                max-height: 340px;
                overflow-y: auto;
            }

            .notification-item {
                padding: 12px 16px;
                border-bottom: 1px solid #eee;
                font-size: 13px;
            }

            .notification-item:last-child {
                border-bottom: none;
            }

            .notification-item.hint {
                border-left: 4px solid #4caf50;
            }

            .notification-item.chat {
                border-left: 4px solid #2196f3;
            }

            .notification-item.timer {
                border-left: 4px solid #ff9800;
            }

            .notification-item.player {
                border-left: 4px solid #9c27b0;
            }

            .notification-title {
                font-weight: bold;
                margin-bottom: 4px;
            }

            .notification-message {
                color: #666;
                margin-bottom: 4px;
            }

            .notification-time {
                color: #999;
                font-size: 11px;
            }

            .toast-notification {
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #333;
                color: white;
                padding: 16px 24px;
                border-radius: 8px;
                z-index: 10001;
                opacity: 0;
                transition: opacity 0.3s ease;
            }

            .toast-notification.show {
                opacity: 1;
            }
        `;
        document.head.appendChild(styles);
    }

    handleHintNotification(data) {
        this.addNotification({
            type: 'hint',
            title: 'Hint Sent',
            message: `Hint sent to room: ${data.hint}`,
            timestamp: Date.now()
        });

        if (this.config.playOnHint) {
            this.playSound('hint');
        }

        if (this.config.showToasts) {
            this.showToast('Hint sent successfully');
        }
    }

    handleChatNotification(data) {
        if (data.sender === 'gm') return; // Don't notify on own messages

        this.addNotification({
            type: 'chat',
            title: 'Player Message',
            message: `${data.sender}: ${data.message}`,
            timestamp: data.timestamp
        });

        if (this.config.playOnChat) {
            this.playSound('chat');
        }

        if (this.config.showToasts) {
            this.showToast(`New message from ${data.sender}`);
        }
    }

    handleTimerNotification(data) {
        // Notify on important timer events
        if (data.timeRemaining <= 60 && data.timeRemaining > 0) { // Last minute
            this.addNotification({
                type: 'timer',
                title: 'Timer Warning',
                message: 'Less than 1 minute remaining!',
                timestamp: Date.now()
            });

            if (this.config.playOnTimer) {
                this.playSound('warning');
            }
        } else if (data.timeRemaining === 0) { // Time up
            this.addNotification({
                type: 'timer',
                title: 'Time Up',
                message: 'Timer has reached zero!',
                timestamp: Date.now()
            });

            if (this.config.playOnTimer) {
                this.playSound('timer');
            }
        }
    }

    handlePlayerJoinedNotification(data) {
        this.addNotification({
            type: 'player',
            title: 'Player Joined',
            message: `A player joined the room`,
            timestamp: Date.now()
        });
    }

    handlePlayerLeftNotification(data) {
        this.addNotification({
            type: 'player',
            title: 'Player Left',
            message: `A player left the room`,
            timestamp: Date.now()
        });
    }

    addNotification(notification) {
        this.notifications.unshift(notification);

        // Limit notifications
        if (this.notifications.length > 50) {
            this.notifications = this.notifications.slice(0, 50);
        }

        this.renderNotifications();
    }

    renderNotifications() {
        const notificationList = document.getElementById('notification-list');
        if (!notificationList) return;

        notificationList.innerHTML = this.notifications.map(notification => `
            <div class="notification-item ${notification.type}">
                <div class="notification-title">${notification.title}</div>
                <div class="notification-message">${notification.message}</div>
                <div class="notification-time">${this.formatTime(notification.timestamp)}</div>
            </div>
        `).join('');
    }

    showNotification(title, message, type = 'info') {
        this.addNotification({
            type,
            title,
            message,
            timestamp: Date.now()
        });
    }

    showToast(message, duration = 3000) {
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = message;
        document.body.appendChild(toast);

        // Show toast
        setTimeout(() => toast.classList.add('show'), 100);

        // Hide and remove toast
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
    }

    playSound(soundName) {
        if (!this.config.soundEnabled || !this.audioContext) return;

        const audioBuffer = this.soundCache.get(soundName);
        if (!audioBuffer) return;

        try {
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();

            source.buffer = audioBuffer;
            gainNode.gain.value = this.config.volume;

            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            source.start();
        } catch (error) {
            console.warn('Failed to play sound:', error);
        }
    }

    clearNotifications() {
        this.notifications = [];
        this.renderNotifications();
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    loadSettings() {
        try {
            const stored = localStorage.getItem('gm_notification_settings');
            if (stored) {
                Object.assign(this.config, JSON.parse(stored));
            }
        } catch (error) {
            console.warn('Failed to load notification settings:', error);
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('gm_notification_settings', JSON.stringify(this.config));
        } catch (error) {
            console.warn('Failed to save notification settings:', error);
        }
    }

    updateSettings(newSettings) {
        Object.assign(this.config, newSettings);
        this.saveSettings();
    }

    destroy() {
        if (this.socket) {
            this.socket.disconnect();
        }

        if (this.audioContext) {
            this.audioContext.close();
        }

        const notificationArea = document.getElementById('gm-notifications');
        if (notificationArea) {
            notificationArea.remove();
        }
    }
}

// Export classes
window.AndroidTVInterface = AndroidTVInterface;
window.AdvancedEditor = AdvancedEditor;
window.GMNotifications = GMNotifications;

// Auto-initialize Android TV interface if needed
if (!window.androidTV) {
    window.androidTV = new AndroidTVInterface();
}

console.log('Specialized Components loaded');