/**
 * OscilloscopeNode - Real-time MIDI CC oscilloscope visualization
 * Extends Node with live CC data display using circular buffer
 * Right-to-left scrolling visualization at 100px/sec
 * Pure model - no rendering logic
 */

import Node from './Node.js';
import HTrigger from './HTrigger.js';
import { 
  OSCILLOSCOPE_BUFFER_WIDTH, 
  OSCILLOSCOPE_DEFAULT_HEIGHT,
  OSCILLOSCOPE_LABEL_PLACEHOLDER,
  CREATE_AREA_RIGHT_WIDTH,
  CC_MAX_VALUE,
  PIXELS_PER_SECOND
} from '../config/constants.js';
import { clamp } from '../utils/geometry.js';

export default class OscilloscopeNode extends Node {
  constructor(x = 0, y = 0) {
    super(x, y, OSCILLOSCOPE_LABEL_PLACEHOLDER);
    
    // Override dimensions for oscilloscope
    this.w = OSCILLOSCOPE_BUFFER_WIDTH;
    this.h = OSCILLOSCOPE_DEFAULT_HEIGHT;
    
    // Source selection (null = no source selected)
    this.selectedSource = null; // { deviceId, deviceName, cc }
    
    // Circular buffer for live data (200 samples = 2 seconds at 100px/sec)
    this.buffer = new Array(OSCILLOSCOPE_BUFFER_WIDTH).fill(0.5);
    this.bufferIndex = 0; // Current write position (oldest data)
    
    // Real-time update tracking
    this.lastUpdateTime = performance.now();
    this.lastReceivedValue = 0.5; // Last normalized value
    
    // HTriggers only (no VTriggers for oscilloscope)
    this.hTriggers = [];
    
    // Live indicator state
    this.lastDataTime = 0;
    this.isReceivingData = false;
  }

  /**
   * Update oscilloscope state
   * @param {number} deltaTime - Time since last update in ms
   */
  update(deltaTime) {
    super.update(deltaTime);
    
    // Check if data is being received (within last 500ms)
    const now = performance.now();
    this.isReceivingData = (now - this.lastDataTime) < 500;
    
    // Time-based buffer advancement for smooth scrolling at PIXELS_PER_SECOND
    // This ensures the graph scrolls at the same speed as WaveformNode playback
    if (this.selectedSource) {
      this._advanceBuffer(deltaTime);
    }
    
    // Update HTrigger port states
    this._updatePortStates();
    
    // Check HTrigger crossings in real-time
    if (this.hTriggers.length > 0) {
      this._checkHTriggerCrossings();
    }
  }

  /**
   * Handle incoming MIDI CC data
   * Called by AppController when MIDI CC message received
   * @param {object} ccData - CC data from MidiManager
   */
  onCCReceived(ccData) {
    // Only process if we have a selected source
    if (!this.selectedSource) {
      return;
    }
    
    // Check if this CC matches our selected source
    const matchesDevice = (ccData.source.id === this.selectedSource.deviceId);
    const matchesCC = (ccData.cc === this.selectedSource.cc);
    
    if (matchesDevice && matchesCC) {
      // Normalize CC value (0-127 → 0-1)
      const normalizedValue = clamp(ccData.value / CC_MAX_VALUE, 0, 1);
      
      // Write new value to CURRENT buffer position (don't increment here)
      // The buffer advancement is handled solely by _advanceBuffer() based on time
      this.buffer[this.bufferIndex] = normalizedValue;
      
      // Track last received data (but don't advance bufferIndex)
      this.lastReceivedValue = normalizedValue;
      this.lastDataTime = performance.now();
      
      // Emit event for potential subscribers
      this.emit('cc-data-received', {
        node: this,
        value: normalizedValue,
        rawValue: ccData.value,
        cc: ccData.cc
      });
    }
  }

  /**
   * Set the MIDI source for this oscilloscope
   * @param {string} deviceId - MIDI device ID
   * @param {string} deviceName - Human-readable device name
   * @param {number} cc - CC number (0-127)
   */
  setSource(deviceId, deviceName, cc) {
    this.selectedSource = {
      deviceId: deviceId,
      deviceName: deviceName,
      cc: clamp(cc, 0, 127)
    };
    
    // Update label to show source
    this.label = `${deviceName} > CC ${cc}`;
    
    // Clear buffer when source changes
    this.buffer.fill(0.5);
    this.bufferIndex = 0;
    
    this.emit('source-changed', {
      node: this,
      source: this.selectedSource
    });
    
    console.log(`OscilloscopeNode: Source set to "${deviceName} > CC ${cc}"`);
  }

  /**
   * Clear the selected source
   */
  clearSource() {
    this.selectedSource = null;
    this.label = OSCILLOSCOPE_LABEL_PLACEHOLDER;
    this.buffer.fill(0.5);
    this.bufferIndex = 0;
    
    this.emit('source-cleared', { node: this });
    
    console.log('OscilloscopeNode: Source cleared');
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
   * Get right create area for HTrigger placement
   * Oscilloscopes only support HTriggers (no VTriggers)
   */
  getRightCreateRect() {
    return {
      x: this.x + this.w - CREATE_AREA_RIGHT_WIDTH,
      y: this.y,
      w: CREATE_AREA_RIGHT_WIDTH,
      h: this.h
    };
  }

  /**
   * Get top create area - DISABLED for oscilloscopes
   * VTriggers don't make sense for real-time scrolling data
   */
  getTopCreateRect() {
    return {
      x: 0,
      y: 0,
      w: 0,
      h: 0
    };
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
    
    console.log(`OscilloscopeNode: HTrigger added at v=${v.toFixed(3)}`);
    
    return trigger;
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
      
      console.log(`OscilloscopeNode: HTrigger removed at index ${index}`);
    }
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
   * Advance buffer based on elapsed time for smooth scrolling
   * Fills intermediate positions with last value for continuous line
   * @param {number} deltaTime - Time since last update in ms
   * @private
   */
  _advanceBuffer(deltaTime) {
    // Calculate how many pixels to advance (fractional)
    const pixelsToAdvance = (deltaTime / 1000) * PIXELS_PER_SECOND;
    
    // Track fractional pixels
    if (!this.fractionalPixels) {
      this.fractionalPixels = 0;
    }
    
    this.fractionalPixels += pixelsToAdvance;
    
    // Advance buffer by whole pixels
    const wholePixels = Math.floor(this.fractionalPixels);
    if (wholePixels > 0) {
      // Fill intermediate positions with last value for continuous line
      for (let i = 0; i < wholePixels; i++) {
        this.buffer[this.bufferIndex] = this.lastReceivedValue;
        this.bufferIndex = (this.bufferIndex + 1) % OSCILLOSCOPE_BUFFER_WIDTH;
      }
      
      // Subtract whole pixels from fractional accumulator
      this.fractionalPixels -= wholePixels;
    }
  }

  /**
   * Check HTrigger crossings in real-time
   * @private
   */
  _checkHTriggerCrossings() {
    const currentValue = this.lastReceivedValue;
    
    for (const trigger of this.hTriggers) {
      const crossing = trigger.checkCrossing(currentValue);
      if (crossing) {
        if (crossing.type === 'up') {
          trigger.fireUpPort();
          console.log(`OscilloscopeNode HTrigger up crossing at v=${crossing.threshold.toFixed(3)}`);
        } else if (crossing.type === 'down') {
          trigger.fireDownPort();
          console.log(`OscilloscopeNode HTrigger down crossing at v=${crossing.threshold.toFixed(3)}`);
        }
      }
    }
  }

  /**
   * Update port states (flash timing, etc.)
   * @private
   */
  _updatePortStates() {
    for (const trigger of this.hTriggers) {
      if (trigger.updatePortState) {
        trigger.updatePortState();
      }
    }
  }

  /**
   * Calculate HTrigger crossing positions in the visible sliding window
   * Matches the renderer's sliding window approach for consistency
   * @param {HTrigger} trigger - The trigger to find crossings for
   * @returns {object} {upCrossings: [{x, y}], downCrossings: [{x, y}]}
   */
  getHTriggerCrossings(trigger) {
    const { gx, gy, gw, gh } = this.getGraphRect();
    const buffer = this.buffer;
    const bufferLength = buffer.length;
    const writePos = this.bufferIndex;
    const threshold = trigger.v; // Normalized threshold (0-1, where 0=top, 1=bottom)
    
    const upCrossings = [];
    const downCrossings = [];
    
    // Only scan the visible sliding window (matches renderer)
    const pixelsToShow = Math.min(gw, bufferLength);
    
    // IMPORTANT: Buffer values use inverted coordinate system (0=bottom, 1=top when rendered)
    // HTrigger v uses standard (0=top, 1=bottom)
    // So we need to invert threshold when comparing against buffer values
    const invertedThreshold = 1 - threshold;
    
    // Scan through visible window from oldest to newest
    for (let i = 0; i < pixelsToShow - 1; i++) {
      // Read backwards from write position (same as renderer)
      const bufferPos = (writePos - pixelsToShow + i + bufferLength) % bufferLength;
      const nextBufferPos = (writePos - pixelsToShow + i + 1 + bufferLength) % bufferLength;
      
      const currentValue = buffer[bufferPos];
      const nextValue = buffer[nextBufferPos];
      
      // Check for up crossing (value goes from below to above inverted threshold)
      if (currentValue < invertedThreshold && nextValue >= invertedThreshold) {
        // Linear interpolation to find exact crossing point
        const t = (invertedThreshold - currentValue) / (nextValue - currentValue);
        const crossingX = gx + i + t;
        const crossingY = gy + (1 - invertedThreshold) * gh;
        
        upCrossings.push({ x: crossingX, y: crossingY });
      }
      
      // Check for down crossing (value goes from above to below inverted threshold)
      if (currentValue > invertedThreshold && nextValue <= invertedThreshold) {
        // Linear interpolation to find exact crossing point
        const t = (currentValue - invertedThreshold) / (currentValue - nextValue);
        const crossingX = gx + i + t;
        const crossingY = gy + (1 - invertedThreshold) * gh;
        
        downCrossings.push({ x: crossingX, y: crossingY });
      }
    }
    
    return {
      upCrossings: upCrossings,
      downCrossings: downCrossings
    };
  }

  /**
   * Get all triggers for rendering
   * @returns {object} {hTriggers}
   */
  getAllTriggers() {
    return {
      vTriggers: [], // Oscilloscopes don't have VTriggers
      hTriggers: this.hTriggers
    };
  }

  /**
   * Get display header for this node
   */
  getDisplayHeader() {
    return this.label;
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      ...super.toJSON(),
      type: 'oscilloscope',
      selectedSource: this.selectedSource,
      hTriggers: this.hTriggers.map(t => t.toJSON())
    };
  }

  /**
   * Restore from JSON
   */
  static fromJSON(data) {
    const node = new OscilloscopeNode(data.x, data.y);
    
    node.id = data.id;
    node.createdAt = data.createdAt || Date.now();
    
    // Restore source selection
    if (data.selectedSource) {
      node.setSource(
        data.selectedSource.deviceId,
        data.selectedSource.deviceName,
        data.selectedSource.cc
      );
    }
    
    // Restore HTriggers
    if (data.hTriggers && Array.isArray(data.hTriggers)) {
      node.hTriggers = data.hTriggers.map(triggerData => 
        HTrigger.fromJSON(triggerData, node)
      );
    }
    
    return node;
  }
}
