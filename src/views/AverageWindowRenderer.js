/**
 * Average Window Renderer - Pure rendering for average window nodes
 * Stateless rendering functions - no business logic
 * Renders box with left edge resize area (no right edge area)
 */

import { 
  COLOR_NODE_STROKE,
  COLOR_TRIGGER_PORT,
  COLOR_BACKGROUND,
  TRIGGER_PORT_WEIGHT,
  OSCILLOSCOPE_DIAMOND_PORT_SIZE,
  OSCILLOSCOPE_DIAMOND_TEXT_SIZE
} from '../config/constants.js';

export default class AverageWindowRenderer {
  constructor(canvas) {
    this.canvas = canvas;
  }

  /**
   * Render an average window node
   * @param {object} avgWindowData - Average window node data to render
   * @param {object} state - Additional state (hover, selection, etc.)
   */
  draw(avgWindowData, state = {}) {
    const { 
      isHovered = false, 
      isSelected = false, 
      isDragging = false
    } = state;

    // Draw main node box (with thick left edge)
    this._drawNodeBox(avgWindowData, isSelected, isDragging);
    
    // Draw orange waveform if source is selected OR input port is receiving data
    const hasSource = avgWindowData.selectedSource;
    const hasInputData = avgWindowData.lastDataTime && (performance.now() - avgWindowData.lastDataTime) < 500;
    
    if (hasSource || hasInputData) {
      this._drawWaveform(avgWindowData);
    }
    
    // Draw diamond-shaped CC ports
    this._drawCCPorts(avgWindowData);
    
    // Draw node label/header
    this._drawLabel(avgWindowData);
  }

  /**
   * Draw the main node box outline with thick left edge (3px)
   * @private
   */
  _drawNodeBox(avgWindowData, isSelected, isDragging) {
    const alpha = isDragging ? 180 : 255;
    const { x, y, w, h } = avgWindowData;
    
    this.canvas.noFill();
    
    // Draw left edge with 3px stroke (resize handle indicator)
    this.canvas.stroke(255, 255, 255, alpha);
    this.canvas.strokeWeight(3);
    this.canvas.line(x, y, x, y + h);
    
    // Draw other three edges with 1px stroke
    this.canvas.strokeWeight(1);
    this.canvas.line(x, y, x + w, y);           // Top edge
    this.canvas.line(x + w, y, x + w, y + h);   // Right edge
    this.canvas.line(x, y + h, x + w, y + h);   // Bottom edge
  }

  /**
   * Draw orange waveform from buffer data
   * Shows entire buffer (all samples visible)
   * @private
   */
  _drawWaveform(avgWindowData) {
    const { x, y, w, h, buffer, bufferIndex } = avgWindowData;
    const bufferLength = buffer.length;
    
    if (bufferLength === 0) return;
    
    // Orange color (RGB)
    this.canvas.stroke(255, 165, 0);
    this.canvas.strokeWeight(1.5);
    this.canvas.noFill();
    
    // Draw waveform as continuous line through all buffer samples
    this.canvas.beginShape();
    
    // Read entire buffer from oldest to newest (right-to-left scrolling effect)
    for (let i = 0; i < bufferLength; i++) {
      // Read backwards from write position (oldest data first)
      const bufferPos = (bufferIndex - bufferLength + i + bufferLength) % bufferLength;
      const value = buffer[bufferPos];
      
      // Map buffer position to screen X (0 to w)
      const screenX = x + i;
      
      // Map value (0-1) to screen Y (inverted: 0=top, 1=bottom)
      const screenY = this.canvas.map(value, 0, 1, y + h, y);
      
      this.canvas.vertex(screenX, screenY);
    }
    
    this.canvas.endShape();
  }

  /**
   * Draw diamond-shaped CC input/output ports (matches OscilloscopeRenderer)
   * Shows current CC value (0-127) inside each diamond
   * @private
   */
  _drawCCPorts(avgWindowData) {
    const size = OSCILLOSCOPE_DIAMOND_PORT_SIZE;
    const halfSize = size / 2;
    const ccValue = avgWindowData.getCurrentCCValue();
    
    // Draw input port (left edge)
    const inputPos = avgWindowData.getCCInputPortPosition();
    this._drawSingleDiamond(inputPos.x, inputPos.y, halfSize, ccValue);
    
    // Draw output port (right edge)
    const outputPos = avgWindowData.getCCOutputPortPosition();
    this._drawSingleDiamond(outputPos.x, outputPos.y, halfSize, ccValue);
  }

  /**
   * Draw a single diamond shape with CC value (matches OscilloscopeRenderer)
   * @param {number} x - Center X position
   * @param {number} y - Center Y position
   * @param {number} halfSize - Half of diamond size
   * @param {number} ccValue - CC value to display (0-127)
   * @private
   */
  _drawSingleDiamond(x, y, halfSize, ccValue) {
    // Draw diamond using beginShape/vertex (4 vertices forming a rotated square)
    this.canvas.stroke(...COLOR_TRIGGER_PORT); // White outline
    this.canvas.strokeWeight(TRIGGER_PORT_WEIGHT);
    this.canvas.fill(...COLOR_BACKGROUND); // Gray fill
    
    this.canvas.beginShape();
    this.canvas.vertex(x, y - halfSize);  // Top vertex
    this.canvas.vertex(x + halfSize, y);  // Right vertex
    this.canvas.vertex(x, y + halfSize);  // Bottom vertex
    this.canvas.vertex(x - halfSize, y);  // Left vertex
    this.canvas.vertex(x, y - halfSize);  // Back to top (close shape)
    this.canvas.endShape();
    
    // Draw CC value text inside diamond
    this.canvas.noStroke();
    this.canvas.fill(255); // White text
    this.canvas.textAlign(this.canvas.CENTER, this.canvas.CENTER);
    this.canvas.textSize(OSCILLOSCOPE_DIAMOND_TEXT_SIZE);
    this.canvas.text(ccValue.toString(), x, y);
  }

  /**
   * Draw node label (positioned at top-left, matching NodeRenderer)
   * @private
   */
  _drawLabel(avgWindowData) {
    this.canvas.noStroke();
    this.canvas.fill(255);
    this.canvas.textAlign(this.canvas.LEFT, this.canvas.TOP);
    this.canvas.textSize(11);
    
    const displayHeader = avgWindowData.getDisplayHeader();
    
    // Position at top-left with 6px left padding and 4px top padding (matches NodeRenderer)
    this.canvas.text(displayHeader, avgWindowData.x + 6, avgWindowData.y + 4);
  }


  /**
   * Draw selection highlight around node
   */
  drawSelection(avgWindowData) {
    this.canvas.stroke(80, 160, 255);
    this.canvas.strokeWeight(2);
    this.canvas.noFill();
    
    // Draw selection rectangle slightly larger than node
    const margin = 3;
    this.canvas.rect(
      avgWindowData.x - margin, 
      avgWindowData.y - margin, 
      avgWindowData.w + margin * 2, 
      avgWindowData.h + margin * 2
    );
  }

  /**
   * Draw deletion overlay
   */
  drawDeletionOverlay(avgWindowData) {
    // Semi-transparent overlay
    this.canvas.noStroke();
    this.canvas.fill(0, 128);
    this.canvas.rect(avgWindowData.x, avgWindowData.y, avgWindowData.w, avgWindowData.h);
    
    // Delete icon in center
    const center = avgWindowData.getCenter();
    this.canvas.drawDeleteIcon(center.x, center.y);
  }

  /**
   * Draw hover highlight
   */
  drawHover(avgWindowData) {
    this.canvas.stroke(255, 255, 255, 100);
    this.canvas.strokeWeight(1);
    this.canvas.noFill();
    
    this.canvas.rect(avgWindowData.x - 1, avgWindowData.y - 1, avgWindowData.w + 2, avgWindowData.h + 2);
  }

  /**
   * Get node bounds for hit testing
   */
  getHitBounds(avgWindowData, margin = 0) {
    return {
      x: avgWindowData.x - margin,
      y: avgWindowData.y - margin,
      w: avgWindowData.w + margin * 2,
      h: avgWindowData.h + margin * 2
    };
  }

  /**
   * Get left edge bounds for hit testing
   */
  getLeftEdgeBounds(avgWindowData) {
    return avgWindowData.getLeftResizeRect();
  }
}
