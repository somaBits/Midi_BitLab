/**
 * Source Selector - DOM-based dropdown for oscilloscope source selection
 * Pure view component - handles UI only, emits events for coordination
 */

export default class SourceSelector {
  constructor() {
    this.dropdown = null;
    this.overlay = null;
    this.targetNode = null;
    this.midiManager = null;
    this.isVisible = false;
  }

  /**
   * Show the source selector dropdown
   * @param {object} node - Oscilloscope node to configure
   * @param {number} x - Screen X position
   * @param {number} y - Screen Y position
   * @param {object} midiManager - MIDI manager instance for source data
   */
  show(node, x, y, midiManager) {
    if (this.isVisible) {
      this.hide();
    }
    
    this.targetNode = node;
    this.midiManager = midiManager;
    
    // Create semi-transparent overlay
    this._createOverlay();
    
    // Create dropdown at position
    this._createDropdown(x, y);
    
    // Populate with available CC sources
    this._populateOptions();
    
    this.isVisible = true;
    
    console.log('SourceSelector: Showing dropdown at', x, y);
  }

  /**
   * Hide the source selector dropdown
   */
  hide() {
    if (this.dropdown) {
      document.body.removeChild(this.dropdown);
      this.dropdown = null;
    }
    
    if (this.overlay) {
      document.body.removeChild(this.overlay);
      this.overlay = null;
    }
    
    this.targetNode = null;
    this.midiManager = null;
    this.isVisible = false;
    
    console.log('SourceSelector: Hidden');
  }

  /**
   * Create semi-transparent overlay
   * @private
   */
  _createOverlay() {
    this.overlay = document.createElement('div');
    Object.assign(this.overlay.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '100%',
      height: '100%',
      background: 'rgba(0, 0, 0, 0.3)',
      zIndex: '1000',
      cursor: 'pointer'
    });
    
    // Click overlay to cancel
    this.overlay.addEventListener('click', () => {
      this.hide();
    });
    
    document.body.appendChild(this.overlay);
  }

  /**
   * Create dropdown element
   * @private
   */
  _createDropdown(x, y) {
    this.dropdown = document.createElement('select');
    Object.assign(this.dropdown.style, {
      position: 'fixed',
      left: `${x-10}px`,
      top: `${y-10}px`,
      zIndex: '1001',
      font: '13px sans-serif',
      padding: '0',
      background: '#222',
      color: '#fff',
      minWidth: '250px',
      maxWidth: '400px',
      cursor: 'pointer',
      outline: 'none'
    });
    
    // Set size to show multiple options at once
    this.dropdown.size = Math.min(10, 5); // Will be adjusted after populating
    
    // Handle selection
    this.dropdown.addEventListener('change', () => {
      this._handleSelection();
    });
    
    // Handle keyboard
    this.dropdown.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hide();
      } else if (e.key === 'Enter') {
        this._handleSelection();
      }
    });
    
    document.body.appendChild(this.dropdown);
    
    // Auto-focus
    setTimeout(() => {
      this.dropdown.focus();
    }, 0);
  }

  /**
   * Populate dropdown with available CC sources
   * @private
   */
  _populateOptions() {
    if (!this.midiManager || !this.dropdown) return;
    
    // Clear existing options
    this.dropdown.innerHTML = '';
    
    // Add placeholder option
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = '-- Select MIDI CC Source --';
    placeholderOption.disabled = true;
    placeholderOption.selected = true;
    this.dropdown.appendChild(placeholderOption);
    
    // Get recent CC messages from MidiManager
    const recentSources = this._getRecentCCSources();
    
    if (recentSources.length === 0) {
      // No CC messages received yet
      const noDataOption = document.createElement('option');
      noDataOption.value = '';
      noDataOption.textContent = '(No MIDI CC data received yet)';
      noDataOption.disabled = true;
      this.dropdown.appendChild(noDataOption);
      
      console.log('SourceSelector: No CC sources available');
      return;
    }
    
    // Add option for each unique CC source
    for (const source of recentSources) {
      const option = document.createElement('option');
      option.value = JSON.stringify({
        deviceId: source.deviceId,
        deviceName: source.deviceName,
        cc: source.cc
      });
      option.textContent = `${source.deviceName} > CC ${source.cc}`;
      this.dropdown.appendChild(option);
    }
    
    // Adjust dropdown size based on number of options
    const optionCount = recentSources.length + 1; // +1 for placeholder
    this.dropdown.size = Math.min(optionCount, 10);
    
    console.log(`SourceSelector: Populated with ${recentSources.length} CC sources`);
  }

  /**
   * Get list of recent CC sources from MidiManager
   * @returns {Array} Array of {deviceId, deviceName, cc} objects
   * @private
   */
  _getRecentCCSources() {
    if (!this.midiManager || !this.midiManager.lastSeen) {
      return [];
    }
    
    const sources = [];
    const seenKeys = new Set();
    
    // Iterate through lastSeen Map (format: "deviceId::channel:cc" -> data)
    for (const [key, data] of this.midiManager.lastSeen.entries()) {
      const { cc, source } = data;
      
      // Create unique key for this device+CC combination
      const uniqueKey = `${source.id}::${cc}`;
      
      // Skip duplicates
      if (seenKeys.has(uniqueKey)) {
        continue;
      }
      
      seenKeys.add(uniqueKey);
      
      // Clean device name for display
      const deviceName = source.name || 'Unknown Device';
      
      sources.push({
        deviceId: source.id,
        deviceName: deviceName,
        cc: cc,
        timestamp: data.timestamp
      });
    }
    
    // Sort by most recent first
    sources.sort((a, b) => b.timestamp - a.timestamp);
    
    return sources;
  }

  /**
   * Handle user selection
   * @private
   */
  _handleSelection() {
    if (!this.dropdown || !this.targetNode) return;
    
    const selectedValue = this.dropdown.value;
    if (!selectedValue) {
      // No valid selection
      this.hide();
      return;
    }
    
    try {
      // Parse selected source data
      const sourceData = JSON.parse(selectedValue);
      
      // Emit event for AppController to handle
      const event = new CustomEvent('oscilloscope-source-selected', {
        detail: {
          node: this.targetNode,
          deviceId: sourceData.deviceId,
          deviceName: sourceData.deviceName,
          cc: sourceData.cc
        }
      });
      
      document.dispatchEvent(event);
      
      console.log(`SourceSelector: Selected ${sourceData.deviceName} > CC ${sourceData.cc}`);
      
      // Hide dropdown
      this.hide();
      
    } catch (err) {
      console.error('SourceSelector: Failed to parse selection', err);
      this.hide();
    }
  }

  /**
   * Check if dropdown is currently visible
   * @returns {boolean}
   */
  get visible() {
    return this.isVisible;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.hide();
  }
}
