/**
 * WaveformNode - Concrete implementation of a waveform visualization node
 * Extends Node with waveform data, playback logic, and MIDI output
 * Pure model - no rendering logic
 */

import Node from './Node.js';
import VTrigger from './VTrigger.js';
import HTrigger from './HTrigger.js';
import { generateSine, generateSawtooth, generateRandomSmooth } from './WaveformGenerator.js';
import { PIXELS_PER_SECOND, CC_MAX_VALUE, DEFAULT_NODE_SAMPLES, CREATE_AREA_TOP_HEIGHT, CREATE_AREA_RIGHT_WIDTH } from '../config/constants.js';
import { clamp, map } from '../utils/geometry.js';

export default class WaveformNode extends Node {
  constructor(x = 0, y = 0, label = 'CC 1', samples = null, width = null) {
    super(x, y, label);
    
    // Override width if specified
    if (width) {
      this.w = width;
    }
    
    // Waveform data
    this.samples = samples || generateSine(DEFAULT_NODE_SAMPLES);
    
    // MIDI output configuration
    this.cc = this._parseCC(label);
    this.sourceDeviceName = '';
    
    // Playback state
    this.playProgress = 0; // 0-1 normalized progress
    this.lastCCSent = -1;
    this.durationMs = this._computeRunDuration();
    
    // Playback from specific position
    this.startProgress = 0; // Where playback started (0-1)
    this.remainingDurationMs = this.durationMs;
    
    // Visual feedback
    this.playheadX = 0; // Current playhead position in pixels
    
    // Create area indicators (for UI)
    this.showCreateAreas = false;
    
    // Trigger arrays
    this.vTriggers = []; // Vertical triggers
    this.hTriggers = []; // Horizontal triggers
    
    // Trigger state tracking
    this._vTriggersHitThisPlayback = new Set(); // Track which V triggers have fired
  }

  /**
   * Parse CC number from label
   * @private
   */
  _parseCC(label) {
    const match = String(label || '').match(/CC\s*(\d+)/i);
    const num = match ? parseInt(match[1], 10) : 1;
    return clamp(num, 0, 127);
  }

  /**
   * Compute run duration based on node width and consistent speed
   * Time-based: pixels ÷ pixels/second = seconds, then convert to ms
   * @private
   */
  _computeRunDuration() {
    const graphWidth = this.w; // Full width, no padding
    return Math.max(1, (graphWidth / PIXELS_PER_SECOND) * 1000);
  }

  /**
   * Get graph area rectangle (content area inside node)
   */
  getGraphRect() {
    return {
      gx: this.x,
      gy: this.y,
      gw: this.w,
      gh: this.h
    };
  }

  /**
   * Get create areas for trigger placement
   * Small edge areas for trigger creation while keeping full-frame waveform
   */
  getTopCreateRect() {
    return {
      x: this.x,
      y: this.y,
      w: this.w,
      h: CREATE_AREA_TOP_HEIGHT
    };
  }

  getRightCreateRect() {
    return {
      x: this.x + this.w - CREATE_AREA_RIGHT_WIDTH,
      y: this.y,
      w: CREATE_AREA_RIGHT_WIDTH,
      h: this.h
    };
  }


  /**
   * Update playback state and compute current values
   * @param {number} deltaTime - Time since last update in ms
   */
  update(deltaTime) {
    super.update(deltaTime);
    
    if (!this.playing) {
      // Update port states even when not playing
      this._updatePortStates();
      return;
    }
    
    // Update playback progress
    const elapsed = performance.now() - this.playStartTime;
    const segmentProgress = clamp(elapsed / this.remainingDurationMs, 0, 1);
    this.playProgress = clamp(this.startProgress + segmentProgress * (1 - this.startProgress), 0, 1);
    
    // Update visual playhead position
    const { gx, gw } = this.getGraphRect();
    this.playheadX = gx + gw * this.playProgress;
    
    // Update trigger port states and check for firing
    this._updateTriggerPorts();
    
    // Update port states (flash timing, etc.)
    this._updatePortStates();
    
    // Check if playback is complete
    if (this.playProgress >= 1.0) {
      this.stopPlayback();
      this.emit('playback-complete', { node: this });
    }
  }

  /**
   * Get current waveform value at playback position
   * @returns {number} Value between 0 and 1
   */
  getCurrentValue() {
    return this.valueAt(this.playProgress);
  }

  /**
   * Get waveform value at normalized position
   * @param {number} t - Normalized position (0-1)
   * @returns {number} Value between 0 and 1
   */
  valueAt(t) {
    const normalizedT = clamp(t, 0, 1);
    const n = this.samples.length;
    const pos = normalizedT * (n - 1);
    const i = Math.floor(pos);
    const f = pos - i;
    
    const a = this.samples[i];
    const b = this.samples[Math.min(i + 1, n - 1)];
    
    return a + (b - a) * f;
  }

  /**
   * Send current MIDI CC value
   * @param {object} midiManager - MIDI manager instance
   */
  sendCurrentCC(midiManager) {
    if (!this.playing || !midiManager || !midiManager.ready) return;
    
    const currentValue = this.getCurrentValue();
    const ccValue = clamp(Math.round(currentValue * CC_MAX_VALUE), 0, CC_MAX_VALUE);
    
    if (ccValue !== this.lastCCSent) {
      midiManager.sendCC(this.cc, ccValue);
      this.lastCCSent = ccValue;
      
      this.emit('cc-sent', {
        node: this,
        cc: this.cc,
        value: ccValue,
        normalizedValue: currentValue
      });
    }
  }

  /**
   * Set waveform samples
   * @param {number[]} newSamples - Array of values between 0 and 1
   */
  setSamples(newSamples) {
    this.samples = [...newSamples];
    this.durationMs = this._computeRunDuration();
    
    this.emit('samples-changed', {
      node: this,
      samples: this.samples
    });
  }

  /**
   * Set CC number
   * @param {number} ccNumber - CC number (0-127)
   */
  setCC(ccNumber) {
    const newCC = clamp(ccNumber, 0, 127);
    if (this.cc !== newCC) {
      this.cc = newCC;
      this.label = `CC ${this.cc}`;
      
      this.emit('cc-changed', {
        node: this,
        cc: this.cc
      });
    }
  }

  /**
   * Set source device name for display
   * @param {string} deviceName - Source device name
   */
  setSourceDeviceName(deviceName) {
    this.sourceDeviceName = deviceName || '';
    
    this.emit('source-changed', {
      node: this,
      sourceName: this.sourceDeviceName
    });
  }

  /**
   * Generate new waveform
   * @param {string} type - Waveform type ('sine', 'sawtooth', 'random')
   * @param {number} samples - Number of samples (optional)
   */
  generateWaveform(type = 'sine', samples = null) {
    const numSamples = samples || this.samples.length;
    
    let newSamples;
    switch (type) {
      case 'sawtooth':
      case 'saw':
        newSamples = generateSawtooth(numSamples);
        break;
      case 'random':
        newSamples = generateRandomSmooth(numSamples);
        break;
      case 'sine':
      default:
        newSamples = generateSine(numSamples);
        break;
    }
    
    this.setSamples(newSamples);
  }

  /**
   * Override size setting to update duration
   */
  setSize(width, height) {
    super.setSize(width, height);
    this.durationMs = this._computeRunDuration();
  }

  /**
   * Create a deep copy of this waveform node
   */
  clone() {
    const cloned = new WaveformNode(
      this.x + 20,
      this.y + 20,
      this.label,
      [...this.samples],
      this.w
    );
    
    cloned.cc = this.cc;
    cloned.sourceDeviceName = this.sourceDeviceName;
    
    return cloned;
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      ...super.toJSON(),
      samples: this.samples,
      cc: this.cc,
      sourceDeviceName: this.sourceDeviceName,
      durationMs: this.durationMs
    };
  }

  /**
   * Restore from JSON
   */
  static fromJSON(data) {
    const node = new WaveformNode(
      data.x,
      data.y,
      data.label,
      data.samples,
      data.w
    );
    
    node.id = data.id;
    node.cc = data.cc || 1;
    node.sourceDeviceName = data.sourceDeviceName || '';
    node.createdAt = data.createdAt || Date.now();
    
    return node;
  }

  /**
   * Add a vertical trigger at the specified mouse X position
   * @param {number} mouseX - Mouse X coordinate
   * @returns {VTrigger} Created trigger
   */
  addVTriggerAtMouse(mouseX) {
    const { gx, gw } = this.getGraphRect();
    const clampedX = clamp(mouseX, gx, gx + gw);
    const u = (clampedX - gx) / gw;
    
    const trigger = new VTrigger(this, u);
    this.vTriggers.push(trigger);
    
    this.emit('vtrigger-added', {
      node: this,
      trigger: trigger,
      index: this.vTriggers.length - 1
    });
    
    return trigger;
  }

  /**
   * Add a horizontal trigger at the specified mouse Y position
   * @param {number} mouseY - Mouse Y coordinate  
   * @returns {HTrigger} Created trigger
   */
  addHTriggerAtMouse(mouseY) {
    const { gy, gh } = this.getGraphRect();
    const clampedY = clamp(mouseY, gy, gy + gh);
    const v = (clampedY - gy) / gh;
    
    const trigger = new HTrigger(this, v);
    this.hTriggers.push(trigger);
    
    this.emit('htrigger-added', {
      node: this,
      trigger: trigger,
      index: this.hTriggers.length - 1
    });
    
    return trigger;
  }

  /**
   * Remove a vertical trigger by index
   * @param {number} index - Trigger index
   */
  removeVTrigger(index) {
    if (index >= 0 && index < this.vTriggers.length) {
      const trigger = this.vTriggers[index];
      this.vTriggers.splice(index, 1);
      
      this.emit('vtrigger-removed', {
        node: this,
        trigger: trigger,
        index: index
      });
    }
  }

  /**
   * Remove a horizontal trigger by index
   * @param {number} index - Trigger index
   */
  removeHTrigger(index) {
    if (index >= 0 && index < this.hTriggers.length) {
      const trigger = this.hTriggers[index];
      this.hTriggers.splice(index, 1);
      
      this.emit('htrigger-removed', {
        node: this,
        trigger: trigger,
        index: index
      });
    }
  }

  /**
   * Find closest vertical trigger to mouse position
   * @param {number} mouseX - Mouse X coordinate
   * @param {number} mouseY - Mouse Y coordinate
   * @param {number} threshold - Distance threshold
   * @returns {object|null} {trigger, index, distance} or null
   */
  findClosestVTrigger(mouseX, mouseY, threshold = 8) {
    let closest = null;
    let minDistance = threshold;
    
    for (let i = 0; i < this.vTriggers.length; i++) {
      const trigger = this.vTriggers[i];
      const distance = trigger.distanceTo(mouseX, mouseY);
      
      if (distance < minDistance) {
        minDistance = distance;
        closest = {
          trigger: trigger,
          index: i,
          distance: distance
        };
      }
    }
    
    return closest;
  }

  /**
   * Find closest horizontal trigger to mouse position
   * @param {number} mouseX - Mouse X coordinate
   * @param {number} mouseY - Mouse Y coordinate
   * @param {number} threshold - Distance threshold
   * @returns {object|null} {trigger, index, distance} or null
   */
  findClosestHTrigger(mouseX, mouseY, threshold = 8) {
    let closest = null;
    let minDistance = threshold;
    
    for (let i = 0; i < this.hTriggers.length; i++) {
      const trigger = this.hTriggers[i];
      const distance = trigger.distanceTo(mouseX, mouseY);
      
      if (distance < minDistance) {
        minDistance = distance;
        closest = {
          trigger: trigger,
          index: i,
          distance: distance
        };
      }
    }
    
    return closest;
  }

  /**
   * Get all triggers for rendering
   * @returns {object} {vTriggers, hTriggers}
   */
  getAllTriggers() {
    return {
      vTriggers: this.vTriggers,
      hTriggers: this.hTriggers
    };
  }

  /**
   * Reset playback state for triggers
   */
  startPlayback() {
    if (this.playing) return;
    
    super.startPlayback();
    
    this.playProgress = 0;
    this.startProgress = 0;
    this.remainingDurationMs = this.durationMs;
    this.lastCCSent = -1;
    
    // Reset trigger tracking
    this._vTriggersHitThisPlayback.clear();
    for (const hTrigger of this.hTriggers) {
      hTrigger.resetCrossingState();
    }
    
    this.emit('waveform-playback-started', {
      node: this,
      startProgress: this.startProgress
    });
  }

  /**
   * Start playback from specific position with trigger state
   */
  startPlaybackFromU(u) {
    if (this.playing) this.stopPlayback();
    
    const normalizedU = clamp(u, 0, 1);
    
    super.startPlayback();
    
    this.playProgress = normalizedU;
    this.startProgress = normalizedU;
    this.remainingDurationMs = Math.max(1, (1 - normalizedU) * this.durationMs);
    this.lastCCSent = -1;
    
    // Mark all V triggers before start position as already hit
    this._vTriggersHitThisPlayback.clear();
    for (let i = 0; i < this.vTriggers.length; i++) {
      if (this.vTriggers[i].u <= normalizedU) {
        this._vTriggersHitThisPlayback.add(i);
      }
    }
    
    // Reset H trigger crossing state
    for (const hTrigger of this.hTriggers) {
      hTrigger.resetCrossingState();
    }
    
    this.emit('waveform-playback-started', {
      node: this,
      startProgress: this.startProgress
    });
  }

  /**
   * Update trigger ports during playback
   * @private
   */
  _updateTriggerPorts() {
    if (!this.playing) return;
    
    // Check VTrigger output port firing
    // IMPORTANT: Allow repeated firing like monolithic script - remove the "already fired" restriction
    for (let i = 0; i < this.vTriggers.length; i++) {
      const trigger = this.vTriggers[i];
      
      // Fire every time the playhead reaches or passes this trigger position
      // Remove the restriction: !this._vTriggersHitThisPlayback.has(i)
      if (this.playProgress >= trigger.u) {
        // Only fire if we haven't fired at this exact position yet (prevent multiple fires at same frame)
        const wasAlreadyFiredThisFrame = this._vTriggersHitThisPlayback.has(i);
        
        if (!wasAlreadyFiredThisFrame) {
          trigger.fireOutputPort();
          this._vTriggersHitThisPlayback.add(i);
          console.log(`VTrigger output fired at u=${trigger.u.toFixed(3)} during playback`);
        }
      } else {
        // Reset the "fired this frame" flag when playhead is before the trigger
        // This allows the trigger to fire again when playhead crosses it again
        this._vTriggersHitThisPlayback.delete(i);
      }
    }
    
    // Check HTrigger crossing events
    const currentValue = this.getCurrentValue();
    for (const trigger of this.hTriggers) {
      const crossing = trigger.checkCrossing(currentValue);
      if (crossing) {
        if (crossing.type === 'up') {
          trigger.fireUpPort();
          console.log(`HTrigger up crossing fired at threshold=${crossing.threshold.toFixed(3)}`);
        } else if (crossing.type === 'down') {
          trigger.fireDownPort();
          console.log(`HTrigger down crossing fired at threshold=${crossing.threshold.toFixed(3)}`);
        }
      }
    }
  }

  /**
   * Update port states (flash timing, etc.)
   * @private
   */
  _updatePortStates() {
    // Update VTrigger port states
    for (const trigger of this.vTriggers) {
      if (trigger.updatePortState) {
        trigger.updatePortState();
      }
    }
    
    // Update HTrigger port states
    for (const trigger of this.hTriggers) {
      if (trigger.updatePortState) {
        trigger.updatePortState();
      }
    }
  }

  /**
   * Get display header for this node
   */
  getDisplayHeader() {
    if (this.sourceDeviceName && this.sourceDeviceName.length) {
      return `${this.sourceDeviceName} ▸ ${this.label}`;
    }
    return this.label;
  }

  /**
   * Split node at normalized position u
   * Creates two new nodes with appropriately distributed triggers and waveform data
   * @param {number} u - Normalized position (0-1) where to split
   * @returns {object|null} {leftNode, rightNode, portMap} or null if split not valid
   */
  splitAtU(u) {
    const normalizedU = clamp(u, 0, 1);
    
    // Don't split too close to edges (minimum 2% from each edge)
    const EPS = 0.02;
    if (normalizedU <= EPS || normalizedU >= 1 - EPS) {
      console.log(`Split rejected: u=${normalizedU.toFixed(3)} too close to edge`);
      return null;
    }

    // Split waveform samples
    const { left: leftSamples, right: rightSamples } = this._splitSamplesAtU(normalizedU);
    
    // Calculate new node widths based on split ratio - proportional to original width
    const leftWidth = Math.max(2, Math.round(this.w * normalizedU));
    const rightWidth = Math.max(2, this.w - leftWidth);

    // Create left node
    const leftNode = new WaveformNode(
      this.x,
      this.y,
      this.label,
      leftSamples,
      leftWidth
    );
    leftNode.cc = this.cc;
    leftNode.sourceDeviceName = this.sourceDeviceName;

    // Create right node (positioned adjacent to left)
    const rightNode = new WaveformNode(
      this.x + leftWidth,
      this.y,
      this.label,
      rightSamples,
      rightWidth
    );
    rightNode.cc = this.cc;
    rightNode.sourceDeviceName = this.sourceDeviceName;

    // Create port mapping for connection remapping
    const portMap = new Map();

    // Distribute VTriggers based on position
    for (const oldTrigger of this.vTriggers) {
      if (oldTrigger.u < normalizedU) {
        // Trigger goes to left node - rescale u position
        const newU = (normalizedU === 0) ? 0 : (oldTrigger.u / normalizedU);
        const newTrigger = new VTrigger(leftNode, clamp(newU, 0, 1));
        leftNode.vTriggers.push(newTrigger);
        
        // Map old ports to new ports
        portMap.set(oldTrigger.portInput, newTrigger.portInput);
        portMap.set(oldTrigger.portOutput, newTrigger.portOutput);
      } else if (oldTrigger.u > normalizedU) {
        // Trigger goes to right node - rescale u position
        const newU = (oldTrigger.u - normalizedU) / (1 - normalizedU);
        const newTrigger = new VTrigger(rightNode, clamp(newU, 0, 1));
        rightNode.vTriggers.push(newTrigger);
        
        // Map old ports to new ports
        portMap.set(oldTrigger.portInput, newTrigger.portInput);
        portMap.set(oldTrigger.portOutput, newTrigger.portOutput);
      } else {
        // Trigger exactly at split - duplicate to BOTH nodes
        const leftTrigger = new VTrigger(leftNode, 1.0); // At right edge of left node
        const rightTrigger = new VTrigger(rightNode, 0.0); // At left edge of right node
        leftNode.vTriggers.push(leftTrigger);
        rightNode.vTriggers.push(rightTrigger);
        
        // Map old ports to BOTH new ports (connections will be duplicated)
        portMap.set(oldTrigger.portInput, [leftTrigger.portInput, rightTrigger.portInput]);
        portMap.set(oldTrigger.portOutput, [leftTrigger.portOutput, rightTrigger.portOutput]);
      }
    }

    // Duplicate ALL HTriggers to both nodes (full copy)
    for (const oldTrigger of this.hTriggers) {
      const leftTrigger = new HTrigger(leftNode, oldTrigger.v);
      const rightTrigger = new HTrigger(rightNode, oldTrigger.v);
      leftNode.hTriggers.push(leftTrigger);
      rightNode.hTriggers.push(rightTrigger);
      
      // Map old ports to BOTH new ports (connections will be duplicated)
      portMap.set(oldTrigger.portUp, [leftTrigger.portUp, rightTrigger.portUp]);
      portMap.set(oldTrigger.portDown, [leftTrigger.portDown, rightTrigger.portDown]);
    }

    console.log(`Split node "${this.label}" at u=${normalizedU.toFixed(3)}`);
    console.log(`- Left: ${leftNode.vTriggers.length} VTriggers, ${leftNode.hTriggers.length} HTriggers`);
    console.log(`- Right: ${rightNode.vTriggers.length} VTriggers, ${rightNode.hTriggers.length} HTriggers`);

    return {
      leftNode,
      rightNode,
      portMap,
      splitU: normalizedU
    };
  }

  /**
   * Split waveform samples at normalized position u
   * @param {number} u - Normalized position (0-1)
   * @returns {object} {left: Array, right: Array}
   * @private
   */
  _splitSamplesAtU(u) {
    const n = Math.max(2, this.samples.length);
    const pos = clamp(u, 0, 1) * (n - 1);
    const i = Math.floor(pos);
    const j = Math.min(i + 1, n - 1);
    const f = pos - i;
    
    // Interpolate value at split point
    const vSplit = this.samples[i] + (this.samples[j] - this.samples[i]) * f;

    // Create left samples: original up to i, plus interpolated split point
    const left = this.samples.slice(0, i + 1);
    left.push(vSplit);
    
    // Create right samples: interpolated split point, plus remaining original
    const right = [vSplit, ...this.samples.slice(j)];

    // Ensure minimum 2 samples per side
    if (left.length < 2) left.push(left[left.length - 1]);
    if (right.length < 2) right.unshift(right[0]);

    return { left, right };
  }
}
