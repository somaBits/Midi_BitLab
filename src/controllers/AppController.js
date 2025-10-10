/**
 * App Controller - Main application coordinator
 * Orchestrates MVC components and handles P5.js lifecycle
 * Pure coordination - no business logic or rendering
 */

import MidiManager from '../models/MidiManager.js';
import WaveformNode from '../models/WaveformNode.js';
import OscilloscopeNode from '../models/OscilloscopeNode.js';
import GroupManager from '../models/GroupManager.js';
import ProjectSerializer from '../models/ProjectSerializer.js';
import CanvasManager from '../views/CanvasManager.js';
import NodeRenderer from '../views/NodeRenderer.js';
import OscilloscopeRenderer from '../views/OscilloscopeRenderer.js';
import SidebarRenderer from '../views/SidebarRenderer.js';
import SourceSelector from '../views/SourceSelector.js';
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
  KEY_SPACE,
  KEY_CONTROL,
  KEY_COMMAND,
  GROUP_PLAYHEAD_COLOR,
  GROUP_PLAYHEAD_WEIGHT,
  GROUP_BORDER_COLOR,
  GROUP_OUTLINE_COLOR,
  GROUP_BORDER_OFFSET,
  GROUP_BORDER_DASH
} from '../config/constants.js';

export default class AppController {
  constructor() {
    // Core systems
    this.midi = new MidiManager();
    this.groupManager = new GroupManager();
    this.serializer = new ProjectSerializer();
    this.canvas = new CanvasManager();
    this.nodeRenderer = new NodeRenderer(this.canvas);
    this.oscilloscopeRenderer = new OscilloscopeRenderer(this.canvas);
    this.sidebar = new SidebarRenderer();
    this.sourceSelector = new SourceSelector();
    this.interaction = new InteractionController(this);
    this.recording = new RecordingManager();
    this.recordingRenderer = new RecordingRenderer(this.canvas);
    this.connectionRenderer = new ConnectionRenderer(this.canvas);
    
    // App state
    this.nodes = [];
    this.connections = [];
    this.deltaTime = 0;
    this.lastFrameTime = 0;
    
    // Project state
    this.currentProjectName = 'Untitled';
    this.hasUnsavedChanges = false;
    this.autoSaveIntervalId = null;
    
    // Bind methods for P5.js
    this._onMidiReady = this._onMidiReady.bind(this);
    this._onMidiError = this._onMidiError.bind(this);
    this._onMidiCC = this._onMidiCC.bind(this);
    this._onMidiDevicesChanged = this._onMidiDevicesChanged.bind(this);
    
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
    
    // Handle Shift key press during drag (for dynamic grouping mode)
    if (keyCode === 16) { // Shift key
      if (this.interaction && this.interaction.dragState.active) {
        console.log('🔵 GROUPING: Shift pressed during drag - entering grouping mode');
        this.interaction.shiftPressed = true;
      }
    }
  }

  /**
   * Handle key release events
   */
  keyReleased() {
    // NEW: Handle Shift key release during drag (exit grouping mode)
    if (keyCode === 16) { // Shift key
      if (this.interaction && this.interaction.dragState.active) {
        console.log('🔵 GROUPING: Shift released during drag - exiting grouping mode');
        this.interaction.shiftPressed = false;
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
      
      // Use appropriate renderer based on node type
      if (node instanceof OscilloscopeNode) {
        this.oscilloscopeRenderer.draw(node, nodeState);
      } else {
        this.nodeRenderer.draw(node, nodeState);
      }
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
    
    // Render group visual indicators
    this._renderGroupOutlines();     // White permanent outlines for formed groups
    this._renderGroupPreview();      // Blue preview outline during Shift+drag snap
    
    // Render group playheads (synchronized playback visualization)
    this._renderGroupPlayheads();
    
    // Render deletion overlays - Universal delete system
    if (this.interaction.deletionState.target) {
      this._renderDeleteIcon(this.interaction.deletionState);
    }
    
    // Render status info
    this._renderStatusInfo();
  }

  /**
   * Calculate connected perimeter vertices for a set of nodes
   * @param {Array} nodes - Array of nodes to trace perimeter around
   * @param {number} offset - Offset distance from node edges
   * @returns {Array} Array of {x, y} vertices forming the perimeter path
   * @private
   */
  _calculateGroupPerimeter(nodes, offset) {
    if (nodes.length === 0) return [];
    if (nodes.length === 1) {
      // Single node - simple rectangle
      const node = nodes[0];
      return [
        { x: node.x - offset, y: node.y - offset },
        { x: node.x + node.w + offset, y: node.y - offset },
        { x: node.x + node.w + offset, y: node.y + node.h + offset },
        { x: node.x - offset, y: node.y + node.h + offset }
      ];
    }
    
    // Multiple nodes - trace outer perimeter
    // Collect all edge segments
    const segments = [];
    
    for (const node of nodes) {
      // Check each edge to see if it's exterior (not adjacent to another group member)
      const nodeRect = {
        x: node.x,
        y: node.y,
        w: node.w,
        h: node.h
      };
      
      // Check if top edge is exterior
      const hasNodeAbove = nodes.some(other => {
        if (other === node) return false;
        // Check if other node is directly above (vertically adjacent)
        return Math.abs((other.y + other.h) - node.y) < 2 &&
               other.x < (node.x + node.w) && (other.x + other.w) > node.x;
      });
      
      if (!hasNodeAbove) {
        segments.push({
          type: 'horizontal',
          y: node.y - offset,
          x1: node.x - offset,
          x2: node.x + node.w + offset
        });
      }
      
      // Check if right edge is exterior
      const hasNodeRight = nodes.some(other => {
        if (other === node) return false;
        // Check if other node is directly to right (horizontally adjacent)
        return Math.abs(other.x - (node.x + node.w)) < 2 &&
               other.y < (node.y + node.h) && (other.y + other.h) > node.y;
      });
      
      if (!hasNodeRight) {
        segments.push({
          type: 'vertical',
          x: node.x + node.w + offset,
          y1: node.y - offset,
          y2: node.y + node.h + offset
        });
      }
      
      // Check if bottom edge is exterior
      const hasNodeBelow = nodes.some(other => {
        if (other === node) return false;
        // Check if other node is directly below (vertically adjacent)
        return Math.abs(other.y - (node.y + node.h)) < 2 &&
               other.x < (node.x + node.w) && (other.x + other.w) > node.x;
      });
      
      if (!hasNodeBelow) {
        segments.push({
          type: 'horizontal',
          y: node.y + node.h + offset,
          x1: node.x - offset,
          x2: node.x + node.w + offset
        });
      }
      
      // Check if left edge is exterior
      const hasNodeLeft = nodes.some(other => {
        if (other === node) return false;
        // Check if other node is directly to left (horizontally adjacent)
        return Math.abs((other.x + other.w) - node.x) < 2 &&
               other.y < (node.y + node.h) && (other.y + other.h) > node.y;
      });
      
      if (!hasNodeLeft) {
        segments.push({
          type: 'vertical',
          x: node.x - offset,
          y1: node.y - offset,
          y2: node.y + node.h + offset
        });
      }
    }
    
    // For now, fallback to simple bounding box
    // (Full perimeter tracing algorithm would require segment sorting and connection)
    const minX = Math.min(...nodes.map(n => n.x)) - offset;
    const minY = Math.min(...nodes.map(n => n.y)) - offset;
    const maxX = Math.max(...nodes.map(n => n.x + n.w)) + offset;
    const maxY = Math.max(...nodes.map(n => n.y + n.h)) + offset;
    
    return [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY }
    ];
  }

  /**
   * Render blue preview outline during Shift+drag snap
   * Shows which nodes will be grouped when drag is released
   * @private
   */
  _renderGroupPreview() {
    // Check if we're showing group preview
    if (!this.interaction.dragState.showGroupPreview) return;
    
    const draggedNode = this.interaction.dragState.node;
    const snapTarget = this.interaction.dragState.snapTarget;
    
    if (!draggedNode || !snapTarget) return;
    
    // Calculate unified bounding box around both nodes
    const minX = Math.min(draggedNode.x, snapTarget.x);
    const minY = Math.min(draggedNode.y, snapTarget.y);
    const maxX = Math.max(draggedNode.x + draggedNode.w, snapTarget.x + snapTarget.w);
    const maxY = Math.max(draggedNode.y + draggedNode.h, snapTarget.y + snapTarget.h);
    
    // Set blue semi-transparent stroke with dashed pattern
    this.canvas.stroke(...GROUP_BORDER_COLOR);
    this.canvas.strokeWeight(1);
    this.canvas.noFill();
    this.canvas.drawingContext.setLineDash(GROUP_BORDER_DASH);
    
    // Draw single unified fence around both nodes with 1px offset
    const offset = GROUP_BORDER_OFFSET;
    this.canvas.rect(
      minX - offset,
      minY - offset,
      (maxX - minX) + offset * 2,
      (maxY - minY) + offset * 2
    );
    
    // Reset line dash for subsequent rendering
    this.canvas.drawingContext.setLineDash([]);
  }

  /**
   * Render white permanent outline around grouped nodes
   * Shows which nodes are in formed groups
   * @private
   */
  _renderGroupOutlines() {
    // Set white semi-transparent stroke with dashed pattern
    this.canvas.stroke(...GROUP_OUTLINE_COLOR);
    this.canvas.strokeWeight(1);
    this.canvas.noFill();
    this.canvas.drawingContext.setLineDash(GROUP_BORDER_DASH);
    
    const offset = GROUP_BORDER_OFFSET;
    
    // Get all groups and draw unified fence around each
    const processedGroups = new Set();
    
    for (const node of this.nodes) {
      if (!this.groupManager.isNodeGrouped(node)) continue;
      
      // Get this node's group
      const group = this.groupManager.findGroupContaining(node);
      if (!group || processedGroups.has(group)) continue;
      
      // Mark group as processed to avoid drawing multiple times
      processedGroups.add(group);
      
      // Get all nodes in this group
      const groupNodes = Array.from(group.members);
      
      // Calculate unified bounding box around all group members
      const minX = Math.min(...groupNodes.map(n => n.x));
      const minY = Math.min(...groupNodes.map(n => n.y));
      const maxX = Math.max(...groupNodes.map(n => n.x + n.w));
      const maxY = Math.max(...groupNodes.map(n => n.y + n.h));
      
      // Draw single unified fence around entire group with 1px offset
      this.canvas.rect(
        minX - offset,
        minY - offset,
        (maxX - minX) + offset * 2,
        (maxY - minY) + offset * 2
      );
    }
    
    // Reset line dash for subsequent rendering
    this.canvas.drawingContext.setLineDash([]);
  }

  /**
   * Render group playheads for active groups
   * Shows synchronized playback progress across grouped nodes
   * @private
   */
  _renderGroupPlayheads() {
    const activeGroups = this.groupManager.getActiveGroups();
    
    for (const group of activeGroups) {
      // Get graph bounds for the entire group
      const bounds = this.groupManager.computeGroupGraphBounds(group);
      
      // Get current playback progress (0-1)
      const progress = this.groupManager.getGroupProgress(group);
      
      // Calculate playhead X position
      const startX = group.startX || bounds.minGX;
      const playheadX = startX + (bounds.maxGX - startX) * progress;
      
      // Draw blue vertical line across entire group
      this.canvas.stroke(...GROUP_PLAYHEAD_COLOR);
      this.canvas.strokeWeight(GROUP_PLAYHEAD_WEIGHT);
      this.canvas.line(playheadX, bounds.minGY, playheadX, bounds.maxGY);
    }
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
    
    // TEMPORARY TEST: Create oscilloscope node
    const oscNode = new OscilloscopeNode(640, 200);
    this.addNode(oscNode);
    
    // Set test source (will start receiving CC 1 data when available)
    // oscNode.setSource('test-device-id', 'Test Device', 1);
    console.log('TEST: Created oscilloscope node at (640, 200)');
    console.log('TEST: Oscilloscope buffer initialized with', oscNode.buffer.length, 'samples');
    console.log('TEST: Oscilloscope label:', oscNode.label);
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
    
    // Forward CC data to all oscilloscope nodes
    for (const node of this.nodes) {
      if (node instanceof OscilloscopeNode) {
        node.onCCReceived(data);
      }
    }
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
   * Recording event handlers
   * @private
   */
  _onRecordingCommitted(data) {
    console.log(`Recording committed: ${data.tracksCommitted} tracks`);
    
    // Track all nodes created from this recording session
    const createdNodes = [];
    
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
      createdNodes.push(node);
    }
    
    // Auto-group nodes if multiple CCs were recorded simultaneously
    if (createdNodes.length > 1) {
      console.log(`🔵 GROUPING: Auto-grouping ${createdNodes.length} simultaneously recorded nodes`);
      
      // Link all created nodes together in a group
      // Start with first node, then link each subsequent node to it
      const firstNode = createdNodes[0];
      for (let i = 1; i < createdNodes.length; i++) {
        this.groupManager.ensureGroupWith(firstNode, createdNodes[i]);
      }
      
      console.log(`✅ Created group with ${createdNodes.length} nodes from recording session`);
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
    
    // Stop individual nodes
    for (const node of this.nodes) {
      if (node.playing) {
        node.stopPlayback();
        stoppedCount++;
      }
    }
    
    // Stop all active groups to clear blue playhead
    if (this.groupManager) {
      const activeGroups = this.groupManager.getActiveGroups();
      for (const group of activeGroups) {
        this.groupManager.stopGroupPlayback(group);
      }
      if (activeGroups.length > 0) {
        console.log(`Stopped ${activeGroups.length} active group(s)`);
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
   * Show source selector for oscilloscope node
   * @param {object} node - Oscilloscope node to configure
   * @param {number} x - Screen X position for dropdown
   * @param {number} y - Screen Y position for dropdown
   */
  showOscilloscopeSourceSelector(node, x, y) {
    if (!(node instanceof OscilloscopeNode)) {
      console.warn('showOscilloscopeSourceSelector called on non-oscilloscope node');
      return;
    }
    
    this.sourceSelector.show(node, x, y, this.midi);
    console.log(`Showing source selector for oscilloscope at (${x}, ${y})`);
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
    
    // Save/Load button event listeners
    document.addEventListener('sidebar-save-project', () => {
      console.log('Sidebar: Save button clicked');
      this.saveProject();
    });
    
    document.addEventListener('sidebar-load-project', () => {
      console.log('Sidebar: Load button clicked');
      this.loadProject();
    });
    
    // Project name change event listener
    document.addEventListener('sidebar-project-name-changed', (event) => {
      const newName = event.detail;
      console.log('Project name changed to:', newName);
      this.currentProjectName = newName;
      this.hasUnsavedChanges = true;
    });
    
    // Oscilloscope source selection event listener
    document.addEventListener('oscilloscope-source-selected', (event) => {
      const { node, deviceId, deviceName, cc } = event.detail;
      console.log(`Oscilloscope source selected: ${deviceName} > CC ${cc}`);
      node.setSource(deviceId, deviceName, cc);
      this.hasUnsavedChanges = true;
    });
    
    // Oscilloscope creation button event listener
    document.addEventListener('sidebar-create-oscilloscope', () => {
      console.log('Sidebar: Create Oscilloscope button clicked');
      this.createOscilloscope();
    });
  }

  /**
   * Create a new oscilloscope node with cascade positioning
   */
  createOscilloscope() {
    // Find last oscilloscope for cascade positioning
    const oscilloscopes = this.nodes.filter(n => n instanceof OscilloscopeNode);
    let x, y;
    
    if (oscilloscopes.length > 0) {
      // Cascade from last oscilloscope (+12, +12 offset)
      const lastScope = oscilloscopes[oscilloscopes.length - 1];
      x = lastScope.x + 12;
      y = lastScope.y + 12;
    } else {
      // First oscilloscope - default position
      x = 640;
      y = 200;
    }
    
    // Create and add the oscilloscope
    const oscilloscope = new OscilloscopeNode(x, y);
    this.addNode(oscilloscope);
    
    console.log(`Created oscilloscope at (${x}, ${y})`);
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
   * Save current project to JSON file
   */
  saveProject() {
    try {
      // Serialize current state
      const projectData = this.serializer.serializeProject(
        this.nodes,
        this.connections,
        this.groupManager,
        this.currentProjectName
      );
      
      // Convert to JSON string
      const json = JSON.stringify(projectData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Trigger download
      const filename = `${this.currentProjectName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      
      // Cleanup
      URL.revokeObjectURL(url);
      this.hasUnsavedChanges = false;
      
      console.log(`Project saved: ${filename}`);
    } catch (err) {
      console.error('Save failed:', err);
      alert(`Failed to save project: ${err.message}`);
    }
  }

  /**
   * Load project from JSON file
   */
  loadProject() {
    // Check for unsaved changes
    if (this.hasUnsavedChanges) {
      const save = confirm('You have unsaved changes. Save before loading?');
      if (save) {
        this.saveProject();
        return; // User can try loading again after save
      }
    }
    
    // Create file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const jsonData = JSON.parse(event.target.result);
          this._restoreProject(jsonData);
        } catch (err) {
          console.error('Load failed:', err);
          alert(`Failed to load project: ${err.message}`);
        }
      };
      
      reader.onerror = () => {
        alert('Failed to read file');
      };
      
      reader.readAsText(file);
    };
    
    input.click();
  }

  /**
   * Restore project from deserialized data
   * @param {object} jsonData - Project JSON data
   * @private
   */
  _restoreProject(jsonData) {
    console.log('Restoring project from JSON...');
    
    // Deserialize project data
    const restored = this.serializer.deserializeProject(jsonData);
    
    // Clear current scene
    this._clearProject();
    
    // Restore nodes
    for (const node of restored.nodes) {
      this.addNode(node);
    }
    
    // Restore connections
    for (const connection of restored.connections) {
      this.addConnection(connection);
    }
    
    // Restore groups (must happen after nodes are added)
    restored.restoreGroups(this.groupManager);
    
    // Update project metadata
    this.currentProjectName = restored.metadata.name || 'Untitled';
    this.hasUnsavedChanges = false;
    
    // Update sidebar display
    this.sidebar.updateProjectName(this.currentProjectName);
    
    console.log(`Project restored: ${this.currentProjectName}`);
    console.log(`- ${restored.nodes.length} nodes`);
    console.log(`- ${restored.connections.length} connections`);
    console.log(`- ${this.groupManager.groups.length} groups`);
  }

  /**
   * Clear all project data
   * @private
   */
  _clearProject() {
    console.log('Clearing project...');
    
    // Stop all playback
    this.stopAllPlayback();
    
    // Remove all connections
    this.connections = [];
    
    // Remove all nodes
    while (this.nodes.length > 0) {
      this.removeNode(this.nodes[0]);
    }
    
    // Clear groups
    this.groupManager.groups = [];
    
    // Reset project name
    this.currentProjectName = 'Untitled';
    this.hasUnsavedChanges = false;
    
    // Update sidebar display
    this.sidebar.updateProjectName('Untitled');
    
    console.log('Project cleared');
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
