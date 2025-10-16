class RulesSlideshow {
    constructor() {
        this.roomId = this.getRoomIdFromUrl();
        this.rules = [];
        this.currentSlide = 0;
        this.autoAdvanceTimer = null;
        this.redirectTimer = null;
        this.keyboardHandler = null;
        this.touchStartX = 0;
        this.touchEndX = 0;
        this.navCooldownMs = 250;
        this.lastNavAt = 0;

        // Detect TV/kiosk environment for optimizations
        this.isTVMode = this.detectTVMode();
        if (this.isTVMode) {
            console.log('[Slideshow] TV mode detected - applying optimizations');
            this.applyTVOptimizations();
        }

        this.initializeElements();
        this.initializeEventListeners();
        // Try to enter fullscreen as early as possible
        setTimeout(() => this.ensureFullscreen(), 0);
        this.loadRules();
    }

    detectTVMode() {
        // Detect Android TV, Google TV, or Fully Kiosk Browser
        const ua = navigator.userAgent.toLowerCase();
        const isAndroidTV = ua.includes('android') && (ua.includes('tv') || ua.includes('aftm') || ua.includes('aftb'));
        const isFullyKiosk = typeof window.fully !== 'undefined';
        const isLargeScreen = window.innerWidth >= 1920 || window.screen.width >= 1920;

        return isAndroidTV || isFullyKiosk || (isLargeScreen && ua.includes('android'));
    }

    applyTVOptimizations() {
        // Add TV mode class to body for CSS optimizations
        document.body.classList.add('tv-mode');

        // Disable expensive visual effects
        document.documentElement.style.setProperty('--disable-blur', '0');
        document.documentElement.style.setProperty('--disable-transitions', '0');
    }

    getRoomIdFromUrl() {
        const pathSegments = window.location.pathname.split('/').filter(segment => segment);
        if (pathSegments.length >= 2 && pathSegments[0] === 'room') {
            return pathSegments[1];
        }
        return null;
    }

    initializeElements() {
        this.elements = {
            container: document.querySelector('.slideshow-container') || document.body,
            slideshowMain: document.getElementById('slideshow-main'),
            loading: document.getElementById('loading'),
            error: document.getElementById('error'),
            controls: document.getElementById('slideshow-controls'),
            currentSlide: document.getElementById('current-slide'),
            totalSlides: document.getElementById('total-slides'),
            indicators: document.getElementById('slide-indicators'),
            prevButton: document.getElementById('prev-slide'),
            nextButton: document.getElementById('next-slide'),
            closeButton: document.getElementById('close-slideshow'),
            completionMessage: document.getElementById('completion-message'),
            continueButton: document.getElementById('continue-to-game')
        };

        // Make sure we can receive keyboard events (remote focus)
        try {
            this.elements.slideshowMain.setAttribute('tabindex', '0');
            this.elements.container.setAttribute('tabindex', '-1');
        } catch (_) {}
        this.ensureFocus();
    }

    initializeEventListeners() {
        // Navigation buttons
        this.elements.prevButton.addEventListener('click', () => this.previousSlide());
        this.elements.nextButton.addEventListener('click', () => this.nextSlide());
        this.elements.closeButton.addEventListener('click', () => this.closeSlideshow());
        this.elements.continueButton.addEventListener('click', () => this.continueToGame());

        // Ensure window is focused for remote key events
        try { window.focus(); } catch(_) {}

        // Keyboard navigation (use window for broader capture)
        this.keyboardHandler = (e) => {
            // Attempt fullscreen on first key gesture
            this.ensureFullscreen();
            this.handleKeyboard(e);
        };
        // Only listen to keydown; ignore keyup/keypress to avoid multi-trigger on remotes
        window.addEventListener('keydown', this.keyboardHandler, true);

        // Re-focus if visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                try { window.focus(); } catch(_) {}
            }
        });

        // Touch navigation
        this.elements.slideshowMain.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.elements.slideshowMain.addEventListener('touchend', (e) => this.handleTouchEnd(e));

        // Click navigation
        this.elements.slideshowMain.addEventListener('click', (e) => this.handleClick(e));

        // Periodically re-focus to keep key events flowing (for kiosk/remotes)
        this.focusInterval = setInterval(() => this.ensureFocus(), 2000);
    }

    async loadRules() {
        if (!this.roomId) {
            this.showError();
            return;
        }

        try {
            const response = await fetch(`/api/rooms/${this.roomId}/rules`);
            const result = await response.json();

            if (result.success && result.data && result.data.length > 0) {
                this.rules = result.data;
                this.renderSlideshow();
            } else {
                this.showError();
            }
        } catch (error) {
            console.error('Error loading rules:', error);
            this.showError();
        }
    }

    renderSlideshow() {
        // Hide loading and error
        this.elements.loading.style.display = 'none';
        this.elements.error.style.display = 'none';

        // Update counters
        this.elements.totalSlides.textContent = this.rules.length;
        this.elements.currentSlide.textContent = this.currentSlide + 1;

        // Create slides
        this.rules.forEach((rule, index) => {
            const slide = document.createElement('div');
            slide.className = `slide ${index === 0 ? 'active' : ''}`;
            slide.dataset.slideIndex = index;

            if (rule.type === 'video') {
                const video = document.createElement('video');
                video.src = rule.url;
                video.className = 'slide-media video';

                // Only enable autoplay for the FIRST slide (index 0)
                const isFirstSlide = index === 0;
                video.autoplay = isFirstSlide;
                video.muted = true; // Always start muted for autoplay to work
                video.playsInline = true;
                video.controls = false;

                if (isFirstSlide) {
                    video.setAttribute('autoplay', '');
                }
                video.setAttribute('muted', '');
                video.setAttribute('playsinline', '');

                // TV/Performance optimizations
                if (this.isTVMode) {
                    // Hardware acceleration hints for Android TV
                    video.setAttribute('webkit-playsinline', '');
                    video.setAttribute('x-webkit-airplay', 'deny'); // Prevent casting overhead

                    // Only preload first video aggressively, others wait for manual preload
                    video.preload = isFirstSlide ? 'auto' : 'none';

                    // Explicit dimensions help hardware decoder
                    video.width = 1920;
                    video.height = 1080;

                    // Disable poster to reduce compositing
                    video.removeAttribute('poster');
                } else {
                    // Only preload metadata for first slide, nothing for others
                    video.preload = isFirstSlide ? 'metadata' : 'none';
                }

                const tryPlay = async () => {
                    try {
                        const p = video.play();
                        if (p && typeof p.then === 'function') { await p; }
                        console.log('[Slideshow] video play started', { src: video.src });

                        // Unmute after playback starts (autoplay requires muted)
                        setTimeout(() => {
                            video.muted = false;
                            console.log('[Slideshow] video unmuted');
                        }, 100);

                        // Preload next video when this one starts playing
                        if (index < this.rules.length - 1 && this.rules[index + 1].type === 'video') {
                            this.preloadVideo(index + 1);
                        }
                    } catch (e) {
                        console.warn('[Slideshow] video play failed', e);
                        // Retry once
                        try {
                            const p2 = video.play();
                            if (p2 && typeof p2.then === 'function') { await p2; }
                            console.log('[Slideshow] video play retry success');

                            // Unmute after successful retry
                            setTimeout(() => {
                                video.muted = false;
                                console.log('[Slideshow] video unmuted after retry');
                            }, 100);
                        } catch (e2) {
                            console.error('[Slideshow] video play retry failed', e2);
                        }
                    }
                };

                // Try play when ready
                video.addEventListener('loadedmetadata', tryPlay, { once: true });
                video.addEventListener('canplay', () => {
                    if (!this.isTVMode) this.ensureFullscreen();
                    tryPlay();
                }, { once: true });

                slide.appendChild(video);
            } else {
                const img = document.createElement('img');
                img.src = rule.url;
                img.alt = rule.title || 'Rule';
                img.className = 'slide-media';
                slide.appendChild(img);
            }

            this.elements.slideshowMain.appendChild(slide);

            // Create indicator
            const indicator = document.createElement('div');
            indicator.className = `indicator ${index === 0 ? 'active' : ''}`;
            indicator.dataset.slideIndex = index;
            indicator.addEventListener('click', () => this.goToSlide(index));
            this.elements.indicators.appendChild(indicator);
        });

        // Show controls
        this.elements.controls.style.display = 'flex';

        // Update button states
        this.updateNavigationButtons();

        // Setup video event listeners
        this.setupVideoListeners();

        // Ensure fullscreen once slides are laid out
        this.ensureFullscreen();

        // If first slide is a video, force play attempt now
        this.forcePlayIfVideo(this.currentSlide);
    }

    setupVideoListeners() {
        const videos = this.elements.slideshowMain.querySelectorAll('video');
        videos.forEach(video => {
            // Make sure fullscreen is engaged when a video starts
            video.addEventListener('play', () => this.ensureFullscreen());
            video.addEventListener('ended', () => {
                // Auto advance to next slide after video ends
                setTimeout(() => this.nextSlide(), 300);
            });

            video.addEventListener('loadedmetadata', () => {
                // Reset any auto advance timer when video loads
                this.clearAutoAdvanceTimer();
            });
        });
    }

    goToSlide(index) {
        if (index < 0 || index >= this.rules.length) return;

        // Clear any auto/redirect timers
        this.clearAutoAdvanceTimer();

        // Update current slide
        this.currentSlide = index;

        // Update slide visibility
        const slides = this.elements.slideshowMain.querySelectorAll('.slide');
        slides.forEach((slide, i) => {
            slide.classList.toggle('active', i === index);
        });

        // Update indicators
        const indicators = this.elements.indicators.querySelectorAll('.indicator');
        indicators.forEach((indicator, i) => {
            indicator.classList.toggle('active', i === index);
        });

        // Update counter
        this.elements.currentSlide.textContent = index + 1;

        // Update button states
        this.updateNavigationButtons();

        // Pause any videos that are not active, reset to muted state
        const videos = this.elements.slideshowMain.querySelectorAll('video');
        videos.forEach((video, i) => {
            if (i !== index) {
                // Stop any playing video
                if (!video.paused) {
                    video.pause();
                }
                video.currentTime = 0;
                video.muted = true; // Re-mute for next autoplay

                // Ensure autoplay is disabled on inactive videos
                video.autoplay = false;
                video.removeAttribute('autoplay');
            }
        });

        // If the active slide is a video, force play (will unmute after play starts)
        this.forcePlayIfVideo(index);

        // If this is the last slide and it's an image, auto-redirect after short delay
        if (index === this.rules.length - 1 && this.rules[index].type !== 'video') {
            this.redirectTimer = setTimeout(() => this.continueToGame(), 1500);
        } else {
            if (this.redirectTimer) { clearTimeout(this.redirectTimer); this.redirectTimer = null; }
        }
    }

    nextSlide() {
        if (this.currentSlide < this.rules.length - 1) {
            this.goToSlide(this.currentSlide + 1);
        } else {
            this.showCompletion();
        }
    }

    previousSlide() {
        if (this.currentSlide > 0) {
            this.goToSlide(this.currentSlide - 1);
        }
    }

    showCompletion() {
        // Immediately navigate back to player view (no clicks required)
        this.continueToGame();
    }

    continueToGame() {
        this.clearAutoAdvanceTimer();
        
        // Redirect to player screen
        if (this.roomId) {
            window.location.href = `/room/${this.roomId}/player`;
        } else {
            window.location.href = '/';
        }
    }

    closeSlideshow() {
        this.clearAutoAdvanceTimer();
        
        // Remove event listeners
        window.removeEventListener('keydown', this.keyboardHandler, true);
        window.removeEventListener('keyup', this.keyboardHandler, true);
        window.removeEventListener('keypress', this.keyboardHandler, true);
        if (this.focusInterval) {
            clearInterval(this.focusInterval);
            this.focusInterval = null;
        }
        
        // Close window or redirect
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = '/';
        }
    }

    updateNavigationButtons() {
        this.elements.prevButton.disabled = this.currentSlide === 0;
        this.elements.nextButton.disabled = this.currentSlide === this.rules.length - 1;
    }

    handleKeyboard(e) {
        if (e.type !== 'keydown') return;
        if (e.repeat) { try { e.preventDefault(); } catch(_) {} return; }
 
        const key = (e.key || '').toLowerCase();
        const which = e.which || 0;
        const keyCode = e.keyCode || which || 0;
        const codeStr = (e.code || '').toLowerCase();
 
        // Diagnostics
        try { console.debug('[Slideshow] key event', { type: e.type, key: e.key, code: e.code, keyCode, which }); } catch(_) {}
 
        // Throttle navigation to avoid skipping on remotes
        if (this.shouldThrottle()) { try { e.preventDefault(); } catch(_) {} return; }
 
        // Map multiple possible remote key values to actions
        const isLeft = key === 'arrowleft' || key === 'left' || codeStr === 'arrowleft' || key === 'pageup' || key === 'mediatrackprevious' || keyCode === 37 || keyCode === 33 || keyCode === 177;
        const isRight = key === 'arrowright' || key === 'right' || codeStr === 'arrowright' || key === 'pagedown' || key === 'mediatracknext' || keyCode === 39 || keyCode === 34 || keyCode === 176;
 
        if (isLeft) {
            try { e.preventDefault(); } catch(_) {}
            this.previousSlide();
            return;
        }
        if (isRight) {
            try { e.preventDefault(); } catch(_) {}
            this.nextSlide();
            return;
        }
        if (key === 'escape' || keyCode === 27) {
            try { e.preventDefault(); } catch(_) {}
            this.closeSlideshow();
        }
    }

    handleTouchStart(e) {
        this.touchStartX = e.changedTouches[0].screenX;
    }

    handleTouchEnd(e) {
        this.touchEndX = e.changedTouches[0].screenX;
        this.handleSwipe();
    }

    handleSwipe() {
        const swipeThreshold = 50;
        const diff = this.touchStartX - this.touchEndX;
 
        if (Math.abs(diff) > swipeThreshold) {
            if (this.shouldThrottle()) return;
            if (diff > 0) {
                // Swipe left - next slide
                this.nextSlide();
            } else {
                // Swipe right - previous slide
                this.previousSlide();
            }
        }
    }

    handleClick(e) {
        if (this.shouldThrottle()) return;
        // Click on left half of screen goes to previous slide
        // Click on right half of screen goes to next slide
        const clickX = e.clientX;
        const screenWidth = window.innerWidth;
        const clickPosition = clickX / screenWidth;
 
        if (clickPosition < 0.3) {
            this.previousSlide();
        } else if (clickPosition > 0.7) {
            this.nextSlide();
        }
    }

    clearAutoAdvanceTimer() {
        if (this.autoAdvanceTimer) {
            clearTimeout(this.autoAdvanceTimer);
            this.autoAdvanceTimer = null;
        }
        if (this.redirectTimer) {
            clearTimeout(this.redirectTimer);
            this.redirectTimer = null;
        }
    }
 
    shouldThrottle() {
        const now = Date.now();
        if (now - this.lastNavAt < this.navCooldownMs) {
            return true;
        }
        this.lastNavAt = now;
        return false;
    }
 
    ensureFocus() {
        try {
            // Focus main area first; if not, the container
            if (this.elements && this.elements.slideshowMain) {
                this.elements.slideshowMain.focus({ preventScroll: true });
            } else if (this.elements && this.elements.container) {
                this.elements.container.focus({ preventScroll: true });
            } else {
                document.body.setAttribute('tabindex','-1');
                document.body.focus({ preventScroll: true });
            }
            window.focus();
        } catch (_) {}
    }

    ensureFullscreen() {
        try {
            const elem = (this.elements && this.elements.container) ? this.elements.container : (document.documentElement || document.body);
            if (!document.fullscreenElement && elem) {
                const req = elem.requestFullscreen || elem.webkitRequestFullscreen || elem.msRequestFullscreen;
                if (req) {
                    try { req.call(elem); } catch (e) { /* no-op */ }
                }
            }
        } catch (_) {}
    }

    preloadVideo(index) {
        // Preload the video at the specified index
        const slides = this.elements.slideshowMain.querySelectorAll('.slide');
        const targetSlide = slides[index];
        if (!targetSlide) return;

        const video = targetSlide.querySelector('video');
        if (video && video.readyState < 2) {
            console.log('[Slideshow] Preloading next video', { index, src: video.src });

            // Disable autoplay before preloading to prevent it from starting
            video.autoplay = false;
            video.removeAttribute('autoplay');

            // Keep it muted during preload
            video.muted = true;

            // Set preload and force load
            video.preload = 'auto';
            video.load(); // Force load but won't autoplay
        }
    }

    forcePlayIfVideo(index) {
        const slides = this.elements.slideshowMain.querySelectorAll('.slide');
        const active = slides[index];
        if (!active) return;
        const v = active.querySelector('video');
        if (v) {
            // Ensure proper flags, then try play
            v.muted = true;
            v.autoplay = true;
            v.playsInline = true;
            v.setAttribute('muted', '');
            v.setAttribute('autoplay', '');
            v.setAttribute('playsinline', '');
            const tryPlay = async () => {
                try {
                    await v.play();

                    // Unmute after playback starts
                    setTimeout(() => {
                        v.muted = false;
                        console.log('[Slideshow] video unmuted (forcePlay)');
                    }, 100);

                    // Preload next video after this one starts
                    if (index < this.rules.length - 1 && this.rules[index + 1].type === 'video') {
                        this.preloadVideo(index + 1);
                    }
                } catch(_) {}
            };
            tryPlay();
        }
    }

    showError() {
        this.elements.loading.style.display = 'none';
        this.elements.error.style.display = 'block';
    }
}

// Initialize slideshow when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.rulesSlideshow = new RulesSlideshow();
});