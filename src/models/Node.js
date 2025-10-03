/**
 * Base Node class - Abstract foundation for all node types
 * Pure data model with no rendering logic
 * Emits events for state changes
 */

import EventEmitter from '../utils/EventEmitter.js';
import { BOX_W, BOX_H } from '../config/constants.js';

export default class Node extends EventEmitter {
  constructor(x = 0, y = 0, label = 'Node') {
    super();
    
    // Position and size
    this.x = x;
    this.y = y;
    this.w = BOX_W;
    this.h = BOX_H;
    
    // Identity
    this.id = this._generateId();
    this.label = label;
    
    // State
    this.selected = false;
    this.playing = false;
    this.playStartTime = 0;
    
    // Visual state (for UI feedback)
    this.isDragging = false;
    this.isHovered = false;
    
    // Creation tracking
    this.createdAt = Date.now();
  }

  /**
   * Generate unique ID for this node
   * @private
   */
  _generateId() {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if point is inside node bounds
   * @param {number} px - Point X
   * @param {number} py - Point Y
   * @returns {boolean} True if point is inside
   */
  bodyHits(px, py) {
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  }

  /**
   * Get center point of node
   * @returns {object} {x, y} center coordinates
   */
  getCenter() {
    return {
      x: this.x + this.w / 2,
      y: this.y + this.h / 2
    };
  }

  /**
   * Get node bounds as rectangle
   * @returns {object} {x, y, w, h} rectangle
   */
  getBounds() {
    return {
      x: this.x,
      y: this.y,
      w: this.w,
      h: this.h
    };
  }

  /**
   * Move node to new position
   * @param {number} newX - New X coordinate
   * @param {number} newY - New Y coordinate
   */
  setPosition(newX, newY) {
    const oldX = this.x;
    const oldY = this.y;
    
    this.x = newX;
    this.y = newY;
    
    this.emit('position-changed', {
      node: this,
      oldX,
      oldY,
      newX,
      newY
    });
  }

  /**
   * Move node by delta amounts
   * @param {number} dx - Delta X
   * @param {number} dy - Delta Y
   */
  moveBy(dx, dy) {
    this.setPosition(this.x + dx, this.y + dy);
  }

  /**
   * Set node size
   * @param {number} width - New width
   * @param {number} height - New height
   */
  setSize(width, height) {
    const oldW = this.w;
    const oldH = this.h;
    
    this.w = Math.max(50, width); // Minimum width
    this.h = Math.max(30, height); // Minimum height
    
    this.emit('size-changed', {
      node: this,
      oldW,
      oldH,
      newW: this.w,
      newH: this.h
    });
  }

  /**
   * Set selection state
   * @param {boolean} selected - Selection state
   */
  setSelected(selected) {
    if (this.selected !== selected) {
      this.selected = selected;
      this.emit('selection-changed', { node: this, selected });
    }
  }

  /**
   * Set hover state
   * @param {boolean} hovered - Hover state
   */
  setHovered(hovered) {
    if (this.isHovered !== hovered) {
      this.isHovered = hovered;
      this.emit('hover-changed', { node: this, hovered });
    }
  }

  /**
   * Set dragging state
   * @param {boolean} dragging - Dragging state
   */
  setDragging(dragging) {
    if (this.isDragging !== dragging) {
      this.isDragging = dragging;
      this.emit('drag-state-changed', { node: this, dragging });
    }
  }

  /**
   * Start playback (to be overridden by subclasses)
   */
  startPlayback() {
    if (this.playing) return;
    
    this.playing = true;
    this.playStartTime = performance.now();
    
    this.emit('playback-started', { node: this });
  }

  /**
   * Stop playback (to be overridden by subclasses)
   */
  stopPlayback() {
    if (!this.playing) return;
    
    this.playing = false;
    this.playStartTime = 0;
    
    this.emit('playback-stopped', { node: this });
  }

  /**
   * Update node state (called each frame)
   * Override in subclasses for specific update logic
   */
  update(deltaTime) {
    // Base implementation does nothing
    // Subclasses should override this for their specific update logic
  }

  /**
   * Get all ports for this node
   * Override in subclasses that have ports
   * @returns {array} Array of port objects
   */
  getAllPorts() {
    return [];
  }

  /**
   * Create a deep copy of this node
   * Override in subclasses for proper cloning
   * @returns {Node} Cloned node
   */
  clone() {
    const cloned = new this.constructor(this.x + 20, this.y + 20, this.label);
    return cloned;
  }

  /**
   * Serialize node to JSON
   * Override in subclasses to include specific data
   * @returns {object} Serializable object
   */
  toJSON() {
    return {
      id: this.id,
      type: this.constructor.name,
      x: this.x,
      y: this.y,
      w: this.w,
      h: this.h,
      label: this.label,
      createdAt: this.createdAt
    };
  }

  /**
   * Restore node from JSON data
   * Override in subclasses for specific restoration
   * @param {object} data - JSON data
   * @static
   */
  static fromJSON(data) {
    const node = new Node(data.x, data.y, data.label);
    node.id = data.id;
    node.w = data.w || BOX_W;
    node.h = data.h || BOX_H;
    node.createdAt = data.createdAt || Date.now();
    return node;
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.stopPlayback();
    this.clear(); // Clear all event listeners
  }
}
