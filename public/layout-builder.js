/**
 * Quandary Layout Builder
 * - Drag-and-drop grid builder for default layout
 * - Color scheme editor (applies to CSS variables)
 * - Live preview + generated HTML/CSS
 * - Validate and save via existing API endpoints
 *
 * Quick usage:
 * - Optional: pass ?roomId=ROOM_ID to load/save that room's layout
 * - Drag items from the left palette onto the canvas
 * - Select a block to tweak Row/Col/Span in Inspector
 * - Edit Grid columns/rows/gap
 * - Colors: choose and Apply to preview
 * - Validate JSON, then Save to room (requires roomId)
 */

(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const byId = (id) => document.getElementById(id);

  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('roomId');

  // State model
  const model = {
    columns: 12,
    rows: 6,
    gap: 10, // px
    cellH: 72, // px visual height per row in builder
    blocks: [], // {id, type, row, col, span}
    colors: {
      primary: '#667eea',
      secondary: '#764ba2',
      accent: '#ff6b6b',
      darkMode: false
    },
    selectedId: null
  };

  // Elements
  const el = {
    back: byId('lb-back'),
    validate: byId('lb-validate'),
    exportBtn: byId('lb-export'),
    reset: byId('lb-reset'),
    save: byId('lb-save'),
    roomChip: byId('lb-room-chip'),

    palette: byId('lb-palette'),
    columns: byId('lb-columns'),
    rows: byId('lb-rows'),
    gap: byId('lb-gap'),
    gapVal: byId('lb-gap-val'),
    applyColors: byId('lb-apply-colors'),

    colorPrimary: byId('color-primary'),
    colorSecondary: byId('color-secondary'),
    colorAccent: byId('color-accent'),
    darkMode: byId('lb-darkmode'),

    canvas: byId('lb-canvas'),
    clearCanvas: byId('lb-clear'),

    inspType: byId('insp-type'),
    inspRow: byId('insp-row'),
    inspCol: byId('insp-col'),
    inspSpan: byId('insp-span'),
    inspUpdate: byId('insp-update'),
    inspDelete: byId('insp-delete'),

    tabs: $$('.lb-tab'),
    panels: {
      preview: byId('tab-preview'),
      json: byId('tab-json'),
      code: byId('tab-code')
    },
    preview: byId('lb-preview'),
    json: byId('lb-json'),
    html: byId('lb-html'),
    css: byId('lb-css'),
    status: byId('lb-status')
  };

  // Init
  function init() {
    // Room chip
    if (roomId) {
      el.roomChip.textContent = `Room: ${roomId}`;
      loadRoomLayout(roomId).catch(() => {});
    } else {
      el.roomChip.textContent = 'No room selected';
    }

    // Palette drag
    setupPalette();

    // Grid controls
    el.columns.addEventListener('change', () => {
      model.columns = parseInt(el.columns.value, 10);
      clampBlocksToGrid();
      renderAll();
    });
    el.rows.addEventListener('change', () => {
      model.rows = parseInt(el.rows.value, 10);
      clampBlocksToGrid();
      renderAll();
    });
    el.gap.addEventListener('input', () => {
      model.gap = parseInt(el.gap.value, 10);
      el.gapVal.textContent = String(model.gap);
      renderAll();
    });

    // Canvas DnD and click
    setupCanvas();

    // Inspector
    el.inspUpdate.addEventListener('click', applyInspector);
    el.inspDelete.addEventListener('click', deleteSelected);

    // Colors
    el.applyColors.addEventListener('click', applyColors);
    el.darkMode.addEventListener('change', (e) => {
      model.colors.darkMode = !!e.target.checked;
      applyColors();
    });

    // Tabs
    el.tabs.forEach((t) => {
      t.addEventListener('click', () => switchTab(t.dataset.tab));
    });

    // Actions
    el.back.addEventListener('click', () => (window.location.href = '/'));
    el.reset.addEventListener('click', resetCanvas);
    el.clearCanvas.addEventListener('click', clearCanvas);
    el.validate.addEventListener('click', validateLayout);
    el.save.addEventListener('click', saveLayout);
    el.exportBtn.addEventListener('click', exportJSON);

    // JSON editor import (debounced)
    let jsonDeb;
    el.json.addEventListener('input', () => {
      clearTimeout(jsonDeb);
      jsonDeb = setTimeout(importFromJSONEditor, 400);
    });

    // Resize reflow
    window.addEventListener('resize', renderBlocks);

    // Seed defaults
    el.columns.value = String(model.columns);
    el.rows.value = String(model.rows);
    el.gap.value = String(model.gap);
    el.gapVal.textContent = String(model.gap);
    el.colorPrimary.value = model.colors.primary;
    el.colorSecondary.value = model.colors.secondary;
    el.colorAccent.value = model.colors.accent;
    el.darkMode.checked = model.colors.darkMode;

    renderAll();
  }

  // Palette Drag
  function setupPalette() {
    $$('.lb-palette-item', el.palette).forEach((item) => {
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', item.dataset.component);
        e.dataTransfer.effectAllowed = 'copy';
      });
      // keyboard support: Enter to append to (1,1)
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          placeBlock(item.dataset.component, 1, 1, 3);
        }
      });
    });
  }

  // Canvas setup
  function setupCanvas() {
    el.canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      el.canvas.classList.add('lb-drop-active');
    });
    el.canvas.addEventListener('dragleave', () => {
      el.canvas.classList.remove('lb-drop-active');
    });
    el.canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      el.canvas.classList.remove('lb-drop-active');
      const type = e.dataTransfer.getData('text/plain');
      if (!type) return;

      const { col, row } = pointToGrid(e);
      placeBlock(type, row, col, Math.min(3, model.columns - col + 1));
    });

    // Select block
    el.canvas.addEventListener('click', (e) => {
      const block = e.target.closest('.lb-block');
      if (!block) {
        model.selectedId = null;
        syncInspector(null);
        renderBlockSelection();
        return;
      }
      model.selectedId = block.dataset.id;
      renderBlockSelection();
      const info = model.blocks.find((b) => b.id === model.selectedId);
      syncInspector(info || null);
    });
  }

  function clearCanvas() {
    model.blocks = [];
    model.selectedId = null;
    renderAll();
  }

  function resetCanvas() {
    if (!confirm('Clear all blocks and reset grid to defaults?')) return;
    model.columns = 12;
    model.rows = 6;
    model.gap = 10;
    model.blocks = [];
    model.selectedId = null;
    el.columns.value = '12';
    el.rows.value = '6';
    el.gap.value = '10';
    el.gapVal.textContent = '10';
    renderAll();
    setStatus('Reset layout', 'ok');
  }

  // Place a new block
  function placeBlock(type, row, col, span) {
    row = clamp(row, 1, model.rows);
    col = clamp(col, 1, model.columns);
    span = clamp(span, 1, model.columns - col + 1);

    // Ensure only one of each core component unless user wants duplicates; allow multi for flexibility
    const id = `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    model.blocks.push({ id, type, row, col, span });
    model.selectedId = id;
    renderAll();
    setStatus(`Added ${type}`, 'ok');
  }

  // Compute grid position from event point
  function pointToGrid(e) {
    const rect = el.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - 10; // 10 padding in CSS
    const y = e.clientY - rect.top - 10;
    const cellW = cellWidth();
    const cellH = model.cellH;
    const col = clamp(Math.floor((x + model.gap / 2) / (cellW + model.gap)) + 1, 1, model.columns);
    const row = clamp(Math.floor((y + model.gap / 2) / (cellH + model.gap)) + 1, 1, model.rows);
    return { col, row };
  }

  function cellWidth() {
    const innerW = el.canvas.clientWidth - 20; // minus padding (10*2)
    const totalGaps = model.gap * (model.columns - 1);
    const colW = Math.max(24, (innerW - totalGaps) / model.columns);
    return colW;
  }

  // Renderers
  function renderAll() {
    renderGridBackground();
    renderBlocks();
    renderPreviewAndCode();
    renderJSONEditor();
    renderBlockSelection();
  }

  function renderGridBackground() {
    // Background is visual only; blocks are absolutely positioned
    // Nothing to do; the dashed background is handled by CSS; we can draw cell placeholders for alignment
    // Optionally could draw cells, but we keep lightweight
  }

  function renderBlocks() {
    // Clear current
    $$('.lb-block', el.canvas).forEach((n) => n.remove());

    const cw = cellWidth();
    const ch = model.cellH;
    model.blocks.forEach((b) => {
      const left = 10 + (b.col - 1) * (cw + model.gap);
      const top = 10 + (b.row - 1) * (ch + model.gap);
      const width = b.span * cw + (b.span - 1) * model.gap;
      const height = ch;

      const div = document.createElement('div');
      div.className = 'lb-block';
      div.dataset.id = b.id;
      if (model.selectedId === b.id) div.classList.add('selected');
      div.style.left = `${left}px`;
      div.style.top = `${top}px`;
      div.style.width = `${width}px`;
      div.style.height = `${height}px`;
      div.textContent = labelForType(b.type);

      el.canvas.appendChild(div);
    });

    // Set grid container CSS to help visual measurements (gap)
    el.canvas.style.setProperty('--lb-gap', `${model.gap}px`);
  }

  function renderBlockSelection() {
    $$('.lb-block', el.canvas).forEach((n) => {
      n.classList.toggle('selected', n.dataset.id === model.selectedId);
    });
  }

  function syncInspector(info) {
    if (!info) {
      el.inspType.value = '';
      el.inspRow.value = '';
      el.inspCol.value = '';
      el.inspSpan.value = '';
      return;
    }
    el.inspType.value = info.type;
    el.inspRow.value = String(info.row);
    el.inspCol.value = String(info.col);
    el.inspSpan.value = String(info.span);
  }

  function applyInspector() {
    const id = model.selectedId;
    if (!id) return;
    const blk = model.blocks.find((b) => b.id === id);
    if (!blk) return;

    const r = clamp(parseInt(el.inspRow.value || '1', 10), 1, model.rows);
    const c = clamp(parseInt(el.inspCol.value || '1', 10), 1, model.columns);
    const s = clamp(parseInt(el.inspSpan.value || '1', 10), 1, model.columns - c + 1);

    blk.row = r;
    blk.col = c;
    blk.span = s;

    renderAll();
  }

  function deleteSelected() {
    if (!model.selectedId) return;
    model.blocks = model.blocks.filter((b) => b.id !== model.selectedId);
    model.selectedId = null;
    renderAll();
  }

  function clampBlocksToGrid() {
    model.blocks.forEach((b) => {
      b.row = clamp(b.row, 1, model.rows);
      b.col = clamp(b.col, 1, model.columns);
      b.span = clamp(b.span, 1, model.columns - b.col + 1);
    });
  }

  // Colors
  function applyColors() {
    model.colors.primary = el.colorPrimary.value || model.colors.primary;
    model.colors.secondary = el.colorSecondary.value || model.colors.secondary;
    model.colors.accent = el.colorAccent.value || model.colors.accent;

    const root = document.documentElement;
    root.style.setProperty('--primary-color', model.colors.primary);
    root.style.setProperty('--secondary-color', model.colors.secondary);
    root.style.setProperty('--accent-color', model.colors.accent);

    document.body.classList.toggle('dark-mode', !!model.colors.darkMode);

    renderPreviewAndCode();
    setStatus('Applied color scheme', 'ok');
  }

  // Preview & Code
  function renderPreviewAndCode() {
    // Build preview HTML
    const gridStyle = `
      display: grid;
      grid-template-columns: repeat(${model.columns}, 1fr);
      gap: ${model.gap}px;
    `.trim();

    const compHTML = model.blocks.map((b) => {
      const start = b.col;
      const end = b.col + b.span;
      return `<div class="comp ${b.type}" style="grid-column:${start} / ${end}; grid-row:${b.row};">${labelForType(b.type)}</div>`;
    }).join('\n');

    el.preview.innerHTML = `
      <div class="layout-grid" style="${gridStyle}">
        ${compHTML || '<div style="color:#888">Drop components here to preview</div>'}
      </div>
    `;

    // Generated code
    const htmlCode = `
<div class="layout-grid">
${model.blocks.map((b) => {
  const start = b.col;
  const end = b.col + b.span;
  return `  <div class="comp ${b.type}" style="grid-column:${start} / ${end}; grid-row:${b.row};"></div>`;
}).join('\n')}
</div>
`.trim();

    const cssCode = `
.layout-grid {
  display: grid;
  grid-template-columns: repeat(${model.columns}, 1fr);
  gap: ${model.gap}px;
}
.comp { background: var(--bg-card); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; min-height: 72px; }
.comp.timer { /* styles */ }
.comp.gameState { /* styles */ }
.comp.hints { /* styles */ }
.comp.navigation { /* styles */ }
.comp.chat { /* styles */ }
.comp.media { /* styles */ }
`.trim();

    el.html.textContent = htmlCode;
    el.css.textContent = cssCode;
  }

  // JSON editor
  function renderJSONEditor() {
    const json = buildLayoutJSON();
    el.json.value = JSON.stringify(json, null, 2);
  }

  function importFromJSONEditor() {
    try {
      const parsed = JSON.parse(el.json.value || '{}');
      if (!parsed || typeof parsed !== 'object') return;

      // Accept only layouts.default.grid/components
      const def = parsed.layouts && parsed.layouts.default;
      if (!def) return;

      const grid = def.grid || {};
      if (grid.columns) model.columns = clamp(parseInt(grid.columns, 10), 1, 64);
      if (grid.rows) model.rows = clamp(parseInt(grid.rows, 10), 1, 128);
      if (grid.gap) {
        const g = String(grid.gap).endsWith('px') ? parseInt(grid.gap, 10) : parseInt(grid.gap || '10', 10);
        model.gap = clamp(g, 0, 64);
      }

      const comps = def.components || {};
      const blocks = [];
      Object.entries(comps).forEach(([type, cfg], idx) => {
        if (!cfg || cfg.visible === false) return;
        const row = toInt(cfg.position?.gridRow, 1);
        const [start, end] = parseGridCol(cfg.position?.gridColumn);
        const span = Math.max(1, (end || (start + 1)) - start);
        blocks.push({
          id: `${type}_${Date.now()}_${idx}`,
          type,
          row: clamp(row, 1, model.rows),
          col: clamp(start || 1, 1, model.columns),
          span: clamp(span, 1, model.columns)
        });
      });

      model.blocks = blocks;
      model.selectedId = null;
      // Sync UI controls
      el.columns.value = String(model.columns);
      el.rows.value = String(model.rows);
      el.gap.value = String(model.gap);
      el.gapVal.textContent = String(model.gap);

      renderAll();
      setStatus('Imported from JSON', 'ok');
    } catch (e) {
      // ignore
    }
  }

  // API
  async function loadRoomLayout(id) {
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(id)}/layout`);
      const data = await res.json();
      if (!data.success) return;
      const layout = data.data || {};
      if (!layout.layouts || !layout.layouts.default) return;

      // import into model
      const def = layout.layouts.default;
      const grid = def.grid || {};
      model.columns = toInt(grid.columns, model.columns);
      model.rows = toInt(grid.rows, model.rows);
      if (grid.gap) {
        const g = String(grid.gap).endsWith('px') ? parseInt(grid.gap, 10) : parseInt(grid.gap || '10', 10);
        model.gap = clamp(g, 0, 64);
      }
      el.columns.value = String(model.columns);
      el.rows.value = String(model.rows);
      el.gap.value = String(model.gap);
      el.gapVal.textContent = String(model.gap);

      const blocks = [];
      const comps = def.components || {};
      let i = 0;
      Object.entries(comps).forEach(([type, cfg]) => {
        if (!cfg || cfg.visible === false) return;
        const row = toInt(cfg.position?.gridRow, 1);
        const [start, end] = parseGridCol(cfg.position?.gridColumn);
        const span = Math.max(1, (end || (start + 1)) - start);
        blocks.push({
          id: `${type}_${Date.now()}_${i++}`,
          type,
          row: clamp(row, 1, model.rows),
          col: clamp(start || 1, 1, model.columns),
          span: clamp(span, 1, model.columns)
        });
      });
      model.blocks = blocks;
      model.selectedId = null;
      renderAll();
      setStatus('Loaded layout from room', 'ok');
    } catch (e) {
      // ignore
    }
  }

  async function validateLayout() {
    try {
      setStatus('Validating...', 'info');
      const res = await fetch('/api/layout/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: buildLayoutJSON() })
      });
      const data = await res.json();
      if (data.success && data.data?.valid) {
        setStatus('✓ Layout is valid', 'ok');
      } else if (data.success) {
        const errs = (data.data?.errors || []).join('; ');
        setStatus(`Validation failed: ${errs}`, 'err');
      } else {
        setStatus(`Validation error: ${data.error || 'Unknown'}`, 'err');
      }
    } catch (e) {
      setStatus(`Validation error: ${e.message}`, 'err');
    }
  }

  async function saveLayout() {
    if (!roomId) {
      setStatus('No roomId provided. Open builder via Admin → room action to save.', 'err');
      return;
    }
    try {
      setStatus('Saving...', 'info');
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/layout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: buildLayoutJSON() })
      });
      const data = await res.json();
      if (data.success) {
        setStatus('Layout saved to room', 'ok');
      } else {
        setStatus(`Save failed: ${data.error || 'Unknown'}`, 'err');
      }
    } catch (e) {
      setStatus(`Save failed: ${e.message}`, 'err');
    }
  }

  function exportJSON() {
    const txt = JSON.stringify(buildLayoutJSON(), null, 2);
    copyToClipboard(txt).then(
      () => setStatus('JSON copied to clipboard', 'ok'),
      () => setStatus('Copy failed', 'err')
    );
  }

  // Builders
  function buildLayoutJSON() {
    const components = {};
    const orderBase = 1;
    const sorted = [...model.blocks].sort((a, b) => (a.row - b.row) || (a.col - b.col));
    sorted.forEach((b, i) => {
      const start = b.col;
      const end = b.col + b.span;
      components[b.type] = {
        visible: true,
        order: orderBase + i,
        position: {
          gridRow: String(b.row),
          gridColumn: `${start} / ${end}`
        },
        size: { minHeight: `${model.cellH}px` }
      };
    });

    const json = {
      layouts: {
        default: {
          type: 'grid',
          grid: {
            columns: model.columns,
            rows: model.rows,
            gap: `${model.gap}px`
          },
          components
        }
      }
    };
    return json;
  }

  // Helpers
  function setStatus(msg, type) {
    el.status.textContent = msg;
    el.status.classList.remove('ok', 'err');
    if (type === 'ok') el.status.classList.add('ok');
    if (type === 'err') el.status.classList.add('err');
  }

  function switchTab(tab) {
    el.tabs.forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === tab);
      t.setAttribute('aria-selected', String(t.dataset.tab === tab));
    });
    $$('.lb-tab-panel').forEach((p) => p.classList.remove('active'));
    if (tab === 'preview') el.panels.preview.classList.add('active');
    if (tab === 'json') el.panels.json.classList.add('active');
    if (tab === 'code') el.panels.code.classList.add('active');
  }

  function labelForType(type) {
    const map = {
      timer: '⏱️ Timer',
      gameState: '🎮 Game State',
      hints: '💡 Hints',
      navigation: '🧭 Navigation',
      chat: '💬 Chat',
      media: '🖼️ Media'
    };
    return map[type] || type;
  }

  function clamp(n, min, max) {
    n = Number.isFinite(n) ? n : min;
    return Math.max(min, Math.min(max, n));
  }

  function toInt(val, fallback) {
    const n = parseInt(val, 10);
    return Number.isFinite(n) ? n : fallback;
  }

  function parseGridCol(v) {
    if (!v || typeof v !== 'string') return [1, 2];
    const parts = v.split('/').map((s) => parseInt(String(s).trim(), 10));
    if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      return [parts[0], parts[1]];
    }
    const start = Number.isFinite(parts[0]) ? parts[0] : 1;
    return [start, start + 1];
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy') ? resolve() : reject(new Error('execCommand failed'));
      } catch (e) {
        reject(e);
      } finally {
        document.body.removeChild(ta);
      }
    });
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();