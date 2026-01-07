/**
 * OscilloscopeNode - Real-time MIDI CC oscilloscope visualization
 * Extends Node with live CC data display using circular buffer
 * Right-to-left scrolling visualization at 100px/sec
 * Pure model - no rendering logic
 */

import Node from './Node.js';
import HTrigger from './HTrigger.js';
import Port from './Port.js';
import { 
  OSCILLOSCOPE_BUFFER_WIDTH, 
  OSCILLOSCOPE_DEFAULT_HEIGHT,
  OSCILLOSCOPE_LABEL_PLACEHOLDER,
  CREATE_AREA_RIGHT_WIDTH,
  CC_MAX_VALUE,
  PIXELS_PER_SECOND,
  COLOR_PICKER_DEFAULT_HUE
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
    
    // Diamond-shaped CC input port (left edge, vertically centered)
    // When connected, this port receives CC values and overrides dropdown source
    this.ccInputPort = new Port(this, 'ccInput', 'in');
    
    // Diamond-shaped CC output port (right edge, vertically centered)
    // This port continuously outputs the current CC value to connected ports
    this.ccOutputPort = new Port(this, 'ccOutput', 'out');
    
    // Track if input port is connected (overrides dropdown source)
    this.inputConnected = false;
    
    // Live indicator state
    this.lastDataTime = 0;
    this.isReceivingData = false;
    
    // Waveform color customization
    this.waveformHue = COLOR_PICKER_DEFAULT_HUE; // Default orange (30°)
  }

  /**
   * Set waveform hue (0-360 degrees)
   * @param {number} hue - Hue value in degrees
   */
  setWaveformHue(hue) {
    this.waveformHue = clamp(hue, 0, 360);
    
    this.emit('waveform-color-changed', {
      node: this,
      hue: this.waveformHue
    });
  }

  /**
   * Get waveform color as RGB array for rendering
   * Converts HSB (hue, 100%, 100%) to RGB
   * @returns {number[]} RGB color array [r, g, b]
   */
  getWaveformColor() {
    // Fallback HSB to RGB conversion (hue in degrees, S=100%, B=100%)
    const h = this.waveformHue / 60;
    const c = 255; // Chroma (full brightness, full saturation)
    const x = c * (1 - Math.abs((h % 2) - 1));
    const m = 0;
    
    let r, g, b;
    if (h >= 0 && h < 1) { r = c; g = x; b = 0; }
    else if (h >= 1 && h < 2) { r = x; g = c; b = 0; }
    else if (h >= 2 && h < 3) { r = 0; g = c; b = x; }
    else if (h >= 3 && h < 4) { r = 0; g = x; b = c; }
    else if (h >= 4 && h < 5) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    
    return [r + m, g + m, b + m];
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
    // Runs when: (1) selectedSource exists (MIDI), OR (2) receiving input data
    if (this.selectedSource || this.isReceivingData) {
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
   * Get diamond CC input port position
   * Port is positioned on the left edge, vertically centered
   * @returns {object} {x, y} position
   */
  getCCInputPortPosition() {
    return {
      x: this.x,
      y: this.y + this.h / 2
    };
  }

  /**
   * Get diamond CC output port position
   * Port is positioned on the right edge, vertically centered
   * @returns {object} {x, y} position
   */
  getCCOutputPortPosition() {
    return {
      x: this.x + this.w,
      y: this.y + this.h / 2
    };
  }

  /**
   * Check if input port is connected
   * @returns {boolean} True if input port has connections
   */
  hasInputConnection() {
    return this.inputConnected;
  }

  /**
   * Set input connection state
   * Called by connection system when connections are made/removed
   * @param {boolean} connected - Whether input is connected
   */
  setInputConnectionState(connected) {
    this.inputConnected = connected;
    
    if (connected) {
      console.log('OscilloscopeNode: Input port connected - dropdown source overridden');
    } else {
      console.log('OscilloscopeNode: Input port disconnected - reverting to dropdown source');
    }
    
    this.emit('input-connection-changed', {
      node: this,
      connected: connected
    });
  }

  /**
   * Receive CC value from connected input port
   * This overrides the dropdown source while input is connected
   * @param {number} ccValue - CC value (0-127)
   */
  receiveInputValue(ccValue) {
    // Normalize CC value (0-127 → 0-1)
    const normalizedValue = clamp(ccValue / CC_MAX_VALUE, 0, 1);
    
    // Only update lastReceivedValue - buffer writing happens in _advanceBuffer()
    // This ensures smooth right-to-left scrolling at PIXELS_PER_SECOND (100px/sec)
    this.lastReceivedValue = normalizedValue;
    this.lastDataTime = performance.now();
    
    this.emit('input-value-received', {
      node: this,
      value: normalizedValue,
      rawValue: ccValue
    });
  }

  /**
   * Get current CC value as integer (0-127)
   * This value is continuously available for connected diamond output ports
   * @returns {number} Current CC value (0-127)
   */
  getCurrentCCValue() {
    // Convert normalized value (0-1) back to CC range (0-127)
    return Math.round(this.lastReceivedValue * CC_MAX_VALUE);
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
   * Returns empty string when input port is connected (hides label)
   */
  getDisplayHeader() {
    // Hide label when input port is connected
    if (this.inputConnected) {
      return '';
    }
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
      waveformHue: this.waveformHue,
      hTriggers: this.hTriggers.map(t => t.toJSON()),
      ccInputPort: this.ccInputPort.toJSON(), // Include input diamond port
      ccOutputPort: this.ccOutputPort.toJSON(), // Include output diamond port
      inputConnected: this.inputConnected
    };
  }

  /**
   * Restore from JSON
   */
  static fromJSON(data) {
    const node = new OscilloscopeNode(data.x, data.y);
    
    node.id = data.id;
    node.createdAt = data.createdAt || Date.now();
    
    // Restore waveform color (with fallback to default)
    node.waveformHue = data.waveformHue !== undefined ? data.waveformHue : COLOR_PICKER_DEFAULT_HUE;
    
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
    
    // ccOutputPort is automatically created in constructor
    // No need to restore it from JSON
    
    return node;
  }
}
