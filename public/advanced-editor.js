/**
 * Advanced Editor (Phase 7 - minimal functional baseline)
 * - Textarea-based HTML/CSS editor
 * - Debounced iframe preview
 * - Save/Validate/Apply/Export actions integrated with template API and sockets
 * - LocalStorage persistence
 */

(function () {
  'use strict';

  const LS_KEY = 'quandary-advanced-editor-state';
  const DEFAULT_HTML = [
    '<div class="qc-root">',
    '  <h1>Quandary Custom View</h1>',
    '  <p>Edit me in the left panel.</p>',
    '</div>'
  ].join('\n');

  const DEFAULT_CSS = [
    '/* Uses player theme variables where possible */',
    '.qc-root {',
    '  color: var(--text-light, #fff);',
    '  padding: 1rem;',
    '}'
  ].join('\n');

  let htmlEl;
  let cssEl;
  let iframeEl;
  let statusEl;
  let btnSave;
  let btnValidate;
  let btnApply;
  let btnExport;
  let btnClear;
  let socket;

  let state = {
    html: DEFAULT_HTML,
    css: DEFAULT_CSS,
    templateId: null,
    roomId: null,
    lastValidated: null
  };

  const debounce = (fn, delay = 300) => {
    let t = null;
    return (...args) => {
      if (t) clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  };

  function init() {
    htmlEl = document.getElementById('editor-html');
    cssEl = document.getElementById('editor-css');
    iframeEl = document.getElementById('editor-preview-iframe');
    statusEl = document.getElementById('lb-status');

    btnSave = document.getElementById('editor-btn-save');
    btnValidate = document.getElementById('editor-btn-validate');
    btnApply = document.getElementById('editor-btn-apply');
    btnExport = document.getElementById('editor-btn-export');
    btnClear = document.getElementById('editor-btn-clear');

    // If editor panel not present (other pages), bail
    if (!htmlEl || !cssEl || !iframeEl) return;

    // Room id
    state.roomId = resolveRoomId();

    // Restore persisted state
    loadFromLocalStorage();

    // Initialize fields
    htmlEl.value = state.html || DEFAULT_HTML;
    cssEl.value = state.css || DEFAULT_CSS;

    // Bind events
    htmlEl.addEventListener('input', handleEditorInput);
    cssEl.addEventListener('input', handleEditorInput);

    const refresh = debounce(updatePreview, 250);
    htmlEl.addEventListener('input', refresh);
    cssEl.addEventListener('input', refresh);

    if (btnSave) btnSave.addEventListener('click', handleSaveTemplate);
    if (btnValidate) btnValidate.addEventListener('click', handleValidateTemplate);
    if (btnApply) btnApply.addEventListener('click', handleApplyToRoom);
    if (btnExport) btnExport.addEventListener('click', handleExportTemplate);
    if (btnClear) btnClear.addEventListener('click', handleClearEditors);

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 's') {
        e.preventDefault();
        handleSaveTemplate();
      } else if (mod && e.key === 'Enter') {
        e.preventDefault();
        handleValidateTemplate();
      } else if (mod && e.shiftKey && (e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        handleApplyToRoom();
      }
    });

    // Ensure socket exists
    socket = window.io ? window.io() : (window.socket || null);

    // Initial preview
    updatePreview();
  }

  function handleEditorInput() {
    state.html = htmlEl.value;
    state.css = cssEl.value;
    persistToLocalStorage();
  }

  function updatePreview() {
    if (!iframeEl) return;
    const doc = iframeEl.contentDocument || iframeEl.contentWindow?.document;
    if (!doc) return;

    const safeCSS = state.css || '';
    const bodyHTML = state.html || '';

    const full = [
      '<!doctype html>',
      '<html>',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      `<style>${safeCSS}</style>`,
      '</head>',
      '<body>',
      bodyHTML,
      '</body>',
      '</html>'
    ].join('');

    doc.open();
    doc.write(full);
    doc.close();
  }

  function resolveRoomId() {
    // Prefer layout builder's internal state if available
    const lbId = window.layoutBuilder?.currentRoomId;
    if (lbId) return lbId;

    // Fallback to query param
    const url = new URL(window.location.href);
    const qp = url.searchParams.get('roomId');
    if (qp) return qp;

    // Attempt from path /room/:roomId/layout-builder or alike
    const segs = window.location.pathname.split('/').filter(Boolean);
    const roomIdx = segs.indexOf('room');
    if (roomIdx >= 0 && segs[roomIdx + 1]) return segs[roomIdx + 1];

    return null;
  }

  function buildTemplatePayload() {
    // Minimal schema-compliant structure with a single media component carrying customData.html/css
    const now = new Date().toISOString();
    const payload = {
      id: undefined, // allow server to generate if not provided
      name: 'Custom Editor Template',
      description: 'Template created from Advanced Editor panel',
      version: '1.0.0',
      author: 'editor',
      tags: ['custom', 'editor'],
      thumbnail: undefined,
      layout: {
        columns: 12,
        rows: 6,
        gap: 10,
        components: [
          {
            id: 'comp_html',
            type: 'media',
            col: 1,
            row: 2,
            width: 12,
            config: {
              customData: {
                html: state.html || DEFAULT_HTML,
                css: state.css || DEFAULT_CSS
              }
            }
          }
        ]
      },
      customization: {
        theme: {
          colors: {},
          fonts: {},
          spacing: {}
        },
        background: {}
      },
      metadata: {
        created: now,
        modified: now,
        category: 'custom',
        complexity: 'simple',
        responsive: true,
        accessibility: {
          keyboardNavigation: true,
          screenReader: true,
          highContrast: false
        }
      }
    };

    // Remove undefined optional fields to avoid format checks
    if (!payload.thumbnail) delete payload.thumbnail;
    if (!payload.id) delete payload.id;

    return payload;
  }

  async function handleSaveTemplate() {
    try {
      const payload = buildTemplatePayload();
      showStatus('Saving template...', 'info');

      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (!json.success) {
        showStatus(`Save failed: ${json.error || 'Unknown error'}`, 'err');
        return;
      }

      state.templateId = json.data?.id || null;
      persistToLocalStorage();
      showStatus(`Template saved (id: ${state.templateId || 'generated'})`, 'ok');
    } catch (e) {
      console.error(e);
      showStatus('Save failed (network error)', 'err');
    }
  }

  async function handleValidateTemplate() {
    try {
      const payload = buildTemplatePayload();
      showStatus('Validating template...', 'info');

      const res = await fetch('/api/templates/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (!json.success) {
        showStatus(`Validation failed: ${json.error || 'Unknown error'}`, 'err');
        return;
      }

      const result = json.data;
      state.lastValidated = result;
      persistToLocalStorage();

      if (result.valid) {
        showStatus('✓ Template is valid', 'ok');
      } else {
        const errs = (result.errors || []).map((e) => e.instancePath || e.schemaPath || e.message).slice(0, 3);
        showStatus(`Validation errors: ${errs.join(', ')}`, 'err');
      }
    } catch (e) {
      console.error(e);
      showStatus('Validation failed (network error)', 'err');
    }
  }

  async function handleApplyToRoom() {
    try {
      const rid = state.roomId;
      if (!rid) {
        showStatus('No room selected. Provide ?roomId=... in URL.', 'err');
        return;
      }

      const payload = buildTemplatePayload();
      const layout = payload.layout;

      // Prefer to broadcast a layout update; consumers can map customData
      const ioSocket = window.socket || socket || (window.io ? window.io() : null);
      if (!ioSocket) {
        showStatus('Socket unavailable; cannot apply to room', 'err');
        return;
      }

      ioSocket.emit('apply_layout', { roomId: rid, layout });
      showStatus('Applied layout to room', 'ok');
    } catch (e) {
      console.error(e);
      showStatus('Apply failed', 'err');
    }
  }

  function handleExportTemplate() {
    try {
      const payload = buildTemplatePayload();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fname = `template-editor-${new Date().toISOString().slice(0, 10)}.json`;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showStatus('Exported template JSON', 'ok');
    } catch (e) {
      console.error(e);
      showStatus('Export failed', 'err');
    }
  }

  function handleClearEditors() {
    htmlEl.value = DEFAULT_HTML;
    cssEl.value = DEFAULT_CSS;
    state.html = DEFAULT_HTML;
    state.css = DEFAULT_CSS;
    persistToLocalStorage();
    updatePreview();
    showStatus('Cleared editor to boilerplate', 'info');
  }

  function persistToLocalStorage() {
    try {
      const toSave = {
        html: state.html,
        css: state.css,
        templateId: state.templateId,
        roomId: state.roomId,
        lastValidated: state.lastValidated
      };
      localStorage.setItem(LS_KEY, JSON.stringify(toSave));
    } catch (_) {
      // ignore
    }
  }

  function loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      state.html = saved.html || DEFAULT_HTML;
      state.css = saved.css || DEFAULT_CSS;
      state.templateId = saved.templateId || null;
      state.roomId = saved.roomId || state.roomId || null;
      state.lastValidated = saved.lastValidated || null;
    } catch (_) {
      // ignore
    }
  }

  function showStatus(message, type) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = 'lb-status';
    if (type === 'ok') statusEl.classList.add('ok');
    if (type === 'err') statusEl.classList.add('err');
    // Auto clear after a bit (non-error)
    if (type !== 'err') {
      setTimeout(() => {
        if (statusEl.textContent === message) {
          statusEl.textContent = '';
          statusEl.className = 'lb-status';
        }
      }, 3000);
    }
  }

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', init);
})();