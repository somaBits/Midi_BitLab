/**
 * Main Entry Point - P5.js integration bridge
 * Connects clean MVC architecture to P5.js global mode
 * Minimal glue code - all logic is in controllers
 */

import AppController from './controllers/AppController.js';

// Create single app controller instance
const app = new AppController();

// P5.js lifecycle hooks - delegate to app controller
window.setup = () => {
  app.setup();
};

window.draw = () => {
  app.draw();
};

window.windowResized = () => {
  app.windowResized();
};

// Mouse event handlers with proper button detection
window.mousePressed = (event) => {
  console.log('main.js mousePressed() called - P5.js event received');
  
  let button = 'left';
  let shiftKey = false;
  let altKey = false;
  
  // Use raw event button property for reliable detection
  // event.button: 0=left, 1=middle, 2=right
  if (event && typeof event.button === 'number') {
    switch (event.button) {
      case 0:
        button = 'left';
        break;
      case 1:
        button = 'center';
        break;
      case 2:
        button = 'right';
        break;
      default:
        button = 'left';
    }
    // Capture modifier key states from the event
    shiftKey = !!event.shiftKey;
    altKey = !!event.altKey;
    console.log(`Raw event.button: ${event.button} → ${button}, shiftKey: ${shiftKey}, altKey: ${altKey}`);
  } else {
    // Fallback to P5.js detection if event not available
    if (window.mouseButton === window.RIGHT) {
      button = 'right';
    } else if (window.mouseButton === window.CENTER) {
      button = 'center';
    }
    console.log(`P5.js fallback detection → ${button}`);
  }
  
  console.log(`main.js calling app.mousePressed(${button}, shiftKey=${shiftKey}, altKey=${altKey})`);
  app.mousePressed(button, shiftKey, altKey);
  
  // Prevent default context menu on right-click
  if (button === 'right') {
    return false;
  }
};

window.mouseDragged = () => {
  app.mouseDragged();
};

window.mouseReleased = (event) => {
  // Use raw DOM event object (same approach as mousePressed, which works perfectly)
  let button = 'left';

  if (event && typeof event.button === 'number') {
    switch (event.button) {
      case 0:
        button = 'left';
        break;
      case 1:
        button = 'center';
        break;
      case 2:
        button = 'right';
        break;
      default:
        button = 'left';
    }
    console.log(`Raw mouse release event.button: ${event.button} → ${button}`);
  } else {
    // Fallback to P5.js detection if event not available
    if (mouseButton === RIGHT) {
      button = 'right';
    } else if (mouseButton === CENTER) {
      button = 'center';
    }
    console.log(`P5.js fallback mouse release detection → ${button}`);
  }

  app.mouseReleased(button);
};

// Keyboard event handlers
window.keyPressed = () => {
  app.keyPressed();
};

// Prevent context menu globally
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  return false;
});

// Optional: Expose app controller for debugging
if (typeof window !== 'undefined') {
  window.__app = app;
  window.app = app; // Also expose as window.app for trigger propagation
  window.__debug = () => app.getDebugState();
}

// Log system startup
console.log('MIDI Viz - Clean MVC Architecture Loaded');
console.log('Phase 1: Foundation with basic nodes, MIDI, and interaction');
console.log('Mouse: Left-click=Drag/Play, Right-click=Delete');
console.log('🟢 NEW MOUSE SYSTEM ACTIVE - main.js loaded with debug handlers');

// Test P5.js global mode
setTimeout(() => {
  console.log('🔍 P5.js globals available:', {
    mouseX: typeof window.mouseX,
    mouseY: typeof window.mouseY,
    mouseButton: typeof window.mouseButton
  });
}, 1000);
