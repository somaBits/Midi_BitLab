/**
 * HTrigger - Horizontal trigger for waveform nodes
 * Represents a horizontal line trigger that detects waveform crossings
 * and can fire events on up/down threshold crossings
 */

import { clamp } from '../utils/geometry.js';
import Port from './Port.js';

export default class HTrigger {
  constructor(node, vNorm = 0.5) {
    this.node = node;
    this.v = clamp(vNorm, 0, 1); // Normalized vertical position (0-1) within node height
    
    // Visual state
    this.isDragging = false;
    this.isHovered = false;
    
    // Trigger identification
    this.id = this._generateId();
    this.type = 'horizontal';
    
    // Crossing detection state
    this.lastValue = null; // Last waveform value at this level
    
    // Create separate Port objects (matching monolithic script architecture)
    this.portUp = new Port(this, 'up', 'out');
    this.portDown = new Port(this, 'down', 'out');
  }

  /**
   * Generate unique ID
   * @private
   */
  _generateId() {
    return `htrigger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Fire the up port (called when waveform crosses above threshold)
   * @param {number} flashDurationMs - Flash duration in milliseconds
   */
  fireUpPort(flashDurationMs = 220) {
    this.upPortTriggered = true;
    this.upFlashEndTime = performance.now() + flashDurationMs;
    console.log(`HTrigger up crossing fired at threshold=${this.v.toFixed(3)}`);
    
    // Emit event if node has event system
    if (this.node && typeof this.node.emit === 'function') {
      this.node.emit('htrigger-up-fired', {
        trigger: this,
        threshold: this.v
      });
    }
    
    // Propagate trigger through connections
    this._propagateUpTrigger();
  }

  /**
   * Fire the down port (called when waveform crosses below threshold)
   * @param {number} flashDurationMs - Flash duration in milliseconds
   */
  fireDownPort(flashDurationMs = 220) {
    this.downPortTriggered = true;
    this.downFlashEndTime = performance.now() + flashDurationMs;
    console.log(`HTrigger down crossing fired at threshold=${this.v.toFixed(3)}`);
    
    // Emit event if node has event system
    if (this.node && typeof this.node.emit === 'function') {
      this.node.emit('htrigger-down-fired', {
        trigger: this,
        threshold: this.v
      });
    }
    
    // Propagate trigger through connections
    this._propagateDownTrigger();
  }

  /**
   * Propagate up port trigger event through connected cables
   * @private
   */
  _propagateUpTrigger() {
    // Get the app instance to access connections
    const app = this._getAppInstance();
    if (!app || !app.connections) return;
    
    // Find connections where this up port is involved (using Port objects)
    for (const connection of app.connections) {
      if (connection.portA === this.portUp) {
        // This up port is connected as source - propagate to the target port
        console.log(`HTrigger up port propagating fire event through connection`);
        connection.propagateFireEvent(this.portUp, 'up');
      } else if (connection.portB === this.portUp) {
        // This up port is connected as target - propagate to the other port  
        console.log(`HTrigger up port propagating fire event through connection`);
        connection.propagateFireEvent(this.portUp, 'up');
      }
    }
  }

  /**
   * Propagate down port trigger event through connected cables
   * @private
   */
  _propagateDownTrigger() {
    // Get the app instance to access connections
    const app = this._getAppInstance();
    if (!app || !app.connections) return;
    
    // Find connections where this down port is involved (using Port objects)
    for (const connection of app.connections) {
      if (connection.portA === this.portDown) {
        // This down port is connected as source - propagate to the target port
        console.log(`HTrigger down port propagating fire event through connection`);
        connection.propagateFireEvent(this.portDown, 'down');
      } else if (connection.portB === this.portDown) {
        // This down port is connected as target - propagate to the other port
        console.log(`HTrigger down port propagating fire event through connection`);
        connection.propagateFireEvent(this.portDown, 'down');
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
   * Get graph rectangle bounds from parent node
   */
  get graphRect() {
    if (!this.node || typeof this.node.getGraphRect !== 'function') {
      return { gx: 0, gy: 0, gw: 200, gh: 80 };
    }
    return this.node.getGraphRect();
  }

  /**
   * Get Y coordinate of this trigger line
   */
  get y() {
    const { gy, gh } = this.graphRect;
    return gy + this.v * gh;
  }

  /**
   * Get end X coordinate of trigger line (extends beyond node for connector)
   */
  get stopX() {
    return this.node.x + this.node.w + 30; // Extend 30px for connector curves
  }

  /**
   * Get center point of trigger line
   */
  centerPoint() {
    return {
      x: this.node.x + this.node.w / 2,
      y: this.y
    };
  }

  /**
   * Get up port position (above trigger line)
   */
  getUpPortPosition() {
    // Match monolithic script: node.x + node.w + 20
    return {
      x: this.node.x + this.node.w + 20,
      y: this.y - 10
    };
  }

  /**
   * Get down port position (below trigger line)
   */
  getDownPortPosition() {
    // Match monolithic script: node.x + node.w + 20  
    return {
      x: this.node.x + this.node.w + 20,
      y: this.y + 10
    };
  }

  /**
   * Calculate distance from point to trigger line
   * @param {number} px - Point X
   * @param {number} py - Point Y
   * @returns {number} Distance to line
   */
  distanceTo(px, py) {
    const startX = this.node.x;
    const endX = this.stopX;
    const triggerY = this.y;
    
    // Distance to horizontal line segment
    if (px < startX) {
      return Math.hypot(px - startX, py - triggerY);
    } else if (px > endX) {
      return Math.hypot(px - endX, py - triggerY);
    } else {
      return Math.abs(py - triggerY);
    }
  }

  /**
   * Set normalized position from mouse Y coordinate
   * @param {number} mouseY - Mouse Y coordinate
   */
  setVFromMouseY(mouseY) {
    const { gy, gh } = this.graphRect;
    const clampedY = clamp(mouseY, gy, gy + gh);
    this.v = (clampedY - gy) / gh;
  }

  /**
   * Get the threshold level for crossing detection
   * @returns {number} Threshold level (0-1)
   */
  getThresholdLevel() {
    return 1 - this.v; // Invert because v=0 is top, but waveform 1.0 is top
  }

  /**
   * Compute crossing points where waveform intersects this trigger level
   * @param {string} direction - 'up' or 'down' for crossing direction
   * @returns {array} Array of crossing points {x, y}
   */
  computeCrossings(direction = 'up') {
    if (!this.node || typeof this.node.valueAt !== 'function' || !this.node.samples) {
      return [];
    }

    const crossings = [];
    const { gx, gw } = this.graphRect;
    const levelVal = this.getThresholdLevel();
    const samples = this.node.samples;
    const n = samples.length;

    for (let i = 0; i < n - 1; i++) {
      const v0 = samples[i];
      const v1 = samples[i + 1];

      let crossed = false;
      if (direction === 'up' && v0 < levelVal && v1 >= levelVal && v1 !== v0) {
        crossed = true;
      } else if (direction === 'down' && v0 > levelVal && v1 <= levelVal && v1 !== v0) {
        crossed = true;
      }

      if (crossed) {
        // Calculate exact crossing point using linear interpolation
        const t = (levelVal - v0) / (v1 - v0);
        const x0 = gx + (i / (n - 1)) * gw;
        const x1 = gx + ((i + 1) / (n - 1)) * gw;
        const crossingX = x0 + t * (x1 - x0);

        crossings.push({
          x: clamp(crossingX, gx, gx + gw),
          y: this.y
        });
      }
    }

    return crossings;
  }

  /**
   * Check for crossing at current playback position
   * @param {number} currentValue - Current waveform value (0-1)
   * @returns {object|null} Crossing info or null
   */
  checkCrossing(currentValue) {
    if (this.lastValue === null) {
      this.lastValue = currentValue;
      return null;
    }

    const threshold = this.getThresholdLevel();
    const prev = this.lastValue;
    const curr = currentValue;

    let crossingType = null;
    if (prev < threshold && curr >= threshold) {
      crossingType = 'up';
    } else if (prev > threshold && curr <= threshold) {
      crossingType = 'down';
    }

    this.lastValue = currentValue;

    if (crossingType) {
      return {
        type: crossingType,
        threshold,
        fromValue: prev,
        toValue: curr
      };
    }

    return null;
  }

  /**
   * Reset crossing detection state
   */
  resetCrossingState() {
    this.lastValue = null;
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
   * Check if point hits up port
   * @param {number} px - Point X
   * @param {number} py - Point Y
   * @param {number} threshold - Hit threshold in pixels
   * @returns {boolean} True if hit
   */
  isUpPortHit(px, py, threshold = 8) {
    const port = this.getUpPortPosition();
    const distance = Math.hypot(px - port.x, py - port.y);
    return distance <= threshold;
  }

  /**
   * Check if point hits down port
   * @param {number} px - Point X
   * @param {number} py - Point Y
   * @param {number} threshold - Hit threshold in pixels
   * @returns {boolean} True if hit
   */
  isDownPortHit(px, py, threshold = 8) {
    const port = this.getDownPortPosition();
    const distance = Math.hypot(px - port.x, py - port.y);
    return distance <= threshold;
  }


  /**
   * Set up port hover state
   * @param {boolean} hovered - Hover state
   */
  setUpPortHovered(hovered) {
    this.upPortHovered = hovered;
  }

  /**
   * Set down port hover state
   * @param {boolean} hovered - Hover state
   */
  setDownPortHovered(hovered) {
    this.downPortHovered = hovered;
  }

  /**
   * Check if up port is currently flashing
   * @returns {boolean} True if flashing
   */
  isUpPortFlashing() {
    return this.upPortTriggered && performance.now() < this.upFlashEndTime;
  }

  /**
   * Check if down port is currently flashing
   * @returns {boolean} True if flashing
   */
  isDownPortFlashing() {
    return this.downPortTriggered && performance.now() < this.downFlashEndTime;
  }

  /**
   * Update port state (call during animation loop)
   */
  updatePortState() {
    const now = performance.now();
    
    // Reset up port triggered state when flash ends
    if (this.upPortTriggered && now >= this.upFlashEndTime) {
      this.upPortTriggered = false;
    }
    
    // Reset down port triggered state when flash ends
    if (this.downPortTriggered && now >= this.downFlashEndTime) {
      this.downPortTriggered = false;
    }
  }

  /**
   * Get render data for this trigger
   * Used by renderer to draw the trigger
   * Note: Import TRIGGER_PORT_DIAMETER dynamically to avoid circular dependency
   */
  getRenderData() {
    const upCrossings = this.computeCrossings('up');
    const downCrossings = this.computeCrossings('down');
    const upPort = this.getUpPortPosition();
    const downPort = this.getDownPortPosition();
    
    // Trigger line should stop at node edge, not extend to ports
    const lineEndX = this.node.x + this.node.w;

    return {
      // Main trigger line (stops at node edge)
      line: {
        y: this.y,
        startX: this.node.x,
        endX: lineEndX // Stop at node edge, not at stopX
      },
      
      // Port connector curves (bezier from line end to ports)
      connectors: {
        upCurve: {
          startX: lineEndX, // Start curves from node edge
          startY: this.y,
          endX: upPort.x, // End at port center (original behavior)
          endY: upPort.y
        },
        downCurve: {
          startX: lineEndX, // Start curves from node edge
          startY: this.y,
          endX: downPort.x, // End at port center (original behavior)
          endY: downPort.y
        }
      },
      
      // Crossing dots
      upCrossings: upCrossings.map(cross => ({
        x: cross.x,
        y: cross.y,
        radius: 3
      })),
      
      downCrossings: downCrossings.map(cross => ({
        x: cross.x,
        y: cross.y,
        radius: 3
      })),
      
      // Port positions
      upPort,
      downPort,
      
      // State
      isHovered: this.isHovered,
      isDragging: this.isDragging
    };
  }

  /**
   * Clone this trigger for another node
   * @param {object} targetNode - Target node
   * @returns {HTrigger} Cloned trigger
   */
  clone(targetNode) {
    return new HTrigger(targetNode, this.v);
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      v: this.v
    };
  }

  /**
   * Create from JSON data
   * @param {object} data - JSON data
   * @param {object} node - Parent node
   * @static
   */
  static fromJSON(data, node) {
    const trigger = new HTrigger(node, data.v);
    trigger.id = data.id;
    return trigger;
  }
}
