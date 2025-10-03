/**
 * RecordingRenderer - Renders recording overlay with live waveforms
 * Pure view - handles visual representation of recording state
 * No business logic
 */

import { COLOR_PLAYHEAD } from '../config/constants.js';

export default class RecordingRenderer {
  constructor(canvasManager) {
    this.canvasManager = canvasManager;
    
    // Track graphics buffers for live waveform drawing
    this.trackBuffers = new Map(); // trackId -> p5.Graphics
  }

  /**
   * Render recording session if active
   * @param {object} session - Recording session from RecordingManager
   */
  render(session) {
    if (!session || !session.trackList) return;

    this.canvasManager.push();
    
    // Render each track
    for (const track of session.trackList) {
      this._renderTrack(track, session);
    }

    // Render recording cursor/playhead
    this._renderPlayhead(session);
    
    // Render armed indicator if no tracks yet
    if (session.trackList.length === 0) {
      this._renderArmedIndicator(session);
    }

    this.canvasManager.pop();
  }

  /**
   * Render individual recording track
   * @param {object} track - Recording track
   * @param {object} session - Recording session
   * @private
   */
  _renderTrack(track, session) {
    // Ensure graphics buffer exists for this track
    this._ensureTrackBuffer(track);
    
    // Update track buffer with new waveform data
    this._updateTrackBuffer(track);
    
    // Draw the buffer to main canvas
    const buffer = this.trackBuffers.get(track.index);
    if (buffer) {
      this.canvasManager.push();
      this.canvasManager.translate(track.x, track.y);
      // Note: image() needs to be handled as a global P5.js function
      image(buffer, 0, 0);
      this.canvasManager.pop();
    }

    // Draw track label
    this._renderTrackLabel(track);
    
    // Draw track border for visual feedback
    this._renderTrackBorder(track);
  }

  /**
   * Ensure graphics buffer exists for track
   * @param {object} track - Recording track
   * @private
   */
  _ensureTrackBuffer(track) {
    if (this.trackBuffers.has(track.index)) {
      // Check if buffer needs to be resized
      const buffer = this.trackBuffers.get(track.index);
      if (buffer.width < track.width) {
        this._resizeTrackBuffer(track);
      }
      return;
    }

    // Create new buffer using global P5.js function
    const buffer = createGraphics(Math.max(120, track.width), track.height);
    buffer.pixelDensity(1);
    buffer.background(12); // Dark background
    this.trackBuffers.set(track.index, buffer);
    
    // Initialize track rendering state
    if (!track._renderState) {
      track._renderState = {
        writeX: 0,           // Current pixel position for drawing
        fracPx: 0,           // Fractional pixel accumulation
        lastDrawnValue: null // Last value drawn for continuity
      };
    }
  }

  /**
   * Resize existing track buffer
   * @param {object} track - Recording track
   * @private
   */
  _resizeTrackBuffer(track) {
    const oldBuffer = this.trackBuffers.get(track.index);
    const newBuffer = createGraphics(track.width, track.height);
    newBuffer.pixelDensity(1);
    newBuffer.background(12);
    
    // Copy old content
    if (oldBuffer) {
      newBuffer.image(oldBuffer, 0, 0);
    }
    
    this.trackBuffers.set(track.index, newBuffer);
  }

  /**
   * Update track buffer with latest waveform data
   * Progressive time-based rendering matching monolithic script
   * @param {object} track - Recording track from RecordingManager
   * @private
   */
  _updateTrackBuffer(track) {
    const buffer = this.trackBuffers.get(track.index);
    if (!buffer || track.values.length === 0) return;

    // Ensure render state exists
    if (!track._renderState) {
      track._renderState = {
        writeX: 0,
        fracPx: 0,
        lastDrawnValue: null
      };
    }

    const state = track._renderState;
    const h = buffer.height;
    
    // Value to Y coordinate mapper (0-127 MIDI range to buffer height)
    const valueToY = (val) => map(val, 0, 127, h - 1, 0, true);

    // Get current value
    const currentValue = track.values[track.values.length - 1];

    // Initialize first value
    if (state.lastDrawnValue === null) {
      state.lastDrawnValue = currentValue;
      return;
    }

    // Calculate target X position based on visualWidth from RecordingManager
    // visualWidth advances via RecordingManager.update() using PIXELS_PER_SECOND
    const targetX = Math.min(Math.floor(track.visualWidth), buffer.width - 1);

    // Draw horizontal line segments as position advances
    if (targetX > state.writeX) {
      buffer.stroke(220); // Light gray waveform
      buffer.strokeWeight(1.5);
      buffer.noFill();

      // Draw line from current position to target position at current value
      const y = valueToY(currentValue);
      buffer.line(state.writeX, y, targetX, y);

      // Update position
      state.writeX = targetX;
    }

    // Draw vertical transitions when value changes
    if (currentValue !== state.lastDrawnValue) {
      buffer.stroke(220);
      buffer.strokeWeight(1.5);
      buffer.noFill();

      // Draw vertical line connecting old value to new value at current X
      const y1 = valueToY(state.lastDrawnValue);
      const y2 = valueToY(currentValue);
      buffer.line(state.writeX, y1, state.writeX, y2);

      state.lastDrawnValue = currentValue;
    }
  }

  /**
   * Render track label
   * @param {object} track - Recording track
   * @private
   */
  _renderTrackLabel(track) {
    this.canvasManager.push();
    this.canvasManager.noStroke();
    this.canvasManager.fill(220);
    this.canvasManager.textAlign(this.canvasManager.LEFT, this.canvasManager.TOP);
    this.canvasManager.textSize(12);
    this.canvasManager.text(`${track.label} (REC)`, track.x + 6, track.y - 16);
    this.canvasManager.pop();
  }

  /**
   * Render track border
   * @param {object} track - Recording track
   * @private
   */
  _renderTrackBorder(track) {
    this.canvasManager.push();
    this.canvasManager.stroke(100, 100, 100, 150);
    this.canvasManager.strokeWeight(1);
    this.canvasManager.noFill();
    this.canvasManager.rect(track.x, track.y, track.width, track.height);
    this.canvasManager.pop();
  }

  /**
   * Render recording playhead
   * @param {object} session - Recording session
   * @private
   */
  _renderPlayhead(session) {
    if (session.trackList.length === 0) return;
    
    // Calculate playhead position (rightmost edge of all tracks)
    let maxX = session.startX;
    let minY = Infinity;
    let maxY = -Infinity;
    
    for (const track of session.trackList) {
      maxX = Math.max(maxX, track.x + track.visualWidth);
      minY = Math.min(minY, track.y);
      maxY = Math.max(maxY, track.y + track.height);
    }
    
    // Draw playhead line
    this.canvasManager.push();
    this.canvasManager.stroke(...COLOR_PLAYHEAD, 200);
    this.canvasManager.strokeWeight(2);
    this.canvasManager.line(maxX, minY - 10, maxX, maxY + 10);
    
    // Draw playhead cap
    this.canvasManager.fill(...COLOR_PLAYHEAD, 200);
    this.canvasManager.noStroke();
    // Note: triangle() needs global P5.js function
    triangle(maxX - 4, minY - 10, maxX + 4, minY - 10, maxX, minY - 4);
    this.canvasManager.pop();
  }

  /**
   * Render armed recording indicator when no tracks exist
   * @param {object} session - Recording session
   * @private
   */
  _renderArmedIndicator(session) {
    this.canvasManager.push();
    
    // Pulsing dot
    const pulseAlpha = 100 + 100 * Math.sin(millis() * 0.01);
    this.canvasManager.noStroke();
    this.canvasManager.fill(255, 0, 0, pulseAlpha);
    this.canvasManager.circle(session.startX, session.startY + 40, 8);
    
    // "Armed" text
    this.canvasManager.fill(180);
    this.canvasManager.textAlign(this.canvasManager.LEFT, this.canvasManager.CENTER);
    this.canvasManager.textSize(12);
    this.canvasManager.text('(armed – waiting for CC)', session.startX + 12, session.startY + 40);
    
    this.canvasManager.pop();
  }

  /**
   * Clear all track buffers (call when recording stops)
   */
  clearBuffers() {
    for (const buffer of this.trackBuffers.values()) {
      buffer.remove(); // Free P5.js graphics memory
    }
    this.trackBuffers.clear();
  }

  /**
   * Check if recording overlay should block interaction
   * @param {object} session - Recording session
   * @param {number} x - Mouse X
   * @param {number} y - Mouse Y
   * @returns {boolean} True if overlay blocks interaction
   */
  hitTest(session, x, y) {
    if (!session) return false;
    
    // Check if mouse is over any track area
    for (const track of session.trackList) {
      if (x >= track.x && 
          x <= track.x + track.width && 
          y >= track.y && 
          y <= track.y + track.height) {
        return true;
      }
    }
    
    // Check if near armed indicator
    if (session.trackList.length === 0) {
      const dx = x - session.startX;
      const dy = y - (session.startY + 40);
      return Math.sqrt(dx * dx + dy * dy) <= 20;
    }
    
    return false;
  }

  /**
   * Render simple waveform for completed tracks (fallback rendering)
   * @param {Array} samples - Waveform samples (0-1)
   * @param {number} x - X position
   * @param {number} y - Y position  
   * @param {number} width - Width
   * @param {number} height - Height
   */
  renderStaticWaveform(samples, x, y, width, height) {
    if (!samples || samples.length === 0) return;
    
    this.canvasManager.push();
    this.canvasManager.stroke(220);
    this.canvasManager.strokeWeight(1);
    this.canvasManager.noFill();
    
    this.canvasManager.beginShape();
    for (let i = 0; i < samples.length; i++) {
      const sx = this.canvasManager.map(i, 0, samples.length - 1, x, x + width);
      const sy = this.canvasManager.map(samples[i], 0, 1, y + height, y);
      this.canvasManager.vertex(sx, sy);
    }
    this.canvasManager.endShape();
    
    this.canvasManager.pop();
  }

  /**
   * Get debug information
   */
  getDebugInfo() {
    return {
      trackBufferCount: this.trackBuffers.size,
      trackBuffers: Array.from(this.trackBuffers.keys())
    };
  }
}
