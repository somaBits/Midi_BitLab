/**
 * ConnectionRenderer - Pure rendering for cable connections
 * Stateless rendering functions - no business logic
 * Receives connection data and canvas context, outputs pixels
 */

import { COLOR_CABLE, CABLE_DASH_PATTERN } from '../config/constants.js';

export default class ConnectionRenderer {
  constructor(canvas) {
    this.canvas = canvas;
  }

  /**
   * Render a single connection
   * @param {object} connection - Connection model
   * @param {object} state - Additional state (hover, etc.)
   */
  drawConnection(connection, state = {}) {
    const { isHovered = false } = state;
    
    const { start, cp1, cp2, end } = connection.getCurvePoints();
    
    // Set up dashed line using canvas context
    const ctx = this.canvas.drawingContext;
    ctx.setLineDash(CABLE_DASH_PATTERN);
    
    // Draw the bezier curve cable
    this.canvas.stroke(...COLOR_CABLE);
    this.canvas.strokeWeight(isHovered ? 2 : 1);
    this.canvas.noFill();
    
    this.canvas.bezier(
      start.x, start.y,
      cp1.x, cp1.y,
      cp2.x, cp2.y,
      end.x, end.y
    );
    
    // Reset line dash to solid for other drawing
    ctx.setLineDash([]);
    
    // Note: Delete icon rendering is handled by AppController
  }

  /**
   * Render a cable being dragged (preview)
   * @param {object} startPort - Starting port
   * @param {number} mouseX - Current mouse X
   * @param {number} mouseY - Current mouse Y
   * @param {string} portType - Type of clicked port ('input', 'output', 'up', 'down')
   */
  drawDragPreview(startPort, mouseX, mouseY, portType = null) {
    // Get the correct start position based on the actual clicked port
    let start;
    
    // NEW: Check if this is a Port object (has .pos property) - prioritize this
    if (startPort.pos) {
      start = startPort.pos;
    } else if (portType) {
      // LEGACY: Use specific port type if provided for old trigger objects
      if (portType === 'input' && startPort.getInputPortPosition) {
        start = startPort.getInputPortPosition();
      } else if (portType === 'output' && startPort.getOutputPortPosition) {
        start = startPort.getOutputPortPosition();
      } else if (portType === 'up' && startPort.getUpPortPosition) {
        start = startPort.getUpPortPosition();
      } else if (portType === 'down' && startPort.getDownPortPosition) {
        start = startPort.getDownPortPosition();
      } else {
        // Fallback to first available position method
        start = this._getFirstAvailablePortPosition(startPort);
      }
    } else {
      // Legacy fallback - try to detect best position
      start = this._getFirstAvailablePortPosition(startPort);
    }

    const end = { x: mouseX, y: mouseY };
    
    // Calculate adaptive preview control points based on port direction
    const { cp1, cp2 } = this._calculateAdaptiveControlPoints(start, end, portType);

    // Draw preview cable (slightly transparent)
    this.canvas.stroke(255, 255, 0, 180); // Yellow preview
    this.canvas.strokeWeight(2);
    this.canvas.noFill();
    
    this.canvas.bezier(
      start.x, start.y,
      cp1.x, cp1.y,
      cp2.x, cp2.y,
      end.x, end.y
    );
  }

  /**
   * Get first available port position from trigger
   * @private
   */
  _getFirstAvailablePortPosition(startPort) {
    if (startPort.getOutputPortPosition) {
      return startPort.getOutputPortPosition();
    } else if (startPort.getInputPortPosition) {
      return startPort.getInputPortPosition();
    } else if (startPort.getUpPortPosition) {
      return startPort.getUpPortPosition();
    } else if (startPort.getDownPortPosition) {
      return startPort.getDownPortPosition();
    } else {
      return { x: startPort.node.x, y: startPort.node.y };
    }
  }

  /**
   * Calculate adaptive control points for natural cable curves
   * @private
   */
  _calculateAdaptiveControlPoints(start, end, portType = null) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.hypot(dx, dy);
    const offset = Math.max(40, Math.min(distance * 0.4, 200));
    
    // Adaptive control points based on port type and direction
    let cp1, cp2;
    
    if (portType === 'input' || portType === 'up') {
      // Input/up ports: curve comes from above/left
      cp1 = {
        x: start.x - offset * 0.5,
        y: start.y - offset * 0.3
      };
      cp2 = {
        x: end.x + offset * 0.5,
        y: end.y - offset * 0.3
      };
    } else if (portType === 'output' || portType === 'down') {
      // Output/down ports: curve goes toward right/down
      cp1 = {
        x: start.x + offset,
        y: start.y
      };
      cp2 = {
        x: end.x - offset,
        y: end.y
      };
    } else {
      // Default horizontal curve
      cp1 = {
        x: start.x + offset,
        y: start.y
      };
      cp2 = {
        x: end.x - offset,
        y: end.y
      };
    }
    
    return { cp1, cp2 };
  }

  /**
   * Render multiple connections efficiently
   * @param {array} connections - Array of connection models
   * @param {object} stateMap - Map of connection ID to state
   */
  drawConnections(connections, stateMap = {}) {
    for (const connection of connections) {
      const state = stateMap[connection.id] || {};
      this.drawConnection(connection, state);
    }
  }

  /**
   * Get connection bounds for hit testing
   * @param {object} connection - Connection model
   * @param {number} margin - Additional margin
   * @returns {object} Bounding box
   */
  getConnectionBounds(connection, margin = 10) {
    const { start, end } = connection.getCurvePoints();
    
    return {
      x: Math.min(start.x, end.x) - margin,
      y: Math.min(start.y, end.y) - margin,
      w: Math.abs(end.x - start.x) + margin * 2,
      h: Math.abs(end.y - start.y) + margin * 2
    };
  }


  /**
   * Render debug information for connections
   * @param {array} connections - Connections to debug
   * @param {number} mouseX - Mouse X for distance calculation
   * @param {number} mouseY - Mouse Y for distance calculation
   */
  drawDebugInfo(connections, mouseX, mouseY) {
    this.canvas.fill(255, 200);
    this.canvas.noStroke();
    this.canvas.textAlign(this.canvas.LEFT, this.canvas.TOP);
    this.canvas.textSize(10);
    
    let yOffset = 10;
    
    this.canvas.text(`Connections: ${connections.length}`, 10, yOffset);
    yOffset += 15;
    
    for (let i = 0; i < Math.min(connections.length, 5); i++) {
      const connection = connections[i];
      const distance = connection.distanceToPoint(mouseX, mouseY);
      const midpoint = connection.getMidpoint();
      
      this.canvas.text(
        `${i}: dist=${distance.toFixed(1)} mid=(${Math.round(midpoint.x)},${Math.round(midpoint.y)})`,
        10, yOffset
      );
      yOffset += 12;
    }
  }

  /**
   * Render connection statistics overlay
   * @param {array} connections - All connections
   */
  drawStats(connections) {
    if (connections.length === 0) return;
    
    const stats = this._calculateConnectionStats(connections);
    
    this.canvas.fill(255, 180);
    this.canvas.noStroke();
    this.canvas.textAlign(this.canvas.RIGHT, this.canvas.TOP);
    this.canvas.textSize(11);
    
    const lines = [
      `Connections: ${stats.total}`,
      `Avg Length: ${stats.avgLength.toFixed(0)}px`,
      `Connected Nodes: ${stats.connectedNodes}`
    ];
    
    let yOffset = 10;
    for (const line of lines) {
      this.canvas.text(line, this.canvas.width - 10, yOffset);
      yOffset += 14;
    }
  }

  /**
   * Calculate connection statistics
   * @private
   */
  _calculateConnectionStats(connections) {
    let totalLength = 0;
    const connectedNodes = new Set();
    
    for (const connection of connections) {
      const { start, end } = connection.getCurvePoints();
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      totalLength += length;
      
      if (connection.portA && connection.portA.node) {
        connectedNodes.add(connection.portA.node);
      }
      if (connection.portB && connection.portB.node) {
        connectedNodes.add(connection.portB.node);
      }
    }
    
    return {
      total: connections.length,
      avgLength: connections.length > 0 ? totalLength / connections.length : 0,
      connectedNodes: connectedNodes.size
    };
  }
}
