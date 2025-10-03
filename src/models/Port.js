/**
 * Port - Represents a connection port for triggers
 * Matches monolithic script Port architecture exactly
 */

export default class Port {
  constructor(trigger, type, role = 'out') {
    this.trigger = trigger; // Parent trigger (VTrigger or HTrigger)
    this.type = type; // 'up', 'down', 'input', 'output'
    this.role = role; // 'in', 'out'
    
    // Visual state
    this.isHovered = false;
    this.isTriggered = false;
    this.flashEndTime = 0;
    
    // Port identification
    this.id = this._generateId();
  }

  /**
   * Generate unique ID
   * @private
   */
  _generateId() {
    return `port_${this.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get the node this port belongs to
   */
  get node() {
    return this.trigger.node;
  }

  /**
   * Get port position based on type
   */
  get pos() {
    if (this.type === 'up') {
      return this.trigger.getUpPortPosition();
    } else if (this.type === 'down') {
      return this.trigger.getDownPortPosition();
    } else if (this.type === 'input') {
      return this.trigger.getInputPortPosition();
    } else if (this.type === 'output') {
      return this.trigger.getOutputPortPosition();
    }
    
    // Fallback
    return { x: this.node.x, y: this.node.y };
  }

  /**
   * Check if point hits this port
   * @param {number} mx - Mouse X
   * @param {number} my - Mouse Y
   * @param {number} threshold - Hit threshold
   */
  hits(mx, my, threshold = 8) {
    const p = this.pos;
    const distance = Math.hypot(mx - p.x, my - p.y);
    return distance <= threshold;
  }

  /**
   * Start flash effect
   * @param {number} duration - Flash duration in ms
   */
  blink(duration = 220) {
    this.isTriggered = true;
    this.flashEndTime = performance.now() + duration;
  }

  /**
   * Check if port is currently flashing
   */
  isFlashing() {
    return this.isTriggered && performance.now() < this.flashEndTime;
  }

  /**
   * Update port state (called during animation loop)
   */
  updateState() {
    // Reset triggered state when flash ends
    if (this.isTriggered && performance.now() >= this.flashEndTime) {
      this.isTriggered = false;
    }
  }

  /**
   * Set hover state
   */
  setHovered(hovered) {
    this.isHovered = hovered;
  }

  /**
   * Fire this port (trigger it)
   */
  fire() {
    this.blink();
    
    // Call appropriate trigger firing method
    if (this.type === 'up' && this.trigger.fireUpPort) {
      this.trigger.fireUpPort();
    } else if (this.type === 'down' && this.trigger.fireDownPort) {
      this.trigger.fireDownPort();
    } else if (this.type === 'input' && this.trigger.triggerInputPort) {
      this.trigger.triggerInputPort();
    } else if (this.type === 'output' && this.trigger.fireOutputPort) {
      this.trigger.fireOutputPort();
    }
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      role: this.role,
      triggerId: this.trigger.id
    };
  }
}
