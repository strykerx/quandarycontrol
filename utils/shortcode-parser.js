const fs = require('fs');
const path = require('path');

class ShortcodeParser {
    constructor() {
        this.components = {
            timer: this.renderTimer,
            'secondary-timer': this.renderSecondaryTimer,
            chat: this.renderChat,
            hints: this.renderHints,
            variables: this.renderVariables,
            media: this.renderMedia,
            'room-info': this.renderRoomInfo,
            'game-state': this.renderGameState,
            notifications: this.renderNotifications
        };
    }

    /**
     * Parse shortcodes in HTML content
     * @param {string} html - HTML content with shortcodes
     * @param {object} roomData - Room data for component rendering
     * @returns {string} - HTML with shortcodes replaced by components
     */
    parse(html, roomData = {}) {
        // Regex to match shortcodes like [timer] or [timer format="mm:ss"]
        const shortcodeRegex = /\[(\w+(?:-\w+)*)(.*?)\]/g;
        
        return html.replace(shortcodeRegex, (match, componentName, attributes) => {
            const component = this.components[componentName];
            if (!component) {
                console.warn(`Unknown shortcode: ${componentName}`);
                return match; // Return original shortcode if unknown
            }
            
            // Parse attributes
            const attrs = this.parseAttributes(attributes);
            return component.call(this, attrs, roomData);
        });
    }

    /**
     * Parse shortcode attributes
     * @param {string} attributeString - String containing attributes
     * @returns {object} - Parsed attributes
     */
    parseAttributes(attributeString) {
        const attrs = {};
        if (!attributeString.trim()) return attrs;

        // Match attribute="value" pairs
        const attrRegex = /(\w+)=["']([^"']*?)["']/g;
        let match;
        while ((match = attrRegex.exec(attributeString)) !== null) {
            attrs[match[1]] = match[2];
        }
        return attrs;
    }

    renderTimer(attrs, roomData) {
        const format = attrs.format || 'mm:ss';
        const showControls = attrs.showControls !== 'false';
        const showConnectionStatus = attrs.connection_status !== 'false';
        const className = attrs.class || '';
        
        return `
            <div class="timer-component ${className}">
                <div id="timer-display" class="timer-display ${className}" data-format="${format}">00:00</div>
                ${showConnectionStatus ? '<div id="status-badge" class="timer-status">Ready</div>' : ''}
                ${showControls ? '<div class="timer-controls" id="timer-controls"></div>' : ''}
            </div>
        `;
    }

    renderSecondaryTimer(attrs, roomData) {
        const format = attrs.format || 'mm:ss';
        const showControls = attrs.showControls === 'true';
        const className = attrs.class || '';
        
        return `
            <div id="secondary-timer-component" class="secondary-timer-component ${className}" style="display: none;">
                <div id="secondary-timer-display" class="secondary-timer-display ${className}" data-format="${format}">00:00</div>
                ${showControls ? '<div class="secondary-timer-controls" id="secondary-timer-controls"></div>' : ''}
            </div>
        `;
    }

    renderChat(attrs, roomData) {
        const maxMessages = attrs.maxMessages || '50';
        const showTimestamps = attrs.showTimestamps !== 'false';
        const allowUserInput = attrs.allowUserInput !== 'false';
        
        return `
            <div class="chat-component" id="chat-section" data-show-timestamps="${showTimestamps}">
                <div class="chat-header">
                    <h3>Chat with Game Master</h3>
                </div>
                <div class="chat-log" id="chat-log" data-max-messages="${maxMessages}"></div>
                ${allowUserInput ? `
                <div class="chat-input-container">
                    <input type="text" id="chat-input" class="chat-input" placeholder="Type your message..." maxlength="500" aria-label="Chat message">
                    <button id="send-chat" class="chat-submit" type="button" aria-label="Send chat message">Send</button>
                </div>
                ` : ''}
            </div>
        `;
    }

    renderHints(attrs, roomData) {
        const maxHints = attrs.maxHints || '10';
        const showNavigation = attrs.showNavigation !== 'false';
        const autoCycle = attrs.autoCycle === 'true';
        const display = attrs.display || 'default';
        const showHeader = attrs.hints_header !== 'false';
        const className = attrs.class || '';
        
        if (display === 'ticker') {
            return `
                <div class="hints-component ${className}" id="hints-section" data-display="ticker">
                    <div class="hint-container ${className}" id="hint-container" data-max-hints="${maxHints}" data-display="ticker">
                        <div class="hint-placeholder">Breaking News: Awaiting updates from the field...</div>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="hints-component ${className}" id="hints-section">
                ${showHeader ? `
                <div class="hints-header">
                    <h3>Hints</h3>
                    ${showNavigation ? '<div class="hint-navigation" id="hint-navigation"></div>' : ''}
                </div>
                ` : ''}
                <div class="hint-container ${className}" id="hint-container" data-max-hints="${maxHints}" data-auto-cycle="${autoCycle}">
                    <div class="hint-placeholder">No hints received yet</div>
                </div>
                <div class="hint-overlay" id="hint-overlay" style="display: none;">
                    <div class="hint-overlay-content">
                        <div id="overlay-hint-text" class="overlay-hint-text"></div>
                        <button id="hint-overlay-close" class="hint-overlay-close">Close</button>
                    </div>
                </div>
            </div>
        `;
    }

    renderVariables(attrs, roomData) {
        const updateInterval = attrs.updateInterval || '1000';
        
        return `
            <div class="variables-component">
                <div class="variables-header">
                    <h3>Game Variables</h3>
                </div>
                <div id="variable-display" class="variable-display" data-update-interval="${updateInterval}">
                    <div class="variable-placeholder">Loading variables...</div>
                </div>
            </div>
        `;
    }

    renderMedia(attrs, roomData) {
        const supportedFormats = attrs.supportedFormats || 'jpg,png,gif,mp4,mp3';
        
        return `
            <div class="media-component">
                <div id="fullscreen-media" style="display: none;">
                    <div class="lightbox">
                        <div class="lightbox-content">
                            <div class="lightbox-header">
                                <h3 class="lightbox-headline"></h3>
                                <button class="lightbox-close">&times;</button>
                            </div>
                            <div class="lightbox-media"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderRoomInfo(attrs, roomData) {
        const field = attrs.field;
        
        // If field parameter is specified, return only that field value
        if (field) {
            switch (field) {
                case 'name':
                case 'title':
                    return roomData.name || '';
                case 'code':
                case 'shortcode':
                    return roomData.shortcode || '';
                case 'pid':
                case 'id':
                    return roomData.id || '';
                default:
                    return roomData[field] || '';
            }
        }
        
        // Default full component render
        const showProgress = attrs.showProgress !== 'false';
        
        return `
            <div class="room-info-component">
                <h1 id="room-title" class="room-title">${roomData.name || 'Loading...'}</h1>
                <div id="room-info" class="room-info">
                    ${roomData.shortcode ? `Room Code: ${roomData.shortcode}` : ''}
                </div>
                ${showProgress ? '<div id="room-progress" class="room-progress"></div>' : ''}
            </div>
        `;
    }

    renderGameState(attrs, roomData) {
        const showScore = attrs.showScore !== 'false';
        const updateInterval = attrs.updateInterval || '1000';
        
        return `
            <div class="game-state-component" data-update-interval="${updateInterval}">
                ${showScore ? '<div id="game-score" class="game-score">Score: 0</div>' : ''}
                <div id="game-status" class="game-status">Ready</div>
                <div id="config-display" class="config-display"></div>
            </div>
        `;
    }

    renderNotifications(attrs, roomData) {
        const showControls = attrs.showControls !== 'false';
        const showStatus = attrs.showStatus !== 'false';
        const className = attrs.class || '';
        
        return `
            <div class="notifications-component ${className}" id="notifications-component">
                ${showStatus ? `
                    <div class="notifications-status" id="notifications-status">
                        <span class="status-icon">🔊</span>
                        <span class="status-text">Enabled</span>
                    </div>
                ` : ''}
                ${showControls ? `
                    <div class="notifications-controls" id="notifications-controls">
                        <button class="notification-toggle" id="notification-toggle" title="Toggle notifications">
                            <i class="fas fa-volume-up"></i>
                        </button>
                        <button class="notification-test" id="notification-test" title="Test notifications">
                            <i class="fas fa-play"></i>
                        </button>
                    </div>
                ` : ''}
            </div>
            <script>
                // Initialize notifications component when DOM is ready
                (function() {
                    function initNotificationsComponent() {
                        if (typeof window.componentFactory !== 'undefined' && window.componentFactory.initialized) {
                            // Create notifications component using the factory
                            const roomId = window.ROOM_DATA ? window.ROOM_DATA.id : (window.roomId || null);
                            const context = { roomId, eventBus: window.componentFactory.eventBus };
                            const config = { 
                                showControls: ${showControls}, 
                                showStatus: ${showStatus} 
                            };
                            
                            window.componentFactory.createComponent('notifications', config, context)
                                .then(component => {
                                    console.log('Notifications component initialized');
                                })
                                .catch(error => {
                                    console.error('Failed to initialize notifications component:', error);
                                });
                        } else {
                            // Fallback: simple initialization
                            const toggleBtn = document.getElementById('notification-toggle');
                            const testBtn = document.getElementById('notification-test');
                            
                            if (toggleBtn && window.notificationManager) {
                                let enabled = true;
                                toggleBtn.addEventListener('click', function() {
                                    enabled = !enabled;
                                    window.notificationManager.setEnabled(enabled);
                                    updateNotificationStatus(enabled);
                                });
                            }
                            
                            if (testBtn && window.notificationManager) {
                                testBtn.addEventListener('click', function() {
                                    // Test sequence of different notification types
                                    const testTypes = ['player_hint_receive', 'player_chat_send', 'player_chat_receive', 'player_media_received'];
                                    testTypes.forEach((type, index) => {
                                        setTimeout(() => {
                                            window.notificationManager.testNotification(type);
                                        }, index * 1000);
                                    });
                                });
                            }
                            
                            function updateNotificationStatus(enabled) {
                                const status = document.getElementById('notifications-status');
                                const toggle = document.getElementById('notification-toggle');
                                
                                if (status) {
                                    const icon = status.querySelector('.status-icon');
                                    const text = status.querySelector('.status-text');
                                    if (icon) icon.textContent = enabled ? '🔊' : '🔇';
                                    if (text) text.textContent = enabled ? 'Enabled' : 'Disabled';
                                }
                                
                                if (toggle) {
                                    const icon = toggle.querySelector('i');
                                    if (icon) {
                                        icon.className = enabled ? 'fas fa-volume-up' : 'fas fa-volume-mute';
                                    }
                                }
                            }
                        }
                    }
                    
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', initNotificationsComponent);
                    } else {
                        // DOM is already ready, but wait a bit for scripts to load
                        setTimeout(initNotificationsComponent, 100);
                    }
                })();
            </script>
        `;
    }

    /**
     * Load and parse theme file
     * @param {string} themeName - Name of the theme
     * @param {object} roomData - Room data for component rendering
     * @returns {string} - Parsed HTML content
     */
    loadTheme(themeName, roomData = {}) {
        const themePath = path.join(__dirname, '..', 'themes', themeName, 'index.html');
        
        try {
            let themeContent = fs.readFileSync(themePath, 'utf8');
            
            // Normalize theme stylesheet path (handles style.css and ./style.css)
            themeContent = themeContent.replace(
                /href=["']\.?\/?style\.css["']/g,
                `href="/themes/${themeName}/style.css"`
            );
            
            // Ensure base application stylesheet is present BEFORE theme stylesheet
            const themeStyleTag = new RegExp(`<link\\s+rel=["']stylesheet["']\\s+href=["']/themes/${themeName}/style\\.css["'][^>]*>`);
            if (!themeContent.includes('/styles.css')) {
                if (themeStyleTag.test(themeContent)) {
                    themeContent = themeContent.replace(
                        themeStyleTag,
                        `<link rel="stylesheet" href="/styles.css">\n    <link rel="stylesheet" href="/themes/${themeName}/style.css">`
                    );
                } else {
                    // Fallback: inject before </head>
                    themeContent = themeContent.replace(
                        /<\/head>/i,
                        `    <link rel="stylesheet" href="/styles.css">\n</head>`
                    );
                }
            }

            // Normalize theme script path (handles script.js and ./script.js)
            themeContent = themeContent.replace(
                /src=["']\.?\/?script\.js["']/g,
                `src="/themes/${themeName}/script.js"`
            );

            // Ensure required core scripts and minimal system elements are present
            const needsSocket = !themeContent.includes('/socket.io/socket.io.js');
            const needsPlayer = !themeContent.includes('/player.js');
            const hasNotifications = themeContent.includes('[notifications');
            const needsNotificationScripts = hasNotifications && (!themeContent.includes('/notification-manager.js') || !themeContent.includes('/theme-component-interface.js'));
            const needsStartBtn = !themeContent.includes('id="start-rules-button"');

            if (needsSocket || needsPlayer || needsNotificationScripts || needsStartBtn) {
                const injections = [];
                if (needsSocket) injections.push(`    <script src="/socket.io/socket.io.js"></script>`);
                if (needsNotificationScripts) {
                    injections.push(`    <script src="/notification-manager.js"></script>`);
                    injections.push(`    <script src="/theme-component-interface.js"></script>`);
                }
                if (needsPlayer) injections.push(`    <script src="/player.js"></script>`);
                if (needsStartBtn) {
                    injections.push(`    <div style="display: none;">`);
                    injections.push(`        <button id="start-rules-button"></button>`);
                    injections.push(`        <div id="system-elements"></div>`);
                    injections.push(`    </div>`);
                }

                // Inject just before </body>
                themeContent = themeContent.replace(
                    /<\/body>/i,
                    `${injections.join('\n')}\n</body>`
                );
            }
            
            return this.parse(themeContent, roomData);
        } catch (error) {
            console.error(`Error loading theme ${themeName}:`, error);
            return this.getDefaultPlayerHTML(roomData);
        }
    }

    /**
     * Get default player HTML if theme loading fails
     * @param {object} roomData - Room data
     * @returns {string} - Default HTML content
     */
    getDefaultPlayerHTML(roomData) {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Quandary Control - Player</title>
                <link rel="stylesheet" href="/styles.css">
            </head>
            <body>
                <div class="default-player">
                    [room-info]
                    [timer]
                    [chat]
                    [hints]
                    [variables]
                    [media]
                    [game-state]
                </div>
                <script src="/socket.io/socket.io.js"></script>
                <script src="/player.js"></script>
            </body>
            </html>
        `;
    }
}

module.exports = ShortcodeParser;