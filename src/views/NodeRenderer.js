/**
 * Node Renderer - Pure rendering for waveform nodes
 * Stateless rendering functions - no business logic
 * Receives data and canvas context, outputs pixels
 */

import { 
  COLOR_NODE_STROKE, 
  COLOR_PLAYHEAD, 
  COLOR_TRIGGER_LINE,
  COLOR_TRIGGER_DOT,
  COLOR_TRIGGER_PORT,
  COLOR_TRIGGER_CONNECTOR,
  COLOR_BACKGROUND,
  TRIGGER_LINE_WEIGHT,
  TRIGGER_PORT_WEIGHT,
  TRIGGER_PORT_DIAMETER,
  TRIGGER_DOT_DIAMETER,
  TRIGGER_PORT_FILL,
  NODE_BORDER_WEIGHT_NORMAL,
  NODE_BORDER_WEIGHT_SELECTED,
  CREATE_AREA_ALPHA_NORMAL,
  CREATE_AREA_ALPHA_HOVER,
  CREATE_AREA_PREVIEW_WEIGHT,
  PORT_FLASH_COLOR,
  PORT_ARROW_SIZE_RATIO,
  PORT_HOVER_ARROW_COLOR,
  VTRIGGER_ARROW_CHAR,
  HTRIGGER_ARROW_CHAR,
  DELETE_ICON_R
} from '../config/constants.js';

export default class NodeRenderer {
  constructor(canvas) {
    this.canvas = canvas;
  }

  /**
   * Render a waveform node
   * @param {object} nodeData - Node data to render
   * @param {object} state - Additional state (hover, selection, etc.)
   */
  draw(nodeData, state = {}) {
    const { 
      isHovered = false, 
      isSelected = false, 
      isDragging = false,
      showCreateAreas = false 
    } = state;

    // Draw main node box
    this._drawNodeBox(nodeData, isSelected, isDragging);
    
    // Draw node label/header
    this._drawNodeHeader(nodeData);
    
    // Draw waveform graph
    this._drawWaveform(nodeData);
    
    // Draw playhead if playing
    if (nodeData.playing) {
      this._drawPlayhead(nodeData);
    }

    // Draw triggers if they exist
    this._drawTriggers(nodeData);

    // Draw create areas if hovered
    if (showCreateAreas && (isHovered || isDragging)) {
      this._drawCreateAreas(nodeData);
    }
  }

  /**
   * Draw the main node box outline
   * @private
   */
  _drawNodeBox(nodeData, isSelected, isDragging) {
    this.canvas.stroke(...COLOR_NODE_STROKE);
    this.canvas.strokeWeight(isSelected ? NODE_BORDER_WEIGHT_SELECTED : NODE_BORDER_WEIGHT_NORMAL);
    this.canvas.noFill();
    
    if (isDragging) {
      // Add slight transparency when dragging
      this.canvas.stroke(255, 255, 255, 180);
    }
    
    this.canvas.rect(nodeData.x, nodeData.y, nodeData.w, nodeData.h);
  }

  /**
   * Draw node header text
   * @private
   */
  _drawNodeHeader(nodeData) {
    this.canvas.noStroke();
    this.canvas.fill(255);
    this.canvas.textAlign(this.canvas.LEFT, this.canvas.TOP);
    this.canvas.textSize(11);
    
    const displayHeader = nodeData.getDisplayHeader ? 
      nodeData.getDisplayHeader() : 
      nodeData.label;
    
    this.canvas.text(displayHeader, nodeData.x + 6, nodeData.y + 4);
  }

  /**
   * Draw the waveform graph
   * @private
   */
  _drawWaveform(nodeData) {
    if (!nodeData.samples || nodeData.samples.length === 0) return;
    
    const { gx, gy, gw, gh } = nodeData.getGraphRect();
    
    this.canvas.stroke(255);
    this.canvas.strokeWeight(1);
    this.canvas.noFill();
    
    // Draw waveform path
    this.canvas.beginShape();
    for (let i = 0; i < nodeData.samples.length; i++) {
      const x = this.canvas.map(i, 0, nodeData.samples.length - 1, gx, gx + gw);
      const y = this.canvas.map(nodeData.samples[i], 0, 1, gy + gh, gy);
      this.canvas.vertex(x, y);
    }
    this.canvas.endShape();
  }

  /**
   * Draw playhead indicator
   * @private
   */
  _drawPlayhead(nodeData) {
    const { gx, gy, gw, gh } = nodeData.getGraphRect();
    const playheadX = gx + gw * nodeData.playProgress;
    
    this.canvas.stroke(...COLOR_PLAYHEAD);
    this.canvas.strokeWeight(1);
    this.canvas.line(playheadX, gy, playheadX, gy + gh);
  }

  /**
   * Draw triggers (VTriggers and HTriggers)
   * @private
   */
  _drawTriggers(nodeData) {
    // Draw VTriggers (vertical lines with dots and ports)
    if (nodeData.vTriggers && nodeData.vTriggers.length > 0) {
      for (const trigger of nodeData.vTriggers) {
        this._drawVTrigger(nodeData, trigger);
      }
    }

    // Draw HTriggers (horizontal lines with dots and ports)
    if (nodeData.hTriggers && nodeData.hTriggers.length > 0) {
      for (const trigger of nodeData.hTriggers) {
        this._drawHTrigger(nodeData, trigger);
      }
    }
  }

  /**
   * Draw a single vertical trigger
   * @private
   */
  _drawVTrigger(nodeData, trigger) {
    const renderData = trigger.getRenderData();
    
    // Draw main vertical trigger line
    this.canvas.stroke(...COLOR_TRIGGER_LINE);
    this.canvas.strokeWeight(TRIGGER_LINE_WEIGHT);
    this.canvas.line(renderData.line.x, renderData.line.startY, renderData.line.x, renderData.line.endY);
    
    // Draw input line extension (from input port to node top)
    this.canvas.line(renderData.inputLine.startX, renderData.inputLine.startY, renderData.inputLine.endX, renderData.inputLine.endY);
    
    // Draw output line extension (from node bottom to output port)
    this.canvas.line(renderData.outputLine.startX, renderData.outputLine.startY, renderData.outputLine.endX, renderData.outputLine.endY);
    
    // Draw intersection dot at waveform
    this.canvas.noStroke();
    this.canvas.fill(...COLOR_TRIGGER_DOT);
    this.canvas.circle(renderData.intersectionDot.x, renderData.intersectionDot.y, TRIGGER_DOT_DIAMETER);
    
    // Draw input port (above node) with flash effect
    const inputPortFlashing = false; // Input ports don't flash
    const inputStrokeColor = inputPortFlashing ? PORT_FLASH_COLOR : COLOR_TRIGGER_PORT;
    this.canvas.stroke(...inputStrokeColor);
    this.canvas.strokeWeight(TRIGGER_PORT_WEIGHT);
    this.canvas.fill(...COLOR_BACKGROUND);
    this.canvas.circle(renderData.inputPort.x, renderData.inputPort.y, TRIGGER_PORT_DIAMETER);
    
    // Draw output port (below node) with flash effect
    const outputPortFlashing = trigger.isOutputPortFlashing();
    const outputStrokeColor = outputPortFlashing ? PORT_FLASH_COLOR : COLOR_TRIGGER_PORT;
    this.canvas.stroke(...outputStrokeColor);
    this.canvas.fill(...COLOR_BACKGROUND);
    this.canvas.circle(renderData.outputPort.x, renderData.outputPort.y, TRIGGER_PORT_DIAMETER);
    
    // Draw arrow icon on input port hover
    if (trigger.inputPortHovered) {
      this._drawPortArrow(renderData.inputPort.x, renderData.inputPort.y, VTRIGGER_ARROW_CHAR);
    }
  }

  /**
   * Draw a single horizontal trigger
   * @private
   */
  _drawHTrigger(nodeData, trigger) {
    const renderData = trigger.getRenderData(nodeData);
    
    // Draw horizontal trigger line
    this.canvas.stroke(...COLOR_TRIGGER_LINE);
    this.canvas.strokeWeight(TRIGGER_LINE_WEIGHT);
    this.canvas.line(nodeData.x, renderData.line.y, renderData.line.endX, renderData.line.y);
    
    // Draw crossing dots at up crossing points
    this.canvas.noStroke();
    this.canvas.fill(...COLOR_TRIGGER_DOT);
    if (renderData.upCrossings) {
      for (const dot of renderData.upCrossings) {
        this.canvas.circle(dot.x, dot.y, TRIGGER_DOT_DIAMETER);
      }
    }
    
    // Draw crossing dots at down crossing points
    if (renderData.downCrossings) {
      for (const dot of renderData.downCrossings) {
        this.canvas.circle(dot.x, dot.y, TRIGGER_DOT_DIAMETER);
      }
    }
    
    // Curved connectors from line to ports (draw BEFORE ports so ports appear on top)
    this.canvas.strokeWeight(TRIGGER_LINE_WEIGHT);
    this.canvas.noFill();
    this.canvas.stroke(...COLOR_TRIGGER_CONNECTOR);
    
    // Curve to up port
    this.canvas.bezier(
      renderData.connectors.upCurve.startX, renderData.connectors.upCurve.startY,
      renderData.connectors.upCurve.startX + 15, renderData.connectors.upCurve.startY,
      renderData.connectors.upCurve.endX - 15, renderData.connectors.upCurve.endY,
      renderData.connectors.upCurve.endX, renderData.connectors.upCurve.endY
    );
    
    // Curve to down port
    this.canvas.bezier(
      renderData.connectors.downCurve.startX, renderData.connectors.downCurve.startY,
      renderData.connectors.downCurve.startX + 15, renderData.connectors.downCurve.startY,
      renderData.connectors.downCurve.endX - 15, renderData.connectors.downCurve.endY,
      renderData.connectors.downCurve.endX, renderData.connectors.downCurve.endY
    );
    
    // Draw up/down output ports AFTER curves (so ports appear on top)
    this.canvas.strokeWeight(TRIGGER_PORT_WEIGHT);
    this.canvas.fill(...COLOR_BACKGROUND);
    
    // Up port with flash effect
    const upPortFlashing = trigger.isUpPortFlashing();
    const upStrokeColor = upPortFlashing ? PORT_FLASH_COLOR : COLOR_TRIGGER_PORT;
    this.canvas.stroke(...upStrokeColor);
    this.canvas.circle(renderData.upPort.x, renderData.upPort.y, TRIGGER_PORT_DIAMETER);
    
    // Down port with flash effect
    const downPortFlashing = trigger.isDownPortFlashing();
    const downStrokeColor = downPortFlashing ? PORT_FLASH_COLOR : COLOR_TRIGGER_PORT;
    this.canvas.stroke(...downStrokeColor);
    this.canvas.circle(renderData.downPort.x, renderData.downPort.y, TRIGGER_PORT_DIAMETER);
    
    // Draw arrow icons on port hover
    if (trigger.upPortHovered) {
      this._drawPortArrow(renderData.upPort.x, renderData.upPort.y, HTRIGGER_ARROW_CHAR);
    }
    if (trigger.downPortHovered) {
      this._drawPortArrow(renderData.downPort.x, renderData.downPort.y, HTRIGGER_ARROW_CHAR);
    }
  }

  /**
   * Draw create areas for trigger placement
   * @private
   */
  _drawCreateAreas(nodeData) {
    // Top create area (for V triggers)
    const topRect = nodeData.getTopCreateRect();
    if (topRect.h > 0) {
      const mousePos = this.canvas.getMousePos();
      const overTop = this._isPointInRect(mousePos.x, mousePos.y, topRect);
      
      this.canvas.noStroke();
      this.canvas.fill(255, overTop ? CREATE_AREA_ALPHA_HOVER : CREATE_AREA_ALPHA_NORMAL);
      this.canvas.rect(topRect.x, topRect.y, topRect.w, topRect.h);
      
      // Preview trigger line
      if (overTop) {
        const { gx, gw } = nodeData.getGraphRect();
        const clampedX = this.canvas.constrain(mousePos.x, gx, gx + gw);
        this.canvas.stroke(255);
        this.canvas.strokeWeight(CREATE_AREA_PREVIEW_WEIGHT);
        this.canvas.line(clampedX, nodeData.y, clampedX, nodeData.y + nodeData.h);
      }
    }

    // Right create area (for H triggers)
    const rightRect = nodeData.getRightCreateRect();
    if (rightRect.w > 0) {
      const mousePos = this.canvas.getMousePos();
      const overRight = this._isPointInRect(mousePos.x, mousePos.y, rightRect);
      
      this.canvas.noStroke();
      this.canvas.fill(255, overRight ? CREATE_AREA_ALPHA_HOVER : CREATE_AREA_ALPHA_NORMAL);
      this.canvas.rect(rightRect.x, rightRect.y, rightRect.w, rightRect.h);
      
      // Preview trigger line
      if (overRight) {
        const { gy, gh } = nodeData.getGraphRect();
        const clampedY = this.canvas.constrain(mousePos.y, gy, gy + gh);
        this.canvas.stroke(255);
        this.canvas.strokeWeight(CREATE_AREA_PREVIEW_WEIGHT);
        this.canvas.line(nodeData.x, clampedY, nodeData.x + nodeData.w, clampedY);
      }
    }
  }

  /**
   * Draw selection highlight around node
   */
  drawSelection(nodeData) {
    this.canvas.stroke(80, 160, 255);
    this.canvas.strokeWeight(2);
    this.canvas.noFill();
    
    // Draw selection rectangle slightly larger than node
    const margin = 3;
    this.canvas.rect(
      nodeData.x - margin, 
      nodeData.y - margin, 
      nodeData.w + margin * 2, 
      nodeData.h + margin * 2
    );
  }

  /**
   * Draw deletion overlay
   */
  drawDeletionOverlay(nodeData) {
    // Semi-transparent overlay
    this.canvas.noStroke();
    this.canvas.fill(0, 128);
    this.canvas.rect(nodeData.x, nodeData.y, nodeData.w, nodeData.h);
    
    // Delete icon in center using standardized constant
    const center = nodeData.getCenter();
    this.canvas.drawDeleteIcon(center.x, center.y, DELETE_ICON_R);
  }

  /**
   * Draw hover highlight
   */
  drawHover(nodeData) {
    this.canvas.stroke(255, 255, 255, 100);
    this.canvas.strokeWeight(1);
    this.canvas.noFill();
    
    this.canvas.rect(nodeData.x - 1, nodeData.y - 1, nodeData.w + 2, nodeData.h + 2);
  }

  /**
   * Draw arrow icon on port hover
   * @param {number} x - Port center X position
   * @param {number} y - Port center Y position
   * @param {string} arrowChar - Arrow character to draw
   * @private
   */
  _drawPortArrow(x, y, arrowChar) {
    const arrowSize = TRIGGER_PORT_DIAMETER * PORT_ARROW_SIZE_RATIO;
    
    this.canvas.noStroke();
    this.canvas.fill(...PORT_HOVER_ARROW_COLOR);
    this.canvas.textAlign(this.canvas.CENTER, this.canvas.CENTER);
    this.canvas.textSize(arrowSize);
    this.canvas.text(arrowChar, x, y);
  }

  /**
   * Utility: Check if point is in rectangle
   * @private
   */
  _isPointInRect(px, py, rect) {
    return px >= rect.x && 
           px <= rect.x + rect.w && 
           py >= rect.y && 
           py <= rect.y + rect.h;
  }

  /**
   * Get node bounds for hit testing
   */
  getHitBounds(nodeData, margin = 0) {
    return {
      x: nodeData.x - margin,
      y: nodeData.y - margin,
      w: nodeData.w + margin * 2,
      h: nodeData.h + margin * 2
    };
  }

  /**
   * Get create area bounds for hit testing
   */
  getCreateAreaBounds(nodeData) {
    return {
      top: nodeData.getTopCreateRect(),
      right: nodeData.getRightCreateRect()
    };
  }

  /**
   * Render multiple nodes efficiently
   */
  drawNodes(nodeDataArray, stateMap = {}) {
    // Draw nodes in z-order (back to front)
    for (const nodeData of nodeDataArray) {
      const state = stateMap[nodeData.id] || {};
      this.draw(nodeData, state);
    }
  }

  /**
   * Draw debug information for a node
   */
  drawDebugInfo(nodeData, debugData = {}) {
    this.canvas.fill(255, 200);
    this.canvas.noStroke();
    this.canvas.textAlign(this.canvas.LEFT, this.canvas.TOP);
    this.canvas.textSize(9);
    
    const lines = [
      `ID: ${nodeData.id}`,
      `Pos: ${Math.round(nodeData.x)}, ${Math.round(nodeData.y)}`,
      `Size: ${nodeData.w} × ${nodeData.h}`,
      `Playing: ${nodeData.playing}`,
      `Progress: ${(nodeData.playProgress * 100).toFixed(1)}%`,
      `CC: ${nodeData.cc || 'N/A'}`,
      `Samples: ${nodeData.samples?.length || 0}`
    ];

    // Add custom debug data
    Object.entries(debugData).forEach(([key, value]) => {
      lines.push(`${key}: ${value}`);
    });

    // Render debug lines
    let yOffset = 0;
    lines.forEach((line, index) => {
      this.canvas.text(line, nodeData.x + nodeData.w + 5, nodeData.y + yOffset);
      yOffset += 12;
    });
  }
}
