class RulesEditor {
    constructor() {
        this.roomId = this.getRoomIdFromUrl();
        this.rules = [];
        this.sortable = null;
        
        this.initializeElements();
        this.initializeEventListeners();
        this.loadRules();
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
            uploadArea: document.getElementById('upload-area'),
            fileInput: document.getElementById('file-input'),
            rulesGrid: document.getElementById('rules-grid'),
            rulesCount: document.getElementById('rules-count'),
            loadingOverlay: document.getElementById('loading-overlay'),
            toast: document.getElementById('toast')
        };
    }

    initializeEventListeners() {
        // Upload area click
        this.elements.uploadArea.addEventListener('click', () => {
            this.elements.fileInput.click();
        });

        // File input change
        this.elements.fileInput.addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files);
        });

        // Drag and drop
        this.elements.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.elements.uploadArea.classList.add('dragover');
        });

        this.elements.uploadArea.addEventListener('dragleave', () => {
            this.elements.uploadArea.classList.remove('dragover');
        });

        this.elements.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.elements.uploadArea.classList.remove('dragover');
            this.handleFileUpload(e.dataTransfer.files);
        });
    }

    async loadRules() {
        if (!this.roomId) {
            this.showToast('No room ID found', 'error');
            return;
        }

        try {
            this.showLoading(true);
            const response = await fetch(`/api/rooms/${this.roomId}/rules`);
            const result = await response.json();

            if (result.success) {
                this.rules = result.data;
                this.renderRules();
            } else {
                this.showToast('Failed to load rules', 'error');
            }
        } catch (error) {
            console.error('Error loading rules:', error);
            this.showToast('Error loading rules', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async handleFileUpload(files) {
        if (!this.roomId || files.length === 0) return;

        const formData = new FormData();
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Validate file type
            if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
                this.showToast(`Invalid file type: ${file.name}`, 'error');
                continue;
            }
            
            // Validate file size (max 50MB)
            if (file.size > 50 * 1024 * 1024) {
                this.showToast(`File too large: ${file.name}`, 'error');
                continue;
            }
            
            formData.append('media', file);
        }

        try {
            this.showLoading(true);
            const response = await fetch(`/api/rooms/${this.roomId}/rules`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast('Rules uploaded successfully', 'success');
                this.loadRules(); // Refresh the list
            } else {
                this.showToast(result.error || 'Failed to upload rules', 'error');
            }
        } catch (error) {
            console.error('Error uploading rules:', error);
            this.showToast('Error uploading rules', 'error');
        } finally {
            this.showLoading(false);
            this.elements.fileInput.value = ''; // Clear file input
        }
    }

    renderRules() {
        // Update count
        this.elements.rulesCount.textContent = `${this.rules.length} items`;

        if (this.rules.length === 0) {
            this.elements.rulesGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📜</div>
                    <div class="empty-state-text">No rules uploaded yet</div>
                    <div class="empty-state-subtext">Upload images or videos to get started</div>
                </div>
            `;
            return;
        }

        // Render rules grid
        this.elements.rulesGrid.innerHTML = this.rules.map((rule, index) => {
            const isVideo = rule.type === 'video';
            const mediaElement = isVideo 
                ? `<video src="${rule.url}" class="rule-preview" muted></video>`
                : `<img src="${rule.url}" alt="${rule.title}" class="rule-preview">`;

            return `
                <div class="rule-card" data-rule-id="${rule.id}" data-index="${index}">
                    ${mediaElement}
                    <div class="rule-info">
                        <div class="rule-title">${rule.title || `Rule ${index + 1}`}</div>
                        <div class="rule-meta">
                            <span class="rule-type">${isVideo ? 'Video' : 'Image'}</span>
                            <div class="rule-actions">
                                <button class="rule-action-btn delete" onclick="rulesEditor.deleteRule('${rule.id}')" title="Delete">
                                    🗑️
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Initialize sortable for drag and drop reordering
        this.initializeSortable();
    }

    initializeSortable() {
        if (this.sortable) {
            this.sortable.destroy();
        }

        this.sortable = new Sortable(this.elements.rulesGrid, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            handle: '.rule-card',
            onEnd: (evt) => {
                this.handleReorder();
            }
        });
    }

    async handleReorder() {
        const ruleCards = this.elements.rulesGrid.querySelectorAll('.rule-card');
        const newOrder = Array.from(ruleCards).map(card => card.dataset.ruleId);

        try {
            const response = await fetch(`/api/rooms/${this.roomId}/rules/order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ruleIds: newOrder })
            });

            const result = await response.json();

            if (result.success) {
                this.rules = result.data;
                this.showToast('Rules reordered successfully', 'success');
            } else {
                this.showToast('Failed to reorder rules', 'error');
                this.loadRules(); // Refresh to restore original order
            }
        } catch (error) {
            console.error('Error reordering rules:', error);
            this.showToast('Error reordering rules', 'error');
            this.loadRules(); // Refresh to restore original order
        }
    }

    async deleteRule(ruleId) {
        if (!confirm('Are you sure you want to delete this rule?')) {
            return;
        }

        try {
            const response = await fetch(`/api/rooms/${this.roomId}/rules/${ruleId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                this.showToast('Rule deleted successfully', 'success');
                this.loadRules(); // Refresh the list
            } else {
                this.showToast(result.error || 'Failed to delete rule', 'error');
            }
        } catch (error) {
            console.error('Error deleting rule:', error);
            this.showToast('Error deleting rule', 'error');
        }
    }

    showLoading(show) {
        this.elements.loadingOverlay.style.display = show ? 'flex' : 'none';
    }

    showToast(message, type = 'info') {
        this.elements.toast.textContent = message;
        this.elements.toast.className = `toast ${type}`;
        this.elements.toast.classList.add('show');

        setTimeout(() => {
            this.elements.toast.classList.remove('show');
        }, 3000);
    }
}

// Initialize Sortable library (simple implementation for drag and drop)
class Sortable {
    constructor(element, options = {}) {
        this.element = element;
        this.options = { ...options };
        this.draggedElement = null;
        this.placeholder = null;
        
        this.initialize();
    }

    initialize() {
        this.element.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }

    handleMouseDown(e) {
        const handle = e.target.closest(this.options.handle || '.rule-card');
        if (!handle) return;

        this.draggedElement = handle;
        this.placeholder = this.createPlaceholder();
        
        const rect = this.draggedElement.getBoundingClientRect();
        this.offsetY = e.clientY - rect.top;
        
        this.draggedElement.style.position = 'absolute';
        this.draggedElement.style.zIndex = '1000';
        this.draggedElement.style.opacity = '0.8';
        
        this.element.insertBefore(this.placeholder, this.draggedElement);
        
        e.preventDefault();
    }

    handleMouseMove(e) {
        if (!this.draggedElement) return;

        const elementRect = this.element.getBoundingClientRect();
        const y = e.clientY - elementRect.top - this.offsetY;
        
        this.draggedElement.style.top = `${y}px`;
        this.draggedElement.style.left = '0';
        this.draggedElement.style.width = '100%';
        
        // Find the element to insert before
        const afterElement = this.getDragAfterElement(this.element, e.clientY);
        if (afterElement == null) {
            this.element.appendChild(this.placeholder);
        } else {
            this.element.insertBefore(this.placeholder, afterElement);
        }
    }

    handleMouseUp(e) {
        if (!this.draggedElement) return;

        this.element.insertBefore(this.draggedElement, this.placeholder);
        this.draggedElement.style.position = '';
        this.draggedElement.style.zIndex = '';
        this.draggedElement.style.opacity = '';
        this.draggedElement.style.top = '';
        this.draggedElement.style.left = '';
        this.draggedElement.style.width = '';
        
        this.placeholder.remove();
        
        if (this.options.onEnd) {
            this.options.onEnd({ oldIndex: 0, newIndex: 0 });
        }
        
        this.draggedElement = null;
        this.placeholder = null;
    }

    createPlaceholder() {
        const placeholder = document.createElement('div');
        placeholder.className = 'rule-card sortable-ghost';
        placeholder.style.height = this.draggedElement.offsetHeight + 'px';
        return placeholder;
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.rule-card:not(.sortable-ghost)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    destroy() {
        this.element.removeEventListener('mousedown', this.handleMouseDown.bind(this));
        document.removeEventListener('mousemove', this.handleMouseMove.bind(this));
        document.removeEventListener('mouseup', this.handleMouseUp.bind(this));
    }
}

// Initialize rules editor when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.rulesEditor = new RulesEditor();
});