// Windows 95 Theme - win95x
// Interactive functionality for moveable windows and taskbar

class Win95Theme {
    constructor() {
        this.activeWindow = null;
        this.isDragging = false;
        this.isResizing = false;
        this.resizeEdges = { n: false, e: false, s: false, w: false };
        this.resizeStart = { mouseX: 0, mouseY: 0, left: 0, top: 0, width: 0, height: 0 };
        this.dragOffset = { x: 0, y: 0 };
        this.windows = [];
        this.minimizedWindows = [];
        this.zIndex = 100;
        
        this.init();
    }
    
    init() {
        this.setupWindows();
        this.setupTaskbar();
        this.setupStartMenu();
        this.setupDesktopIcons();
        this.updateClock();
        this.setupWindowControls();
        this.setupGlobalDelegates();

        
        // Update clock every second
        setInterval(() => this.updateClock(), 1000);
        
        // Set first window as active
        if (this.windows.length > 0) {
            this.setActiveWindow(this.windows[0]);
        }
    }
    
    setupWindows() {
        const windowElements = document.querySelectorAll('.window');
        windowElements.forEach(windowEl => {
            this.windows.push(windowEl);
            this.makeWindowDraggable(windowEl);
            this.makeWindowResizable(windowEl);
        });
    }
    
    makeWindowDraggable(windowEl) {
        const titleBar = windowEl.querySelector('.window-title-bar');
        
        titleBar.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('window-control')) return;
            
            // If maximized, restore before dragging
            if (windowEl.classList.contains('maximized')) {
                this.maximizeWindow(windowEl);
            }
            
            this.isDragging = true;
            this.setActiveWindow(windowEl);
            
            const rect = windowEl.getBoundingClientRect();
            this.dragOffset.x = e.clientX - rect.left;
            this.dragOffset.y = e.clientY - rect.top;
            
            document.addEventListener('mousemove', this.handleMouseMove);
            document.addEventListener('mouseup', this.handleMouseUp);
            
            e.preventDefault();
        });

        // Double-click title bar to toggle maximize/restore
        titleBar.addEventListener('dblclick', () => {
            this.maximizeWindow(windowEl);
        });
    }
    
    handleMouseMove = (e) => {
        if (!this.isDragging || !this.activeWindow) return;

        const desktop = document.getElementById('desktop');
        const desktopRect = desktop.getBoundingClientRect();

        const x = e.clientX - this.dragOffset.x - desktopRect.left;
        const y = e.clientY - this.dragOffset.y - desktopRect.top;

        // Keep window within desktop bounds (relative to desktop)
        const maxX = desktopRect.width - this.activeWindow.offsetWidth;
        const maxY = desktopRect.height - this.activeWindow.offsetHeight;

        const constrainedX = Math.max(0, Math.min(x, maxX));
        const constrainedY = Math.max(0, Math.min(y, maxY));

        this.activeWindow.style.left = `${constrainedX}px`;
        this.activeWindow.style.top = `${constrainedY}px`;
    }
    
    handleMouseUp = () => {
        this.isDragging = false;
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
    }

    makeWindowResizable(windowEl) {
        // Add 8 resize handles (n, e, s, w, ne, nw, se, sw)
        const directions = ['n','e','s','w','ne','nw','se','sw'];
        directions.forEach(dir => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${dir}`;
            handle.dataset.direction = dir;
            windowEl.appendChild(handle);

            handle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.setActiveWindow(windowEl);

                // If maximized, restore first
                if (windowEl.classList.contains('maximized')) {
                    this.maximizeWindow(windowEl);
                }

                this.isResizing = true;
                this.resizeEdges = {
                    n: dir.includes('n'),
                    e: dir.includes('e'),
                    s: dir.includes('s'),
                    w: dir.includes('w')
                };

                const rect = windowEl.getBoundingClientRect();
                this.resizeStart = {
                    mouseX: e.clientX,
                    mouseY: e.clientY,
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height
                };

                document.addEventListener('mousemove', this.handleResizeMouseMove);
                document.addEventListener('mouseup', this.handleResizeMouseUp);
                e.preventDefault();
            });
        });
    }

    handleResizeMouseMove = (e) => {
        if (!this.isResizing || !this.activeWindow) return;

        const desktop = document.getElementById('desktop');
        const desktopRect = desktop.getBoundingClientRect();
        const minWidth = 200;
        const minHeight = 150;

        // Work in viewport coords (like getBoundingClientRect), then convert to desktop-relative
        let newLeftVP = this.resizeStart.left;
        let newTopVP = this.resizeStart.top;
        let newWidth = this.resizeStart.width;
        let newHeight = this.resizeStart.height;

        const dx = e.clientX - this.resizeStart.mouseX;
        const dy = e.clientY - this.resizeStart.mouseY;

        // East/South edges expand
        if (this.resizeEdges.e) {
            const maxWidth = (desktopRect.left + desktopRect.width) - this.resizeStart.left;
            newWidth = Math.min(this.resizeStart.width + dx, maxWidth);
            if (newWidth < minWidth) newWidth = minWidth;
        }
        if (this.resizeEdges.s) {
            const maxHeight = (desktopRect.top + desktopRect.height) - this.resizeStart.top;
            newHeight = Math.min(this.resizeStart.height + dy, maxHeight);
            if (newHeight < minHeight) newHeight = minHeight;
        }

        // West/North edges move origin and shrink
        if (this.resizeEdges.w) {
            const minLeftVP = desktopRect.left;
            const maxLeftVP = this.resizeStart.left + this.resizeStart.width - minWidth;
            newLeftVP = Math.min(Math.max(minLeftVP, this.resizeStart.left + dx), maxLeftVP);
            newWidth = this.resizeStart.width - (newLeftVP - this.resizeStart.left);
        }
        if (this.resizeEdges.n) {
            const minTopVP = desktopRect.top;
            const maxTopVP = this.resizeStart.top + this.resizeStart.height - minHeight;
            newTopVP = Math.min(Math.max(minTopVP, this.resizeStart.top + dy), maxTopVP);
            newHeight = this.resizeStart.height - (newTopVP - this.resizeStart.top);
        }

        // Convert to desktop-relative coords for application
        const newLeft = newLeftVP - desktopRect.left;
        const newTop = newTopVP - desktopRect.top;

        // Ensure within desktop bounds again
        const boundedWidth = Math.min(newWidth, desktopRect.width - newLeft);
        const boundedHeight = Math.min(newHeight, desktopRect.height - newTop);

        // Apply
        this.activeWindow.style.left = `${newLeft}px`;
        this.activeWindow.style.top = `${newTop}px`;
        this.activeWindow.style.width = `${boundedWidth}px`;
        this.activeWindow.style.height = `${boundedHeight}px`;
    }

    handleResizeMouseUp = () => {
        this.isResizing = false;
        document.removeEventListener('mousemove', this.handleResizeMouseMove);
        document.removeEventListener('mouseup', this.handleResizeMouseUp);
    }
    
    setActiveWindow(windowEl) {
        // Remove active class from all windows
        this.windows.forEach(w => w.classList.remove('active'));
        
        // Add active class to selected window
        windowEl.classList.add('active');
        this.activeWindow = windowEl;
        
        // Update z-index
        this.zIndex++;
        windowEl.style.zIndex = this.zIndex;
        
        // Update taskbar
        this.updateTaskbar();
    }
    
    setupWindowControls() {
        this.windows.forEach(windowEl => {
            const minimizeBtn = windowEl.querySelector('.minimize');
            const maximizeBtn = windowEl.querySelector('.maximize');
            const closeBtn = windowEl.querySelector('.close');
            
            minimizeBtn.addEventListener('click', () => this.minimizeWindow(windowEl));
            maximizeBtn.addEventListener('click', () => this.maximizeWindow(windowEl));
            closeBtn.addEventListener('click', () => this.closeWindow(windowEl));
            
            // Make window clickable to bring to front
            windowEl.addEventListener('mousedown', () => {
                if (!this.isDragging) {
                    this.setActiveWindow(windowEl);
                }
            });
        });
    }

    // Global delegation to ensure controls always work (even for dynamically added windows)
    setupGlobalDelegates() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.window-control');
            if (!btn) return;
            const windowEl = btn.closest('.window');
            if (!windowEl) return;

            if (btn.classList.contains('minimize')) {
                this.minimizeWindow(windowEl);
            } else if (btn.classList.contains('maximize')) {
                this.maximizeWindow(windowEl);
            } else if (btn.classList.contains('close')) {
                this.closeWindow(windowEl);
            }
        });

        // Activate window when clicked anywhere inside it
        document.addEventListener('mousedown', (e) => {
            const win = e.target.closest('.window');
            if (!win) return;
            if (!this.isDragging && !this.isResizing) this.setActiveWindow(win);
        });
    }
    
    minimizeWindow(windowEl) {
        windowEl.classList.add('minimized');
        windowEl.style.display = 'none';
        if (!this.minimizedWindows.includes(windowEl)) {
            this.minimizedWindows.push(windowEl);
        }
        this.updateTaskbar();
        
        // Activate next window if available
        const visibleWindows = this.windows.filter(w => !w.classList.contains('minimized') && w.style.display !== 'none');
        if (visibleWindows.length > 0) {
            this.setActiveWindow(visibleWindows[visibleWindows.length - 1]);
        }
    }
    
    maximizeWindow(windowEl) {
        if (windowEl.classList.contains('maximized')) {
            // Restore window
            windowEl.classList.remove('maximized');
            const maximizeBtn = windowEl.querySelector('.maximize');
            maximizeBtn.textContent = '□';
        } else {
            // Maximize window
            windowEl.classList.add('maximized');
            const maximizeBtn = windowEl.querySelector('.maximize');
            maximizeBtn.textContent = '❐';
        }
        this.setActiveWindow(windowEl);
    }
    
    closeWindow(windowEl) {
        windowEl.style.display = 'none';
        this.windows = this.windows.filter(w => w !== windowEl);
        this.minimizedWindows = this.minimizedWindows.filter(w => w !== windowEl);
        this.updateTaskbar();
        
        // Activate next window if available
        const visibleWindows = this.windows.filter(w => w.style.display !== 'none');
        if (visibleWindows.length > 0) {
            this.setActiveWindow(visibleWindows[visibleWindows.length - 1]);
        }
    }
    
    setupTaskbar() {
        const taskbarApps = document.querySelectorAll('.taskbar-app');
        taskbarApps.forEach(app => {
            app.addEventListener('click', () => {
                const windowId = app.getAttribute('data-window');
                const windowEl = document.getElementById(windowId);
                
                if (windowEl) {
                    // Window exists, handle minimize/restore
                    if (windowEl.classList.contains('minimized') || windowEl.style.display === 'none') {
                        windowEl.classList.remove('minimized');
                        windowEl.style.display = 'block';
                        this.minimizedWindows = this.minimizedWindows.filter(w => w !== windowEl);
                        this.setActiveWindow(windowEl);
                    } else {
                        // Toggle minimize if already active and visible
                        if (this.activeWindow === windowEl) {
                            this.minimizeWindow(windowEl);
                        } else {
                            this.setActiveWindow(windowEl);
                        }
                    }
                } else {
                    // Window doesn't exist, recreate it
                    if (windowId === 'timer-window') {
                        this.restoreTimerWindow();
                    } else if (windowId === 'chat-window') {
                        this.restoreChatWindow();
                    }
                }
            });
        });
    }
    
    updateTaskbar() {
        const taskbarApps = document.querySelectorAll('.taskbar-app');
        taskbarApps.forEach(app => {
            const windowId = app.getAttribute('data-window');
            const windowEl = document.getElementById(windowId);
            
            if (windowEl === this.activeWindow && !windowEl.classList.contains('minimized')) {
                app.classList.add('active');
            } else {
                app.classList.remove('active');
            }
        });
    }
    
    setupStartMenu() {
        const startButton = document.getElementById('start-button');
        const startMenu = document.getElementById('start-menu');
        
        startButton.addEventListener('click', () => {
            startMenu.classList.toggle('hidden');
        });
        
        // Close start menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!startButton.contains(e.target) && !startMenu.contains(e.target)) {
                startMenu.classList.add('hidden');
            }
        });
        
        // Handle menu item clicks
        const menuItems = startMenu.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            item.addEventListener('click', () => {
                const text = item.textContent.trim();
                if (text === 'Shut Down...') {
                    this.showShutdownDialog();
                } else if (text === 'Run...') {
                    this.showRunDialog();
                } else if (item.id === 'restore-timer') {
                    this.restoreTimerWindow();
                } else if (item.id === 'restore-chat') {
                    this.restoreChatWindow();
                }
                startMenu.classList.add('hidden');
            });
        });
    }
    
    setupDesktopIcons() {
        const desktopIcons = document.querySelectorAll('.desktop-icon');
        desktopIcons.forEach(icon => {
            icon.addEventListener('dblclick', () => {
                const app = icon.getAttribute('data-app');
                this.openApplication(app);
            });
            
            icon.addEventListener('click', () => {
                // Remove selection from all icons
                desktopIcons.forEach(i => i.classList.remove('selected'));
                // Select clicked icon
                icon.classList.add('selected');
            });
        });
    }
    
    openApplication(appName) {
        switch (appName) {
            case 'my-computer':
                this.openMyComputer();
                break;
            case 'recycle-bin':
                this.openRecycleBin();
                break;
            case 'my-documents':
                this.openMyDocuments();
                break;
        }
    }
    
    openMyComputer() {
        // Check if My Computer window already exists
        let myComputerWindow = document.getElementById('my-computer-window');
        if (!myComputerWindow) {
            myComputerWindow = this.createWindow('My Computer', '🖥️', 'my-computer-window');
            const content = myComputerWindow.querySelector('.window-content');
            content.innerHTML = `
                <div style="padding: 20px;">
                    <h3>My Computer</h3>
                    <div style="margin-top: 20px;">
                        <div style="margin-bottom: 10px;">🖥️ 3½ Floppy (A:)</div>
                        <div style="margin-bottom: 10px;">💿 Compact Disc (D:)</div>
                        <div style="margin-bottom: 10px;">💾 Local Disk (C:)</div>
                        <div style="margin-bottom: 10px;">🖨️ Printers</div>
                        <div style="margin-bottom: 10px;">🌐 Dial-up Networking</div>
                        <div style="margin-bottom: 10px;">🔧 Control Panel</div>
                    </div>
                </div>
            `;
        }
        this.showWindow(myComputerWindow);
    }
    
    openRecycleBin() {
        let recycleBinWindow = document.getElementById('recycle-bin-window');
        if (!recycleBinWindow) {
            recycleBinWindow = this.createWindow('Recycle Bin', '🗑️', 'recycle-bin-window');
            const content = recycleBinWindow.querySelector('.window-content');
            content.innerHTML = `
                <div style="padding: 20px;">
                    <h3>Recycle Bin</h3>
                    <p style="margin-top: 20px;">The Recycle Bin is empty.</p>
                </div>
            `;
        }
        this.showWindow(recycleBinWindow);
    }
    
    openMyDocuments() {
        let myDocumentsWindow = document.getElementById('my-documents-window');
        if (!myDocumentsWindow) {
            myDocumentsWindow = this.createWindow('My Documents', '📁', 'my-documents-window');
            const content = myDocumentsWindow.querySelector('.window-content');
            content.innerHTML = `
                <div style="padding: 20px;">
                    <h3>My Documents</h3>
                    <div style="margin-top: 20px;">
                        <div style="margin-bottom: 10px;">📄 New Text Document.txt</div>
                        <div style="margin-bottom: 10px;">📄 My Resume.doc</div>
                        <div style="margin-bottom: 10px;">📁 Personal</div>
                        <div style="margin-bottom: 10px;">📁 Work</div>
                    </div>
                </div>
            `;
        }
        this.showWindow(myDocumentsWindow);
    }
    
    createWindow(title, icon, id) {
        const windowEl = document.createElement('div');
        windowEl.className = 'window';
        windowEl.id = id;
        windowEl.style.left = '50px';
        windowEl.style.top = '50px';
        windowEl.style.width = '400px';
        windowEl.style.height = '300px';
        
        windowEl.innerHTML = `
            <div class="window-title-bar">
                <div class="window-title">${title}</div>
                <div class="window-controls">
                    <button class="window-control minimize">_</button>
                    <button class="window-control maximize">□</button>
                    <button class="window-control close">×</button>
                </div>
            </div>
            <div class="window-content">
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 48px; margin-bottom: 10px;">${icon}</div>
                    <div>Loading...</div>
                </div>
            </div>
        `;
        
        document.getElementById('desktop').appendChild(windowEl);
        this.windows.push(windowEl);
        this.makeWindowDraggable(windowEl);
        this.makeWindowResizable(windowEl);
        this.setupWindowControls();
        
        // Add to taskbar
        this.addTaskbarApp(windowEl, title, icon);
        
        return windowEl;
    }
    
    addTaskbarApp(windowEl, title, icon) {
        const taskbarApps = document.getElementById('taskbar-apps');
        const appEl = document.createElement('div');
        appEl.className = 'taskbar-app';
        appEl.setAttribute('data-window', windowEl.id);
        appEl.innerHTML = `
            <span class="taskbar-icon">${icon}</span>
            <span class="taskbar-label">${title}</span>
        `;
        
        appEl.addEventListener('click', () => {
            if (windowEl.classList.contains('minimized')) {
                windowEl.classList.remove('minimized');
                windowEl.style.display = 'block';
                this.minimizedWindows = this.minimizedWindows.filter(w => w !== windowEl);
                this.setActiveWindow(windowEl);
            } else {
                // Toggle minimize if already active and visible
                if (this.activeWindow === windowEl) {
                    this.minimizeWindow(windowEl);
                } else {
                    this.setActiveWindow(windowEl);
                }
            }
        });
        
        taskbarApps.appendChild(appEl);
    }
    
    showWindow(windowEl) {
        windowEl.style.display = 'block';
        windowEl.classList.remove('minimized');
        this.minimizedWindows = this.minimizedWindows.filter(w => w !== windowEl);
        this.setActiveWindow(windowEl);
    }
    
    showShutdownDialog() {
        const dialog = this.createDialog('Shut Down Windows', 'Are you sure you want to shut down?', () => {
            this.showShutdownScreen();
        });
    }

    showShutdownScreen() {
        // Store the original body content
        const originalContent = document.body.innerHTML;

        // Show shutdown screen
        document.body.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                height: 100vh;
                background-color: #008080;
                font-family: 'MS Sans Serif', sans-serif;
                color: white;
                text-align: center;
            ">
                <div style="font-size: 18px; margin-bottom: 20px;">
                    It's now safe to turn off your computer.
                </div>
                <div style="font-size: 12px; margin-bottom: 30px;">
                    You can now safely turn off your computer.<br>
                    If your computer has an ATX power supply, it will turn off automatically.
                </div>
                <button onclick="restoreNormalFunction()" style="
                    background-color: #c0c0c0;
                    border: 2px outset #c0c0c0;
                    padding: 8px 16px;
                    font-family: 'MS Sans Serif', sans-serif;
                    font-size: 11px;
                    cursor: pointer;
                    margin-top: 20px;
                ">
                    Restart Computer
                </button>
            </div>
        `;

        // Add the restore function to the global scope
        window.restoreNormalFunction = () => {
            document.body.innerHTML = originalContent;

            // Re-initialize the theme
            setTimeout(() => {
                new Win95Theme();
            }, 100);

            // Clean up the global function
            delete window.restoreNormalFunction;
        };
    }
    
    showRunDialog() {
        const dialog = this.createDialog('Run', 'Type the name of a program, folder, or document, and Windows will open it for you.', () => {
            const input = dialog.querySelector('input');
            alert(`Running: ${input.value}`);
            dialog.remove();
        }, true);
    }
    
    createDialog(title, message, onOk, showInput = false) {
        const dialog = document.createElement('div');
        dialog.className = 'window';
        dialog.style.position = 'fixed';
        dialog.style.left = '50%';
        dialog.style.top = '50%';
        dialog.style.transform = 'translate(-50%, -50%)';
        dialog.style.width = '300px';
        dialog.style.height = '150px';
        dialog.style.zIndex = '10000';
        
        dialog.innerHTML = `
            <div class="window-title-bar">
                <div class="window-title">${title}</div>
                <div class="window-controls">
                    <button class="window-control close">×</button>
                </div>
            </div>
            <div class="window-content">
                <div style="padding: 10px;">
                    <p style="margin-bottom: 15px;">${message}</p>
                    ${showInput ? '<input type="text" style="width: 100%; margin-bottom: 15px; padding: 2px; border: 1px solid #808080;" placeholder="Enter command...">' : ''}
                    <div style="text-align: right;">
                        <button class="win95-button" onclick="this.closest('.window').remove()">Cancel</button>
                        <button class="win95-button" style="margin-left: 10px;">OK</button>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('desktop').appendChild(dialog);
        
        // Setup close button
        const closeBtn = dialog.querySelector('.close');
        closeBtn.addEventListener('click', () => dialog.remove());
        
        // Setup OK button
        const okBtn = dialog.querySelector('.win95-button:last-child');
        okBtn.addEventListener('click', () => onOk());
        
        // Make dialog draggable
        this.makeWindowDraggable(dialog);
        
        return dialog;
    }
    
    updateClock() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        const clockElement = document.getElementById('clock');
        if (clockElement) {
            clockElement.textContent = timeString;
        }
    }

    restoreTimerWindow() {
        let timerWindow = document.getElementById('timer-window');
        if (!timerWindow) {
            timerWindow = this.createWindow('Game Timer', '⏱️', 'timer-window');
            const content = timerWindow.querySelector('.window-content');
            content.innerHTML = '[timer position="window" format="mm:ss" showControls="true"]';
        }
        this.showWindow(timerWindow);
    }

    restoreChatWindow() {
        let chatWindow = document.getElementById('chat-window');
        if (!chatWindow) {
            chatWindow = this.createWindow('Team Chat', '💬', 'chat-window');
            const content = chatWindow.querySelector('.window-content');
            content.innerHTML = '[chat position="window" maxMessages="50" showTimestamps="true"]';
        }
        this.showWindow(chatWindow);
    }

}

// Add Windows 95 button styles
const win95Style = document.createElement('style');
win95Style.textContent = `
    .win95-button {
        background-color: #c0c0c0;
        border: 1px solid #c0c0c0;
        padding: 4px 8px;
        font-size: 11px;
        font-family: 'MS Sans Serif', sans-serif;
        cursor: pointer;
        box-shadow: 
            1px 1px 0 #ffffff,
            -1px -1px 0 #808080,
            1px -1px 0 #808080,
            -1px 1px 0 #808080;
    }
    
    .win95-button:hover {
        background-color: #e0e0e0;
    }
    
    .win95-button:active {
        box-shadow: 
            -1px -1px 0 #ffffff,
            1px 1px 0 #808080,
            -1px 1px 0 #808080,
            1px -1px 0 #808080;
    }
`;
document.head.appendChild(win95Style);

// Initialize the theme when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new Win95Theme();
});