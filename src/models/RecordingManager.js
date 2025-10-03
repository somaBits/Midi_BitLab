/**
 * RecordingManager - Manages MIDI CC recording sessions
 * Pure model - handles recording state, track management, and data processing
 * No rendering logic
 */

import EventEmitter from '../utils/EventEmitter.js';
import { PIXELS_PER_SECOND } from '../config/constants.js';

export default class RecordingManager extends EventEmitter {
  constructor() {
    super();
    
    // Recording session state
    this.isRecording = false;
    this.session = null;
    
    // Configuration
    this.simultaneousWindowMs = 5; // CC messages within 5ms are considered simultaneous
  }

  /**
   * Start recording at specified position
   * @param {number} x - Start X position
   * @param {number} y - Start Y position
   */
  startRecording(x, y) {
    if (this.isRecording) {
      this.stopRecording();
    }

    this.session = {
      id: Date.now(),
      startX: Math.floor(x),
      startY: Math.floor(y),
      startTime: performance.now(),
      firstEventTime: null,
      tracks: new Map(), // key: `${sourceId}:${channel}:${cc}` -> RecordingTrack
      trackList: [], // ordered list for rendering
      isStackingMode: true, // true while within simultaneous window
      lastUpdateTime: performance.now()
    };

    this.isRecording = true;
    
    this.emit('recording-started', {
      sessionId: this.session.id,
      position: { x: this.session.startX, y: this.session.startY }
    });
  }

  /**
   * Stop recording and clear session
   */
  stopRecording() {
    if (!this.isRecording || !this.session) return;

    const sessionData = {
      sessionId: this.session.id,
      tracks: this.session.trackList,
      duration: performance.now() - this.session.startTime
    };

    this.isRecording = false;
    this.session = null;

    this.emit('recording-stopped', sessionData);
  }

  /**
   * Record a MIDI CC message
   * @param {number} channel - MIDI channel (1-16)
   * @param {number} cc - CC number (0-127)
   * @param {number} value - CC value (0-127)
   * @param {number} timestamp - Event timestamp
   * @param {object} source - MIDI source device info
   */
  recordCC(channel, cc, value, timestamp, source = null) {
    if (!this.isRecording || !this.session) return;

    const now = timestamp || performance.now();
    
    // Set first event time for simultaneous window calculation
    if (this.session.firstEventTime === null) {
      this.session.firstEventTime = now;
      this.session.isStackingMode = true;
    }

    // Check if we're still in simultaneous window
    const timeSinceFirst = now - this.session.firstEventTime;
    if (this.session.isStackingMode && timeSinceFirst > this.simultaneousWindowMs) {
      this.session.isStackingMode = false;
    }

    // Create track key
    const sourceId = source?.id || 'unknown';
    const trackKey = `${sourceId}:${channel}:${cc}`;
    
    let track = this.session.tracks.get(trackKey);
    
    if (!track) {
      // Create new track
      const trackIndex = this.session.trackList.length;
      const offsetX = this.session.isStackingMode ? 0 : this._getCurrentRecordingWidth();
      
      track = new RecordingTrack(
        trackIndex,
        this.session.startX + offsetX,
        this.session.startY + (trackIndex * 80), // No gap - direct stacking
        channel,
        cc,
        source
      );
      
      this.session.tracks.set(trackKey, track);
      this.session.trackList.push(track);

      // If we added a horizontal track, exit stacking mode
      if (!this.session.isStackingMode) {
        this.session.isStackingMode = false;
      }

      this.emit('track-created', { track, sessionId: this.session.id });
    }

    // Record the value
    track.recordValue(value, now);

    this.emit('cc-recorded', {
      sessionId: this.session.id,
      trackKey,
      channel,
      cc,
      value,
      timestamp: now
    });
  }

  /**
   * Update recording visualization (call from animation loop)
   * @param {number} deltaTime - Time since last update
   */
  update(deltaTime) {
    if (!this.isRecording || !this.session) return;

    const now = performance.now();
    const dt = now - this.session.lastUpdateTime;
    this.session.lastUpdateTime = now;

    // Update all tracks
    for (const track of this.session.trackList) {
      track.update(dt);
    }

    this.emit('recording-updated', {
      sessionId: this.session.id,
      deltaTime: dt
    });
  }

  /**
   * Get current recording width (for horizontal positioning)
   * @private
   */
  _getCurrentRecordingWidth() {
    if (!this.session || this.session.trackList.length === 0) return 0;
    
    let maxWidth = 0;
    for (const track of this.session.trackList) {
      maxWidth = Math.max(maxWidth, track.getVisualWidth());
    }
    return maxWidth;
  }

  /**
   * Commit recording session to create nodes
   * @returns {Array} Array of node data for creation
   */
  commitRecording() {
    if (!this.isRecording || !this.session) return [];

    // Calculate full session duration (not just last CC timestamp)
    const sessionDuration = performance.now() - this.session.startTime;

    const nodeDataList = [];
    
    for (let i = 0; i < this.session.trackList.length; i++) {
      const track = this.session.trackList[i];
      const nodeData = track.generateNodeData(i, sessionDuration);
      if (nodeData) {
        nodeDataList.push(nodeData);
      }
    }

    const sessionData = {
      sessionId: this.session.id,
      nodeDataList,
      tracksCommitted: this.session.trackList.length
    };

    this.stopRecording();

    this.emit('recording-committed', sessionData);
    
    return nodeDataList;
  }

  /**
   * Cancel recording without creating nodes
   */
  cancelRecording() {
    if (!this.isRecording || !this.session) return;

    const sessionId = this.session.id;
    this.stopRecording();

    this.emit('recording-cancelled', { sessionId });
  }

  /**
   * Get current recording state
   */
  getState() {
    return {
      isRecording: this.isRecording,
      session: this.session ? {
        id: this.session.id,
        startX: this.session.startX,
        startY: this.session.startY,
        trackCount: this.session.trackList.length,
        duration: performance.now() - this.session.startTime,
        isStackingMode: this.session.isStackingMode
      } : null
    };
  }

  /**
   * Get recording session for rendering
   */
  getSessionForRendering() {
    return this.session;
  }

  /**
   * Check if a point hits any recording track
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {object|null} Hit track or null
   */
  hitTest(x, y) {
    if (!this.session) return null;
    
    for (const track of this.session.trackList) {
      if (track.hitTest(x, y)) {
        return track;
      }
    }
    return null;
  }
}

/**
 * RecordingTrack - Individual track within a recording session
 */
class RecordingTrack {
  constructor(index, x, y, channel, cc, source = null) {
    this.index = index;
    this.x = x;
    this.y = y;
    this.channel = channel;
    this.cc = cc;
    this.source = source;
    
    // Track dimensions
    this.width = 120; // Initial width
    this.height = 80; // Standard node height
    
    // Recording data
    this.values = []; // CC values
    this.timestamps = []; // Relative timestamps from first event
    this.firstTimestamp = null; // Absolute timestamp of first event
    this.visualWidth = 0; // Current visual width for drawing
    
    // Visual state
    this.lastValue = 0;
    this.pixelsPerMs = PIXELS_PER_SECOND / 1000;
    
    // Display info
    this.deviceName = this._getDeviceDisplayName();
    this.label = `${this.deviceName} ▸ CC ${cc}`;
  }

  /**
   * Record a new CC value
   * @param {number} value - CC value (0-127)
   * @param {number} timestamp - Absolute timestamp
   */
  recordValue(value, timestamp) {
    // Store first timestamp as reference point
    if (this.firstTimestamp === null) {
      this.firstTimestamp = timestamp;
    }
    
    // Calculate relative time from first event
    const relativeTime = timestamp - this.firstTimestamp;
    
    if (this.values.length === 0 || value !== this.lastValue) {
      this.values.push(value);
      this.timestamps.push(relativeTime);
      this.lastValue = value;
    }
  }

  /**
   * Update visual state
   * @param {number} deltaTime - Time since last update
   */
  update(deltaTime) {
    // Update visual width based on time progression
    this.visualWidth += deltaTime * this.pixelsPerMs;
    this.width = Math.max(120, Math.floor(this.visualWidth));
  }

  /**
   * Get current visual width
   */
  getVisualWidth() {
    return this.width;
  }

  /**
   * Test if point hits this track
   * @param {number} x - X coordinate  
   * @param {number} y - Y coordinate
   */
  hitTest(x, y) {
    return x >= this.x && 
           x <= this.x + this.width && 
           y >= this.y && 
           y <= this.y + this.height;
  }

  /**
   * Generate node creation data
   * @param {number} stackIndex - Index for vertical stacking
   * @param {number} sessionDuration - Full session duration in ms (optional)
   */
  generateNodeData(stackIndex, sessionDuration = null) {
    if (this.values.length === 0) return null;

    // Create a copy of timestamps/values to avoid modifying original data
    const timestamps = [...this.timestamps];
    const values = [...this.values];
    
    // Use full session duration if provided, otherwise use last CC timestamp
    let totalDuration;
    if (sessionDuration !== null && this.firstTimestamp !== null) {
      // Calculate when the session ends relative to this track's first timestamp
      const sessionEndTime = performance.now();
      totalDuration = sessionEndTime - this.firstTimestamp;
      
      // Add final timestamp to extend interpolation range to end of session
      if (values.length > 0 && timestamps.length > 0) {
        const lastCCTime = Math.max(...timestamps);
        if (totalDuration > lastCCTime) {
          // Extend the waveform with the last value held until session end
          timestamps.push(totalDuration);
          values.push(values[values.length - 1]);
        }
      }
      
      totalDuration = Math.max(totalDuration, 0);
    } else {
      totalDuration = timestamps.length > 0 ? Math.max(...timestamps) : 0;
    }
    
    // Use visual width for final node size (matches what user saw during recording)
    // Add bounds checking to prevent invalid array lengths
    const safeVisualWidth = Math.max(0, Math.min(this.visualWidth, 2000)); // Cap at reasonable size
    const nodeWidth = Math.max(120, Math.floor(safeVisualWidth)); // Match live recording logic exactly
    const targetSamples = Math.max(1, Math.min(nodeWidth, 2000)); // Ensure valid sample count
    
    // Ensure totalDuration is reasonable
    const safeTotalDuration = Math.max(0, Math.min(totalDuration, 300000)); // Cap at 5 minutes
    
    // Resample values to create waveform samples using extended timestamps/values
    const samples = this._resampleToWaveform(targetSamples, safeTotalDuration, timestamps, values);
    
    return {
      x: this.x,
      y: this.y,
      width: nodeWidth,
      height: this.height,
      label: `CC ${this.cc}`,
      samples: samples,
      cc: this.cc,
      sourceDeviceName: this.deviceName,
      trackIndex: this.index
    };
  }

  /**
   * Resample recorded values to create smooth waveform
   * @param {number} targetWidth - Target sample count
   * @param {number} totalDuration - Total duration to resample over (optional)
   * @param {number[]} timestamps - Timestamps array to use (optional)
   * @param {number[]} values - Values array to use (optional)
   * @private
   */
  _resampleToWaveform(targetWidth, totalDuration = null, timestamps = null, values = null) {
    const useTimestamps = timestamps || this.timestamps;
    const useValues = values || this.values;
    
    // Comprehensive validation of targetWidth
    if (typeof targetWidth !== 'number' || !isFinite(targetWidth) || isNaN(targetWidth)) {
      console.error('ERROR: targetWidth is not a valid number:', targetWidth);
      return [];
    }
    
    // Convert to safe integer
    const safeTargetWidth = Math.max(1, Math.min(Math.floor(Math.abs(targetWidth)), 2000));
    
    if (useValues.length === 0) return [];
    
    if (useValues.length === 1) {
      try {
        return new Array(safeTargetWidth).fill(useValues[0] / 127);
      } catch (error) {
        console.error('ERROR creating single-value array:', error, 'safeTargetWidth:', safeTargetWidth);
        return [useValues[0] / 127]; // Fallback to single element array
      }
    }

    let samples;
    try {
      samples = new Array(safeTargetWidth);
    } catch (error) {
      console.error('ERROR creating samples array:', error, 'safeTargetWidth:', safeTargetWidth);
      return []; // Return empty array as fallback
    }
    
    const totalTime = totalDuration !== null ? totalDuration : Math.max(...useTimestamps);
    
    for (let i = 0; i < safeTargetWidth; i++) {
      const t = (i / (safeTargetWidth - 1)) * totalTime;
      samples[i] = this._interpolateValueAt(t, useTimestamps, useValues) / 127;
    }
    
    return samples;
  }

  /**
   * Interpolate value at specific time
   * @param {number} time - Time to interpolate at
   * @param {number[]} timestamps - Timestamps array to use (optional)
   * @param {number[]} values - Values array to use (optional)
   * @private
   */
  _interpolateValueAt(time, timestamps = null, values = null) {
    const useTimestamps = timestamps || this.timestamps;
    const useValues = values || this.values;
    
    if (useTimestamps.length === 0) return 0;
    if (useTimestamps.length === 1) return useValues[0];
    
    // Find surrounding timestamps
    let i = 0;
    while (i < useTimestamps.length - 1 && useTimestamps[i + 1] <= time) {
      i++;
    }
    
    if (i >= useTimestamps.length - 1) return useValues[useValues.length - 1];
    
    const t0 = useTimestamps[i];
    const t1 = useTimestamps[i + 1];
    const v0 = useValues[i];
    const v1 = useValues[i + 1];
    
    if (t1 === t0) return v0;
    
    const factor = (time - t0) / (t1 - t0);
    return v0 + (v1 - v0) * factor;
  }

  /**
   * Get device display name
   * @private
   */
  _getDeviceDisplayName() {
    if (!this.source) return 'Input';
    
    const name = this.source.name || '';
    const manufacturer = this.source.manufacturer || '';
    
    // Strip manufacturer from name if present
    let displayName = name;
    if (manufacturer && name.toLowerCase().includes(manufacturer.toLowerCase())) {
      displayName = name.replace(new RegExp(manufacturer, 'gi'), '').trim();
    }
    
    // Clean up common terms
    displayName = displayName
      .replace(/\b(MIDI|USB|Port\s*\d+)\b/ig, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
      
    return displayName || name || 'Input';
  }
}
