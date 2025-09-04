// Sample test data fixtures
export const sampleRooms = [
  {
    id: 'test-room-1',
    name: 'Test Room 1',
    config: { maxPlayers: 4, gameMode: 'classic', difficulty: 'normal', features: ['timer', 'hints'], theme: 'mystery' },
    timer_duration: 300,
    api_variables: { score: 0, level: 1 },
    custom_html: '<div>Test HTML</div>',
    custom_css: '.test { color: red; }',
    rules_config: { allowHints: true, timeLimit: 300, scoring: { win: 1000, loss: -100 } },
    hint_config: { maxHints: 3, hintDelay: 30, hintTypes: ['text', 'image'] }
  },
  {
    id: 'test-room-2',
    name: 'Test Room 2',
    config: { maxPlayers: 6, gameMode: 'speed', difficulty: 'hard', settings: { autoSave: true, soundEnabled: false }, teamConfig: { teams: ['red', 'blue'] } },
    timer_duration: 180,
    api_variables: { score: 100, level: 2 },
    custom_html: '<div>Speed Test HTML</div>',
    custom_css: '.speed { color: blue; }',
    rules_config: { allowHints: false, timeLimit: 180, penalties: { timeout: -50 } },
    hint_config: { maxHints: 1, hintDelay: 15, visualHints: true }
  },
  {
    id: 'complex-config-room',
    name: 'Complex Configuration Room',
    config: {
      maxPlayers: 10,
      gameMode: 'multiplayer',
      difficulty: 'expert',
      features: ['timer', 'hints', 'variables', 'actions', 'real-time'],
      theme: {
        background: 'dark_forest',
        sound: 'ambient_forest',
        effects: ['fog', 'lighting']
      },
      scoring: {
        win: 2000,
        partial: 500,
        completion: 1500,
        bonus: {
          timeBonus: 100,
          noHints: 200,
          firstTry: 300
        }
      },
      rules: {
        allowReplay: true,
        publicStats: false,
        leaderboards: true
      }
    },
    timer_duration: 600,
    api_variables: { score: 0, level: 1, attempts: 0, hints_used: 0 },
    custom_html: '<div id="game-headers"><h1>Welcome to Complex Room!</h1></div>',
    custom_css: '.complex-room { background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); } .effects-fog { backdrop-filter: blur(2px); }',
    rules_config: {
      allowHints: true,
      timeLimit: 600,
      winConditions: ['solve_puzzle', 'find_artifacts', 'escape_room'],
      penalties: { timeout: -100, wrongChoice: -25 }
    },
    hint_config: {
      maxHints: 5,
      hintDelay: 60,
      hintTypes: ['text', 'image', 'video', 'audio'],
      progressiveDifficulty: true,
      contextualHints: true
    }
  },
  {
    id: 'empty-config-room',
    name: 'Empty Config Room',
    config: {},
    timer_duration: 300,
    api_variables: {},
    custom_html: '',
    custom_css: '',
    rules_config: {},
    hint_config: {}
  },
  {
    id: 'minimal-config-room',
    name: 'Minimal Config Room',
    config: { gameMode: 'basic' },
    timer_duration: 0,
    api_variables: {},
    custom_html: '',
    custom_css: '',
    rules_config: {},
    hint_config: {}
  }
];

export const sampleVariables = [
  {
    room_id: 'test-room-1',
    name: 'testVar1',
    type: 'integer',
    value: '42'
  },
  {
    room_id: 'test-room-1',
    name: 'testVar2',
    type: 'string',
    value: 'hello world'
  },
  {
    room_id: 'test-room-1',
    name: 'testVar3',
    type: 'boolean',
    value: 'true'
  }
];

export const sampleTimers = [
  {
    room_id: 'test-room-1',
    name: 'mainTimer',
    duration: 300,
    remaining: 300,
    active: false
  },
  {
    room_id: 'test-room-1',
    name: 'bonusTimer',
    duration: 60,
    remaining: 60,
    active: true
  }
];

export const sampleHints = [
  {
    room_id: 'test-room-1',
    message: 'This is your first hint!',
    status: 'pending'
  },
  {
    room_id: 'test-room-1',
    message: 'Try looking for clues in the room.',
    status: 'sent'
  }
];

export const sampleEvents = [
  {
    variable_id: 1,
    condition: 'score > 100',
    action_type: 'show_hint',
    action_data: { hintId: 1 }
  },
  {
    variable_id: 2,
    condition: 'level == 3',
    action_type: 'unlock_door',
    action_data: { doorId: 'main-door' }
  }
];

// Helper function to get all sample data
export const getAllSampleData = () => ({
  rooms: sampleRooms,
  variables: sampleVariables,
  timers: sampleTimers,
  hints: sampleHints,
  events: sampleEvents
});