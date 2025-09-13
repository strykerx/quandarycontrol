/**
 * Enhanced Layout Builder (Phase 2)
 * - Native HTML5 Drag API implementation
 * - Grid snap and position storage
 * - Component palette with drag handles
 * - Template system integration
 */

class EnhancedLayoutBuilder {
  constructor() {
    this.gridColumns = 12;
    this.gridRows = 6;
    this.gridGap = 10;
    this.components = [];
    this.draggedComponent = null;
    this.templates = [];
    this.currentTemplate = null;
    this.selectedComponent = null;
    this.currentRoomId = null;
    this.isDragging = false;
    this.isResizing = false;
    this.dragOffset = { x: 0, y: 0 };
    this.gridOverlayVisible = true;
    this.snapToGridEnabled = true;
    
    this.init();
  }

  async init() {
    // Initialize UI elements
    this.initUIElements();
    
    // Initialize drag handlers
    this.initDragHandlers();
    
    // Initialize template system
    await this.initTemplateSystem();
    
    // Initialize event listeners
    this.initEventListeners();
    
    // Initialize grid
    this.renderGrid();
    
    // Load room ID from URL if available
    this.loadRoomIdFromURL();
    
    // Load saved layout or template
    this.loadInitialLayout();
  }

  initUIElements() {
    // Get DOM elements
    this.elements = {
      canvas: document.getElementById('lb-canvas'),
      backBtn: document.getElementById('lb-back'),
      validateBtn: document.getElementById('lb-validate'),
      exportBtn: document.getElementById('lb-export'),
      resetBtn: document.getElementById('lb-reset'),
      saveBtn: document.getElementById('lb-save'),
      roomChip: document.getElementById('lb-room-chip'),
      columnsSelect: document.getElementById('lb-columns'),
      rowsSelect: document.getElementById('lb-rows'),
      gapRange: document.getElementById('lb-gap'),
      gapValue: document.getElementById('lb-gap-val'),
      clearBtn: document.getElementById('lb-clear'),
      jsonTextarea: document.getElementById('lb-json'),
      htmlPre: document.getElementById('lb-html'),
      cssPre: document.getElementById('lb-css'),
      previewDiv: document.getElementById('lb-preview'),
      statusDiv: document.getElementById('lb-status'),
      templateSelect: document.getElementById('lb-template-select'),
      loadTemplateBtn: document.getElementById('lb-load-template'),
      saveAsTemplateBtn: document.getElementById('lb-save-as-template'),
      templateNameInput: document.getElementById('lb-template-name'),
      templateDescInput: document.getElementById('lb-template-desc'),
      inspectorType: document.getElementById('insp-type'),
      inspectorRow: document.getElementById('insp-row'),
      inspectorCol: document.getElementById('insp-col'),
      inspectorSpan: document.getElementById('insp-span'),
      inspectorUpdateBtn: document.getElementById('insp-update'),
      inspectorDeleteBtn: document.getElementById('insp-delete'),
      tabs: document.querySelectorAll('.lb-tab'),
      tabPanels: document.querySelectorAll('.lb-tab-panel')
    };
  }

  async initTemplateSystem() {
    try {
      // Fetch available templates
      const response = await fetch('/api/layout-templates');
      const result = await response.json();
      
      if (result.success) {
        this.templates = result.data;
        this.populateTemplateSelector();
      } else {
        console.error('Failed to load templates:', result.error);
        this.showStatus('Failed to load templates', 'error');
      }
    } catch (error) {
      console.error('Error initializing template system:', error);
      this.showStatus('Error loading templates', 'error');
    }
  }

  populateTemplateSelector() {
    if (!this.elements.templateSelect) return;
    
    // Clear existing options except the default
    while (this.elements.templateSelect.options.length > 1) {
      this.elements.templateSelect.remove(1);
    }
    
    // Add template options
    this.templates.forEach(template => {
      const option = document.createElement('option');
      option.value = template.id;
      option.textContent = template.name;
      this.elements.templateSelect.appendChild(option);
    });
  }

  initEventListeners() {
    // Header buttons
    if (this.elements.backBtn) {
      this.elements.backBtn.addEventListener('click', () => this.goBackToAdmin());
    }
    
    if (this.elements.validateBtn) {
      this.elements.validateBtn.addEventListener('click', () => this.validateLayout());
    }
    
    if (this.elements.exportBtn) {
      this.elements.exportBtn.addEventListener('click', () => this.exportLayout());
    }
    
    if (this.elements.resetBtn) {
      this.elements.resetBtn.addEventListener('click', () => this.resetLayout());
    }
    
    if (this.elements.saveBtn) {
      this.elements.saveBtn.addEventListener('click', () => this.saveLayoutToRoom());
    }
    
    // Grid controls
    if (this.elements.columnsSelect) {
      this.elements.columnsSelect.addEventListener('change', (e) => {
        this.gridColumns = parseInt(e.target.value);
        this.renderGrid();
        this.renderComponents();
        this.updatePreview();
      });
    }
    
    if (this.elements.rowsSelect) {
      this.elements.rowsSelect.addEventListener('change', (e) => {
        this.gridRows = parseInt(e.target.value);
        this.renderGrid();
        this.renderComponents();
        this.updatePreview();
      });
    }
    
    if (this.elements.gapRange) {
      this.elements.gapRange.addEventListener('input', (e) => {
        this.gridGap = parseInt(e.target.value);
        if (this.elements.gapValue) {
          this.elements.gapValue.textContent = this.gridGap;
        }
        this.renderGrid();
        this.renderComponents();
        this.updatePreview();
      });
    }
    
    if (this.elements.clearBtn) {
      this.elements.clearBtn.addEventListener('click', () => this.clearCanvas());
    }
    
    // Template controls
    if (this.elements.loadTemplateBtn && this.elements.templateSelect) {
      this.elements.loadTemplateBtn.addEventListener('click', () => this.loadSelectedTemplate());
    }
    
    if (this.elements.saveAsTemplateBtn) {
      this.elements.saveAsTemplateBtn.addEventListener('click', () => this.saveAsTemplate());
    }
    
    // Inspector controls
    if (this.elements.inspectorUpdateBtn) {
      this.elements.inspectorUpdateBtn.addEventListener('click', () => this.updateSelectedComponent());
    }
    
    if (this.elements.inspectorDeleteBtn) {
      this.elements.inspectorDeleteBtn.addEventListener('click', () => this.deleteSelectedComponent());
    }
    
    // Tab switching
    this.elements.tabs.forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });
  }

  initDragHandlers() {
    // Component palette drag handlers
    document.querySelectorAll('[draggable="true"]').forEach(component => {
      component.addEventListener('dragstart', (e) => {
        this.draggedComponent = {
          type: e.target.dataset.component,
          width: 3 // Default span
        };
        e.dataTransfer.setData('text/plain', e.target.dataset.component);
      });
    });

    // Grid drop zone
    if (this.elements.canvas) {
      this.elements.canvas.addEventListener('dragover', (e) => {
        e.preventDefault();
        this.highlightDropZone(e);
      });

      this.elements.canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        this.placeComponent(e);
        this.clearDropHighlights();
      });
    }

    // Add mouse event handlers for improved drag feedback
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
  }

  loadRoomIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('roomId');
    
    if (roomId) {
      this.currentRoomId = roomId;
      if (this.elements.roomChip) {
        this.elements.roomChip.textContent = `Room: ${roomId}`;
        this.elements.roomChip.title = `Editing layout for room ${roomId}`;
      }
    }
  }

  loadInitialLayout() {
    // Try to load room-specific layout first
    if (this.currentRoomId) {
      this.loadRoomLayout(this.currentRoomId);
    } else {
      // Try to load from localStorage
      const savedLayout = localStorage.getItem('layoutConfig');
      if (savedLayout) {
        try {
          const config = JSON.parse(savedLayout);
          this.applyLayoutConfig(config);
        } catch (error) {
          console.error('Error parsing saved layout:', error);
          this.showStatus('Error loading saved layout', 'error');
        }
      }
    }
  }

  async loadRoomLayout(roomId) {
    try {
      const response = await fetch(`/api/rooms/${roomId}/layout`);
      const result = await response.json();
      
      if (result.success && result.data) {
        this.applyLayoutConfig(result.data);
        this.showStatus(`Loaded layout for room ${roomId}`, 'success');
      } else {
        // No custom layout found, use defaults
        console.log('No custom layout found for room, using defaults');
        this.showStatus('No custom layout found, using defaults', 'info');
      }
    } catch (error) {
      console.error('Error loading room layout:', error);
      this.showStatus('Error loading room layout', 'error');
    }
  }

  applyLayoutConfig(config) {
    if (config.columns) this.gridColumns = config.columns;
    if (config.rows) this.gridRows = config.rows;
    if (config.gap) this.gridGap = config.gap;
    if (config.components) this.components = config.components;
    
    // Update UI controls
    if (this.elements.columnsSelect) this.elements.columnsSelect.value = this.gridColumns;
    if (this.elements.rowsSelect) this.elements.rowsSelect.value = this.gridRows;
    if (this.elements.gapRange) {
      this.elements.gapRange.value = this.gridGap;
      if (this.elements.gapValue) this.elements.gapValue.textContent = this.gridGap;
    }
    
    // Re-render grid and components
    this.renderGrid();
    this.renderComponents();
    this.updatePreview();
    this.updateJSONOutput();
  }

  loadSelectedTemplate() {
    if (!this.elements.templateSelect) return;
    
    const templateId = this.elements.templateSelect.value;
    if (!templateId || templateId === 'default') return;
    
    const template = this.templates.find(t => t.id === templateId);
    if (!template) return;
    
    this.currentTemplate = template;
    this.applyLayoutConfig(template.layout);
    this.showStatus(`Loaded template: ${template.name}`, 'success');
  }

  async saveAsTemplate() {
    const name = this.elements.templateNameInput?.value.trim();
    const description = this.elements.templateDescInput?.value.trim();
    
    if (!name) {
      this.showStatus('Template name is required', 'error');
      return;
    }
    
    const templateData = {
      name,
      description: description || 'Custom layout template',
      layout: {
        columns: this.gridColumns,
        rows: this.gridRows,
        gap: this.gridGap,
        components: this.components
      }
    };
    
    try {
      const response = await fetch('/api/layout-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(templateData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Add new template to list
        this.templates.push(result.data);
        this.populateTemplateSelector();
        
        // Clear form
        if (this.elements.templateNameInput) this.elements.templateNameInput.value = '';
        if (this.elements.templateDescInput) this.elements.templateDescInput.value = '';
        
        this.showStatus(`Template "${name}" saved successfully`, 'success');
      } else {
        this.showStatus(`Failed to save template: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      this.showStatus('Error saving template', 'error');
    }
  }

  async saveLayoutToRoom() {
    if (!this.currentRoomId) {
      this.showStatus('No room selected', 'error');
      return;
    }
    
    const layoutConfig = {
      columns: this.gridColumns,
      rows: this.gridRows,
      gap: this.gridGap,
      components: this.components
    };
    
    try {
      const response = await fetch(`/api/rooms/${this.currentRoomId}/layout`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ layout: layoutConfig })
      });
      
      const result = await response.json();
      
      if (result.success) {
        this.showStatus('Layout saved to room successfully', 'success');
      } else {
        this.showStatus(`Failed to save layout: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error saving layout to room:', error);
      this.showStatus('Error saving layout to room', 'error');
    }
  }

  highlightDropZone(e) {
    const {col, row} = this.calculateGridPosition(e);
    const cells = document.querySelectorAll('.grid-cell');
    cells.forEach(cell => cell.classList.remove('drop-active'));
    
    const targetCell = [...cells].find(cell =>
      parseInt(cell.dataset.col) === col &&
      parseInt(cell.dataset.row) === row
    );
    
    if(targetCell) {
      targetCell.classList.add('drop-active');
      targetCell.style.gridColumn = `span ${this.draggedComponent.width}`;
    }
  }

  calculateGridPosition(e) {
    const gridRect = this.elements.canvas.getBoundingClientRect();
    const cellSize = (gridRect.width - (this.gridGap * (this.gridColumns - 1))) / this.gridColumns;
    
    // Snap to grid using Math.round()
    let col = Math.round((e.clientX - gridRect.left) / (cellSize + this.gridGap)) + 1;
    let row = Math.round((e.clientY - gridRect.top) / (cellSize + this.gridGap)) + 1;
    
    // Apply snap-to-grid if enabled
    if (this.snapToGridEnabled) {
      col = Math.round(col);
      row = Math.round(row);
    }
    
    // Clamp to grid bounds
    col = Math.max(1, Math.min(col, this.gridColumns));
    row = Math.max(1, Math.min(row, this.gridRows));
    
    return { col, row };
  }

  placeComponent(e) {
    const position = this.calculateGridPosition(e);
    const newComponent = {
      type: this.draggedComponent.type,
      col: position.col,
      row: position.row,
      width: this.draggedComponent.width,
      id: `comp_${Date.now()}`
    };
    
    this.components.push(newComponent);
    this.renderComponents();
    this.updatePreview();
    this.updateJSONOutput();
  }

  clearDropHighlights() {
    const cells = document.querySelectorAll('.grid-cell');
    cells.forEach(cell => {
      cell.classList.remove('drop-active');
      cell.style.gridColumn = '';
    });
  }

  renderGrid() {
    if (!this.elements.canvas) return;
    
    this.elements.canvas.style.gridTemplateColumns = `repeat(${this.gridColumns}, 1fr)`;
    this.elements.canvas.style.gap = `${this.gridGap}px`;
    
    // Generate grid cells with overlay visualization
    this.elements.canvas.innerHTML = Array.from({length: this.gridRows * this.gridColumns}, (_, i) => {
      const col = (i % this.gridColumns) + 1;
      const row = Math.floor(i / this.gridColumns) + 1;
      const overlayClass = this.gridOverlayVisible ? 'grid-overlay-visible' : '';
      return `<div class="grid-cell ${overlayClass}" data-col="${col}" data-row="${row}"></div>`;
    }).join('');
    
    // Add grid overlay toggle button if it doesn't exist
    if (!document.getElementById('grid-overlay-toggle')) {
      const toggleBtn = document.createElement('button');
      toggleBtn.id = 'grid-overlay-toggle';
      toggleBtn.className = 'lb-btn lb-btn-ghost';
      toggleBtn.textContent = 'Toggle Grid Overlay';
      toggleBtn.addEventListener('click', () => this.toggleGridOverlay());
      
      const toolbar = document.querySelector('.lb-canvas-toolbar .lb-toolbar-actions');
      if (toolbar) {
        toolbar.appendChild(toggleBtn);
      }
    }
    
    // Add snap-to-grid toggle button if it doesn't exist
    if (!document.getElementById('snap-to-grid-toggle')) {
      const snapBtn = document.createElement('button');
      snapBtn.id = 'snap-to-grid-toggle';
      snapBtn.className = 'lb-btn lb-btn-ghost';
      snapBtn.textContent = 'Snap to Grid: ON';
      snapBtn.addEventListener('click', () => this.toggleSnapToGrid());
      
      const toolbar = document.querySelector('.lb-canvas-toolbar .lb-toolbar-actions');
      if (toolbar) {
        toolbar.appendChild(snapBtn);
      }
    }
  }

  renderComponents() {
    if (!this.elements.canvas) return;
    
    // Remove existing components
    this.elements.canvas.querySelectorAll('.component').forEach(el => el.remove());
    
    // Add components
    this.components.forEach(comp => {
      const el = document.createElement('div');
      el.className = `component ${comp.type}`;
      el.id = comp.id;
      el.draggable = true;
      el.dataset.componentId = comp.id;
      
      // Add component-specific content
      const componentContent = this.getComponentContent(comp.type);
      el.innerHTML = `
        ${componentContent}
        <div class="resize-handle" data-component-id="${comp.id}"></div>
      `;
      
      el.style.gridColumn = `${comp.col} / span ${comp.width}`;
      el.style.gridRow = comp.row;
      
      // Add click event for selection
      el.addEventListener('click', (e) => {
        if (!this.isResizing) {
          this.selectComponent(comp);
        }
      });
      
      // Add drag event for moving
      el.addEventListener('dragstart', (e) => {
        this.draggedComponent = comp;
        this.isDragging = true;
        e.dataTransfer.setData('text/plain', comp.id);
        this.addDragVisualFeedback(el);
      });
      
      el.addEventListener('dragend', (e) => {
        this.isDragging = false;
        this.removeDragVisualFeedback(el);
      });
      
      // Add mouse events for resize handles
      const resizeHandle = el.querySelector('.resize-handle');
      if (resizeHandle) {
        resizeHandle.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.startResize(comp, e);
        });
      }
      
      this.elements.canvas.appendChild(el);
    });
  }

  getComponentContent(type) {
    const contentMap = {
      timer: '⏱️ Timer',
      gameState: '🎮 Game State',
      hints: '💡 Hints',
      navigation: '🧭 Navigation',
      chat: '💬 Chat',
      media: '🖼️ Media'
    };
    
    return contentMap[type] || type;
  }

  selectComponent(component) {
    this.selectedComponent = component;
    
    // Update inspector
    if (this.elements.inspectorType) this.elements.inspectorType.value = component.type;
    if (this.elements.inspectorRow) this.elements.inspectorRow.value = component.row;
    if (this.elements.inspectorCol) this.elements.inspectorCol.value = component.col;
    if (this.elements.inspectorSpan) this.elements.inspectorSpan.value = component.width;
    
    // Visual selection
    this.elements.canvas.querySelectorAll('.component').forEach(el => {
      el.classList.remove('selected');
    });
    
    const selectedEl = this.elements.canvas.querySelector(`[data-component-id="${component.id}"]`);
    if (selectedEl) {
      selectedEl.classList.add('selected');
    }
  }

  updateSelectedComponent() {
    if (!this.selectedComponent) return;
    
    // Update component properties from inspector
    if (this.elements.inspectorRow) {
      this.selectedComponent.row = parseInt(this.elements.inspectorRow.value);
    }
    if (this.elements.inspectorCol) {
      this.selectedComponent.col = parseInt(this.elements.inspectorCol.value);
    }
    if (this.elements.inspectorSpan) {
      this.selectedComponent.width = parseInt(this.elements.inspectorSpan.value);
    }
    
    // Re-render components
    this.renderComponents();
    this.updatePreview();
    this.updateJSONOutput();
    
    this.showStatus('Component updated', 'success');
  }

  deleteSelectedComponent() {
    if (!this.selectedComponent) return;
    
    // Remove component from array
    this.components = this.components.filter(c => c.id !== this.selectedComponent.id);
    
    // Clear selection
    this.selectedComponent = null;
    
    // Re-render components
    this.renderComponents();
    this.updatePreview();
    this.updateJSONOutput();
    
    this.showStatus('Component deleted', 'success');
  }

  clearCanvas() {
    if (confirm('Are you sure you want to clear all components?')) {
      this.components = [];
      this.selectedComponent = null;
      this.renderComponents();
      this.updatePreview();
      this.updateJSONOutput();
      this.showStatus('Canvas cleared', 'info');
    }
  }

  resetLayout() {
    if (confirm('Are you sure you want to reset to default layout?')) {
      this.components = [];
      this.gridColumns = 12;
      this.gridRows = 6;
      this.gridGap = 10;
      this.selectedComponent = null;
      
      // Update UI controls
      if (this.elements.columnsSelect) this.elements.columnsSelect.value = this.gridColumns;
      if (this.elements.rowsSelect) this.elements.rowsSelect.value = this.gridRows;
      if (this.elements.gapRange) {
        this.elements.gapRange.value = this.gridGap;
        if (this.elements.gapValue) this.elements.gapValue.textContent = this.gridGap;
      }
      
      // Re-render
      this.renderGrid();
      this.renderComponents();
      this.updatePreview();
      this.updateJSONOutput();
      
      this.showStatus('Layout reset to defaults', 'info');
    }
  }

  async validateLayout() {
    const errors = [];
    
    // Check for overlapping components
    for (let i = 0; i < this.components.length; i++) {
      for (let j = i + 1; j < this.components.length; j++) {
        if (this.componentsOverlap(this.components[i], this.components[j])) {
          errors.push(`Components overlap: ${this.components[i].type} and ${this.components[j].type}`);
        }
      }
    }
    
    // Check for out-of-bounds components
    this.components.forEach(comp => {
      if (comp.col < 1 || comp.col + comp.width - 1 > this.gridColumns) {
        errors.push(`Component out of bounds: ${comp.type}`);
      }
      if (comp.row < 1 || comp.row > this.gridRows) {
        errors.push(`Component out of bounds: ${comp.type}`);
      }
    });
    
    // Validate against schema if saving as template
    const layoutConfig = {
      columns: this.gridColumns,
      rows: this.gridRows,
      gap: this.gridGap,
      components: this.components
    };
    
    // Server-side validation
    try {
      const response = await fetch('/api/layout/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ layout: layoutConfig })
      });
      
      const result = await response.json();
      
      if (result.success && !result.data.valid) {
        errors.push(...result.data.errors);
      }
    } catch (error) {
      console.error('Error validating layout with server:', error);
      errors.push('Server validation unavailable');
    }
    
    // Display validation results
    if (errors.length > 0) {
      this.showStatus(`Validation failed: ${errors.join(', ')}`, 'error');
      this.displayValidationErrors(errors);
    } else {
      this.showStatus('Layout validation passed', 'success');
      this.displayValidationErrors([]);
    }
  }
  
  displayValidationErrors(errors) {
    // Find or create validation results container
    let validationContainer = document.getElementById('validation-results');
    
    if (!validationContainer) {
      validationContainer = document.createElement('div');
      validationContainer.id = 'validation-results';
      validationContainer.className = 'validation-results';
      
      // Insert after status div
      if (this.elements.statusDiv) {
        this.elements.statusDiv.parentNode.insertBefore(validationContainer, this.elements.statusDiv.nextSibling);
      }
    }
    
    // Update content
    if (errors.length > 0) {
      validationContainer.innerHTML = `
        <div class="validation-errors">
          <h4>Validation Errors:</h4>
          <ul>
            ${errors.map(error => `<li>${error}</li>`).join('')}
          </ul>
        </div>
      `;
      validationContainer.classList.add('has-errors');
    } else {
      validationContainer.innerHTML = `
        <div class="validation-success">
          ✓ Layout configuration is valid
        </div>
      `;
      validationContainer.classList.remove('has-errors');
    }
  }

  componentsOverlap(comp1, comp2) {
    // Check if two components overlap in the grid
    const comp1Right = comp1.col + comp1.width - 1;
    const comp2Right = comp2.col + comp2.width - 1;
    
    return !(comp1Right < comp2.col || comp2Right < comp1.col || comp1.row !== comp2.row);
  }

  exportLayout() {
    const layoutConfig = {
      columns: this.gridColumns,
      rows: this.gridRows,
      gap: this.gridGap,
      components: this.components
    };
    
    const jsonString = JSON.stringify(layoutConfig, null, 2);
    
    // Create download link
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `layout-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.showStatus('Layout exported', 'success');
  }

  updatePreview() {
    if (!this.elements.previewDiv) return;
    
    // Generate preview HTML
    let previewHTML = '<div class="preview-container" style="display: grid; ';
    previewHTML += `grid-template-columns: repeat(${this.gridColumns}, 1fr); `;
    previewHTML += `gap: ${this.gridGap}px; `;
    previewHTML += 'height: 100%;">';
    
    this.components.forEach(comp => {
      previewHTML += `<div class="preview-component ${comp.type}" style="`;
      previewHTML += `grid-column: ${comp.col} / span ${comp.width}; `;
      previewHTML += `grid-row: ${comp.row}; `;
      previewHTML += 'background: rgba(102, 126, 234, 0.2); ';
      previewHTML += 'border: 1px solid rgba(102, 126, 234, 0.5); ';
      previewHTML += 'border-radius: 8px; ';
      previewHTML += 'padding: 8px; ';
      previewHTML += 'display: flex; ';
      previewHTML += 'align-items: center; ';
      previewHTML += 'justify-content: center;';
      previewHTML += `">${this.getComponentContent(comp.type)}</div>`;
    });
    
    previewHTML += '</div>';
    
    this.elements.previewDiv.innerHTML = previewHTML;
  }

  updateJSONOutput() {
    if (!this.elements.jsonTextarea) return;
    
    const layoutConfig = {
      columns: this.gridColumns,
      rows: this.gridRows,
      gap: this.gridGap,
      components: this.components
    };
    
    this.elements.jsonTextarea.value = JSON.stringify(layoutConfig, null, 2);
    
    // Update HTML/CSS output if visible
    if (this.elements.htmlPre && this.elements.cssPre) {
      this.updateCodeOutput();
    }
  }

  updateCodeOutput() {
    if (!this.elements.htmlPre || !this.elements.cssPre) return;
    
    // Generate HTML
    let html = '<div class="layout-container">\n';
    this.components.forEach(comp => {
      html += `  <div class="component ${comp.type}" data-id="${comp.id}"></div>\n`;
    });
    html += '</div>';
    
    // Generate CSS
    let css = `.layout-container {\n`;
    css += `  display: grid;\n`;
    css += `  grid-template-columns: repeat(${this.gridColumns}, 1fr);\n`;
    css += `  gap: ${this.gridGap}px;\n`;
    css += `}\n\n`;
    
    this.components.forEach(comp => {
      css += `.component.${comp.type} {\n`;
      css += `  grid-column: ${comp.col} / span ${comp.width};\n`;
      css += `  grid-row: ${comp.row};\n`;
      css += `}\n\n`;
    });
    
    this.elements.htmlPre.textContent = html;
    this.elements.cssPre.textContent = css;
  }

  switchTab(tabName) {
    // Update tab buttons
    this.elements.tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Update tab panels
    this.elements.tabPanels.forEach(panel => {
      panel.classList.toggle('active', panel.id === `tab-${tabName}`);
    });
    
    // Update content for active tab
    if (tabName === 'preview') {
      this.updatePreview();
    } else if (tabName === 'json') {
      this.updateJSONOutput();
    } else if (tabName === 'code') {
      this.updateCodeOutput();
    }
  }

  showStatus(message, type = 'info') {
    if (!this.elements.statusDiv) return;
    
    this.elements.statusDiv.textContent = message;
    this.elements.statusDiv.className = 'lb-status';
    
    if (type === 'success') {
      this.elements.statusDiv.classList.add('ok');
    } else if (type === 'error') {
      this.elements.statusDiv.classList.add('err');
    }
    
    // Clear status after 3 seconds
    setTimeout(() => {
      if (this.elements.statusDiv.textContent === message) {
        this.elements.statusDiv.textContent = '';
        this.elements.statusDiv.className = 'lb-status';
      }
    }, 3000);
  }

  goBackToAdmin() {
    // Navigate back to admin page
    window.location.href = '/admin.html';
  }

  // Grid overlay toggle
  toggleGridOverlay() {
    this.gridOverlayVisible = !this.gridOverlayVisible;
    const cells = document.querySelectorAll('.grid-cell');
    cells.forEach(cell => {
      cell.classList.toggle('grid-overlay-visible', this.gridOverlayVisible);
    });
    
    const toggleBtn = document.getElementById('grid-overlay-toggle');
    if (toggleBtn) {
      toggleBtn.textContent = `Grid Overlay: ${this.gridOverlayVisible ? 'ON' : 'OFF'}`;
    }
    
    this.showStatus(`Grid overlay ${this.gridOverlayVisible ? 'enabled' : 'disabled'}`, 'info');
  }

  // Snap-to-grid toggle
  toggleSnapToGrid() {
    this.snapToGridEnabled = !this.snapToGridEnabled;
    
    const toggleBtn = document.getElementById('snap-to-grid-toggle');
    if (toggleBtn) {
      toggleBtn.textContent = `Snap to Grid: ${this.snapToGridEnabled ? 'ON' : 'OFF'}`;
    }
    
    this.showStatus(`Snap to grid ${this.snapToGridEnabled ? 'enabled' : 'disabled'}`, 'info');
  }

  // Mouse move handler for drag operations
  handleMouseMove(e) {
    if (this.isDragging && this.draggedComponent) {
      // Add visual feedback during drag
      this.updateDragVisualFeedback(e);
    }
    
    if (this.isResizing && this.resizingComponent) {
      this.handleResize(e);
    }
  }

  // Mouse up handler for drag operations
  handleMouseUp(e) {
    if (this.isDragging) {
      this.isDragging = false;
      this.removeDragVisualFeedback();
    }
    
    if (this.isResizing) {
      this.isResizing = false;
      this.resizingComponent = null;
      document.body.style.cursor = 'default';
    }
  }

  // Add visual feedback during drag operations
  addDragVisualFeedback(element) {
    element.style.opacity = '0.7';
    element.style.transform = 'scale(1.05)';
    element.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.4)';
    element.style.zIndex = '1000';
    element.style.transition = 'all 0.2s ease';
  }

  // Remove visual feedback after drag operations
  removeDragVisualFeedback(element) {
    if (element) {
      element.style.opacity = '';
      element.style.transform = '';
      element.style.boxShadow = '';
      element.style.zIndex = '';
    } else {
      // Remove from all components
      document.querySelectorAll('.component').forEach(el => {
        el.style.opacity = '';
        el.style.transform = '';
        el.style.boxShadow = '';
        el.style.zIndex = '';
      });
    }
    
    // Hide drag preview if it exists
    const preview = document.getElementById('drag-preview');
    if (preview) {
      preview.style.display = 'none';
    }
  }

  // Update visual feedback during drag
  updateDragVisualFeedback(e) {
    // Create or update drag preview
    let preview = document.getElementById('drag-preview');
    if (!preview) {
      preview = document.createElement('div');
      preview.id = 'drag-preview';
      preview.className = 'drag-preview';
      document.body.appendChild(preview);
    }
    
    preview.style.left = `${e.clientX - 40}px`;
    preview.style.top = `${e.clientY - 20}px`;
    preview.style.display = 'block';
    
    // Update preview content
    if (this.draggedComponent.type) {
      preview.textContent = this.getComponentContent(this.draggedComponent.type);
    }
  }

  // Start resize operation
  startResize(component, e) {
    this.isResizing = true;
    this.resizingComponent = component;
    this.resizeStartX = e.clientX;
    this.resizeStartWidth = component.width;
    document.body.style.cursor = 'nwse-resize';
    
    // Add visual feedback
    const element = document.querySelector(`[data-component-id="${component.id}"]`);
    if (element) {
      element.style.transition = 'none';
      element.classList.add('resizing');
    }
  }

  // Handle resize operation
  handleResize(e) {
    if (!this.resizingComponent) return;
    
    const deltaX = e.clientX - this.resizeStartX;
    const gridRect = this.elements.canvas.getBoundingClientRect();
    const cellWidth = (gridRect.width - (this.gridGap * (this.gridColumns - 1))) / this.gridColumns;
    
    // Calculate new width in grid columns
    const newWidthCells = Math.round(deltaX / cellWidth);
    let newWidth = this.resizeStartWidth + newWidthCells;
    
    // Clamp to valid range
    newWidth = Math.max(1, Math.min(newWidth, this.gridColumns - this.resizingComponent.col + 1));
    
    // Update component width
    this.resizingComponent.width = newWidth;
    
    // Update visual representation
    const element = document.querySelector(`[data-component-id="${this.resizingComponent.id}"]`);
    if (element) {
      element.style.gridColumn = `${this.resizingComponent.col} / span ${newWidth}`;
    }
    
    // Update preview
    this.updatePreview();
    this.updateJSONOutput();
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  window.layoutBuilder = new EnhancedLayoutBuilder();
});