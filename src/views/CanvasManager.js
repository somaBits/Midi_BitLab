/**
 * Canvas Manager - P5.js integration and canvas lifecycle
 * Wraps P5.js global functions for use by renderers
 * Provides stateless rendering context to other view components
 */

import { FONT_FAMILY, COLOR_BACKGROUND, DELETE_ICON_R, DELETE_ICON_CROSS_RATIO } from '../config/constants.js';

export default class CanvasManager {
  constructor() {
    this.initialized = false;
    this.canvas = null;
    this.width = 0;
    this.height = 0;
  }

  /**
   * Initialize canvas (called from p5 setup)
   */
  init() {
    if (this.initialized) return;
    
    this.canvas = createCanvas(windowWidth, windowHeight);
    this.width = windowWidth;
    this.height = windowHeight;
    
    // Set up canvas properties
    pixelDensity(Math.min(2, window.devicePixelRatio || 1));
    textFont(FONT_FAMILY);
    
    this.initialized = true;
  }

  /**
   * Handle window resize (called from p5 windowResized)
   */
  resize() {
    if (!this.initialized) return;
    
    resizeCanvas(windowWidth, windowHeight);
    this.width = windowWidth;
    this.height = windowHeight;
  }

  /**
   * Clear canvas with background color
   */
  clear() {
    background(...COLOR_BACKGROUND);
  }

  /**
   * Get current mouse position
   */
  getMousePos() {
    return { x: mouseX, y: mouseY };
  }

  /**
   * Check if mouse is pressed
   */
  isMousePressed() {
    return mouseIsPressed;
  }

  /**
   * Get current time in milliseconds
   */
  getTime() {
    return millis();
  }

  /**
   * Drawing context helpers - wrapped P5.js functions
   */
  
  // Shapes
  rect(x, y, w, h) {
    return rect(x, y, w, h);
  }

  circle(x, y, diameter) {
    return circle(x, y, diameter);
  }

  line(x1, y1, x2, y2) {
    return line(x1, y1, x2, y2);
  }

  // Curves
  bezier(x1, y1, x2, y2, x3, y3, x4, y4) {
    return bezier(x1, y1, x2, y2, x3, y3, x4, y4);
  }

  beginShape() {
    return beginShape();
  }

  endShape() {
    return endShape();
  }

  vertex(x, y) {
    return vertex(x, y);
  }

  // Text
  text(str, x, y) {
    return text(str, x, y);
  }

  textAlign(alignX, alignY) {
    return textAlign(alignX, alignY);
  }

  textSize(size) {
    return textSize(size);
  }

  // Styling
  fill(...color) {
    if (color.length === 0) {
      return fill(255);
    } else if (color.length === 1) {
      return fill(color[0]);
    } else if (color.length === 3) {
      return fill(color[0], color[1], color[2]);
    } else if (color.length === 4) {
      return fill(color[0], color[1], color[2], color[3]);
    }
    return fill(...color);
  }

  noFill() {
    return noFill();
  }

  stroke(...color) {
    if (color.length === 0) {
      return stroke(255);
    } else if (color.length === 1) {
      return stroke(color[0]);
    } else if (color.length === 3) {
      return stroke(color[0], color[1], color[2]);
    } else if (color.length === 4) {
      return stroke(color[0], color[1], color[2], color[3]);
    }
    return stroke(...color);
  }

  noStroke() {
    return noStroke();
  }

  strokeWeight(weight) {
    return strokeWeight(weight);
  }

  // Transform
  push() {
    return push();
  }

  pop() {
    return pop();
  }

  translate(x, y) {
    return translate(x, y);
  }

  rotate(angle) {
    return rotate(angle);
  }

  scale(sx, sy) {
    if (sy === undefined) {
      return scale(sx);
    }
    return scale(sx, sy);
  }

  // Math helpers
  map(value, start1, stop1, start2, stop2) {
    return map(value, start1, stop1, start2, stop2);
  }

  constrain(n, low, high) {
    return constrain(n, low, high);
  }

  lerp(start, stop, amt) {
    return lerp(start, stop, amt);
  }

  // Create vector (P5.Vector)
  createVector(x, y) {
    return createVector(x, y);
  }

  // Constants
  get PI() { return PI; }
  get TWO_PI() { return TWO_PI; }
  get LEFT() { return LEFT; }
  get RIGHT() { return RIGHT; }
  get CENTER() { return CENTER; }
  get TOP() { return TOP; }
  get BOTTOM() { return BOTTOM; }

  /**
   * Utility: Draw standardized delete icon
   * Circle with white stroke, black fill, 45° cross in center
   * Matches port diameter for consistency
   */
  drawDeleteIcon(x, y, radius = DELETE_ICON_R) {
    // Draw circle with white stroke and black fill
    this.stroke(255, 255, 255);
    this.strokeWeight(1);
    this.fill(0, 0, 0);
    this.circle(x, y, radius * 2);
    
    // Draw 45° rotated cross (diagonal lines)
    const arm = radius * DELETE_ICON_CROSS_RATIO;
    this.stroke(255, 255, 255);
    this.strokeWeight(1.5);
    
    // Diagonal line from top-left to bottom-right
    this.line(x - arm, y - arm, x + arm, y + arm);
    // Diagonal line from top-right to bottom-left
    this.line(x + arm, y - arm, x - arm, y + arm);
  }

  /**
   * Utility: Draw guide line
   */
  drawGuideLine(isVertical, position, alpha = 190) {
    this.stroke(80, 160, 255, alpha);
    this.strokeWeight(1);
    
    if (isVertical) {
      this.line(position, 0, position, this.height);
    } else {
      this.line(0, position, this.width, position);
    }
  }

  /**
   * Get the underlying canvas 2D context for advanced operations
   */
  get drawingContext() {
    return drawingContext; // P5.js global
  }

  /**
   * Get canvas dimensions
   */
  getDimensions() {
    return { width: this.width, height: this.height };
  }

  /**
   * Check if point is within canvas bounds
   */
  isPointInBounds(x, y) {
    return x >= 0 && x <= this.width && y >= 0 && y <= this.height;
  }

  /**
   * Set cursor style
   * @param {string} cursorType - CSS cursor type (default, pointer, ew-resize, ns-resize, etc.)
   */
  setCursor(cursorType = 'default') {
    // Use global P5.js cursor function
    if (typeof window.cursor === 'function') {
      window.cursor(cursorType);
    }
  }

  /**
   * Reset cursor to default
   */
  resetCursor() {
    // Use global P5.js cursor function
    if (typeof window.cursor === 'function') {
      window.cursor('default');
    }
  }
}
