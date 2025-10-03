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

// UI Styling
export const FONT_FAMILY = 'sans-serif';

// Key Codes
export const KEY_ALT = 18;
export const KEY_SHIFT = 16;
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

// Trigger Visual Colors (separated for clarity)
export const COLOR_TRIGGER_LINE = [255, 255, 255]; // White trigger lines
export const COLOR_TRIGGER_DOT = [255, 0, 0]; // White intersection dots
export const COLOR_TRIGGER_PORT = [255, 255, 255]; // White trigger ports (normal state)
export const COLOR_TRIGGER_CONNECTOR = [255, 255, 255]; // White connector curves

// Delete Overlay Constants
export const DELETE_OVERLAY_COLOR = [0, 0, 0, 128]; // Node deletion overlay color

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
