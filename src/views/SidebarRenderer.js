/**
 * Sidebar Renderer - DOM-based MIDI sidebar interface
 * Handles all sidebar visual elements and styling
 * Pure view component - coordinates with MidiManager via events
 */

export default class SidebarRenderer {
  constructor() {
    // DOM elements
    this.sidebar = null;
    this.toggleButton = null;
    this.inputList = null;
    this.outputList = null;
    this.channelSelect = null;
    this.inputAllCheckbox = null;
    this.outputAllCheckbox = null;
    
    // State
    this.collapsed = false;
    this.suppressUIUpdates = false;
    
    // Event handlers (bound)
    this.onToggleClick = this.onToggleClick.bind(this);
    this.onInputAllChange = this.onInputAllChange.bind(this);
    this.onOutputAllChange = this.onOutputAllChange.bind(this);
    this.onChannelChange = this.onChannelChange.bind(this);
  }

  /**
   * Create and initialize the sidebar DOM elements
   */
  init() {
    this.createToggleButton();
    this.createSidebar();
    this.setCollapsed(true); // Start expanded
  }

  /**
   * Create the sidebar toggle button
   * @private
   */
  createToggleButton() {
    this.toggleButton = document.createElement('button');
    Object.assign(this.toggleButton.style, {
      position: 'fixed',
      left: '8px',
      top: '8px',
      zIndex: '100',
      width: '34px',
      height: '28px',
      borderRadius: '6px',
      border: '1px solid #666',
      background: '#111',
      color: '#fff',
      font: '16px/1 sans-serif',
      cursor: 'pointer',
      transition: 'background 160ms ease-out'
    });
    
    this.toggleButton.textContent = '☰';
    this.toggleButton.addEventListener('click', this.onToggleClick);
    document.body.appendChild(this.toggleButton);
  }

  /**
   * Create the main sidebar container
   * @private
   */
  createSidebar() {
    this.sidebar = document.createElement('div');
    Object.assign(this.sidebar.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      height: '100%',
      width: '280px',
      background: 'rgba(0,0,0,0.78)',
      color: '#fff',
      zIndex: '90',
      boxShadow: '2px 0 8px rgba(0,0,0,0.35)',
      transform: 'translateX(0)',
      transition: 'transform 160ms ease-out',
      padding: '44px 12px 12px 12px',
      backdropFilter: 'blur(3px)',
      overflowY: 'auto',
      fontFamily: 'sans-serif'
    });

    // Create content sections
    this.createTitle();
    this.createInputSection();
    this.createOutputSection();
    this.createChannelSection();

    document.body.appendChild(this.sidebar);
  }

  /**
   * Create the sidebar title
   * @private
   */
  createTitle() {
    const title = document.createElement('div');
    title.textContent = 'MIDI';
    Object.assign(title.style, {
      font: 'bold 14px/1.2 sans-serif',
      marginBottom: '10px',
      letterSpacing: '0.03em'
    });
    this.sidebar.appendChild(title);
  }

  /**
   * Create the inputs section
   * @private
   */
  createInputSection() {
    // Header
    const header = document.createElement('div');
    header.textContent = 'Inputs';
    Object.assign(header.style, {
      font: 'bold 12px/1.2 sans-serif',
      opacity: '0.85',
      margin: '10px 0 6px'
    });
    this.sidebar.appendChild(header);

    // "All" checkbox row
    const allRow = document.createElement('div');
    Object.assign(allRow.style, {
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      marginBottom: '4px'
    });

    this.inputAllCheckbox = document.createElement('input');
    this.inputAllCheckbox.type = 'checkbox';
    this.inputAllCheckbox.id = 'midi_in_all';
    this.inputAllCheckbox.addEventListener('change', this.onInputAllChange);

    const allLabel = document.createElement('label');
    allLabel.htmlFor = 'midi_in_all';
    allLabel.textContent = 'All';

    allRow.appendChild(this.inputAllCheckbox);
    allRow.appendChild(allLabel);
    this.sidebar.appendChild(allRow);

    // Individual device list
    this.inputList = document.createElement('div');
    Object.assign(this.inputList.style, {
      marginLeft: '8px',
      display: 'grid',
      gap: '4px'
    });
    this.sidebar.appendChild(this.inputList);
  }

  /**
   * Create the outputs section
   * @private
   */
  createOutputSection() {
    // Header
    const header = document.createElement('div');
    header.textContent = 'Outputs';
    Object.assign(header.style, {
      font: 'bold 12px/1.2 sans-serif',
      opacity: '0.85',
      margin: '12px 0 6px'
    });
    this.sidebar.appendChild(header);

    // "All" checkbox row
    const allRow = document.createElement('div');
    Object.assign(allRow.style, {
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      marginBottom: '4px'
    });

    this.outputAllCheckbox = document.createElement('input');
    this.outputAllCheckbox.type = 'checkbox';
    this.outputAllCheckbox.id = 'midi_out_all';
    this.outputAllCheckbox.addEventListener('change', this.onOutputAllChange);

    const allLabel = document.createElement('label');
    allLabel.htmlFor = 'midi_out_all';
    allLabel.textContent = 'All';

    allRow.appendChild(this.outputAllCheckbox);
    allRow.appendChild(allLabel);
    this.sidebar.appendChild(allRow);

    // Individual device list
    this.outputList = document.createElement('div');
    Object.assign(this.outputList.style, {
      marginLeft: '8px',
      display: 'grid',
      gap: '4px'
    });
    this.sidebar.appendChild(this.outputList);
  }

  /**
   * Create the channel section
   * @private
   */
  createChannelSection() {
    // Header
    const header = document.createElement('div');
    header.textContent = 'Channel';
    Object.assign(header.style, {
      font: 'bold 12px/1.2 sans-serif',
      opacity: '0.85',
      margin: '12px 0 6px'
    });
    this.sidebar.appendChild(header);

    // Channel select dropdown
    this.channelSelect = document.createElement('select');
    Object.assign(this.channelSelect.style, {
      font: '12px sans-serif',
      padding: '4px 6px',
      background: '#111',
      color: '#fff',
      border: '1px solid #666',
      borderRadius: '4px',
      minWidth: '120px'
    });

    // Populate with channels 1-16
    for (let i = 1; i <= 16; i++) {
      const option = document.createElement('option');
      option.value = String(i - 1); // Store as 0-15
      option.textContent = `CH ${i}`;
      this.channelSelect.appendChild(option);
    }

    this.channelSelect.addEventListener('change', this.onChannelChange);
    this.sidebar.appendChild(this.channelSelect);
  }

  /**
   * Toggle sidebar collapsed state
   * @private
   */
  onToggleClick() {
    this.setCollapsed(!this.collapsed);
  }

  /**
   * Set sidebar collapsed state
   * @param {boolean} collapsed - Whether sidebar should be collapsed
   */
  setCollapsed(collapsed) {
    this.collapsed = collapsed;
    
    // Update sidebar position
    this.sidebar.style.transform = collapsed ? 'translateX(-100%)' : 'translateX(0)';
    
    // Update toggle button
    this.toggleButton.textContent = collapsed ? '☰' : '×';
    this.toggleButton.style.background = collapsed ? '#111' : '#181818';
  }

  /**
   * Update input devices list
   * @param {array} inputs - Array of MIDI input devices
   * @param {string|array} inputMode - Current input mode ('all', 'none', or array)
   */
  updateInputDevices(inputs, inputMode) {
    this.suppressUIUpdates = true;

    // Clear existing list
    this.inputList.innerHTML = '';

    // Update "All" checkbox
    this.inputAllCheckbox.checked = (inputMode === 'all');
    this.inputAllCheckbox.disabled = (inputs.length === 0);

    // Create individual device checkboxes
    const selectedIndices = Array.isArray(inputMode) ? new Set(inputMode.map(String)) : new Set();

    inputs.forEach((input, index) => {
      const row = document.createElement('div');
      Object.assign(row.style, {
        display: 'flex',
        gap: '8px',
        alignItems: 'center'
      });

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.index = String(index);
      checkbox.checked = (inputMode === 'all') ? true : selectedIndices.has(String(index));

      const label = document.createElement('label');
      label.textContent = input.name || `Input ${index + 1}`;

      row.appendChild(checkbox);
      row.appendChild(label);
      this.inputList.appendChild(row);

      // Add event listener
      checkbox.addEventListener('change', (e) => {
        if (this.suppressUIUpdates) return;
        this.onInputDeviceChange();
      });
    });

    this.suppressUIUpdates = false;
  }

  /**
   * Update output devices list
   * @param {array} outputs - Array of MIDI output devices
   * @param {string|array} outputSelection - Current output selection
   */
  updateOutputDevices(outputs, outputSelection) {
    this.suppressUIUpdates = true;

    // Clear existing list
    this.outputList.innerHTML = '';

    // Update "All" checkbox
    const isAll = (outputSelection === 'all');
    this.outputAllCheckbox.checked = isAll;
    this.outputAllCheckbox.disabled = (outputs.length === 0);

    // Create individual device checkboxes
    const selectedIndices = Array.isArray(outputSelection) ? new Set(outputSelection.map(String)) : new Set();

    outputs.forEach((output, index) => {
      const row = document.createElement('div');
      Object.assign(row.style, {
        display: 'flex',
        gap: '8px',
        alignItems: 'center'
      });

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.index = String(index);
      checkbox.checked = isAll ? true : selectedIndices.has(String(index));

      const label = document.createElement('label');
      label.textContent = output.name || `Output ${index + 1}`;

      row.appendChild(checkbox);
      row.appendChild(label);
      this.outputList.appendChild(row);

      // Add event listener
      checkbox.addEventListener('change', (e) => {
        if (this.suppressUIUpdates) return;
        this.onOutputDeviceChange();
      });
    });

    this.suppressUIUpdates = false;
  }

  /**
   * Update channel selection
   * @param {number} channel - Current MIDI channel (0-15)
   */
  updateChannel(channel) {
    this.channelSelect.value = String(channel);
  }

  /**
   * Handle input "All" checkbox change
   * @private
   */
  onInputAllChange() {
    if (this.suppressUIUpdates) return;
    
    const mode = this.inputAllCheckbox.checked ? 'all' : 'none';
    this.emit('input-mode-change', mode);
  }

  /**
   * Handle output "All" checkbox change
   * @private
   */
  onOutputAllChange() {
    if (this.suppressUIUpdates) return;
    
    const selection = this.outputAllCheckbox.checked ? 'all' : [];
    this.emit('output-selection-change', selection);
  }

  /**
   * Handle individual input device checkbox changes
   * @private
   */
  onInputDeviceChange() {
    if (this.suppressUIUpdates) return;

    const checkboxes = Array.from(this.inputList.querySelectorAll('input[type=checkbox]'));
    const selected = checkboxes
      .filter(cb => cb.checked)
      .map(cb => parseInt(cb.dataset.index, 10));

    let mode;
    if (selected.length === 0) {
      mode = 'none';
    } else if (selected.length === checkboxes.length) {
      mode = 'all';
    } else {
      mode = selected;
    }

    this.emit('input-mode-change', mode);
  }

  /**
   * Handle individual output device checkbox changes
   * @private
   */
  onOutputDeviceChange() {
    if (this.suppressUIUpdates) return;

    const checkboxes = Array.from(this.outputList.querySelectorAll('input[type=checkbox]'));
    const selected = checkboxes
      .filter(cb => cb.checked)
      .map(cb => parseInt(cb.dataset.index, 10));

    let selection;
    if (selected.length === 0) {
      selection = [];
    } else if (selected.length === checkboxes.length) {
      selection = 'all';
    } else {
      selection = selected;
    }

    this.emit('output-selection-change', selection);
  }

  /**
   * Handle channel selection change
   * @private
   */
  onChannelChange() {
    const channel = parseInt(this.channelSelect.value, 10) || 0;
    this.emit('channel-change', channel);
  }

  /**
   * Emit custom event for communication with controllers
   * @param {string} eventName - Name of the event
   * @param {*} data - Event data
   */
  emit(eventName, data) {
    const event = new CustomEvent(`sidebar-${eventName}`, {
      detail: data
    });
    document.dispatchEvent(event);
  }

  /**
   * Clean up DOM elements and event listeners
   */
  destroy() {
    if (this.toggleButton) {
      this.toggleButton.removeEventListener('click', this.onToggleClick);
      document.body.removeChild(this.toggleButton);
      this.toggleButton = null;
    }

    if (this.sidebar) {
      document.body.removeChild(this.sidebar);
      this.sidebar = null;
    }

    this.inputList = null;
    this.outputList = null;
    this.channelSelect = null;
    this.inputAllCheckbox = null;
    this.outputAllCheckbox = null;
  }
}
