/**
 * MIDI Manager - Pure MIDI business logic
 * Handles Web MIDI API interaction, device management, message routing
 * NO UI CODE - only emits events for state changes
 */

import EventEmitter from '../utils/EventEmitter.js';
import { MIDI_CHANNELS, CC_MAX_VALUE, CC_MIN_VALUE } from '../config/constants.js';

export default class MidiManager extends EventEmitter {
  constructor() {
    super();
    
    // MIDI API state
    this.access = null;
    this.ready = false;
    this.initRequested = false;
    
    // Device collections
    this.inputs = [];
    this.outputs = [];
    
    // Selection state
    this.inputMode = 'all'; // 'none' | 'all' | number[]
    this.outputSelection = 'all'; // 'all' | number[]
    this.channel = 0; // 0-15 (MIDI channel 1-16)
    
    // Last received data
    this.lastGlobalValue = 0;
    this.lastGlobalCC = 1;
    this.lastSeen = new Map(); // Track last CC values by source
    
    // Bind methods for event handlers
    this._onMIDIMessage = this._onMIDIMessage.bind(this);
    this._onStateChange = this._onStateChange.bind(this);
  }

  /**
   * Initialize MIDI system
   */
  async init() {
    if (this.initRequested) return;
    this.initRequested = true;

    try {
      if (!('requestMIDIAccess' in navigator)) {
        throw new Error('Web MIDI API not supported');
      }

      this.access = await navigator.requestMIDIAccess({ sysex: false });
      this.access.onstatechange = this._onStateChange;
      
      this.refreshAll();
      this.ready = true;
      
      this.emit('ready', { ready: true });
      
    } catch (error) {
      console.error('MIDI initialization failed:', error);
      this.emit('error', { error: error.message });
    }
  }

  /**
   * Refresh all device listings and reconnect listeners
   */
  refreshAll() {
    this.refreshOutputs();
    this.refreshInputs();
    this.attachInputListeners();
    
    this.emit('devices-changed', {
      inputs: this.inputs,
      outputs: this.outputs
    });
  }

  /**
   * Refresh output device list
   */
  refreshOutputs() {
    this.outputs = [];
    if (!this.access) return;

    for (const output of this.access.outputs.values()) {
      this.outputs.push(output);
    }

    // Validate current selection
    if (this.outputSelection !== 'all') {
      if (!Array.isArray(this.outputSelection)) {
        this.outputSelection = [];
      }
      this.outputSelection = this.outputSelection.filter(
        index => index >= 0 && index < this.outputs.length
      );
      
      if (this.outputs.length && this.outputSelection.length === this.outputs.length) {
        this.outputSelection = 'all';
      }
    }
  }

  /**
   * Refresh input device list
   */
  refreshInputs() {
    this.inputs = [];
    if (!this.access) return;

    for (const input of this.access.inputs.values()) {
      this.inputs.push(input);
    }

    // Validate current selection
    if (this.inputs.length === 0) {
      this.inputMode = 'none';
    } else if (Array.isArray(this.inputMode)) {
      this.inputMode = this.inputMode.filter(
        index => index >= 0 && index < this.inputs.length
      );
      
      if (this.inputMode.length === 0) {
        this.inputMode = 'none';
      } else if (this.inputMode.length === this.inputs.length) {
        this.inputMode = 'all';
      }
    } else if (this.inputMode !== 'all' && this.inputMode !== 'none') {
      this.inputMode = 'all';
    }
  }

  /**
   * Attach input listeners based on current selection
   */
  attachInputListeners() {
    if (!this.access) return;

    // Clear all existing listeners
    for (const input of this.access.inputs.values()) {
      input.onmidimessage = null;
    }

    if (this.inputMode === 'none') return;

    if (this.inputMode === 'all') {
      for (const input of this.inputs) {
        input.onmidimessage = this._onMIDIMessage;
      }
    } else if (Array.isArray(this.inputMode)) {
      for (const index of this.inputMode) {
        const input = this.inputs[index];
        if (input) {
          input.onmidimessage = this._onMIDIMessage;
        }
      }
    }
  }

  /**
   * Handle incoming MIDI message
   * @private
   */
  _onMIDIMessage(event) {
    const data = event.data;
    if (!data || data.length < 3) return;

    const status = data[0];
    const type = status & 0xF0;
    const channel = (status & 0x0F) + 1; // Convert to 1-16

    const source = event.currentTarget || event.target;
    const sourceInfo = {
      id: source?.id || 'unknown',
      name: source?.name || '',
      manufacturer: source?.manufacturer || ''
    };

    // Handle CC messages
    if (type === 0xB0) {
      const cc = data[1] & 0x7F;
      const value = data[2] & 0x7F;
      
      this.lastGlobalValue = value;
      this.lastGlobalCC = cc;
      
      // Store per-source CC state
      const key = `${sourceInfo.id}::${channel}:${cc}`;
      this.lastSeen.set(key, {
        channel,
        cc,
        value,
        timestamp: performance.now(),
        source: sourceInfo
      });

      this.emit('cc-received', {
        channel,
        cc,
        value,
        timestamp: performance.now(),
        source: sourceInfo
      });
    }

    // Emit raw MIDI for other message types
    this.emit('midi-message', {
      data: Array.from(data),
      type,
      channel,
      source: sourceInfo,
      timestamp: performance.now()
    });
  }

  /**
   * Handle MIDI state changes (devices connected/disconnected)
   * @private
   */
  _onStateChange(event) {
    console.log('MIDI state change:', event.port.state, event.port.name);
    this.refreshAll();
  }

  /**
   * Send CC message
   * @param {number} cc - Control change number (0-127)
   * @param {number} value - CC value (0-127)
   * @param {number} channel - MIDI channel (0-15, optional)
   */
  sendCC(cc, value, channel = null) {
    const targetChannel = (channel !== null) ? channel : this.channel;
    const clampedChannel = Math.max(0, Math.min(15, targetChannel));
    const clampedCC = Math.max(0, Math.min(127, cc));
    const clampedValue = Math.max(0, Math.min(127, value));
    
    const message = [
      0xB0 | clampedChannel,
      clampedCC,
      clampedValue
    ];

    this._sendMessage(message);
  }

  /**
   * Send raw MIDI message to selected outputs
   * @param {number[]} message - MIDI message bytes
   * @private
   */
  _sendMessage(message) {
    if (!this.ready || !this.outputs.length) {
      return;
    }

    const targetOutputs = this._getTargetOutputs();
    
    for (const output of targetOutputs) {
      try {
        output.send(message);
      } catch (error) {
        console.error('MIDI send error:', error);
        this.emit('send-error', { error: error.message, output });
      }
    }

    this.emit('message-sent', { message, outputs: targetOutputs.length });
  }

  /**
   * Get currently selected output devices
   * @private
   * @returns {array} Array of output devices
   */
  _getTargetOutputs() {
    if (this.outputSelection === 'all') {
      return this.outputs;
    }
    
    if (Array.isArray(this.outputSelection)) {
      return this.outputSelection
        .map(index => this.outputs[index])
        .filter(output => output); // Remove undefined entries
    }
    
    return [];
  }

  /**
   * Set input mode
   * @param {string|number[]} mode - 'none', 'all', or array of indices
   */
  setInputMode(mode) {
    this.inputMode = mode;
    this.attachInputListeners();
    this.emit('input-mode-changed', { mode });
  }

  /**
   * Set output selection
   * @param {string|number[]} selection - 'all' or array of indices
   */
  setOutputSelection(selection) {
    this.outputSelection = selection;
    this.emit('output-selection-changed', { selection });
  }

  /**
   * Set MIDI channel
   * @param {number} channel - MIDI channel (0-15)
   */
  setChannel(channel) {
    this.channel = Math.max(0, Math.min(15, channel));
    this.emit('channel-changed', { channel: this.channel });
  }

  /**
   * Get current state for debugging
   */
  getState() {
    return {
      ready: this.ready,
      inputCount: this.inputs.length,
      outputCount: this.outputs.length,
      inputMode: this.inputMode,
      outputSelection: this.outputSelection,
      channel: this.channel,
      lastGlobalValue: this.lastGlobalValue
    };
  }

  /**
   * Clean device name by removing manufacturer prefixes and common noise
   * @param {string} name - Original device name
   * @param {string} manufacturer - Manufacturer name
   * @returns {string} Cleaned device name
   */
  static cleanDeviceName(name, manufacturer = '') {
    if (!name) return '';
    
    let cleaned = name;
    
    // Remove manufacturer prefix
    if (manufacturer && manufacturer.length) {
      const manu = manufacturer.trim();
      if (manu) {
        // Remove leading manufacturer name
        const leadPattern = new RegExp(`^\\s*${this._escapeRegex(manu)}\\s*`, 'i');
        cleaned = cleaned.replace(leadPattern, '');
        
        // Remove manufacturer name anywhere in the string
        const anyPattern = new RegExp(`\\b${this._escapeRegex(manu)}\\b`, 'gi');
        cleaned = cleaned.replace(anyPattern, '').trim();
      }
    }
    
    // Remove common noise words
    cleaned = cleaned.replace(/\b(MIDI|USB|Port\s*\d+)\b/gi, '');
    
    // Clean up whitespace
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
    
    // Return cleaned name or fallback to original
    return cleaned || name;
  }

  /**
   * Escape regex special characters
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   * @private
   */
  static _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Cleanup and disconnect
   */
  destroy() {
    if (this.access) {
      this.access.onstatechange = null;
      for (const input of this.access.inputs.values()) {
        input.onmidimessage = null;
      }
    }
    
    this.ready = false;
    this.access = null;
    this.inputs = [];
    this.outputs = [];
    this.lastSeen.clear();
  }
}
