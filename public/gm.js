const socket = io();
// Local storage media handler
let roomId = null;
let roomName = 'Game Master'; // Store room name for browser title

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
    loadGameVariables();

    // Initialize GM notification manager (for settings UI)
    if (window.gmNotificationManager) {
      window.gmNotificationManager.initialize(roomId);
    }

    // Initialize notification manager (for audio playback)
    if (window.notificationManager) {
      window.notificationManager.initialize(roomId).then(() => {
        console.log('[GM] Notification manager initialized for audio playback');
      }).catch(err => {
        console.error('[GM] Failed to initialize notification manager:', err);
      });
    }
  }
});

// Helper function to update browser tab title with room name and timer
function updateBrowserTitle(timeInSeconds = null) {
  if (timeInSeconds !== null) {
    const minutes = Math.floor(timeInSeconds / 60).toString().padStart(2, '0');
    const seconds = (timeInSeconds % 60).toString().padStart(2, '0');
    document.title = `${roomName} - ${minutes}:${seconds}`;
  } else {
    document.title = `${roomName} - Game Master`;
  }
}

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

    // Extract filename from URL
    const filename = item.url.split('/').pop();
    const displayName = item.title || filename;

    if (item.type === 'image') {
      mediaElement.innerHTML = `
        <img src="${item.url}" alt="${displayName}" class="media-thumbnail">
        <div class="media-info">
          <div class="media-filename" style="font-size: 0.8em; color: #888; margin-bottom: 0.25rem;" title="${filename}">${filename}</div>
          <input type="text" class="media-title-input form-input" value="${displayName}"
                 data-media-id="${item.id}"
                 style="width: 100%; margin-bottom: 0.5rem; padding: 0.25rem 0.5rem; font-size: 0.9em;">
          <div class="media-buttons">
            <button class="btn-update-media nav-button secondary" data-media-id="${item.id}" style="min-width: 60px;">Update</button>
            <button class="btn-select-media nav-button secondary" data-media-id="${item.id}">Select</button>
            <button class="btn-delete-media nav-button secondary" data-media-id="${item.id}" style="background-color: #dc3545; min-width: 35px; padding: 0.5rem;">🗑️</button>
          </div>
        </div>
      `;
    } else if (item.type === 'video') {
      mediaElement.innerHTML = `
        <video src="${item.url}" class="media-thumbnail" muted></video>
        <div class="media-info">
          <div class="media-filename" style="font-size: 0.8em; color: #888; margin-bottom: 0.25rem;" title="${filename}">${filename}</div>
          <input type="text" class="media-title-input form-input" value="${displayName}"
                 data-media-id="${item.id}"
                 style="width: 100%; margin-bottom: 0.5rem; padding: 0.25rem 0.5rem; font-size: 0.9em;">
          <div class="media-buttons">
            <button class="btn-update-media nav-button secondary" data-media-id="${item.id}" style="min-width: 60px;">Update</button>
            <button class="btn-select-media nav-button secondary" data-media-id="${item.id}">Select</button>
            <button class="btn-delete-media nav-button secondary" data-media-id="${item.id}" style="background-color: #dc3545; min-width: 35px; padding: 0.5rem;">🗑️</button>
          </div>
        </div>
      `;
    }

    gallery.appendChild(mediaElement);
  });

  // Add event listeners for media update
  document.querySelectorAll('.btn-update-media').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const mediaId = e.target.dataset.mediaId;
      const input = document.querySelector(`.media-title-input[data-media-id="${mediaId}"]`);
      if (input) {
        updateMediaTitle(mediaId, input.value);
      }
    });
  });

  // Add event listeners for media selection and deletion
  document.querySelectorAll('.btn-select-media').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const mediaId = e.target.dataset.mediaId;
      selectMediaForLightbox(mediaId);
    });
  });

  document.querySelectorAll('.btn-delete-media').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const mediaId = e.target.dataset.mediaId;
      deleteMediaFile(mediaId);
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

async function updateMediaTitle(mediaId, newTitle) {
  try {
    const response = await fetch(`/api/media/${mediaId}/title`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: newTitle })
    });

    const result = await response.json();
    if (result.success) {
      // Show success message
      const statusEl = document.getElementById('upload-status');
      if (statusEl) {
        statusEl.textContent = 'Media title updated successfully';
        setTimeout(() => {
          statusEl.textContent = '';
        }, 3000);
      }
    } else {
      alert(`Failed to update media title: ${result.error}`);
      // Reload gallery to restore original title
      loadRoomMedia();
    }
  } catch (error) {
    console.error('Error updating media title:', error);
    alert('Failed to update media title');
    // Reload gallery to restore original title
    loadRoomMedia();
  }
}

async function deleteMediaFile(mediaId) {
  if (!confirm('Are you sure you want to delete this media file?')) {
    return;
  }

  try {
    const response = await fetch(`/api/media/${mediaId}`, {
      method: 'DELETE'
    });

    const result = await response.json();
    if (result.success) {
      // Clear selection if the deleted media was selected
      if (selectedMediaId === mediaId) {
        selectedMediaId = null;
      }

      // Reload media gallery
      loadRoomMedia();

      // Show success message
      const statusEl = document.getElementById('upload-status');
      if (statusEl) {
        statusEl.textContent = 'Media file deleted successfully';
        setTimeout(() => {
          statusEl.textContent = '';
        }, 3000);
      }
    } else {
      alert(`Failed to delete media: ${result.error}`);
    }
  } catch (error) {
    console.error('Error deleting media:', error);
    alert('Failed to delete media file');
  }
}

async function resetTimerToOriginal() {
  try {
    // Fetch room data to get original timer duration
    const response = await fetch(`/api/rooms/${roomId}`);
    const data = await response.json();

    if (data.success && data.data && data.data.timer_duration !== undefined) {
      const originalDuration = data.data.timer_duration;

      if (originalDuration > 0) {
        // Reset timer to original duration
        socket.emit('timer_control', {
          roomId,
          action: 'reset',
          amount: originalDuration
        });

        // Show success message
        const statusEl = document.getElementById('upload-status');
        if (statusEl) {
          statusEl.textContent = `Timer reset to original duration: ${Math.floor(originalDuration/60)}:${(originalDuration%60).toString().padStart(2,'0')}`;
          setTimeout(() => {
            statusEl.textContent = '';
          }, 3000);
        }
      } else {
        alert('No original timer duration set for this room');
      }
    } else {
      alert('Failed to fetch room data');
    }
  } catch (error) {
    console.error('Error resetting timer:', error);
    alert('Failed to reset timer');
  }
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

document.getElementById('reset-timer').addEventListener('click', () => {
  console.log('Reset timer clicked, roomId:', roomId);
  resetTimerToOriginal();
});

document.getElementById('add-time').addEventListener('click', () => {
  console.log('Add time clicked, roomId:', roomId);
  socket.emit('timer_control', {
    roomId,
    action: 'adjust',
    amount: 60
  });
});

document.getElementById('subtract-time').addEventListener('click', () => {
  console.log('Subtract time clicked, roomId:', roomId);
  socket.emit('timer_control', {
    roomId,
    action: 'adjust',
    amount: -60
  });
});

// Secondary Timer Controls
document.getElementById('start-secondary-timer').addEventListener('click', () => {
  console.log('Start secondary timer clicked, roomId:', roomId);
  socket.emit('secondary_timer_control', {
    roomId,
    action: 'start'
  });
});

document.getElementById('pause-secondary-timer').addEventListener('click', () => {
  console.log('Pause secondary timer clicked, roomId:', roomId);
  socket.emit('secondary_timer_control', {
    roomId,
    action: 'pause'
  });
});

document.getElementById('stop-secondary-timer').addEventListener('click', () => {
  console.log('Stop secondary timer clicked, roomId:', roomId);
  socket.emit('secondary_timer_control', {
    roomId,
    action: 'stop'
  });
});

document.getElementById('add-secondary-time').addEventListener('click', () => {
  console.log('Add secondary time clicked, roomId:', roomId);
  socket.emit('secondary_timer_control', {
    roomId,
    action: 'adjust',
    amount: 60
  });
});

document.getElementById('subtract-secondary-time').addEventListener('click', () => {
  console.log('Subtract secondary time clicked, roomId:', roomId);
  socket.emit('secondary_timer_control', {
    roomId,
    action: 'adjust',
    amount: -60
  });
});

// Dual Timer Controls
document.getElementById('start-both-timers').addEventListener('click', () => {
  console.log('Start both timers clicked, roomId:', roomId);
  // Start primary timer
  socket.emit('timer_control', {
    roomId,
    action: 'start'
  });
  // Start secondary timer
  socket.emit('secondary_timer_control', {
    roomId,
    action: 'start'
  });
});

document.getElementById('pause-both-timers').addEventListener('click', () => {
  console.log('Pause both timers clicked, roomId:', roomId);
  // Pause primary timer
  socket.emit('timer_control', {
    roomId,
    action: 'pause'
  });
  // Pause secondary timer
  socket.emit('secondary_timer_control', {
    roomId,
    action: 'pause'
  });
});

document.getElementById('stop-both-timers').addEventListener('click', () => {
  console.log('Stop both timers clicked, roomId:', roomId);
  // Stop primary timer
  socket.emit('timer_control', {
    roomId,
    action: 'stop'
  });
  // Stop secondary timer
  socket.emit('secondary_timer_control', {
    roomId,
    action: 'stop'
  });
  // Also clear chat and hints when stopping both timers
  socket.emit('clear_chat', { roomId });
  socket.emit('clear_hints', { roomId });
});

// Custom Timer Controls - Primary Timer
document.getElementById('add-custom-time').addEventListener('click', () => {
  const customMinutes = parseInt(document.getElementById('custom-time').value) || 0;
  if (customMinutes > 0) {
    console.log('Add custom time clicked:', customMinutes, 'minutes, roomId:', roomId);
    socket.emit('timer_control', {
      roomId,
      action: 'adjust',
      amount: customMinutes * 60
    });
  }
});

document.getElementById('subtract-custom-time').addEventListener('click', () => {
  const customMinutes = parseInt(document.getElementById('custom-time').value) || 0;
  if (customMinutes > 0) {
    console.log('Subtract custom time clicked:', customMinutes, 'minutes, roomId:', roomId);
    socket.emit('timer_control', {
      roomId,
      action: 'adjust',
      amount: -(customMinutes * 60)
    });
  }
});

// Custom Timer Controls - Secondary Timer
document.getElementById('add-custom-secondary-time').addEventListener('click', () => {
  const customMinutes = parseInt(document.getElementById('custom-secondary-time').value) || 0;
  if (customMinutes > 0) {
    console.log('Add custom secondary time clicked:', customMinutes, 'minutes, roomId:', roomId);
    socket.emit('secondary_timer_control', {
      roomId,
      action: 'adjust',
      amount: customMinutes * 60
    });
  }
});

document.getElementById('subtract-custom-secondary-time').addEventListener('click', () => {
  const customMinutes = parseInt(document.getElementById('custom-secondary-time').value) || 0;
  if (customMinutes > 0) {
    console.log('Subtract custom secondary time clicked:', customMinutes, 'minutes, roomId:', roomId);
    socket.emit('secondary_timer_control', {
      roomId,
      action: 'adjust',
      amount: -(customMinutes * 60)
    });
  }
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

  // Play notification sound when GM receives chat from player
  if (payload.sender === 'player' && window.notificationManager) {
    console.log('[GM] Received chat from player, playing notification');
    window.notificationManager.onGMChatReceived();
  }
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

// Timer variables that should be separated
const TIMER_VARIABLES = [
  'timer_duration', 'secondary_timer_enabled', 'secondary_timer_duration',
  'timer_state', 'timer_remaining', 'secondary_timer_state', 'secondary_timer_remaining',
  'timer_main', 'timer_secondary', 'timer_main_remaining', 'timer_secondary_remaining'
];

// Load game variables on page load
async function loadGameVariables() {
  try {
    const response = await fetch(`/api/rooms/${roomId}/variables`);
    const data = await response.json();

    console.log('Variables API response:', data); // Debug log

    if (data.success && data.data) {
      // Debug: log the raw data structure
      console.log('Raw variables data:', data.data);

      // Filter variables into user and timer categories
      const userVariables = data.data.filter(v => !TIMER_VARIABLES.includes(v.name));
      const timerVariables = data.data.filter(v => TIMER_VARIABLES.includes(v.name));

      console.log('User variables:', userVariables);
      console.log('Timer variables:', timerVariables);

      displayUserVariables(userVariables);
      displayTimerVariables(timerVariables);
      initializeCollapsibleSections();
    } else {
      console.warn('No variables found for room', roomId);
      displayEmptyVariables();
    }
  } catch (error) {
    console.error('Failed to load variables:', error);
    displayEmptyVariables();
  }
}

function displayEmptyVariables() {
  const userContainer = document.querySelector('#user-variables-display .state-content');
  const timerContainer = document.querySelector('#timer-variables-display .state-content');

  if (userContainer) {
    userContainer.innerHTML = '<div class="variable-empty-state">No game variables configured for this room</div>';
  }
  if (timerContainer) {
    timerContainer.innerHTML = '<div class="variable-empty-state">No timer variables found</div>';
  }
}

function displayUserVariables(variables) {
  const container = document.querySelector('#user-variables-display .state-content');
  if (!container) return;

  container.innerHTML = '';

  if (!variables || variables.length === 0) {
    container.innerHTML = '<div class="variable-empty-state">No game variables configured for this room</div>';
    return;
  }

  variables.forEach(variable => {
    container.appendChild(createVariableControl(variable));
  });
}

function displayTimerVariables(variables) {
  const container = document.querySelector('#timer-variables-display .state-content');
  if (!container) return;

  container.innerHTML = '';

  if (!variables || variables.length === 0) {
    container.innerHTML = '<div class="variable-empty-state">No timer variables found</div>';
    return;
  }

  variables.forEach(variable => {
    container.appendChild(createVariableControl(variable));
  });
}

function createVariableControl(variable) {
  const control = document.createElement('div');
  control.className = 'variable-control';

  const nameLabel = document.createElement('div');
  nameLabel.className = 'variable-name';
  nameLabel.textContent = variable.name;

  const inputContainer = document.createElement('div');
  inputContainer.className = 'variable-input-container';

  // Extract the actual value - handle both direct values and parsed_value structure
  const actualValue = variable.parsed_value !== undefined ? variable.parsed_value : variable.value;
  const valueType = typeof actualValue;

  const typeBadge = document.createElement('span');
  typeBadge.className = `variable-type-badge ${valueType}`;
  typeBadge.textContent = valueType;

  const input = createInputForVariable({ name: variable.name, value: actualValue });
  // Store the original type on the input element for use during updates
  input.dataset.originalType = valueType;

  const updateBtn = document.createElement('button');
  updateBtn.className = 'update-button';
  updateBtn.textContent = 'Update';
  updateBtn.dataset.variable = variable.name;

  inputContainer.appendChild(input);
  inputContainer.appendChild(typeBadge);
  inputContainer.appendChild(updateBtn);

  control.appendChild(nameLabel);
  control.appendChild(inputContainer);

  // Add update listener
  updateBtn.addEventListener('click', () => updateVariable(variable.name, input));

  return control;
}

function createInputForVariable(variable) {
  const type = typeof variable.value;

  switch(type) {
    case 'boolean':
      return createToggleSwitch(variable.value);
    case 'number':
      const numberInput = document.createElement('input');
      numberInput.type = 'number';
      numberInput.value = variable.value;
      numberInput.className = 'variable-input';
      return numberInput;
    default:
      const textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.value = variable.value;
      textInput.className = 'variable-input';
      return textInput;
  }
}

function createToggleSwitch(checked) {
  const switchContainer = document.createElement('label');
  switchContainer.className = 'toggle-switch';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;

  const slider = document.createElement('span');
  slider.className = 'toggle-slider';

  switchContainer.appendChild(input);
  switchContainer.appendChild(slider);

  return switchContainer;
}

function initializeCollapsibleSections() {
  const toggle = document.getElementById('timer-variables-toggle');
  const content = document.getElementById('timer-variables-display');
  const arrow = toggle.querySelector('.toggle-arrow');

  if (toggle && content && arrow) {
    toggle.addEventListener('click', () => {
      const isHidden = content.style.display === 'none';

      if (isHidden) {
        content.style.display = 'block';
        arrow.classList.remove('rotated');
      } else {
        content.style.display = 'none';
        arrow.classList.add('rotated');
      }
    });
  }
}

async function updateVariable(varName, inputElement) {
  try {
    let value;
    const originalType = inputElement.dataset.originalType;

    // Handle toggle switch (label containing checkbox)
    if (inputElement.classList.contains('toggle-switch')) {
      const checkbox = inputElement.querySelector('input[type="checkbox"]');
      value = checkbox.checked;
    }
    // Handle regular inputs
    else if (inputElement.type === 'checkbox') {
      value = inputElement.checked;
    } else {
      // Get the raw input value
      const rawValue = inputElement.value;

      // Convert based on original type
      if (originalType === 'number') {
        value = parseFloat(rawValue);
        if (isNaN(value)) {
          showVariableMessage(`Please enter a valid number for "${varName}"`, 'error');
          return;
        }
      } else if (originalType === 'boolean') {
        // Convert string representations to boolean
        if (rawValue.toLowerCase() === 'true') {
          value = true;
        } else if (rawValue.toLowerCase() === 'false') {
          value = false;
        } else {
          showVariableMessage(`Please enter "true" or "false" for boolean variable "${varName}"`, 'error');
          return;
        }
      } else {
        // Keep as string for string types and unknown types
        value = rawValue;
      }
    }

    const response = await fetch(`/api/rooms/${roomId}/variables/${varName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        value: value,
        type: originalType
      })
    });

    const result = await response.json();

    if (result.success) {
      showVariableMessage(`Variable "${varName}" updated successfully`, 'success');
      // Reload variables to show updated values
      await loadGameVariables();
    } else {
      showVariableMessage(`Failed to update variable: ${result.error || 'Unknown error'}`, 'error');
    }
  } catch (error) {
    console.error('Error updating variable:', error);
    showVariableMessage('Failed to update variable', 'error');
  }
}

function showVariableMessage(message, type = 'success') {
  // Try to use existing status element, or create a temporary toast
  const statusEl = document.getElementById('upload-status');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.style.color = type === 'success' ? '#28a745' : '#dc3545';
    setTimeout(() => {
      statusEl.textContent = '';
      statusEl.style.color = '';
    }, 3000);
  } else {
    // Create temporary toast
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#28a745' : '#dc3545'};
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
}

// Variable Management - Legacy socket handler for real-time updates
socket.on('variableUpdate', (data) => {
  const variables = Object.entries(data.variables).map(([name, value], index) => ({
    id: index,
    name,
    value,
    parsed_value: value // For this socket handler, the value is already parsed
  }));

  // Filter and display in new sections
  const userVariables = variables.filter(v => !TIMER_VARIABLES.includes(v.name));
  const timerVariables = variables.filter(v => TIMER_VARIABLES.includes(v.name));

  displayUserVariables(userVariables);
  displayTimerVariables(timerVariables);
});

socket.on('variable_updated', (data) => {
  // Reload variables when updated by other clients or API calls
  loadGameVariables();
});

// Timer display updates
socket.on('timer_update', (data) => {
  document.getElementById('timer-display').textContent =
    `${Math.floor(data.remaining/60).toString().padStart(2,'0')}:${(data.remaining%60).toString().padStart(2,'0')}`;
  // Update browser tab title with current timer
  updateBrowserTitle(data.remaining);
});

// Secondary timer update
socket.on('secondary_timer_update', (data) => {
  const secondaryTimerDisplay = document.getElementById('secondary-timer-display');
  const secondaryTimerSection = document.getElementById('secondary-timer-section');
  const dualTimerSection = document.getElementById('dual-timer-section');
  
  if (data.enabled && secondaryTimerDisplay) {
    secondaryTimerDisplay.textContent =
      `${Math.floor(data.remaining/60).toString().padStart(2,'0')}:${(data.remaining%60).toString().padStart(2,'0')}`;
    
    // Show secondary timer section if enabled
    if (secondaryTimerSection) {
      secondaryTimerSection.style.display = 'block';
    }
    // Show dual timer section if secondary timer is enabled
    if (dualTimerSection) {
      dualTimerSection.style.display = 'block';
    }
  } else if (secondaryTimerSection) {
    // Hide secondary timer section if not enabled
    secondaryTimerSection.style.display = 'none';
    // Hide dual timer section if secondary timer is not enabled
    if (dualTimerSection) {
      dualTimerSection.style.display = 'none';
    }
  }
});

// Secondary timer complete
socket.on('secondary_timer_complete', () => {
  console.log('Secondary timer completed');
  const secondaryTimerDisplay = document.getElementById('secondary-timer-display');
  if (secondaryTimerDisplay) {
    secondaryTimerDisplay.textContent = '00:00';
    secondaryTimerDisplay.style.animation = 'timerCompletePulse 1s infinite';
  }
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

// GM Page Customization Functionality
class GMCustomization {
  constructor() {
    this.roomId = roomId;
    this.defaultColors = {
      bgColor: '#1a1a1a',
      primaryColor: '#007bff',
      secondaryColor: '#6c757d',
      titleColor: '#ffffff',
      textColor: '#ffffff'
    };
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadCustomization();
    this.updateRoomTitle();
  }

  bindEvents() {
    // File input
    document.getElementById('choose-bg-image')?.addEventListener('click', () => {
      document.getElementById('gm-bg-image').click();
    });

    document.getElementById('gm-bg-image')?.addEventListener('change', (e) => {
      this.handleImageUpload(e);
    });

    // Color inputs
    document.getElementById('gm-bg-color')?.addEventListener('change', (e) => {
      this.updateBackgroundColor(e.target.value);
    });

    document.getElementById('gm-primary-color')?.addEventListener('change', (e) => {
      this.updatePrimaryColor(e.target.value);
    });

    document.getElementById('gm-secondary-color')?.addEventListener('change', (e) => {
      this.updateSecondaryColor(e.target.value);
    });

    document.getElementById('gm-title-color')?.addEventListener('change', (e) => {
      this.updateTitleColor(e.target.value);
    });

    document.getElementById('gm-text-color')?.addEventListener('change', (e) => {
      this.updateTextColor(e.target.value);
    });

    // Reset buttons
    document.getElementById('reset-bg-color')?.addEventListener('click', () => {
      this.resetBackgroundColor();
    });

    document.getElementById('reset-primary-color')?.addEventListener('click', () => {
      this.resetPrimaryColor();
    });

    document.getElementById('reset-secondary-color')?.addEventListener('click', () => {
      this.resetSecondaryColor();
    });

    document.getElementById('reset-title-color')?.addEventListener('click', () => {
      this.resetTitleColor();
    });

    document.getElementById('reset-text-color')?.addEventListener('click', () => {
      this.resetTextColor();
    });

    document.getElementById('remove-bg-image')?.addEventListener('click', () => {
      this.removeBackgroundImage();
    });

    // Action buttons
    document.getElementById('save-gm-customization')?.addEventListener('click', () => {
      this.saveCustomization();
    });

    document.getElementById('reset-all-customization')?.addEventListener('click', () => {
      this.resetAllCustomization();
    });
  }

  async updateRoomTitle() {
    try {
      if (!this.roomId) return;

      const response = await fetch(`/api/rooms/${this.roomId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.name) {
          const titleElement = document.getElementById('gm-page-title');
          if (titleElement) {
            titleElement.textContent = `${data.data.name} Control`;
          }
          // Store room name globally and update browser tab title
          roomName = data.data.name;
          updateBrowserTitle();
        }
      }
    } catch (error) {
      console.error('Error fetching room data:', error);
    }
  }

  handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      this.updateBackgroundImage(e.target.result);
    };
    reader.readAsDataURL(file);
  }

  updateBackgroundColor(color) {
    document.body.style.backgroundColor = color;
    document.querySelector('.container').style.backgroundColor = color;
  }

  updateBackgroundImage(imageData) {
    document.body.style.backgroundImage = `url(${imageData})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';
  }

  removeBackgroundImage() {
    document.body.style.backgroundImage = 'none';
    document.getElementById('gm-bg-image').value = '';
  }

  updatePrimaryColor(color) {
    const style = document.createElement('style');
    style.id = 'gm-primary-color-override';
    const existingStyle = document.getElementById('gm-primary-color-override');
    if (existingStyle) {
      existingStyle.remove();
    }
    
    style.textContent = `
      .nav-button:not(.secondary) {
        background-color: ${color} !important;
        border-color: ${color} !important;
      }
      .nav-button:not(.secondary):hover {
        background-color: ${this.darkenColor(color, 10)} !important;
        border-color: ${this.darkenColor(color, 10)} !important;
      }
      .status-badge {
        background-color: ${color} !important;
      }
    `;
    document.head.appendChild(style);
  }

  updateSecondaryColor(color) {
    const style = document.createElement('style');
    style.id = 'gm-secondary-color-override';
    const existingStyle = document.getElementById('gm-secondary-color-override');
    if (existingStyle) {
      existingStyle.remove();
    }

    style.textContent = `
      .nav-button.secondary {
        background-color: ${color} !important;
        border-color: ${color} !important;
      }
      .nav-button.secondary:hover {
        background-color: ${this.darkenColor(color, 10)} !important;
        border-color: ${this.darkenColor(color, 10)} !important;
      }
    `;
    document.head.appendChild(style);
  }

  updateTitleColor(color) {
    const style = document.createElement('style');
    style.id = 'gm-title-color-override';
    const existingStyle = document.getElementById('gm-title-color-override');
    if (existingStyle) {
      existingStyle.remove();
    }

    style.textContent = `
      .room-title, #gm-page-title {
        color: ${color} !important;
      }
    `;
    document.head.appendChild(style);
  }

  updateTextColor(color) {
    const style = document.createElement('style');
    style.id = 'gm-text-color-override';
    const existingStyle = document.getElementById('gm-text-color-override');
    if (existingStyle) {
      existingStyle.remove();
    }

    style.textContent = `
      .section-heading, .container,
      .gm-control-section, .state-card, .state-content {
        color: ${color} !important;
      }
    `;
    document.head.appendChild(style);
  }

  darkenColor(color, percent) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
  }

  resetBackgroundColor() {
    document.getElementById('gm-bg-color').value = this.defaultColors.bgColor;
    this.updateBackgroundColor(this.defaultColors.bgColor);
  }

  resetPrimaryColor() {
    document.getElementById('gm-primary-color').value = this.defaultColors.primaryColor;
    this.updatePrimaryColor(this.defaultColors.primaryColor);
  }

  resetSecondaryColor() {
    document.getElementById('gm-secondary-color').value = this.defaultColors.secondaryColor;
    this.updateSecondaryColor(this.defaultColors.secondaryColor);
  }

  resetTitleColor() {
    document.getElementById('gm-title-color').value = this.defaultColors.titleColor;
    this.updateTitleColor(this.defaultColors.titleColor);
  }

  resetTextColor() {
    document.getElementById('gm-text-color').value = this.defaultColors.textColor;
    this.updateTextColor(this.defaultColors.textColor);
  }

  async resetAllCustomization() {
    if (confirm('Are you sure you want to reset all customizations? This cannot be undone.')) {
      this.removeBackgroundImage();
      this.resetBackgroundColor();
      this.resetPrimaryColor();
      this.resetSecondaryColor();
      this.resetTitleColor();
      this.resetTextColor();

      // Save the reset values to the database
      try {
        await this.saveCustomization();
        this.showToast('All customizations reset', 'success');
      } catch (error) {
        console.error('Error resetting customization:', error);
        this.showToast('Failed to reset customization', 'error');
      }
    }
  }

  async saveCustomization() {
    const customization = {
      bg_color: document.getElementById('gm-bg-color').value,
      primary_color: document.getElementById('gm-primary-color').value,
      secondary_color: document.getElementById('gm-secondary-color').value,
      text_color: document.getElementById('gm-text-color').value,
      title_color: document.getElementById('gm-title-color').value,
      bg_image_data: document.body.style.backgroundImage !== 'none' ? document.body.style.backgroundImage : null
    };

    try {
      const response = await fetch(`/api/rooms/${this.roomId}/gm-customization`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customization)
      });

      const result = await response.json();
      if (result.success) {
        this.showToast('Customization saved successfully!', 'success');
      } else {
        this.showToast('Failed to save customization', 'error');
      }
    } catch (error) {
      console.error('Error saving customization:', error);
      this.showToast('Failed to save customization', 'error');
    }
  }

  async loadCustomization() {
    try {
      const response = await fetch(`/api/rooms/${this.roomId}/gm-customization`);
      const result = await response.json();

      if (!result.success) {
        console.error('Failed to load customization:', result.error);
        return;
      }

      const customization = result.data;

      if (customization.bg_color) {
        document.getElementById('gm-bg-color').value = customization.bg_color;
        this.updateBackgroundColor(customization.bg_color);
      }

      if (customization.primary_color) {
        document.getElementById('gm-primary-color').value = customization.primary_color;
        this.updatePrimaryColor(customization.primary_color);
      }

      if (customization.secondary_color) {
        document.getElementById('gm-secondary-color').value = customization.secondary_color;
        this.updateSecondaryColor(customization.secondary_color);
      }

      if (customization.title_color) {
        document.getElementById('gm-title-color').value = customization.title_color;
        this.updateTitleColor(customization.title_color);
      }

      if (customization.text_color) {
        document.getElementById('gm-text-color').value = customization.text_color;
        this.updateTextColor(customization.text_color);
      }

      if (customization.bg_image_data) {
        document.body.style.backgroundImage = customization.bg_image_data;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundAttachment = 'fixed';
      }
    } catch (error) {
      console.error('Error loading customization:', error);
    }
  }

  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#28a745' : '#dc3545'};
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
}

// Initialize GM customization when page loads
document.addEventListener('DOMContentLoaded', () => {
  if (roomId) {
    window.gmCustomization = new GMCustomization();
  }
});