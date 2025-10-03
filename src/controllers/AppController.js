/**
 * App Controller - Main application coordinator
 * Orchestrates MVC components and handles P5.js lifecycle
 * Pure coordination - no business logic or rendering
 */

import MidiManager from '../models/MidiManager.js';
import WaveformNode from '../models/WaveformNode.js';
import CanvasManager from '../views/CanvasManager.js';
import NodeRenderer from '../views/NodeRenderer.js';
import SidebarRenderer from '../views/SidebarRenderer.js';
import InteractionController from './InteractionController.js';
import RecordingManager from '../models/RecordingManager.js';
import RecordingRenderer from '../views/RecordingRenderer.js';
import ConnectionRenderer from '../views/ConnectionRenderer.js';
import { generateSine, generateSawtooth, generateRandomSmooth } from '../models/WaveformGenerator.js';
import {
  DELETE_OVERLAY_COLOR,
  DELETE_ICON_R,
  KEY_ESCAPE,
  KEY_ENTER,
  KEY_SPACE
} from '../config/constants.js';

export default class AppController {
  constructor() {
    // Core systems
    this.midi = new MidiManager();
    this.canvas = new CanvasManager();
    this.nodeRenderer = new NodeRenderer(this.canvas);
    this.sidebar = new SidebarRenderer();
    this.interaction = new InteractionController(this);
    this.recording = new RecordingManager();
    this.recordingRenderer = new RecordingRenderer(this.canvas);
    this.connectionRenderer = new ConnectionRenderer(this.canvas);
    
    // App state
    this.nodes = [];
    this.connections = [];
    this.deltaTime = 0;
    this.lastFrameTime = 0;
    
    // Bind methods for P5.js
    this._onMidiReady = this._onMidiReady.bind(this);
    this._onMidiError = this._onMidiError.bind(this);
    this._onMidiCC = this._onMidiCC.bind(this);
    
    // Bind recording event handlers
    this._onRecordingCommitted = this._onRecordingCommitted.bind(this);
    this._onRecordingCancelled = this._onRecordingCancelled.bind(this);
    
    // Bind sidebar event handlers
    this._onSidebarInputModeChange = this._onSidebarInputModeChange.bind(this);
    this._onSidebarOutputSelectionChange = this._onSidebarOutputSelectionChange.bind(this);
    this._onSidebarChannelChange = this._onSidebarChannelChange.bind(this);
  }

  /**
   * P5.js setup - Initialize the application
   */
  setup() {
    console.log('AppController: Setting up clean MVC MIDI Viz');
    
    // Initialize canvas
    this.canvas.init();
    
    // Initialize MIDI system
    this.midi.on('ready', this._onMidiReady);
    this.midi.on('error', this._onMidiError);
    this.midi.on('cc-received', this._onMidiCC);
    this.midi.on('devices-changed', this._onMidiDevicesChanged.bind(this));
    this.midi.init();
    
    // Initialize sidebar
    this.sidebar.init();
    this._setupSidebarEventListeners();
    
    // Initialize interaction controller
    this.interaction.init();
    
    // Initialize recording system
    this.recording.on('recording-committed', this._onRecordingCommitted);
    this.recording.on('recording-cancelled', this._onRecordingCancelled);
    
    // Create initial example nodes
    this._createExampleNodes();
    
    this.lastFrameTime = performance.now();
    
    console.log('AppController: Setup complete');
  }

  /**
   * P5.js draw - Main render loop
   */
  draw() {
    // Calculate delta time
    const currentTime = performance.now();
    this.deltaTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;
    
    // Clear canvas
    this.canvas.clear();
    
    // Update all nodes
    this._updateNodes();
    
    // Update interaction states (triggers, cursors, etc.)
    this._updateInteractionStates();
    
    // Render connections (behind nodes)
    this._renderConnections();
    
    // Render all nodes
    this._renderNodes();
    
    // Render UI overlays
    this._renderUI();
  }

  /**
   * P5.js windowResized
   */
  windowResized() {
    this.canvas.resize();
  }

  /**
   * Mouse event handlers (called by P5.js via main.js)
   */
  mousePressed(button = 'left', shiftKey = false, altKey = false) {
    console.log(`AppController.mousePressed: button=${button}, shiftKey=${shiftKey}, altKey=${altKey}`);
    this.interaction.handleMousePressed(button, shiftKey, altKey);
  }

  mouseDragged() {
    this.interaction.handleMouseDragged();
  }

  mouseReleased(button) {
    this.interaction.handleMouseReleased(button);
  }

  /**
   * Keyboard event handlers
   */
  keyPressed() {
    // Handle SPACEBAR for stopping all playback
    if (keyCode === KEY_SPACE) {
      console.log('SPACEBAR pressed - stopping all playback');
      this.stopAllPlayback();
      return;
    }

    // Handle ENTER key for recording commit
    if (keyCode === KEY_ENTER && this.recording.isRecording) {
      console.log('ENTER pressed - committing recording');
      this.commitRecording();
      return;
    }

    // Handle ESC key for recording cancellation
    if (keyCode === KEY_ESCAPE) {
      console.log('ESC pressed - cancelling recording and clearing states');

      // Cancel any active recording
      if (this.recording.isRecording) {
        this.cancelRecording();
      }

      // Clear visual guides and interaction states
      if (this.interaction) {
        this.interaction.guideV = null;
        this.interaction.guideH = null;
        this.interaction.deletionState = {
          target: null,
          type: null,
          iconPosition: null
        };
      }

      // Clear recording renderer buffers
      if (this.recordingRenderer) {
        this.recordingRenderer.clearBuffers();
      }
    }
  }

  /**
   * Add node to the scene
   */
  addNode(node) {
    this.nodes.push(node);
    
    // Set up node event listeners
    node.on('playback-started', (data) => {
      console.log(`Node ${data.node.label} started playing`);
    });
    
    node.on('playback-complete', (data) => {
      console.log(`Node ${data.node.label} completed playback`);
    });
    
    node.on('cc-sent', (data) => {
      console.log(`Node ${data.node.label} sent CC${data.cc}: ${data.value}`);
    });
    
    console.log(`Added node: ${node.label} at (${node.x}, ${node.y})`);
  }

  /**
   * Remove node from scene
   */
  removeNode(node) {
    const index = this.nodes.indexOf(node);
    if (index >= 0) {
      this.nodes.splice(index, 1);
      node.destroy();
      console.log(`Removed node: ${node.label}`);
    }
  }

  /**
   * Get node at position
   */
  getNodeAt(x, y) {
    // Search from front to back (reverse order for proper z-order)
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const node = this.nodes[i];
      if (node.bodyHits(x, y)) {
        return node;
      }
    }
    return null;
  }

  /**
   * Update all nodes
   * @private
   */
  _updateNodes() {
    for (const node of this.nodes) {
      node.update(this.deltaTime);
      
      // Send MIDI CC if node is playing
      if (node.playing && node.sendCurrentCC) {
        node.sendCurrentCC(this.midi);
      }
    }
    
    // Update recording system if active (CRITICAL for width growth)
    if (this.recording.isRecording) {
      this.recording.update(this.deltaTime);
    }
  }

  /**
   * Update interaction states (hover, cursor management, etc.)
   * @private
   */
  _updateInteractionStates() {
    // Update connection hover every frame (for hover-delete behavior)
    if (this.interaction) {
      this.interaction._updateConnectionHover();
    }

    // Update trigger hover states for cursor management
    // Only update when not actively dragging to avoid interference
    if (!this.interaction.dragState.active && !this.interaction.triggerDrag.active) {
      this.interaction._updateTriggerHover();
    }
  }

  /**
   * Render all nodes
   * @private
   */
  _renderNodes() {
    const interactionState = this.interaction.getNodeRenderingState();
    
    for (const node of this.nodes) {
      const nodeState = interactionState[node.id] || {};
      this.nodeRenderer.draw(node, nodeState);
    }
  }

  /**
   * Render UI overlays
   * @private
   */
  _renderUI() {
    const interactionUI = this.interaction.getRenderingData();
    
    // Render recording overlay
    const recordingSession = this.recording.getSessionForRendering();
    if (recordingSession) {
      this.recordingRenderer.render(recordingSession);
    }
    
    // Render docking guides
    if (interactionUI.guideV !== null) {
      this.canvas.drawGuideLine(true, interactionUI.guideV);
    }
    if (interactionUI.guideH !== null) {
      this.canvas.drawGuideLine(false, interactionUI.guideH);
    }
    
    // Render deletion overlays - Universal delete system
    if (this.interaction.deletionState.target) {
      this._renderDeleteIcon(this.interaction.deletionState);
    }
    
    // Render status info
    this._renderStatusInfo();
  }

  /**
   * Render status information
   * @private
   */
  _renderStatusInfo() {
    this.canvas.fill(255, 200);
    this.canvas.noStroke();
    this.canvas.textAlign(this.canvas.LEFT, this.canvas.TOP);
    this.canvas.textSize(12);
    
    const midiState = this.midi.getState();
    const lines = [
      `MIDI: ${midiState.ready ? 'Ready' : 'Not Ready'}`,
      `Outputs: ${midiState.outputCount || 0}`,
      `Inputs: ${midiState.inputCount || 0}`,
      `Channel: ${midiState.channel + 1}`,
      `Nodes: ${this.nodes.length}`,
      `Last CC: ${midiState.lastGlobalCC} = ${midiState.lastGlobalValue}`
    ];
    
    let yOffset = 10;
    lines.forEach(line => {
      this.canvas.text(line, 10, yOffset);
      yOffset += 15;
    });
  }

  /**
   * Render universal delete icon for any element type
   * @param {object} deletionState - Deletion state from InteractionController
   * @private
   */
  _renderDeleteIcon(deletionState) {
    const { target, type, iconPosition } = deletionState;
    if (!target || !iconPosition) return;
    
    // Render different backgrounds based on element type
    if (type === 'node') {
      // Node gets 50% black overlay across entire node
      this.canvas.noStroke();
      this.canvas.fill(...DELETE_OVERLAY_COLOR);
      this.canvas.rect(target.x, target.y, target.w, target.h);
    }
    // Triggers and connections get no background (as specified)
    
    // Draw standardized delete icon using CanvasManager utility
    this.canvas.drawDeleteIcon(iconPosition.x, iconPosition.y, DELETE_ICON_R);
  }

  /**
   * Create example nodes for demo
   * @private
   */
  _createExampleNodes() {
    // Create some example nodes like the original
    const node1 = new WaveformNode(120, 120, 'CC 10', generateSine(200));
    const node2 = new WaveformNode(420, 260, 'CC 74', generateSawtooth(200));
    const node3 = new WaveformNode(220, 420, 'CC 1', generateRandomSmooth(200));
    
    this.addNode(node1);
    this.addNode(node2);
    this.addNode(node3);
    
  }

  /**
   * MIDI event handlers
   * @private
   */
  _onMidiReady(data) {
    console.log('MIDI system ready:', data);
  }

  _onMidiError(data) {
    console.error('MIDI error:', data.error);
  }

  _onMidiCC(data) {
    console.log(`MIDI CC received: CH${data.channel} CC${data.cc} = ${data.value}`);
    
    // Forward CC data to recording system if recording
    if (this.recording.isRecording) {
      this.recording.recordCC(
        data.channel,
        data.cc,
        data.value,
        data.timestamp,
        data.source
      );
    }
  }

  /**
   * Recording event handlers
   * @private
   */
  _onRecordingCommitted(data) {
    console.log(`Recording committed: ${data.tracksCommitted} tracks`);
    
    // Create nodes from recording data
    for (const nodeData of data.nodeDataList) {
      const node = new WaveformNode(
        nodeData.x,
        nodeData.y,
        nodeData.label,
        nodeData.samples,
        nodeData.width
      );
      
      node.setCC(nodeData.cc);
      node.setSourceDeviceName(nodeData.sourceDeviceName);
      
      this.addNode(node);
    }
    
    // Clear recording renderer buffers
    this.recordingRenderer.clearBuffers();
  }

  _onRecordingCancelled(data) {
    console.log('Recording cancelled');
    
    // Clear recording renderer buffers
    this.recordingRenderer.clearBuffers();
  }

  /**
   * Public methods for interaction controller
   */

  /**
   * Start recording at position
   * @param {number} x - X position
   * @param {number} y - Y position
   */
  startRecording(x, y) {
    if (this.recording.isRecording) {
      this.recording.stopRecording();
    }
    this.recording.startRecording(x, y);
    console.log(`Started recording at (${x}, ${y})`);
  }

  /**
   * Commit current recording
   */
  commitRecording() {
    if (this.recording.isRecording) {
      this.recording.commitRecording();
    }
  }

  /**
   * Cancel current recording
   */
  cancelRecording() {
    if (this.recording.isRecording) {
      this.recording.cancelRecording();
    }
  }

  /**
   * Stop playback on all nodes
   */
  stopAllPlayback() {
    let stoppedCount = 0;
    
    for (const node of this.nodes) {
      if (node.playing) {
        node.stopPlayback();
        stoppedCount++;
      }
    }
    
    console.log(`Stopped ${stoppedCount} playing node(s)`);
  }

  /**
   * Check if recording overlay blocks interaction
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {boolean} True if blocked
   */
  isRecordingBlocking(x, y) {
    const session = this.recording.getSessionForRendering();
    if (!session) return false;
    
    return this.recordingRenderer.hitTest(session, x, y);
  }

  /**
   * Get recording hit test
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {object|null} Recording track or null
   */
  getRecordingHit(x, y) {
    return this.recording.hitTest(x, y);
  }

  /**
   * Render connections
   * @private
   */
  _renderConnections() {
    // Get connection states from interaction controller
    const connectionStates = {};
    for (const connection of this.connections) {
      connectionStates[connection.id] = {
        isHovered: connection.isHovered
      };
    }
    
    // Render all connections
    this.connectionRenderer.drawConnections(this.connections, connectionStates);
    
    // Render cable drag preview if active
    if (this.interaction.cableDrag.active && this.interaction.cableDrag.startPort) {
      const mousePos = this.canvas.getMousePos();
      this.connectionRenderer.drawDragPreview(
        this.interaction.cableDrag.startPort,
        mousePos.x,
        mousePos.y,
        this.interaction.cableDrag.portType // Pass the port type for correct positioning
      );
    }

    // Draw hover delete icon on hovered connection (no right-click overlay)
    if (this.interaction.hoveredConnection && this.interaction.hoveredConnection.getMidpoint) {
      const mid = this.interaction.hoveredConnection.getMidpoint();
      this.canvas.drawDeleteIcon(mid.x, mid.y, DELETE_ICON_R);
    }
  }

  /**
   * Add connection between two ports
   * @param {object} connection - Connection to add
   */
  addConnection(connection) {
    this.connections.push(connection);
    console.log(`Added connection: ${connection.id}`);
  }

  /**
   * Remove connection
   * @param {object} connection - Connection to remove
   */
  removeConnection(connection) {
    const index = this.connections.indexOf(connection);
    if (index >= 0) {
      this.connections.splice(index, 1);
      console.log(`Removed connection: ${connection.id}`);
    }
  }

  /**
   * Split a node into two nodes with connection remapping
   * @param {object} originalNode - Original node to replace
   * @param {object} leftNode - New left node
   * @param {object} rightNode - New right node
   * @param {Map} portMap - Map of old ports to new ports
   */
  splitNode(originalNode, leftNode, rightNode, portMap) {
    console.log(`AppController.splitNode: Splitting "${originalNode.label}"`);
    
    // Add new nodes to scene
    this.addNode(leftNode);
    this.addNode(rightNode);
    
    // Remap all connections from old ports to new ports
    const newConnections = [];
    
    for (const connection of this.connections) {
      const portA = connection.portA;
      const portB = connection.portB;
      
      // Check if either port belongs to the original node
      const aIsOldPort = portMap.has(portA);
      const bIsOldPort = portMap.has(portB);
      
      if (!aIsOldPort && !bIsOldPort) {
        // Connection doesn't involve the split node - keep as-is
        newConnections.push(connection);
        continue;
      }
      
      // Get new port(s) for each end
      const newPortA = aIsOldPort ? portMap.get(portA) : portA;
      const newPortB = bIsOldPort ? portMap.get(portB) : portB;
      
      // Handle cases where a port maps to multiple new ports (array)
      const portsA = Array.isArray(newPortA) ? newPortA : [newPortA];
      const portsB = Array.isArray(newPortB) ? newPortB : [newPortB];
      
      // Create connections for all combinations (for HTriggers and split-point VTriggers)
      for (const pA of portsA) {
        for (const pB of portsB) {
          // Import Connection class dynamically
          import('../models/Connection.js').then(({ default: Connection }) => {
            const newConnection = new Connection(pA, pB);
            newConnections.push(newConnection);
            console.log(`Remapped connection: old ports → new ports`);
          }).catch(error => {
            console.error('Failed to create remapped connection:', error);
          });
        }
      }
    }
    
    // Wait a tick for async imports to complete, then update connections
    setTimeout(() => {
      this.connections = newConnections;
      console.log(`Remapped ${this.connections.length} connections after split`);
      
      // Remove original node (after connections are remapped)
      this.removeNode(originalNode);
      
      console.log(`Split complete: "${originalNode.label}" → 2 nodes with ${this.connections.length} connections`);
    }, 0);
  }

  /**
   * Get application state for debugging
   */
  getDebugState() {
    return {
      nodes: this.nodes.length,
      connections: this.connections.length,
      midi: this.midi.getState(),
      interaction: this.interaction.getState(),
      deltaTime: this.deltaTime.toFixed(2)
    };
  }

  /**
   * Setup sidebar event listeners
   * @private
   */
  _setupSidebarEventListeners() {
    document.addEventListener('sidebar-input-mode-change', this._onSidebarInputModeChange);
    document.addEventListener('sidebar-output-selection-change', this._onSidebarOutputSelectionChange);
    document.addEventListener('sidebar-channel-change', this._onSidebarChannelChange);
  }

  /**
   * Handle MIDI devices changed event
   * @private
   */
  _onMidiDevicesChanged(data) {
    // Update sidebar with new device lists
    this.sidebar.updateInputDevices(data.inputs, this.midi.inputMode);
    this.sidebar.updateOutputDevices(data.outputs, this.midi.outputSelection);
    this.sidebar.updateChannel(this.midi.channel);
    
    console.log(`MIDI devices updated: ${data.inputs.length} inputs, ${data.outputs.length} outputs`);
  }

  /**
   * Handle sidebar input mode change
   * @private
   */
  _onSidebarInputModeChange(event) {
    const mode = event.detail;
    this.midi.setInputMode(mode);
    console.log('Sidebar: Input mode changed to', mode);
  }

  /**
   * Handle sidebar output selection change
   * @private
   */
  _onSidebarOutputSelectionChange(event) {
    const selection = event.detail;
    this.midi.setOutputSelection(selection);
    console.log('Sidebar: Output selection changed to', selection);
  }

  /**
   * Handle sidebar channel change
   * @private
   */
  _onSidebarChannelChange(event) {
    const channel = event.detail;
    this.midi.setChannel(channel);
    console.log('Sidebar: Channel changed to', channel + 1);
  }

  /**
   * Clean up resources
   */
  destroy() {
    // Clean up sidebar event listeners
    document.removeEventListener('sidebar-input-mode-change', this._onSidebarInputModeChange);
    document.removeEventListener('sidebar-output-selection-change', this._onSidebarOutputSelectionChange);
    document.removeEventListener('sidebar-channel-change', this._onSidebarChannelChange);
    
    // Clean up nodes
    for (const node of this.nodes) {
      node.destroy();
    }
    this.nodes = [];
    
    // Clean up systems
    this.midi.destroy();
    this.sidebar.destroy();
    this.interaction.destroy();
    
    console.log('AppController: Destroyed');
  }
}
