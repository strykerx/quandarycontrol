const socket = io();
// Local storage media handler
let roomId = null;

// Get room ID from URL
const pathSegments = window.location.pathname.split('/').filter(segment => segment);
console.log('Path segments:', pathSegments);
if (pathSegments.length >= 2 && pathSegments[0] === 'room') {
  roomId = pathSegments[1];
  console.log('Room ID extracted:', roomId);
} else if (pathSegments.length >= 2) {
  roomId = pathSegments[1];
  console.log('Room ID extracted (fallback):', roomId);
}

// Socket.IO Handlers
socket.on('connect', () => {
  console.log('Connected to server as GM');
  if (roomId) {
    socket.emit('join_room', { roomId, clientType: 'gm' });
    const infoEl = document.getElementById('room-info');
    if (infoEl) infoEl.innerHTML = `Controlling Room: <strong>${roomId}</strong>`;
    fetchHintConfigAndToggle();
    initializeMediaUpload();
  }
});

function initializeMediaUpload() {
  // 1) If markup already exists in gm.html, just wire up handlers
  const uploadEl = document.getElementById('media-upload');
  const triggerEl = document.getElementById('trigger-upload');
  const confirmEl = document.getElementById('confirm-upload');
  const showEl = document.getElementById('show-lightbox');

  if (uploadEl && triggerEl && confirmEl && showEl) {
    triggerEl.addEventListener('click', () => uploadEl.click());
    uploadEl.addEventListener('change', handleFileSelect);
    confirmEl.addEventListener('click', handleFileUpload);
    showEl.addEventListener('click', showLightboxOnPlayer);
    loadRoomMedia();
    return;
  }

  // 2) Fallback: inject section if not present
  const main = document.querySelector('main') || document.body;
  const mediaSection = document.createElement('section');
  mediaSection.className = 'media-manager gm-control-section';
  mediaSection.innerHTML = `
    <h2 class="section-heading">🖼️ Media / Lightbox</h2>
    <div class="upload-container">
      <input type="file" id="media-upload" accept="image/*,video/*" multiple style="display:none;">
      <button class="nav-button" id="trigger-upload">Choose Files</button>
      <button class="nav-button secondary" id="confirm-upload">Upload Selected</button>
    </div>
    <div id="file-list" class="file-list"></div>
    <div id="upload-status" class="state-card" style="margin-top:.5rem;"></div>
    <div class="media-display-section state-card" style="margin-top:1rem;">
      <h3>Uploaded Media</h3>
      <div id="media-gallery" class="media-gallery"></div>
      <div class="media-controls" style="margin-top:1rem; display:flex; gap:.75rem;">
        <input type="text" id="lightbox-headline" class="form-input" placeholder="Enter headline text..." style="flex:1;">
        <button class="nav-button" id="show-lightbox">Show on Player Screen</button>
      </div>
    </div>
  `;
  main.appendChild(mediaSection);

  // Wire up handlers for injected UI
  const upEl = document.getElementById('media-upload');
  const trgEl = document.getElementById('trigger-upload');
  const confEl = document.getElementById('confirm-upload');
  const shwEl = document.getElementById('show-lightbox');

  if (trgEl && upEl) trgEl.addEventListener('click', () => upEl.click());
  if (upEl) upEl.addEventListener('change', handleFileSelect);
  if (confEl) confEl.addEventListener('click', handleFileUpload);
  if (shwEl) shwEl.addEventListener('click', showLightboxOnPlayer);

  loadRoomMedia();
}

function handleFileSelect(e) {
  const files = e.target.files;
  const fileList = document.getElementById('file-list');
  fileList.innerHTML = '';
  
  Array.from(files).forEach(file => {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.innerHTML = `
      <span>${file.name}</span>
      <span class="file-size">(${(file.size/1024/1024).toFixed(2)}MB)</span>
      <span class="file-type">${file.type.split('/')[0]}</span>
    `;
    fileList.appendChild(fileItem);
  });
}

async function handleFileUpload() {
  const files = document.getElementById('media-upload').files;
  const statusEl = document.getElementById('upload-status');
  if (!files.length) {
    statusEl.textContent = 'No files selected';
    return;
  }

  statusEl.textContent = 'Uploading...';
  const uploadPromises = Array.from(files).map(file =>
    uploadMedia(file).catch(error => ({ error }))
  );

  try {
    const results = await Promise.all(uploadPromises);
    const successfulUploads = results.filter(r => !r.error);
    const failedUploads = results.filter(r => r.error);

    if (successfulUploads.length) {
      socket.emit('new_media_available', { roomId });
      statusEl.textContent = `Successfully uploaded ${successfulUploads.length} files`;
    }
    
    if (failedUploads.length) {
      statusEl.textContent += ` | Failed to upload ${failedUploads.length} files`;
    }

    document.getElementById('media-upload').value = '';
    document.getElementById('file-list').innerHTML = '';
    
  } catch (error) {
    statusEl.textContent = 'Upload failed: ' + error.message;
    console.error('Batch upload error:', error);
  }
}

async function uploadMedia(file) {
  const formData = new FormData();
  formData.append('media', file);
  
  const response = await fetch(`/api/rooms/${roomId}/media`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error('Failed to upload media');
  }
  return response.json();
}

async function loadRoomMedia() {
  try {
    const response = await fetch(`/api/rooms/${roomId}/media`);
    const data = await response.json();
    
    if (data.success && data.data) {
      displayMediaGallery(data.data);
    }
  } catch (error) {
    console.error('Failed to load media:', error);
  }
}

function displayMediaGallery(mediaItems) {
  const gallery = document.getElementById('media-gallery');
  if (!gallery) return;
  
  gallery.innerHTML = '';
  
  mediaItems.forEach(item => {
    const mediaElement = document.createElement('div');
    mediaElement.className = 'media-item';
    mediaElement.dataset.mediaId = item.id;
    
    if (item.type === 'image') {
      mediaElement.innerHTML = `
        <img src="${item.url}" alt="${item.title}" class="media-thumbnail">
        <div class="media-info">
          <span class="media-title">${item.title || 'Untitled'}</span>
          <button class="btn-select-media" data-media-id="${item.id}">Select</button>
        </div>
      `;
    } else if (item.type === 'video') {
      mediaElement.innerHTML = `
        <video src="${item.url}" class="media-thumbnail" muted></video>
        <div class="media-info">
          <span class="media-title">${item.title || 'Untitled'}</span>
          <button class="btn-select-media" data-media-id="${item.id}">Select</button>
        </div>
      `;
    }
    
    gallery.appendChild(mediaElement);
  });
  
  // Add event listeners for media selection
  document.querySelectorAll('.btn-select-media').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const mediaId = e.target.dataset.mediaId;
      selectMediaForLightbox(mediaId);
    });
  });
}

let selectedMediaId = null;

function selectMediaForLightbox(mediaId) {
  // Toggle off if clicking the already selected item
  if (selectedMediaId === mediaId) {
    selectedMediaId = null;
    document.querySelectorAll('.media-item').forEach(item => item.classList.remove('selected'));
    return;
  }

  // Select new item
  selectedMediaId = mediaId;

  // Update UI to show selection
  document.querySelectorAll('.media-item').forEach(item => {
    item.classList.remove('selected');
  });

  const selectedItem = document.querySelector(`[data-media-id="${mediaId}"]`);
  if (selectedItem) {
    selectedItem.classList.add('selected');
  }
}

function showLightboxOnPlayer() {
  const headline = document.getElementById('lightbox-headline')?.value || '';

  // New autoclose controls
  const autoToggle = document.getElementById('autoclose-toggle');
  const secondsSel = document.getElementById('autoclose-seconds');
  const autoCloseEnabled = autoToggle ? autoToggle.checked : true;
  const autoCloseSeconds = secondsSel ? parseInt(secondsSel.value, 10) : 5;

  // Allow text-only lightbox if no media selected
  const payload = {
    roomId,
    mediaId: selectedMediaId || null,
    headline,
    autoCloseEnabled,
    autoCloseSeconds
  };

  socket.emit('show_lightbox', payload);
}

// Timer Controls
document.getElementById('start-timer').addEventListener('click', () => {
  console.log('Start timer clicked, roomId:', roomId);
  socket.emit('timer_control', {
    roomId,
    action: 'start'
  });
});

document.getElementById('pause-timer').addEventListener('click', () => {
  console.log('Pause timer clicked, roomId:', roomId);
  socket.emit('timer_control', {
    roomId,
    action: 'pause'
  });
});

document.getElementById('stop-timer').addEventListener('click', () => {
  console.log('Stop timer clicked, roomId:', roomId);
  socket.emit('timer_control', {
    roomId,
    action: 'stop'
  });
  // Also clear chat and hints when stopping timer
  socket.emit('clear_chat', { roomId });
  socket.emit('clear_hints', { roomId });
});

document.getElementById('add-time').addEventListener('click', () => {
  console.log('Add time clicked, roomId:', roomId);
  socket.emit('timer_control', {
    roomId,
    action: 'adjust',
    amount: 30
  });
});

document.getElementById('subtract-time').addEventListener('click', () => {
  console.log('Subtract time clicked, roomId:', roomId);
  socket.emit('timer_control', {
    roomId,
    action: 'adjust',
    amount: -30
  });
});

// Clear chat button
document.getElementById('clear-chat').addEventListener('click', () => {
  console.log('Clear chat clicked, roomId:', roomId);
  socket.emit('clear_chat', { roomId });
});

// Clear hints button
document.getElementById('clear-hints').addEventListener('click', () => {
  console.log('Clear hints clicked, roomId:', roomId);
  socket.emit('clear_hints', { roomId });
});

// Hint System - Broadcast
const sendHintBtn = document.getElementById('send-hint');
if (sendHintBtn) {
  sendHintBtn.addEventListener('click', () => {
    const hintInput = document.getElementById('hint-input');
    const hint = hintInput ? hintInput.value : '';
    if (hint) {
      socket.emit('sendHint', { roomId, message: hint });
      hintInput.value = '';
    }
  });
}

// Chat System (GM ↔ Player)
const sendChatBtn = document.getElementById('send-chat');
if (sendChatBtn) {
  sendChatBtn.addEventListener('click', () => {
    const input = document.getElementById('chat-input');
    const message = input ? input.value.trim() : '';
    if (!message) return;
    socket.emit('chat_message', { roomId, sender: 'gm', message });
    input.value = '';
  });
}

socket.on('chat_message', (payload) => {
  const log = document.getElementById('chat-log');
  if (!log) return;
  const row = document.createElement('div');
  row.className = 'chat-row';
  const who = payload.sender === 'gm' ? 'GM' : 'Player';
  row.textContent = `[${new Date(payload.timestamp || Date.now()).toLocaleTimeString()}] ${who}: ${payload.message}`;
  log.appendChild(row);
  log.parentElement.scrollTop = log.parentElement.scrollHeight;
});

// Clear chat handler
socket.on('clear_chat', () => {
  console.log('Clearing chat on GM side');
  const log = document.getElementById('chat-log');
  if (log) {
    log.innerHTML = '';
    // Add system message
    const row = document.createElement('div');
    row.className = 'chat-row';
    row.textContent = `[${new Date().toLocaleTimeString()}] System: Chat cleared by GM`;
    row.style.fontStyle = 'italic';
    row.style.color = '#888';
    log.appendChild(row);
  }
});

// Clear hints handler
socket.on('clear_hints', () => {
  console.log('Clearing hints on GM side');
  const hintHistory = document.querySelector('#hint-history .state-content');
  if (hintHistory) {
    hintHistory.innerHTML = '';
    // Add system message
    const hintItem = document.createElement('div');
    hintItem.className = 'hint-entry';
    hintItem.innerHTML = `<strong>${new Date().toLocaleTimeString()}:</strong> <em>Hints cleared by GM</em>`;
    hintItem.style.fontStyle = 'italic';
    hintItem.style.color = '#888';
    hintHistory.appendChild(hintItem);
  }
});

// Variable Management
socket.on('variableUpdate', (data) => {
  const container = document.getElementById('variable-display');
  container.innerHTML = '';
  
  Object.entries(data.variables).forEach(([name, value]) => {
    const control = document.createElement('div');
    control.className = 'variable-control';
    control.innerHTML = `
      <label>${name}:</label>
      ${getInputForType(name, value)}
      <button class="btn-update" data-variable="${name}">Update</button>
    `;
    container.appendChild(control);
  });

  // Add update listeners
  document.querySelectorAll('.btn-update').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const varName = e.target.dataset.variable;
      const input = e.target.previousElementSibling;
      socket.emit('updateVariable', { 
        roomId,
        variable: varName,
        value: parseValue(input.value, input.type)
      });
    });
  });
});

function getInputForType(name, value) {
  const type = typeof value;
  switch(type) {
    case 'boolean':
      return `<input type="checkbox" ${value ? 'checked' : ''}>`;
    case 'number':
      return `<input type="number" value="${value}">`;
    default:
      return `<input type="text" value="${value}">`;
  }
}

function parseValue(val, type) {
  switch(type) {
    case 'checkbox': return Boolean(val);
    case 'number': return Number(val);
    default: return val;
  }
}

// Timer display updates
socket.on('timer_update', (data) => {
  document.getElementById('timer-display').textContent =
    `${Math.floor(data.remaining/60).toString().padStart(2,'0')}:${(data.remaining%60).toString().padStart(2,'0')}`;
});

// Hint confirmation
socket.on('hintConfirmed', (hint) => {
  const history = document.getElementById('hint-history');
  if (!history) return;
  const entry = document.createElement('div');
  entry.className = 'hint-entry';
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${hint}`;
  history.appendChild(entry);
});

// Fetch hint config and toggle GM UI
async function fetchHintConfigAndToggle() {
  try {
    if (!roomId) return;
    const res = await fetch(`/api/rooms/${roomId}/hints`);
    const data = await res.json();
    const type = (data && data.success && data.data && data.data.type) ? data.data.type : 'broadcast';
    const broadcastSection = document.getElementById('broadcast-section');
    const chatSection = document.getElementById('chat-section');
    if (broadcastSection) broadcastSection.style.display = (type === 'broadcast') ? '' : 'none';
    if (chatSection) chatSection.style.display = (type === 'chat') ? '' : 'none';
  } catch (e) {
    // Default to broadcast on error
    const broadcastSection = document.getElementById('broadcast-section');
    const chatSection = document.getElementById('chat-section');
    if (broadcastSection) broadcastSection.style.display = '';
    if (chatSection) chatSection.style.display = 'none';
  }
}

// Rules Editor functionality
document.getElementById('edit-rules-button').addEventListener('click', () => {
  if (roomId) {
    window.open(`/room/${roomId}/rules-editor`, 'rules-editor', 'width=1200,height=800,scrollbars=yes');
  } else {
    alert('No room ID found. Please make sure you are in a valid room.');
  }
});