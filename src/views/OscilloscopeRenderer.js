/**
 * Oscilloscope Renderer - Pure rendering for oscilloscope nodes
 * Stateless rendering functions - no business logic
 * Renders real-time scrolling waveform with right-to-left movement
 */

import { 
  COLOR_NODE_STROKE,
  COLOR_TRIGGER_LINE,
  COLOR_TRIGGER_DOT,
  COLOR_TRIGGER_PORT,
  COLOR_TRIGGER_CONNECTOR,
  COLOR_BACKGROUND,
  COLOR_WAVEFORM_OSCILLOSCOPE,
  COLOR_PREVIEW_LINE,
  TRIGGER_LINE_WEIGHT,
  TRIGGER_PORT_WEIGHT,
  TRIGGER_PORT_DIAMETER,
  TRIGGER_DOT_DIAMETER,
  NODE_BORDER_WEIGHT_NORMAL,
  NODE_BORDER_WEIGHT_SELECTED,
  CREATE_AREA_ALPHA_NORMAL,
  CREATE_AREA_ALPHA_HOVER,
  CREATE_AREA_PREVIEW_WEIGHT,
  PORT_FLASH_COLOR,
  PORT_ARROW_SIZE_RATIO,
  PORT_HOVER_ARROW_COLOR,
  HTRIGGER_ARROW_CHAR,
  OSCILLOSCOPE_LIVE_INDICATOR_COLOR,
  OSCILLOSCOPE_LIVE_INDICATOR_SIZE
} from '../config/constants.js';

export default class OscilloscopeRenderer {
  constructor(canvas) {
    this.canvas = canvas;
  }

  /**
   * Render an oscilloscope node
   * @param {object} oscilloscopeData - Oscilloscope node data to render
   * @param {object} state - Additional state (hover, selection, etc.)
   */
  draw(oscilloscopeData, state = {}) {
    const { 
      isHovered = false, 
      isSelected = false, 
      isDragging = false,
      showCreateAreas = false 
    } = state;

    // Draw main node box
    this._drawNodeBox(oscilloscopeData, isSelected, isDragging);
    
    // Draw node label/header
    this._drawLabel(oscilloscopeData);
    
    // Draw oscilloscope waveform (right-to-left scrolling)
    this._drawWaveform(oscilloscopeData);
    
    // Draw HTriggers (no VTriggers)
    this._drawHTriggers(oscilloscopeData);

    // Draw create area if hovered (right edge only)
    if (showCreateAreas && (isHovered || isDragging)) {
      this._drawRightCreateArea(oscilloscopeData);
    }
  }

  /**
   * Draw the main node box outline
   * @private
   */
  _drawNodeBox(oscilloscopeData, isSelected, isDragging) {
    this.canvas.stroke(...COLOR_NODE_STROKE);
    this.canvas.strokeWeight(isSelected ? NODE_BORDER_WEIGHT_SELECTED : NODE_BORDER_WEIGHT_NORMAL);
    this.canvas.noFill();
    
    if (isDragging) {
      // Add slight transparency when dragging
      this.canvas.stroke(255, 255, 255, 180);
    }
    
    this.canvas.rect(oscilloscopeData.x, oscilloscopeData.y, oscilloscopeData.w, oscilloscopeData.h);
  }

  /**
   * Draw node label (source or placeholder)
   * @private
   */
  _drawLabel(oscilloscopeData) {
    this.canvas.noStroke();
    this.canvas.fill(255);
    this.canvas.textAlign(this.canvas.LEFT, this.canvas.TOP);
    this.canvas.textSize(11);
    
    const displayHeader = oscilloscopeData.getDisplayHeader();
    
    this.canvas.text(displayHeader, oscilloscopeData.x + 6, oscilloscopeData.y + 4);
  }

  /**
   * Draw the oscilloscope waveform with right-to-left scrolling
   * Uses sliding window approach - shows only most recent data
   * @private
   */
  _drawWaveform(oscilloscopeData) {
    if (!oscilloscopeData.buffer || oscilloscopeData.buffer.length === 0) return;
    
    const { gx, gy, gw, gh } = oscilloscopeData.getGraphRect();
    const buffer = oscilloscopeData.buffer;
    const bufferLength = buffer.length;
    const writePos = oscilloscopeData.bufferIndex;
    
    // DEBUG: Log actual values to find stretch source
    if (Math.random() < 0.01) { // Only log occasionally to avoid spam
      console.log(`[OSCILLOSCOPE DEBUG] gw=${gw}, bufferLength=${bufferLength}, writePos=${writePos}`);
      console.log(`[OSCILLOSCOPE DEBUG] Node dimensions: x=${oscilloscopeData.x}, y=${oscilloscopeData.y}, w=${oscilloscopeData.w}, h=${oscilloscopeData.h}`);
      console.log(`[OSCILLOSCOPE DEBUG] Graph rect: gx=${gx}, gy=${gy}, gw=${gw}, gh=${gh}`);
    }
    
    // Only show the most recent 'gw' pixels worth of data (sliding window)
    const pixelsToShow = Math.min(gw, bufferLength);
    
    // Use custom node color if available, otherwise fallback to constant
    const color = oscilloscopeData.getWaveformColor ? oscilloscopeData.getWaveformColor() : COLOR_WAVEFORM_OSCILLOSCOPE;
    this.canvas.stroke(...color);
    this.canvas.strokeWeight(1);
    this.canvas.noFill();
    
    // Draw waveform path - sliding window of most recent data
    this.canvas.beginShape();
    
    let firstX = null;
    let lastX = null;
    let vertexCount = 0;
    
    for (let i = 0; i < pixelsToShow; i++) {
      // Read backwards from write position (newest data on right edge)
      // writePos points to NEXT position to write, so writePos-1 is newest
      const bufferPos = (writePos - pixelsToShow + i + bufferLength) % bufferLength;
      const value = buffer[bufferPos];
      
      // Map to screen X (left to right across visible width)
      const x = gx + i;
      
      // Map value to screen Y (inverted: 0=bottom, 1=top)
      const y = this.canvas.map(value, 0, 1, gy + gh, gy);
      
      this.canvas.vertex(x, y);
      
      // Track first and last X for debugging
      if (firstX === null) firstX = x;
      lastX = x;
      vertexCount++;
    }
    
    this.canvas.endShape();
    
    // DEBUG: Log waveform rendering details
    if (Math.random() < 0.01) {
      console.log(`[OSCILLOSCOPE WAVEFORM] vertexCount=${vertexCount}, pixelsToShow=${pixelsToShow}`);
      console.log(`[OSCILLOSCOPE WAVEFORM] X range: ${firstX} to ${lastX}, width=${lastX - firstX + 1}px`);
    }
  }

  /**
   * Draw LIVE indicator (red dot in top-right corner)
   * @private
   */
  _drawLiveIndicator(oscilloscopeData) {
    // Position in top-right corner with small margin
    const x = oscilloscopeData.x + oscilloscopeData.w - 8;
    const y = oscilloscopeData.y + 8;
    
    // Draw filled red circle
    this.canvas.noStroke();
    
    // Pulse effect when receiving data
    if (oscilloscopeData.isReceivingData) {
      this.canvas.fill(...OSCILLOSCOPE_LIVE_INDICATOR_COLOR);
    } else {
      // Dimmed when no data
      this.canvas.fill(OSCILLOSCOPE_LIVE_INDICATOR_COLOR[0], 
                       OSCILLOSCOPE_LIVE_INDICATOR_COLOR[1], 
                       OSCILLOSCOPE_LIVE_INDICATOR_COLOR[2], 
                       100);
    }
    
    this.canvas.circle(x, y, OSCILLOSCOPE_LIVE_INDICATOR_SIZE);
  }

  /**
   * Draw HTriggers (horizontal triggers only)
   * @private
   */
  _drawHTriggers(oscilloscopeData) {
    if (!oscilloscopeData.hTriggers || oscilloscopeData.hTriggers.length === 0) {
      return;
    }
    
    for (const trigger of oscilloscopeData.hTriggers) {
      this._drawHTrigger(oscilloscopeData, trigger);
    }
  }

  /**
   * Draw a single horizontal trigger
   * @private
   */
  _drawHTrigger(oscilloscopeData, trigger) {
    const renderData = trigger.getRenderData(oscilloscopeData);
    
    // Draw horizontal trigger line
    this.canvas.stroke(...COLOR_TRIGGER_LINE);
    this.canvas.strokeWeight(TRIGGER_LINE_WEIGHT);
    this.canvas.line(oscilloscopeData.x, renderData.line.y, renderData.line.endX, renderData.line.y);
    
    // Get crossing positions from oscilloscope node's circular buffer
    const crossings = oscilloscopeData.getHTriggerCrossings(trigger);
    
    // Draw crossing dots at up crossing points
    this.canvas.noStroke();
    this.canvas.fill(...COLOR_TRIGGER_DOT);
    if (crossings.upCrossings) {
      for (const dot of crossings.upCrossings) {
        this.canvas.circle(dot.x, dot.y, TRIGGER_DOT_DIAMETER);
      }
    }
    
    // Draw crossing dots at down crossing points
    if (crossings.downCrossings) {
      for (const dot of crossings.downCrossings) {
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
   * Draw right create area for HTrigger placement
   * @private
   */
  _drawRightCreateArea(oscilloscopeData) {
    const rightRect = oscilloscopeData.getRightCreateRect();
    if (rightRect.w === 0) return;
    
    const mousePos = this.canvas.getMousePos();
    const overRight = this._isPointInRect(mousePos.x, mousePos.y, rightRect);
    
    this.canvas.noStroke();
    this.canvas.fill(255, overRight ? CREATE_AREA_ALPHA_HOVER : CREATE_AREA_ALPHA_NORMAL);
    this.canvas.rect(rightRect.x, rightRect.y, rightRect.w, rightRect.h);
    
    // Preview trigger line
    if (overRight) {
      const { gy, gh } = oscilloscopeData.getGraphRect();
      const clampedY = this.canvas.constrain(mousePos.y, gy, gy + gh);
      this.canvas.stroke(...COLOR_PREVIEW_LINE);
      this.canvas.strokeWeight(CREATE_AREA_PREVIEW_WEIGHT);
      this.canvas.line(oscilloscopeData.x, clampedY, oscilloscopeData.x + oscilloscopeData.w, clampedY);
    }
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
   * Draw selection highlight around oscilloscope
   */
  drawSelection(oscilloscopeData) {
    this.canvas.stroke(80, 160, 255);
    this.canvas.strokeWeight(2);
    this.canvas.noFill();
    
    // Draw selection rectangle slightly larger than node
    const margin = 3;
    this.canvas.rect(
      oscilloscopeData.x - margin, 
      oscilloscopeData.y - margin, 
      oscilloscopeData.w + margin * 2, 
      oscilloscopeData.h + margin * 2
    );
  }

  /**
   * Draw deletion overlay
   */
  drawDeletionOverlay(oscilloscopeData) {
    // Semi-transparent overlay
    this.canvas.noStroke();
    this.canvas.fill(0, 128);
    this.canvas.rect(oscilloscopeData.x, oscilloscopeData.y, oscilloscopeData.w, oscilloscopeData.h);
    
    // Delete icon in center
    const center = oscilloscopeData.getCenter();
    this.canvas.drawDeleteIcon(center.x, center.y);
  }

  /**
   * Draw hover highlight
   */
  drawHover(oscilloscopeData) {
    this.canvas.stroke(255, 255, 255, 100);
    this.canvas.strokeWeight(1);
    this.canvas.noFill();
    
    this.canvas.rect(oscilloscopeData.x - 1, oscilloscopeData.y - 1, oscilloscopeData.w + 2, oscilloscopeData.h + 2);
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
   * Get oscilloscope bounds for hit testing
   */
  getHitBounds(oscilloscopeData, margin = 0) {
    return {
      x: oscilloscopeData.x - margin,
      y: oscilloscopeData.y - margin,
      w: oscilloscopeData.w + margin * 2,
      h: oscilloscopeData.h + margin * 2
    };
  }

  /**
   * Get create area bounds for hit testing
   */
  getCreateAreaBounds(oscilloscopeData) {
    return {
      top: { x: 0, y: 0, w: 0, h: 0 }, // No top area (VTriggers disabled)
      right: oscilloscopeData.getRightCreateRect()
    };
  }
}
