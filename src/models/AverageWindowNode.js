/**
 * AverageWindowNode - Simplified averaging node with resizable width
 * Extends Node with left edge resize capability
 * Pure model - no rendering logic
 */

import Node from './Node.js';
import Port from './Port.js';
import { 
  AVERAGE_WINDOW_DEFAULT_WIDTH,
  AVERAGE_WINDOW_MIN_WIDTH,
  AVERAGE_WINDOW_HEIGHT,
  AVERAGE_WINDOW_LABEL_PLACEHOLDER
} from '../config/constants.js';
import { clamp } from '../utils/geometry.js';

export default class AverageWindowNode extends Node {
  constructor(x = 0, y = 0, width = AVERAGE_WINDOW_DEFAULT_WIDTH) {
    super(x, y, AVERAGE_WINDOW_LABEL_PLACEHOLDER);
    
    // Fixed height, variable width
    this.w = Math.max(width, AVERAGE_WINDOW_MIN_WIDTH);
    this.h = AVERAGE_WINDOW_HEIGHT;
    
    // Source selection (null = no source selected)
    this.selectedSource = null; // { deviceId, deviceName, cc }
    
    // Circular buffer for averaging (size = width)
    this.buffer = new Array(this.w).fill(0.5);
    this.bufferIndex = 0; // Current write position
    
    // Real-time scrolling tracking
    this.lastReceivedValue = 0.5; // Last normalized value
    this.fractionalPixels = 0; // Sub-pixel accumulation for smooth scrolling
    
    // Current average value
    this.currentAverage = 0.5; // Normalized (0-1)
    
    // No triggers for simplified version
    this.vTriggers = [];
    this.hTriggers = [];
    
    // Diamond-shaped CC ports for continuous value streaming
    this.ccInputPort = new Port(this, 'ccInput', 'in');
    this.ccOutputPort = new Port(this, 'ccOutput', 'out');
  }

  /**
   * Set node width (adjusts buffer size)
   * @param {number} newWidth - New width in pixels
   */
  setWidth(newWidth) {
    // ROBUST VALIDATION - ensure valid positive integer
    // Handle NaN, negative, non-finite, and fractional values
    const clampedWidth = Math.max(
      Math.floor(Math.abs(newWidth || AVERAGE_WINDOW_MIN_WIDTH)), 
      AVERAGE_WINDOW_MIN_WIDTH
    );
    
    // Additional safety check for finite numbers
    if (!isFinite(clampedWidth)) {
      console.warn('AverageWindowNode.setWidth: Invalid width value, keeping current width');
      return;
    }
    
    if (clampedWidth === this.w) return;
    
    const oldBuffer = this.buffer;
    const oldWidth = this.w;
    
    // Update width
    this.w = clampedWidth;
    
    // Rebuild buffer with new size
    this.buffer = new Array(this.w).fill(0.5);
    
    // Copy old values to new buffer (as many as fit)
    const copyCount = Math.min(oldWidth, this.w);
    for (let i = 0; i < copyCount; i++) {
      const oldIndex = (this.bufferIndex - copyCount + i + oldWidth) % oldWidth;
      this.buffer[i] = oldBuffer[oldIndex];
    }
    
    // Reset buffer index
    this.bufferIndex = copyCount % this.w;
    
    // Recalculate average with new buffer
    this._calculateAverage();
    
    this.emit('width-changed', {
      node: this,
      oldWidth: oldWidth,
      newWidth: this.w
    });
    
    console.log(`AverageWindowNode: Width changed from ${oldWidth}px to ${this.w}px`);
  }

  /**
   * Update node state
   * @param {number} deltaTime - Time since last update in ms
   */
  update(deltaTime) {
    super.update(deltaTime);
    
    // Check if data is being received (within last 500ms)
    const now = performance.now();
    const isReceivingData = (now - (this.lastDataTime || 0)) < 500;
    
    // Time-based buffer advancement for smooth scrolling at PIXELS_PER_SECOND
    // Runs when: (1) selectedSource exists (MIDI), OR (2) receiving input data
    if (this.selectedSource || isReceivingData) {
      this._advanceBuffer(deltaTime);
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
      const normalizedValue = clamp(ccData.value / 127, 0, 1);
      
      // Write new value to CURRENT buffer position (don't increment here)
      // The buffer advancement is handled solely by _advanceBuffer() based on time
      this.buffer[this.bufferIndex] = normalizedValue;
      
      // Track last received data (but don't advance bufferIndex)
      this.lastReceivedValue = normalizedValue;
      
      // Recalculate average
      this._calculateAverage();
      
      // Update label to show current average
      this.label = `${this.selectedSource.deviceName} > CC ${this.selectedSource.cc} (AVG: ${(this.currentAverage * 127).toFixed(0)})`;
      
      // Emit event for potential subscribers
      this.emit('cc-data-received', {
        node: this,
        value: normalizedValue,
        average: this.currentAverage,
        rawValue: ccData.value,
        cc: ccData.cc
      });
    }
  }

  /**
   * Set the MIDI source for this average window
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
    this.currentAverage = 0.5;
    
    this.emit('source-changed', {
      node: this,
      source: this.selectedSource
    });
    
    console.log(`AverageWindowNode: Source set to "${deviceName} > CC ${cc}"`);
  }

  /**
   * Clear the selected source
   */
  clearSource() {
    this.selectedSource = null;
    this.label = AVERAGE_WINDOW_LABEL_PLACEHOLDER;
    this.buffer.fill(0.5);
    this.bufferIndex = 0;
    this.currentAverage = 0.5;
    
    this.emit('source-cleared', { node: this });
    
    console.log('AverageWindowNode: Source cleared');
  }

  /**
   * Advance buffer based on elapsed time for smooth scrolling
   * Fills intermediate positions with last value for continuous line
   * @param {number} deltaTime - Time since last update in ms
   * @private
   */
  _advanceBuffer(deltaTime) {
    // Import PIXELS_PER_SECOND dynamically to avoid circular deps
    const PIXELS_PER_SECOND = 100; // Same as oscilloscope and waveform playback
    
    // Calculate how many pixels to advance (fractional)
    const pixelsToAdvance = (deltaTime / 1000) * PIXELS_PER_SECOND;
    
    this.fractionalPixels += pixelsToAdvance;
    
    // Advance buffer by whole pixels
    const wholePixels = Math.floor(this.fractionalPixels);
    if (wholePixels > 0) {
      // Fill intermediate positions with last value for continuous line
      for (let i = 0; i < wholePixels; i++) {
        this.buffer[this.bufferIndex] = this.lastReceivedValue;
        this.bufferIndex = (this.bufferIndex + 1) % this.w;
      }
      
      // Subtract whole pixels from fractional accumulator
      this.fractionalPixels -= wholePixels;
      
      // Recalculate average after buffer advancement
      this._calculateAverage();
    }
  }

  /**
   * Calculate current average of buffer
   * @private
   */
  _calculateAverage() {
    let sum = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      sum += this.buffer[i];
    }
    this.currentAverage = sum / this.buffer.length;
  }

  /**
   * Get current average value (0-1)
   */
  getAverageValue() {
    return this.currentAverage;
  }

  /**
   * Get current CC value for output port (0-127)
   * Called by Connection.propagateContinuousValue()
   */
  getCurrentCCValue() {
    return Math.round(this.currentAverage * 127);
  }

  /**
   * Receive input value from connected input port (0-127)
   * Called by Connection.propagateContinuousValue()
   */
  receiveInputValue(ccValue) {
    const normalizedValue = ccValue / 127; // Convert 0-127 → 0-1
    
    // Only update lastReceivedValue - buffer writing happens in _advanceBuffer()
    // This ensures smooth right-to-left scrolling at PIXELS_PER_SECOND (100px/sec)
    this.lastReceivedValue = normalizedValue;
    this.lastDataTime = performance.now(); // Track when data was received
    
    // Recalculate average (based on current buffer state)
    this._calculateAverage();
  }

  /**
   * Get CC input port position (left edge, center)
   */
  getCCInputPortPosition() {
    return {
      x: this.x,
      y: this.y + this.h / 2
    };
  }

  /**
   * Get CC output port position (right edge, center)
   */
  getCCOutputPortPosition() {
    return {
      x: this.x + this.w,
      y: this.y + this.h / 2
    };
  }

  /**
   * Get left resize area rectangle
   */
  getLeftResizeRect() {
    // Import at top level, so use constant directly
    return {
      x: this.x,
      y: this.y,
      w: 13, // AVERAGE_WINDOW_LEFT_EDGE_WIDTH constant value
      h: this.h
    };
  }

  /**
   * Get top create area - DISABLED for average window
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
   * Get right create area - DISABLED for average window
   */
  getRightCreateRect() {
    return {
      x: 0,
      y: 0,
      w: 0,
      h: 0
    };
  }

  /**
   * Get all triggers (empty for average window)
   */
  getAllTriggers() {
    return {
      vTriggers: [],
      hTriggers: []
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
      type: 'average_window',
      width: this.w,
      selectedSource: this.selectedSource,
      buffer: this.buffer,
      currentAverage: this.currentAverage
    };
  }

  /**
   * Restore from JSON
   */
  static fromJSON(data) {
    const node = new AverageWindowNode(data.x, data.y, data.width || AVERAGE_WINDOW_DEFAULT_WIDTH);
    
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
    
    // Restore buffer if available
    if (data.buffer && Array.isArray(data.buffer)) {
      node.buffer = [...data.buffer];
    }
    
    // Restore average
    if (typeof data.currentAverage === 'number') {
      node.currentAverage = data.currentAverage;
    }
    
    return node;
  }
}
