/* Barebones Player that directly renders the active room layout (grid + boxes)
   - Fetches saved layout: GET /rooms/:roomId/layout
   - Subscribes to socket 'layout_updated' to live-apply changes
   - Renders simple boxes per component (timer, hints, gameState, chat, media, navigation)
*/

(function () {
  'use strict';

  const socket = io();
  const gridEl = document.getElementById('layout-grid');
  const roomLabelEl = document.getElementById('room-label');

  // Track latest timer value so we can render into timer box and refit
  let latestTimerRemaining = null;

  let roomId = null;

  // Parse roomId from URL: /room/:roomId/player-bare
  (function resolveRoomId() {
    const parts = (window.location.pathname || '').split('/').filter(Boolean);
    // [ 'room', ':roomId', 'player-bare' ]
    if (parts.length >= 3 && parts[0] === 'room' && parts[2] === 'player-bare') {
      roomId = parts[1];
    }
  })();

  if (roomLabelEl && roomId) {
    roomLabelEl.textContent = `Room: ${roomId}`;
  }

  // Socket listeners
  socket.on('connect', () => {
    if (roomId) socket.emit('join_room', { roomId, clientType: 'player' });
  });

  // Live timer updates: render mm:ss into any timer box and fit
  socket.on('timer_update', ({ remaining }) => {
    latestTimerRemaining = typeof remaining === 'number' ? remaining : latestTimerRemaining;
    const timerEls = gridEl?.querySelectorAll('.layout-box.timer .box-content');
    if (timerEls && timerEls.length) {
      const text = formatTime(latestTimerRemaining ?? 0);
      timerEls.forEach(el => {
        el.textContent = text;
        fitTextToBox(el);
      });
    }
  });

  socket.on('layout_updated', (payload) => {
    if (!payload || !payload.layout) return;
    renderLayout(payload.layout);
  });

  // Optional live previews (from builder)
  socket.on('builder_preview', ({ layout }) => {
    if (layout) renderLayout(layout);
  });
  socket.on('layout_preview', ({ layout }) => {
    if (layout) renderLayout(layout);
  });

  // Initial load
  if (roomId) {
    loadLayout(roomId)
      .then((layout) => {
        if (layout) renderLayout(layout);
      })
      .catch((e) => console.error('Failed to load layout:', e));
  }

  // Fetch active layout
  async function loadLayout(id) {
    const res = await fetch(`/rooms/${id}/layout`);
    const json = await res.json();
    if (json && json.success && json.data) return json.data;
    return null;
  }

  // Render a layout object that follows:
  // { layouts: { default: { type: 'grid', grid:{columns,rows,gap}, components:{ key:{ visible, position:{gridRow, gridColumn}, props } } } } }
  function renderLayout(layout) {
    const def = layout && layout.layouts && layout.layouts.default;
    if (!def || !gridEl) return;

    // Configure grid
    const gridCfg = def.grid || {};
    const cols = Number(gridCfg.columns) || 12;
    const rows = Number(gridCfg.rows) || 8;
    const gap = gridCfg.gap || '10px';

    gridEl.style.display = 'grid';
    gridEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    gridEl.style.gridTemplateRows = `repeat(${rows}, 80px)`;
    gridEl.style.gap = gap;

    // Clear
    while (gridEl.firstChild) gridEl.removeChild(gridEl.firstChild);

    // Render components as simple boxes
    const comps = def.components || {};
    const entries = Object.entries(comps)
      .filter(([, c]) => c && c.visible !== false)
      .sort((a, b) => {
        const ao = a[1]?.order ?? 9999;
        const bo = b[1]?.order ?? 9999;
        return ao - bo;
      });

    for (const [key, comp] of entries) {
      const type = (key || '').split('_')[0] || 'unknown';
      const pos = comp.position || {};
      const props = comp.props || {};

      const box = document.createElement('div');
      box.className = `layout-box ${type}`;
      if (pos.gridColumn) box.style.gridColumn = pos.gridColumn;
      if (pos.gridRow) box.style.gridRow = pos.gridRow;

      const content = document.createElement('div');
      content.className = 'box-content fit-text ' + type;
      // If this is a timer, prefer the live timer value when available
      if (type === 'timer' && typeof latestTimerRemaining === 'number') {
        content.textContent = formatTime(latestTimerRemaining);
      } else {
        content.textContent = getLabelFor(type, props);
      }
      box.appendChild(content);

      gridEl.appendChild(box);
      // Fit each box immediately after adding
      fitTextToBox(content);
    }

    // Safety: refit everything once after all nodes exist
    refitAllBoxes();
  }

  function getLabelFor(type, props) {
    const fallback = props && typeof props.content === 'string' ? props.content : null;
    switch (type) {
      case 'timer': return fallback || '⏱️ Timer';
      case 'hints': return fallback || '💡 Hints';
      case 'gameState': return fallback || '🎮 Game State';
      case 'chat': return fallback || '💬 Chat';
      case 'media': return fallback || '🖼️ Media';
      case 'navigation': return fallback || '🧭 Navigation';
      default: return fallback || type;
    }
  }

  // Fit text utilities (binary search using parent box dimensions)
  function fitTextToBox(el, minPx = 8, maxPx = 800) {
    if (!el || !el.parentElement) return;
    const parent = el.parentElement;
    const targetW = Math.max(1, parent.clientWidth);
    const targetH = Math.max(1, parent.clientHeight);
    // reset transforms so we measure real size
    el.style.transform = '';
    el.style.whiteSpace = 'nowrap';

    let low = minPx;
    let high = maxPx;
    let best = minPx;

    while (low <= high) {
      const mid = (low + high) >> 1;
      el.style.fontSize = mid + 'px';
      // Force layout
      const w = el.scrollWidth;
      const h = el.scrollHeight;
      if (w <= targetW && h <= targetH) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    // pad down a touch for safety
    el.style.fontSize = Math.floor(best * 0.98) + 'px';
  }

  function refitAllBoxes() {
    if (!gridEl) return;
    const els = gridEl.querySelectorAll('.box-content.fit-text');
    els.forEach(el => fitTextToBox(el));
  }

  // Debounced resize/content-change handling
  let resizeTid = null;
  function scheduleRefit() {
    if (resizeTid) cancelAnimationFrame(resizeTid);
    resizeTid = requestAnimationFrame(refitAllBoxes);
  }
  window.addEventListener('resize', scheduleRefit);

  // Observe grid size/content changes
  if (window.ResizeObserver && gridEl) {
    const ro = new ResizeObserver(() => scheduleRefit());
    ro.observe(gridEl);
  }

  function formatTime(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds || 0));
    const mins = Math.floor(s / 60).toString().padStart(2, '0');
    const secs = (s % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }
})();