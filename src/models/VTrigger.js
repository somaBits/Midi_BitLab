/**
 * VTrigger - Vertical trigger for waveform nodes
 * Represents a vertical line trigger that can be positioned within a waveform
 * and can trigger playback from that position
 */

import { clamp } from '../utils/geometry.js';
import Port from './Port.js';

export default class VTrigger {
  constructor(node, uNorm = 0.5) {
    this.node = node;
    this.u = clamp(uNorm, 0, 1); // Normalized position (0-1) within node width
    
    // Visual state
    this.isDragging = false;
    this.isHovered = false;
    
    // Port state (legacy - kept for compatibility)
    this.inputPortHovered = false; // Top port hover state
    this.outputPortTriggered = false; // Bottom port triggered state
    this.flashEndTime = 0; // When flash effect should end
    
    // Trigger identification
    this.id = this._generateId();
    this.type = 'vertical';
    
    // Create separate Port objects (matching HTrigger architecture)
    this.portInput = new Port(this, 'input', 'in');   // Input port (top)
    this.portOutput = new Port(this, 'output', 'out'); // Output port (bottom)
  }

  /**
   * Generate unique ID
   * @private
   */
  _generateId() {
    return `vtrigger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get graph rectangle bounds from parent node
   */
  get graphRect() {
    if (!this.node || typeof this.node.getGraphRect !== 'function') {
      return { gx: 0, gy: 0, gw: 200, gh: 80 };
    }
    return this.node.getGraphRect();
  }

  /**
   * Get X coordinate of this trigger line
   */
  get x() {
    const { gx, gw } = this.graphRect;
    return gx + this.u * gw;
  }

  /**
   * Get top point of trigger line
   */
  topPoint() {
    return {
      x: this.x,
      y: this.node.y
    };
  }

  /**
   * Get center point of trigger line
   */
  centerPoint() {
    return {
      x: this.x,
      y: this.node.y + this.node.h / 2
    };
  }

  /**
   * Get bottom point of trigger line (for output port)
   */
  bottomPoint() {
    return {
      x: this.x,
      y: this.node.y + this.node.h + 20 // Extended for port
    };
  }

  /**
   * Get input port position (top of node)
   */
  getInputPortPosition() {
    return {
      x: this.x,
      y: this.node.y - 20 // Above the node
    };
  }

  /**
   * Get output port position (below node)
   */
  getOutputPortPosition() {
    return {
      x: this.x,
      y: this.node.y + this.node.h + 20
    };
  }

  /**
   * Calculate distance from point to trigger line
   * @param {number} px - Point X
   * @param {number} py - Point Y
   * @returns {number} Distance to line
   */
  distanceTo(px, py) {
    const triggerX = this.x;
    const startY = this.node.y;
    const endY = this.node.y + this.node.h;
    
    // Distance to vertical line segment
    if (py < startY) {
      return Math.hypot(px - triggerX, py - startY);
    } else if (py > endY) {
      return Math.hypot(px - triggerX, py - endY);
    } else {
      return Math.abs(px - triggerX);
    }
  }

  /**
   * Set normalized position from mouse X coordinate
   * @param {number} mouseX - Mouse X coordinate
   */
  setUFromMouseX(mouseX) {
    const { gx, gw } = this.graphRect;
    const clampedX = clamp(mouseX, gx, gx + gw);
    this.u = (clampedX - gx) / gw;
  }

  /**
   * Get Y coordinate where trigger intersects the waveform
   * @returns {number} Y coordinate of intersection
   */
  getWaveformIntersectionY() {
    if (!this.node || typeof this.node.valueAt !== 'function') {
      return this.node.y + this.node.h / 2; // Fallback to center
    }

    const { gx, gy, gw, gh } = this.graphRect;
    const waveformValue = this.node.valueAt(this.u);
    
    // Map waveform value (0-1) to Y coordinate (bottom to top)
    return gy + gh - (waveformValue * gh);
  }

  /**
   * Check if point hits this trigger
   * @param {number} px - Point X
   * @param {number} py - Point Y
   * @param {number} threshold - Hit threshold in pixels
   * @returns {boolean} True if hit
   */
  hits(px, py, threshold = 8) {
    return this.distanceTo(px, py) <= threshold;
  }

  /**
   * Start dragging operation
   */
  startDrag() {
    this.isDragging = true;
  }

  /**
   * End dragging operation
   */
  endDrag() {
    this.isDragging = false;
  }

  /**
   * Set hover state
   * @param {boolean} hovered - Hover state
   */
  setHovered(hovered) {
    this.isHovered = hovered;
  }

  /**
   * Trigger playback from this position
   */
  triggerPlayback() {
    if (this.node && typeof this.node.startPlaybackFromU === 'function') {
      this.node.startPlaybackFromU(this.u);
    }
  }

  /**
   * Check if point hits input port (top port)
   * @param {number} px - Point X
   * @param {number} py - Point Y
   * @param {number} threshold - Hit threshold in pixels
   * @returns {boolean} True if hit
   */
  isInputPortHit(px, py, threshold = 8) {
    const port = this.getInputPortPosition();
    const distance = Math.hypot(px - port.x, py - port.y);
    return distance <= threshold;
  }

  /**
   * Check if point hits output port (bottom port)
   * @param {number} px - Point X
   * @param {number} py - Point Y  
   * @param {number} threshold - Hit threshold in pixels
   * @returns {boolean} True if hit
   */
  isOutputPortHit(px, py, threshold = 8) {
    const port = this.getOutputPortPosition();
    const distance = Math.hypot(px - port.x, py - port.y);
    return distance <= threshold;
  }

  /**
   * Trigger the input port (start playback from this position)
   */
  triggerInputPort() {
    this.triggerPlayback();
    console.log(`VTrigger input port triggered - starting playback from u=${this.u.toFixed(3)}`);
  }

  /**
   * Fire the output port (called when playback reaches this trigger)
   * @param {number} flashDurationMs - Flash duration in milliseconds
   */
  fireOutputPort(flashDurationMs = 220) {
    this.outputPortTriggered = true;
    this.flashEndTime = performance.now() + flashDurationMs;
    console.log(`VTrigger output port fired at u=${this.u.toFixed(3)}`);
    
    // Emit event if node has event system
    if (this.node && typeof this.node.emit === 'function') {
      this.node.emit('vtrigger-output-fired', {
        trigger: this,
        position: this.u
      });
    }
    
    // Propagate trigger through connections
    this._propagateOutputTrigger();
  }

  /**
   * Propagate trigger event through connected cables
   * @private
   */
  _propagateOutputTrigger() {
    // Get the app instance to access connections
    const app = this._getAppInstance();
    if (!app || !app.connections) return;
    
    // Find connections where this output port is involved (using Port objects like HTrigger)
    for (const connection of app.connections) {
      if (connection.portA === this.portOutput) {
        // This output port is connected as source - propagate to the target port
        console.log(`VTrigger output port propagating fire event through connection`);
        connection.propagateFireEvent(this.portOutput, 'output');
      } else if (connection.portB === this.portOutput) {
        // This output port is connected as target - propagate to the other port
        console.log(`VTrigger output port propagating fire event through connection`);
        connection.propagateFireEvent(this.portOutput, 'output');
      }
    }
  }

  /**
   * Get app instance for accessing connections
   * @private
   */
  _getAppInstance() {
    // Try to get app instance from global window or from node
    if (typeof window !== 'undefined' && window.app) {
      return window.app;
    }
    
    // Alternative: traverse up from node to find app
    if (this.node && this.node.app) {
      return this.node.app;
    }
    
    return null;
  }

  /**
   * Set input port hover state
   * @param {boolean} hovered - Hover state
   */
  setInputPortHovered(hovered) {
    this.inputPortHovered = hovered;
  }

  /**
   * Check if output port is currently flashing
   * @returns {boolean} True if flashing
   */
  isOutputPortFlashing() {
    return this.outputPortTriggered && performance.now() < this.flashEndTime;
  }

  /**
   * Update port state (call during animation loop)
   */
  updatePortState() {
    // Reset triggered state when flash ends
    if (this.outputPortTriggered && performance.now() >= this.flashEndTime) {
      this.outputPortTriggered = false;
    }
  }

  /**
   * Get render data for this trigger
   * Used by renderer to draw the trigger
   */
  getRenderData() {
    const triggerX = this.x;
    const intersectionY = this.getWaveformIntersectionY();
    const inputPort = this.getInputPortPosition();
    const outputPort = this.getOutputPortPosition();

    return {
      // Main trigger line
      line: {
        x: triggerX,
        startY: this.node.y,
        endY: this.node.y + this.node.h
      },
      
      // Port connection lines
      inputLine: {
        startX: inputPort.x,
        startY: inputPort.y,
        endX: triggerX,
        endY: this.node.y
      },
      
      outputLine: {
        startX: triggerX,
        startY: this.node.y + this.node.h,
        endX: outputPort.x,
        endY: outputPort.y
      },
      
      // Waveform intersection dot
      intersectionDot: {
        x: triggerX,
        y: intersectionY,
        radius: 3
      },
      
      // Port positions
      inputPort,
      outputPort,
      
      // State
      isHovered: this.isHovered,
      isDragging: this.isDragging
    };
  }

  /**
   * Clone this trigger for another node
   * @param {object} targetNode - Target node
   * @returns {VTrigger} Cloned trigger
   */
  clone(targetNode) {
    return new VTrigger(targetNode, this.u);
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      u: this.u
    };
  }

  /**
   * Create from JSON data
   * @param {object} data - JSON data
   * @param {object} node - Parent node
   * @static
   */
  static fromJSON(data, node) {
    const trigger = new VTrigger(node, data.u);
    trigger.id = data.id;
    return trigger;
  }
}
