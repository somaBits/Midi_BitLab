/**
 * Connection - Represents a cable connection between two trigger ports
 * Pure model - handles connection logic but no rendering
 */

export default class Connection {
  constructor(portA, portB) {
    this.portA = portA; // Starting port
    this.portB = portB; // Ending port
    this.id = this._generateId();
    
    // Visual state
    this.isHovered = false;
    
    // Connection validation
    if (!this._isValidConnection()) {
      console.warn('Invalid connection attempted:', portA, portB);
    }
  }

  /**
   * Generate unique ID for this connection
   * @private
   */
  _generateId() {
    return `connection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate that this connection is allowed
   * @private
   */
  _isValidConnection() {
    // Basic validation - ports exist and are different
    if (!this.portA || !this.portB || this.portA === this.portB) return false;
    
    // NEW: Role-based validation - only allow input ↔ output connections
    const roleA = this._getPortRole(this.portA);
    const roleB = this._getPortRole(this.portB);
    
    // Only allow connections between input and output ports
    const validConnection = (roleA === 'in' && roleB === 'out') || (roleA === 'out' && roleB === 'in');
    
    if (!validConnection) {
      console.log(`Connection validation failed: ${roleA} port cannot connect to ${roleB} port`);
    }
    
    return validConnection;
  }

  /**
   * Get port role (input/output) from port or legacy trigger
   * @param {object} port - Port or trigger object
   * @returns {string} 'in', 'out', or 'unknown'
   * @private
   */
  _getPortRole(port) {
    // Check if this is a Port object with role property
    if (port.role) {
      return port.role;
    }
    
    // Legacy support: Determine role from port type
    if (port.type === 'input') return 'in';
    if (port.type === 'output') return 'out';
    if (port.type === 'up' || port.type === 'down') return 'out'; // HTrigger ports are outputs
    
    // Fallback: check for legacy _connectedPortType
    if (port._connectedPortType === 'input') return 'in';
    if (port._connectedPortType === 'output') return 'out';
    if (port._connectedPortType === 'up' || port._connectedPortType === 'down') return 'out';
    
    // Default fallback
    return 'unknown';
  }

  /**
   * Get the other port in this connection
   * @param {object} port - One of the ports in this connection
   * @returns {object|null} The other port, or null if not found
   */
  getOtherPort(port) {
    if (port === this.portA) return this.portB;
    if (port === this.portB) return this.portA;
    return null;
  }

  /**
   * Check if this connection involves the given port
   * @param {object} port - Port to check
   * @returns {boolean} True if this connection uses the port
   */
  hasPort(port) {
    return this.portA === port || this.portB === port;
  }

  /**
   * Check if this connection involves the given node
   * @param {object} node - Node to check
   * @returns {boolean} True if this connection involves the node
   */
  hasNode(node) {
    return (this.portA && this.portA.node === node) || 
           (this.portB && this.portB.node === node);
  }

  /**
   * Get bezier curve control points for rendering
   * @returns {object} Curve control points {start, cp1, cp2, end}
   */
  getCurvePoints() {
    // Get best available positions for both ports
    const start = this._getBestPortPosition(this.portA);
    const end = this._getBestPortPosition(this.portB);

    // Calculate adaptive control points based on port layout
    const { cp1, cp2 } = this._calculateAdaptiveBezierControlPoints(start, end);

    return { start, cp1, cp2, end };
  }

  /**
   * Get best available position for a port
   * @private
   */
  _getBestPortPosition(port) {
    // Check if this is the new Port class (has .pos property)
    if (port.pos) {
      return port.pos;
    }
    
    // Legacy support: If the port has a specific type stored, use that
    if (port._connectedPortType) {
      if (port._connectedPortType === 'input' && port.getInputPortPosition) {
        return port.getInputPortPosition();
      } else if (port._connectedPortType === 'output' && port.getOutputPortPosition) {
        return port.getOutputPortPosition();
      } else if (port._connectedPortType === 'up' && port.getUpPortPosition) {
        return port.getUpPortPosition();
      } else if (port._connectedPortType === 'down' && port.getDownPortPosition) {
        return port.getDownPortPosition();
      }
    }
    
    // Legacy fallback: Try all available position methods in order of preference
    if (port.getOutputPortPosition) {
      return port.getOutputPortPosition();
    } else if (port.getInputPortPosition) {
      return port.getInputPortPosition();
    } else if (port.getUpPortPosition) {
      return port.getUpPortPosition();
    } else if (port.getDownPortPosition) {
      return port.getDownPortPosition();
    } else {
      return { x: port.node.x, y: port.node.y };
    }
  }

  /**
   * Calculate adaptive bezier control points for natural cable curves
   * @private
   */
  _calculateAdaptiveBezierControlPoints(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.hypot(dx, dy);
    const baseOffset = Math.max(40, Math.min(distance * 0.4, 200));
    
    // Detect port orientations based on positions relative to nodes
    const startIsLeft = this._isPortOnLeft(this.portA, start);
    const startIsTop = this._isPortOnTop(this.portA, start);
    const endIsLeft = this._isPortOnLeft(this.portB, end);
    const endIsTop = this._isPortOnTop(this.portB, end);
    
    let cp1, cp2;
    
    // Adaptive control points based on port orientations
    if (startIsLeft && endIsLeft) {
      // Both ports on left - curve inward
      cp1 = {
        x: start.x - baseOffset * 0.8,
        y: start.y + dy * 0.2
      };
      cp2 = {
        x: end.x - baseOffset * 0.8,
        y: end.y - dy * 0.2
      };
    } else if (!startIsLeft && !endIsLeft) {
      // Both ports on right - curve outward
      cp1 = {
        x: start.x + baseOffset,
        y: start.y + dy * 0.1
      };
      cp2 = {
        x: end.x + baseOffset,
        y: end.y - dy * 0.1
      };
    } else if (startIsTop || endIsTop) {
      // Vertical connection - use vertical curves
      cp1 = {
        x: start.x + dx * 0.2,
        y: start.y + (startIsTop ? -baseOffset * 0.5 : baseOffset * 0.5)
      };
      cp2 = {
        x: end.x - dx * 0.2,
        y: end.y + (endIsTop ? -baseOffset * 0.5 : baseOffset * 0.5)
      };
    } else {
      // Standard horizontal curve with direction awareness
      const leftToRight = dx > 0;
      const rightToLeft = dx < 0;
      
      if (leftToRight) {
        cp1 = {
          x: start.x + baseOffset,
          y: start.y
        };
        cp2 = {
          x: end.x - baseOffset,
          y: end.y
        };
      } else {
        // Right to left - use more curved path
        cp1 = {
          x: start.x - baseOffset * 0.6,
          y: start.y + dy * 0.3
        };
        cp2 = {
          x: end.x + baseOffset * 0.6,
          y: end.y - dy * 0.3
        };
      }
    }
    
    return { cp1, cp2 };
  }

  /**
   * Check if port is positioned on the left side of its node
   * @private
   */
  _isPortOnLeft(port, position) {
    if (!port.node) return false;
    return position.x < port.node.x + port.node.w * 0.2;
  }

  /**
   * Check if port is positioned on the top of its node
   * @private
   */
  _isPortOnTop(port, position) {
    if (!port.node) return false;
    return position.y < port.node.y + port.node.h * 0.2;
  }

  /**
   * Get the midpoint of the connection for UI interactions
   * @returns {object} Point with x,y coordinates
   */
  getMidpoint() {
    const { start, cp1, cp2, end } = this.getCurvePoints();
    
    // Calculate bezier curve midpoint (t=0.5)
    const t = 0.5;
    const x = Math.pow(1-t, 3) * start.x + 
              3 * Math.pow(1-t, 2) * t * cp1.x + 
              3 * (1-t) * Math.pow(t, 2) * cp2.x + 
              Math.pow(t, 3) * end.x;
    
    const y = Math.pow(1-t, 3) * start.y + 
              3 * Math.pow(1-t, 2) * t * cp1.y + 
              3 * (1-t) * Math.pow(t, 2) * cp2.y + 
              Math.pow(t, 3) * end.y;
    
    return { x, y };
  }

  /**
   * Calculate distance from a point to this connection curve
   * @param {number} px - Point X coordinate
   * @param {number} py - Point Y coordinate
   * @param {number} samples - Number of samples along curve for accuracy
   * @returns {number} Minimum distance to curve
   */
  distanceToPoint(px, py, samples = 40) {
    const { start, cp1, cp2, end } = this.getCurvePoints();
    
    let minDistance = Infinity;
    let prevX = start.x;
    let prevY = start.y;
    
    for (let i = 1; i <= samples; i++) {
      const t = i / samples;
      
      // Bezier curve calculation
      const x = Math.pow(1-t, 3) * start.x + 
                3 * Math.pow(1-t, 2) * t * cp1.x + 
                3 * (1-t) * Math.pow(t, 2) * cp2.x + 
                Math.pow(t, 3) * end.x;
      
      const y = Math.pow(1-t, 3) * start.y + 
                3 * Math.pow(1-t, 2) * t * cp1.y + 
                3 * (1-t) * Math.pow(t, 2) * cp2.y + 
                Math.pow(t, 3) * end.y;
      
      // Distance to line segment between previous and current point
      const segmentDist = this._pointToSegmentDistance(px, py, prevX, prevY, x, y);
      minDistance = Math.min(minDistance, segmentDist);
      
      prevX = x;
      prevY = y;
    }
    
    return minDistance;
  }

  /**
   * Calculate distance from point to line segment
   * @private
   */
  _pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSq = dx * dx + dy * dy;
    
    if (lengthSq === 0) {
      return Math.hypot(px - x1, py - y1);
    }
    
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    
    return Math.hypot(px - projX, py - projY);
  }

  /**
   * Fire a trigger event through this connection
   * @param {object} sourcePort - The port that fired the trigger
   * @param {string} sourcePortType - Type of port that fired ('input', 'output', 'up', 'down')
   */
  propagateFireEvent(sourcePort, sourcePortType = null) {
    // NEW: Directional propagation - only output ports can initiate propagation
    const sourceRole = this._getPortRole(sourcePort);
    if (sourceRole !== 'out') {
      console.log(`Propagation blocked: Only output ports can propagate (source is ${sourceRole})`);
      return;
    }
    
    const targetPort = this.getOtherPort(sourcePort);
    
    if (!targetPort) {
      console.warn('Cannot propagate fire event - target port not found');
      return;
    }
    
    // NEW: Only propagate TO input ports
    const targetRole = this._getPortRole(targetPort);
    if (targetRole !== 'in') {
      console.log(`Propagation blocked: Can only propagate to input ports (target is ${targetRole})`);
      return;
    }
    
    console.log(`Connection propagating fire event from ${sourceRole} port to ${targetRole} port`);
    
    // NEW: Handle Port objects by calling their fire() method
    if (targetPort.constructor.name === 'Port') {
      // Port objects handle firing through their fire() method
      console.log(`Firing target Port object (${targetPort.type} port)`);
      targetPort.fire();
      return;
    }
    
    // LEGACY: Handle direct trigger objects (backwards compatibility)
    // Fire the target port based on its type and stored connection type
    // IMPORTANT: Allow repeated firing like monolithic script - no restrictions
    const targetPortType = targetPort._connectedPortType;
    
    if (targetPort.constructor.name === 'VTrigger') {
      // VTrigger ports - can fire repeatedly
      if (targetPortType === 'input' && targetPort.triggerInputPort) {
        // VTrigger input port - start playback from trigger position (can trigger multiple times)
        targetPort.triggerInputPort();
      } else if (targetPortType === 'output' && targetPort.fireOutputPort) {
        // VTrigger output port - fire it directly for chaining (can fire multiple times)
        targetPort.fireOutputPort();
      } else if (targetPort.triggerInputPort) {
        // Fallback to input port (can trigger multiple times)
        targetPort.triggerInputPort();
      }
    } else if (targetPort.constructor.name === 'HTrigger') {
      // HTrigger ports - fire directly every time (matching monolithic behavior)
      if (targetPortType === 'up' && targetPort.fireUpPort) {
        // HTrigger up port - fire it directly every time (no restrictions)
        targetPort.fireUpPort();
      } else if (targetPortType === 'down' && targetPort.fireDownPort) {
        // HTrigger down port - fire it directly every time (no restrictions)
        targetPort.fireDownPort();
      } else if (targetPort.fireUpPort || targetPort.fireDownPort) {
        // If no specific port type stored, try to fire the appropriate one
        if (sourcePortType === 'up' && targetPort.fireUpPort) {
          targetPort.fireUpPort();
        } else if (sourcePortType === 'down' && targetPort.fireDownPort) {
          targetPort.fireDownPort();
        } else {
          // Default to starting node playback
          if (targetPort.node && targetPort.node.startPlayback) {
            targetPort.node.startPlayback();
          }
        }
      } else {
        // Fallback: start playback on the node
        if (targetPort.node && targetPort.node.startPlayback) {
          targetPort.node.startPlayback();
        }
      }
    } else if (targetPort.node && targetPort.node.startPlayback) {
      // Unknown port type - start full node playback as fallback (can start multiple times)
      targetPort.node.startPlayback();
    }
    
    // Visual feedback - brief flash like monolithic script
    if (targetPort.setInputPortHovered) {
      targetPort.setInputPortHovered(true);
      setTimeout(() => targetPort.setInputPortHovered(false), 100);
    }
  }

  /**
   * Set hover state
   * @param {boolean} hovered - Hover state
   */
  setHovered(hovered) {
    this.isHovered = hovered;
  }

  /**
   * Serialize connection to JSON
   */
  toJSON() {
    return {
      id: this.id,
      portA: this.portA.id || 'unknown',
      portB: this.portB.id || 'unknown'
    };
  }

  /**
   * Create connection from JSON (requires port lookup)
   * @param {object} data - JSON data
   * @param {function} portLookup - Function to find ports by ID
   * @static
   */
  static fromJSON(data, portLookup) {
    const portA = portLookup(data.portA);
    const portB = portLookup(data.portB);
    
    if (!portA || !portB) {
      console.warn('Cannot restore connection - ports not found');
      return null;
    }
    
    const connection = new Connection(portA, portB);
    connection.id = data.id;
    return connection;
  }
}
