# Proposed Clean MVC Architecture Plan

## Models (Data & Business Logic)

```javascript
models/
├── MidiManager.js          # MIDI device & message handling
├── Node.js                 # Base node class
├── NodeBox.js             # Waveform node implementation  
├── TriggerSystem.js       # VTrigger & HTrigger management
├── ConnectionSystem.js    # Port & Link management
├── GroupManager.js        # Node grouping & sync logic
├── RecordingSystem.js     # MIDI recording functionality
├── PlaybackEngine.js      # Timing & playback coordination
└── WaveformGenerator.js   # Sine, saw, random wave creation
```

### Views (Pure Rendering)

```javascript
views/
├── CanvasRenderer.js      # Main canvas management
├── NodeRenderer.js        # Node visual rendering
├── TriggerRenderer.js     # Trigger line rendering
├── ConnectionRenderer.js  # Cable & port rendering
├── UIRenderer.js          # Overlays, guides, icons
├── SidebarRenderer.js     # MIDI controls sidebar
└── RecordingRenderer.js   # Recording status & overlay
```

## Controllers (User Interaction & Coordination)

```javascript
controllers/
├── AppController.js       # Main app coordinator
├── InteractionController.js # Mouse/keyboard input handling
├── DragController.js      # Drag operations (nodes, triggers, cables)
├── SelectionController.js # Selection & multi-selection
├── PlaybackController.js  # Play/pause/stop coordination
└── RecordingController.js # Recording state management
```


__Phase 1: Foundation (Core MVC + Basic Nodes)__

- Set up clean MVC structure with p5.js integration
- Implement basic Node model with waveform data
- Create NodeRenderer for visual display
- Basic mouse interaction for node creation/movement
- MIDI system integration (input/output)

__Phase 2: Recording System (PRIORITY)__

- Real-time MIDI recording infrastructure
- Recording visualization and status indicator
- Recording-to-node conversion with proper waveform generation
- Multi-track recording capabilities
- Recording state management and controls

__Phase 3: Trigger System__

- Implement VTrigger and HTrigger models
- Add trigger creation via edge interaction areas
- Trigger visualization and manipulation
- Basic trigger-to-node playback relationship

__Phase 4: Connection System__

- Port system implementation
- Cable dragging and connection logic
- Visual connection rendering
- Trigger propagation through connections

__Phase 5: Grouping & Synchronization__

- Node proximity detection and grouping
- Visual docking guides and snapping
- Synchronized group playback
- Group management and coordination

__Phase 6: Advanced Features__

- Node deletion system with overlays
- Trigger deletion system
- Node duplication (Alt+drag)
- Keyboard shortcuts and context menus

__Phase 7: Polish & Optimization__

- Advanced interaction modes
- Visual polish and animations
- Performance optimization
- Undo/redo system
- Error handling and edge cases
