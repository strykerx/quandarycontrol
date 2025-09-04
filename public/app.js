const socket = io();

// Parse URL for room configuration
const pathSegments = window.location.pathname.split('/').filter(segment => segment);
let roomId = null;
let role = null;

if (pathSegments.length >= 3 && pathSegments[0] === 'room') {
  roomId = pathSegments[1];
  role = pathSegments[2]; // 'player' or 'gm'
}

// Initialize connection
socket.on('connect', () => {
  console.log('Connected to server');
});

// Socket.io listeners
socket.on('timerUpdate', (data) => {
  document.getElementById('timer-display').textContent = formatTime(data.remaining);
});

socket.on('variableUpdate', (update) => {
  const display = document.getElementById('variable-display');
  const element = document.createElement('div');
  element.className = 'variable';
  element.innerHTML = `
    <strong>${update.name}:</strong> 
    <span class="value">${update.value}</span>
  `;
  display.appendChild(element);
});

socket.on('hintReceived', (hint) => {
  const container = document.getElementById('hint-container');
  const hintElement = document.createElement('div');
  hintElement.className = 'hint-message';
  hintElement.textContent = hint.message;
  container.appendChild(hintElement);
});

// Utility functions
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

// Initial setup
document.addEventListener('DOMContentLoaded', () => {
  if (roomId) {
    // Join specific room
    socket.emit('joinRoom', { roomId, role });
    // Display room info
    const roomInfo = document.getElementById('room-info');
    roomInfo.style.display = 'block';
    roomInfo.innerHTML = `
      <div>Room: <strong>${roomId}</strong> (${role})</div>
    `;
  } else {
    // Request initial game state (fallback for direct access)
    socket.emit('requestInitialState');
  }
});