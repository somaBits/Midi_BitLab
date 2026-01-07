/**
 * Application constants for MIDI Viz
 * Clean, organized configuration without any logic
 */

// Visual Constants
export const BOX_W = 200;
export const BOX_H = 80;
export const PORT_R = 10;

// Trigger Visual Constants
export const TRIGGER_LINE_WEIGHT = 1;
export const TRIGGER_PORT_WEIGHT = 2;
export const TRIGGER_PORT_DIAMETER = 10;
export const TRIGGER_DOT_DIAMETER = 6;
export const TRIGGER_PORT_FILL = [0]; // Black fill

// Trigger Port Interactive Constants
export const PORT_FLASH_COLOR = [255, 0, 0]; // Red flash when triggered
export const PORT_FLASH_DURATION = 220; // Use BLINK_MS value (220ms)
export const PORT_ARROW_SIZE_RATIO = 0.8; // 80% of port diameter
export const PORT_HOVER_ARROW_COLOR = [255, 255, 255]; // White arrows on hover
export const VTRIGGER_ARROW_CHAR = '▼'; // Downward arrow for VTrigger input ports
export const HTRIGGER_ARROW_CHAR = '▶'; // Right arrow for HTrigger ports

// Node Visual Constants
export const NODE_BORDER_WEIGHT_NORMAL = 1;
export const NODE_BORDER_WEIGHT_SELECTED = 1;

// Create Area Visual Constants
export const CREATE_AREA_ALPHA_NORMAL = 128;
export const CREATE_AREA_ALPHA_HOVER = 255;
export const CREATE_AREA_PREVIEW_WEIGHT = 1;
export const CREATE_AREA_TOP_HEIGHT = 10; // Height of top edge area for VTrigger creation
export const CREATE_AREA_RIGHT_WIDTH = 10; // Width of right edge area for HTrigger creation

// Port Types
export const PORT_LEFT = 'left';
export const PORT_RIGHT = 'right';
export const PORT_BOTTOM_TRIGGER = 'bottomTrigger';
export const PORT_RIGHT_TRIGGER = 'rightTrigger';
export const PORT_TOP_TRIGGER = 'topTrigger';

// Interaction Thresholds
export const CABLE_HIT_THRESH = 6;
export const TRIGGER_HIT_THRESH = 8;
export const TRIGGER_HIT_RIGHTCLICK = 16;
export const DELETE_ICON_R = 8; // Delete icon radius (matches port diameter)
export const DELETE_ICON_CROSS_RATIO = 0.35; // Cross arm length as ratio of radius
export const CLICK_DRAG_THRESHOLD = 5;

// Port Visibility
export const PORT_VIS_PX = 20;

// Timing & Animation
export const PIXELS_PER_SECOND = 100; // Consistent visual speed across all nodes
export const BLINK_MS = 220;
export const BLINK_RING_EXTRA = 2.5;

// Snapping & Docking
export const SNAP_PX = 8;
export const SNAP_NEAR_PX = 20;
export const GUIDE_ALPHA = 190;

// Group Visual Constants
export const GROUP_BORDER_COLOR = [80, 160, 255, 180]; // Light blue, semi-transparent (preview)
export const GROUP_OUTLINE_COLOR = [255, 255, 255, 200]; // White, semi-transparent (permanent)
export const GROUP_PLAYHEAD_COLOR = [80, 160, 255, 230]; // Brighter blue for playhead
export const GROUP_BORDER_OFFSET = 5; // Pixels from node edge
export const GROUP_BORDER_DASH = [5, 5]; // Dash pattern: [dash length, gap length]
export const GROUP_PLAYHEAD_WEIGHT = 2; // Stroke weight for group playhead
export const UNGROUP_DISTANCE = 30; // Pixels - auto-ungroup during Shift+drag when node moves this far from group

// UI Styling
export const FONT_FAMILY = 'sans-serif';

// Key Codes
export const KEY_ALT = 18;
export const KEY_SHIFT = 16;
export const KEY_CONTROL = 17;
export const KEY_COMMAND = 91; // macOS Command key
export const KEY_ESCAPE = 27;
export const KEY_ENTER = 13;
export const KEY_SPACE = 32;

// Colors (as arrays for p5.js)
export const COLOR_GUIDE = ["#ff6600"];
export const COLOR_CABLE = [255, 255, 255]; // White cables
export const COLOR_PLAYHEAD = [255, 0, 0];
export const COLOR_PORT_STROKE = [255, 255, 255];
export const COLOR_NODE_STROKE = [255, 255, 255];
export const COLOR_BACKGROUND = [80, 80, 80];

// Waveform Colors
export const COLOR_WAVEFORM_NODE = [255, 255, 255]; // White waveform for WaveformNode
export const COLOR_WAVEFORM_OSCILLOSCOPE = [255, 102, 0]; // White waveform for OscilloscopeNode
export const COLOR_WAVEFORM_RECORDING = [220]; // Light gray for recording tracks
export const COLOR_PREVIEW_LINE = [255, 255, 255]; // White preview lines for trigger creation

// Trigger Visual Colors (separated for clarity)
export const COLOR_TRIGGER_LINE = [255, 255, 255]; // White trigger lines
export const COLOR_TRIGGER_DOT = [255, 0, 0]; // White intersection dots
export const COLOR_TRIGGER_PORT = [255, 255, 255]; // White trigger ports (normal state)
export const COLOR_TRIGGER_CONNECTOR = [255, 255, 255]; // White connector curves

// Delete Overlay Constants
export const DELETE_OVERLAY_COLOR = [0, 0, 0, 128]; // Node deletion overlay color

// Color Picker Constants
export const COLOR_PICKER_WIDTH = 10; // Width of hue spectrum rectangle
export const COLOR_PICKER_MARGIN = 0; // Top/bottom margin for spectrum
export const COLOR_PICKER_ARROW_CHAR = '◀'; // Left-pointing arrow
export const COLOR_PICKER_ARROW_SIZE = 12; // Arrow text size
export const COLOR_PICKER_DEFAULT_HUE = 30; // Default orange hue
export const COLOR_PICKER_ARROW_OFFSET = 2; // Spacing between spectrum and arrow

// Cable Constants
export const CABLE_HIT_THRESHOLD = 6; // Hit detection threshold for cables
export const CABLE_DRAG_PREVIEW_COLOR = [255, 255, 0, 180]; // Yellow preview
export const CABLE_DASH_PATTERN = [5, 5]; // Dash pattern: [dash length, gap length]

// MIDI Constants
export const MIDI_CHANNELS = 16;
export const CC_MAX_VALUE = 127;
export const CC_MIN_VALUE = 0;

// Recording Constants
export const RECORDING_INDICATOR_SIZE = 60;
export const RECORDING_MARGIN = 20;

// Node Creation
export const NODE_STACK_GAP = 12;
export const DEFAULT_NODE_SAMPLES = 200;

// Oscilloscope Constants
export const OSCILLOSCOPE_BUFFER_WIDTH = 200; // 2 seconds at 100px/sec (matches visual width)
export const OSCILLOSCOPE_DEFAULT_HEIGHT = 80;
export const OSCILLOSCOPE_LABEL_PLACEHOLDER = '(select source)';
export const OSCILLOSCOPE_LIVE_INDICATOR_COLOR = [255, 0, 0]; // Red dot
export const OSCILLOSCOPE_LIVE_INDICATOR_SIZE = 5; // Diameter in pixels
export const OSCILLOSCOPE_DIAMOND_PORT_SIZE = 30; // Square size before 45° rotation
export const OSCILLOSCOPE_DIAMOND_TEXT_SIZE = 9; // CC value text size
export const COLOR_DIAMOND_CONNECTION = [255, 102, 0]; // Orange for diamond connections

// Average Window Node Constants
export const AVERAGE_WINDOW_DEFAULT_WIDTH = 200; // Default width in pixels
export const AVERAGE_WINDOW_MIN_WIDTH = 1; // Minimum width (1 pixel)
export const AVERAGE_WINDOW_HEIGHT = 80; // Fixed height
export const AVERAGE_WINDOW_LEFT_EDGE_WIDTH = 13; // 10px base + 3px fatter = 13px
export const AVERAGE_WINDOW_LABEL_PLACEHOLDER = 'AVG: --'; // Placeholder label
