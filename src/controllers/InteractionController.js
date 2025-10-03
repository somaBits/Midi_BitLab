/**
 * Interaction Controller - Handles user input and interaction state
 * Translates mouse/keyboard events into model operations
 * Coordinates visual feedback for user actions
 */

import { pointInRect, computeDockSnap, dist2 } from '../utils/geometry.js';
import { CLICK_DRAG_THRESHOLD, SNAP_PX, SNAP_NEAR_PX, DELETE_ICON_R } from '../config/constants.js';

export default class InteractionController {
  constructor(app) {
    this.app = app;
    
    // Interaction state
    this.dragState = {
      active: false,
      node: null,
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0
    };
    
    // Visual feedback state
    this.guideV = null; // Vertical guide line position
    this.guideH = null; // Horizontal guide line position
    
    // Node states for rendering
    this.nodeStates = new Map(); // nodeId -> state object
    
    // Universal deletion system
    this.deletionState = {
      target: null,      // The element to delete
      type: null,        // 'node', 'vtrigger', 'htrigger', 'connection'
      iconPosition: null // Where to show delete icon {x, y}
    };
    
    // Trigger interaction state
    this.triggerHover = {
      active: false,
      node: null,
      trigger: null,
      type: null // 'v' or 'h'
    };
    
    this.triggerDrag = {
      active: false,
      node: null,
      trigger: null,
      type: null, // 'v' or 'h'
      startX: 0,
      startY: 0
    };
    
    // Cable dragging state
    this.cableDrag = {
      active: false,
      startPort: null,
      startX: 0,
      startY: 0
    };
    
    // Cable hover state
    this.hoveredConnection = null;
    
    // Last mouse position
    this.lastMouseX = 0;
    this.lastMouseY = 0;
  }

  /**
   * Initialize interaction system
   */
  init() {
    console.log('InteractionController: Initialized');
  }

  /**
   * Handle mouse pressed event
   */
  handleMousePressed(button = 'left', shiftKey = false, altKey = false) {
    console.log(`InteractionController.handleMousePressed: button=${button}, shiftKey=${shiftKey}, altKey=${altKey}`);
    
    // Store modifier key states for use in other methods
    this.shiftPressed = shiftKey;
    this.altPressed = altKey;
    
    const mousePos = this.app.canvas.getMousePos();
    console.log(`Mouse position from CanvasManager: (${mousePos.x}, ${mousePos.y})`);
    
    this.lastMouseX = mousePos.x;
    this.lastMouseY = mousePos.y;

    if (button === 'right') {
      this._handleRightClick(mousePos.x, mousePos.y);
      return;
    }

    if (button === 'left') {
      this._handleLeftClick(mousePos.x, mousePos.y);
    }
  }

  /**
   * Handle mouse dragged event
   */
  handleMouseDragged() {
    const mousePos = this.app.canvas.getMousePos();
    
    if (this.cableDrag.active) {
      this._handleCableDrag(mousePos.x, mousePos.y);
    } else if (this.triggerDrag.active) {
      this._handleTriggerDrag(mousePos.x, mousePos.y);
    } else if (this.dragState.active && this.dragState.node) {
      this._handleNodeDrag(mousePos.x, mousePos.y);
    }
    
    this.lastMouseX = mousePos.x;
    this.lastMouseY = mousePos.y;
  }

  /**
   * Handle mouse released event
   */
  handleMouseReleased(button = 'left') {
    console.log(`🎯 handleMouseReleased called with button=${button}, deletionState exists: ${!!this.deletionState.target}`);

    const mousePos = this.app.canvas.getMousePos();

    // Only handle deletion for LEFT mouse button release
    // RIGHT mouse release should NOT clear deletion state
    if (button === 'left' && this.deletionState.target) {
      console.log(`🖱️ LEFT mouse release - handling deletion at (${mousePos.x}, ${mousePos.y})`);
      this._handleDeletionRelease(mousePos.x, mousePos.y);
      return;
    } else if (button === 'right' && this.deletionState.target) {
      console.log(`🖱️ RIGHT mouse release - IGNORING deletion (should stay persistent!)`);
      // Right-click release should NOT affect deletion state
      this.lastMouseX = mousePos.x;
      this.lastMouseY = mousePos.y;
      return;
    }

    // Handle cable drag release (highest priority after deletion)
    if (this.cableDrag.active) {
      this._endCableDrag(mousePos.x, mousePos.y);
      return;
    }

    // Handle trigger drag release
    if (this.triggerDrag.active) {
      this._endTriggerDrag();
      return;
    }

    // Handle node drag release
    if (this.dragState.active) {
      this._handleDragRelease(mousePos.x, mousePos.y);
      return;
    }

    this.lastMouseX = mousePos.x;
    this.lastMouseY = mousePos.y;
  }

  /**
   * Handle left click
   * @private
   */
  _handleLeftClick(mouseX, mouseY) {
    console.log(`_handleLeftClick at (${mouseX}, ${mouseY})`);

    // Check recording overlay first (highest priority)
    if (this.app.isRecordingBlocking(mouseX, mouseY)) {
      console.log('Recording blocking - committing recording');
      this.app.commitRecording();
      return;
    }

    // Check for hovered connection delete (hover icon) before other interactions
    if (this.hoveredConnection && this.hoveredConnection.getMidpoint) {
      const mid = this.hoveredConnection.getMidpoint();
      const hitR = 0.75 * DELETE_ICON_R;
      if (dist2(mouseX, mouseY, mid.x, mid.y) <= hitR * hitR) {
        console.log('Clicked on hovered connection delete icon - deleting connection');
        this._deleteConnection(this.hoveredConnection);
        return;
      }
    }

    // If a deletion overlay exists, consume left press; handle on release
    if (this.deletionState.target) {
      console.log('Deletion target exists - consuming left press; release will handle deletion/cancel');
      const iconPos = this.deletionState.iconPosition;
      // Note: Use 0.75 * DELETE_ICON_R for parity; still defer actual deletion to release
      if (iconPos) {
        const hitR = 0.75 * DELETE_ICON_R;
        if (dist2(mouseX, mouseY, iconPos.x, iconPos.y) <= hitR * hitR) {
          console.log('Clicked on deletion icon - will delete on mouse release');
        }
      }
      return;
    }

    // Check for port clicks (highest priority after recording and deletion)
    console.log('Checking for port hits...');
    const portHit = this._findPortAt(mouseX, mouseY, 8);
    if (portHit) {
      console.log(`Port hit found - ${portHit.type} port on ${portHit.trigger.type}Trigger`);
      this._handlePortClick(portHit);
      return;
    }

    // Check for trigger hits (after port hits)
    console.log('Checking for trigger hits...');
    const triggerHit = this._findTriggerAt(mouseX, mouseY, 8);
    if (triggerHit) {
      console.log(`Trigger hit found - starting trigger drag: ${triggerHit.type}Trigger on ${triggerHit.node.label}`);
      this._startTriggerDrag(triggerHit, mouseX, mouseY);
      return;
    }

    // Check for edge area hits (for trigger creation)
    console.log('Checking edge area hits...');
    const edgeHit = this._checkEdgeAreaHit(mouseX, mouseY);
    if (edgeHit) {
      console.log('Edge hit found - handling edge area click');
      this._handleEdgeAreaClick(edgeHit.node, edgeHit.area, mouseX, mouseY);
      return;
    }

    // Check for node hit
    console.log('Checking for node hit...');
    const node = this.app.getNodeAt(mouseX, mouseY);
    if (node) {
      // Check if Alt is held - duplicate instead of dragging original
      if (this.altPressed) {
        console.log('Alt+node hit found - duplicating and dragging');
        this._duplicateAndDragNode(node, mouseX, mouseY);
      } else {
        console.log('Node hit found - starting node drag');
        this._startNodeDrag(node, mouseX, mouseY);
      }
      return;
    }

    // Empty space click - start recording
    console.log('Empty space click - starting recording');
    this.app.startRecording(mouseX, mouseY);
  }

  /**
   * Handle right click - Universal deletion system
   * @private  
   */
  _handleRightClick(mouseX, mouseY) {
    // Check for triggers first (higher priority than nodes)
    const triggerHit = this._findTriggerAt(mouseX, mouseY, 8);
    if (triggerHit) {
      // Compute monolithic-style delete icon position
      let iconPos;
      if (triggerHit.type === 'v') {
        const trig = triggerHit.trigger;
        const outPos = (typeof trig.getOutputPortPosition === 'function') ? trig.getOutputPortPosition() : { x: trig.x, y: trig.node.y + trig.node.h + 20 };
        iconPos = { x: trig.x, y: (triggerHit.node.y + outPos.y) * 0.5 };
      } else {
        const trig = triggerHit.trigger;
        const stopX = (typeof trig.stopX === 'number') ? trig.stopX : (triggerHit.node.x + triggerHit.node.w);
        iconPos = { x: (triggerHit.node.x + stopX) * 0.5, y: trig.y };
      }
      this.deletionState = {
        target: triggerHit.trigger,
        type: triggerHit.type === 'v' ? 'vtrigger' : 'htrigger',
        iconPosition: iconPos,
        node: triggerHit.node,
        index: triggerHit.index
      };
      console.log(`Right-clicked ${triggerHit.type}Trigger - showing deletion at (${this.deletionState.iconPosition.x}, ${this.deletionState.iconPosition.y})`);
      return;
    }

    // Check for connections (no persistent overlay for connections in hover-delete model)
    // Intentionally do not set deletionState for connections; handled via hover + left click.

    // Check for nodes last (lowest priority)
    const node = this.app.getNodeAt(mouseX, mouseY);
    if (node) {
      const center = node.getCenter();
      this.deletionState = {
        target: node,
        type: 'node',
        iconPosition: { x: center.x, y: center.y }
      };
      this._updateNodeStates();
      console.log(`Right-clicked node: ${node.label} - showing deletion at center`);
    } else {
      // Clear deletion state if not over any element
      this._clearInteractionStates();
    }
  }

  /**
   * Start node dragging
   * @private
   */
  _startNodeDrag(node, mouseX, mouseY) {
    this.dragState = {
      active: true,
      node: node,
      startX: mouseX,
      startY: mouseY,
      offsetX: mouseX - node.x,
      offsetY: mouseY - node.y
    };
    
    // Bring node to front
    this._bringNodeToFront(node);
    
    // Update node states
    node.setDragging(true);
    this._updateNodeStates();
    
    console.log(`Started dragging node: ${node.label}`);
  }

  /**
   * Handle node drag movement
   * @private
   */
  _handleNodeDrag(mouseX, mouseY) {
    const node = this.dragState.node;
    if (!node) return;

    const proposedX = mouseX - this.dragState.offsetX;
    const proposedY = mouseY - this.dragState.offsetY;

    // Compute snapping
    const snapResult = computeDockSnap(
      node,
      proposedX,
      proposedY,
      this.app.nodes,
      SNAP_PX,
      SNAP_NEAR_PX
    );

    // Update node position
    node.setPosition(snapResult.x, snapResult.y);

    // Update visual guides
    this.guideV = snapResult.guideV;
    this.guideH = snapResult.guideH;

    // Update deletion icon position if this node is being deleted
    this._updateDeletionIconPosition();

    this._updateNodeStates();
  }

  /**
   * Handle drag release
   * @private
   */
  _handleDragRelease(mouseX, mouseY) {
    const node = this.dragState.node;
    if (!node) return;

    const moved = Math.hypot(
      mouseX - this.dragState.startX,
      mouseY - this.dragState.startY
    ) > CLICK_DRAG_THRESHOLD;

    if (!moved) {
      // This was a click, not a drag - start playback
      node.startPlayback();
      console.log(`Started playback: ${node.label}`);
    } else {
      console.log(`Finished dragging node: ${node.label} to (${Math.round(node.x)}, ${Math.round(node.y)})`);
    }

    // End drag state
    node.setDragging(false);
    this.dragState = {
      active: false,
      node: null,
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0
    };

    // Clear guides
    this.guideV = null;
    this.guideH = null;

    // Reset cursor (will be updated by hover state if needed)
    if (this.app.canvas.resetCursor) {
      this.app.canvas.resetCursor();
    }

    this._updateNodeStates();
  }

  /**
   * Handle deletion release - Universal deletion system
   * @private
   */
  _handleDeletionRelease(mouseX, mouseY) {
    if (!this.deletionState.target) return;

    const { target, type } = this.deletionState;
    const iconPos = this.deletionState.iconPosition;
    const hitR = 0.75 * DELETE_ICON_R;
    const onIcon = iconPos && dist2(mouseX, mouseY, iconPos.x, iconPos.y) <= hitR * hitR;

    if (onIcon) {
      this._executeElementDeletion();
      // Clear deletion state after deletion
      this.deletionState = {
        target: null,
        type: null,
        iconPosition: null
      };
      this._updateNodeStates();
      return;
    }

    if (type === 'node' && target && typeof target.x === 'number') {
      // Cancel only if release is inside the node; otherwise keep persistent overlay
      if (pointInRect(mouseX, mouseY, target.x, target.y, target.w, target.h)) {
        this._cancelDeletion();
      } else {
        // Keep overlay; update icon position in case node moved
        this._updateDeletionIconPosition();
      }
      return;
    }

    // For triggers and any other types, cancel overlay on non-icon release
    this._cancelDeletion();
  }

  /**
   * Execute deletion based on element type
   * @private
   */
  _executeElementDeletion() {
    const { target, type, node, index } = this.deletionState;

    switch (type) {
      case 'node':
        console.log(`Deleting node: ${target.label}`);
        this.app.removeNode(target);
        break;

      case 'vtrigger':
        console.log(`Deleting VTrigger at index ${index} from node: ${node.label}`);
        if (node && typeof node.removeVTrigger === 'function') {
          node.removeVTrigger(index);
        }
        break;

      case 'htrigger':
        console.log(`Deleting HTrigger at index ${index} from node: ${node.label}`);
        if (node && typeof node.removeHTrigger === 'function') {
          node.removeHTrigger(index);
        }
        break;

      case 'connection':
        console.log(`Deleting connection: ${target.id}`);
        if (this.app.removeConnection) {
          this.app.removeConnection(target);
        }
        break;

      default:
        console.warn(`Unknown deletion type: ${type}`);
    }
  }

  /**
   * Bring node to front of render order
   * @private
   */
  _bringNodeToFront(node) {
    const index = this.app.nodes.indexOf(node);
    if (index >= 0) {
      this.app.nodes.splice(index, 1);
      this.app.nodes.push(node);
    }
  }

  /**
   * Update node visual states
   * @private
   */
  _updateNodeStates() {
    this.nodeStates.clear();
    
    const mousePos = this.app.canvas.getMousePos();
    
    for (const node of this.app.nodes) {
      const state = {
        isHovered: node.bodyHits(mousePos.x, mousePos.y),
        isSelected: false, // Will be expanded in Phase 3+
        isDragging: node.isDragging,
        showCreateAreas: node.bodyHits(mousePos.x, mousePos.y) && !this.dragState.active
      };
      
      this.nodeStates.set(node.id, state);
    }
  }

  /**
   * Cancel deletion state
   * @private
   */
  _cancelDeletion() {
    console.log('🗑️ CANCELLING deletion state:', {
      hadTarget: !!this.deletionState.target,
      targetType: this.deletionState.type,
      reason: new Error().stack.split('\n')[2].trim()
    });
    this.deletionState = {
      target: null,
      type: null,
      iconPosition: null
    };
    this._updateNodeStates();
  }

  /**
   * Update deletion icon position for moving elements
   * @private
   */
  _updateDeletionIconPosition() {
    if (!this.deletionState.target || !this.deletionState.iconPosition) return;

    const { target, type } = this.deletionState;

    if (type === 'node' && target.getCenter) {
      // Update icon position for node
      const center = target.getCenter();
      this.deletionState.iconPosition = { x: center.x, y: center.y };
    } else if (type === 'vtrigger') {
      // Update icon position for VTrigger - monolithic-style midpoint between node top and output port
      const trig = target;
      const outPos = (typeof trig.getOutputPortPosition === 'function')
        ? trig.getOutputPortPosition()
        : { x: trig.x, y: trig.node.y + trig.node.h + 20 };
      this.deletionState.iconPosition = { x: trig.x, y: (trig.node.y + outPos.y) * 0.5 };
    } else if (type === 'htrigger') {
      // Update icon position for HTrigger - monolithic-style midpoint between node.x and stopX
      const trig = target;
      const stopX = (typeof trig.stopX === 'number') ? trig.stopX : (trig.node.x + trig.node.w);
      this.deletionState.iconPosition = { x: (trig.node.x + stopX) * 0.5, y: trig.y };
    } else if (type === 'connection' && target.getMidpoint) {
      // Update icon position for connection
      const midpoint = target.getMidpoint();
      this.deletionState.iconPosition = { x: midpoint.x, y: midpoint.y };
    }
  }

  /**
   * Clear all interaction states
   * @private
   */
  _clearInteractionStates() {
    this.deletionTarget = null;
    this.guideV = null;
    this.guideH = null;
    this._updateNodeStates();
  }

  /**
   * Get node rendering states for views
   */
  getNodeRenderingState() {
    // Update states based on current mouse position
    this._updateNodeStates();
    
    const stateMap = {};
    for (const [nodeId, state] of this.nodeStates) {
      stateMap[nodeId] = state;
    }
    return stateMap;
  }

  /**
   * Get general rendering data for UI overlays
   */
  getRenderingData() {
    return {
      guideV: this.guideV,
      guideH: this.guideH,
      deletionNode: this.deletionTarget,
      isDragging: this.dragState.active
    };
  }

  /**
   * Get current interaction state for debugging
   */
  getState() {
    return {
      dragActive: this.dragState.active,
      dragNode: this.dragState.node ? this.dragState.node.label : null,
      deletionTarget: this.deletionTarget ? this.deletionTarget.label : null,
      nodeStates: this.nodeStates.size,
      guideV: this.guideV,
      guideH: this.guideH
    };
  }

  /**
   * Check if mouse position hits any edge area for trigger creation
   * @param {number} mouseX - Mouse X coordinate
   * @param {number} mouseY - Mouse Y coordinate
   * @returns {object|null} Edge hit info or null
   * @private
   */
  _checkEdgeAreaHit(mouseX, mouseY) {
    console.log(`Checking edge areas at (${mouseX}, ${mouseY})`);
    
    // Check all nodes in reverse order (front to back)
    for (let i = this.app.nodes.length - 1; i >= 0; i--) {
      const node = this.app.nodes[i];
      
      // Only check WaveformNodes that have trigger creation methods
      if (typeof node.getTopCreateRect !== 'function' || 
          typeof node.getRightCreateRect !== 'function') {
        continue;
      }

      // Check top edge area (for VTriggers)
      const topRect = node.getTopCreateRect();
      console.log(`Node ${node.label} top rect:`, topRect);
      if (pointInRect(mouseX, mouseY, topRect.x, topRect.y, topRect.w, topRect.h)) {
        console.log(`Hit top edge area of ${node.label}!`);
        return {
          node: node,
          area: 'top'
        };
      }

      // Check right edge area (for HTriggers)  
      const rightRect = node.getRightCreateRect();
      console.log(`Node ${node.label} right rect:`, rightRect);
      if (pointInRect(mouseX, mouseY, rightRect.x, rightRect.y, rightRect.w, rightRect.h)) {
        console.log(`Hit right edge area of ${node.label}!`);
        return {
          node: node,
          area: 'right'
        };
      }
    }
    
    console.log('No edge area hit found');
    return null;
  }

  /**
   * Handle edge area click to create triggers (or split node with Shift)
   * @param {object} node - The node to add trigger to
   * @param {string} area - 'top' or 'right'
   * @param {number} mouseX - Mouse X coordinate
   * @param {number} mouseY - Mouse Y coordinate
   * @private
   */
  _handleEdgeAreaClick(node, area, mouseX, mouseY) {
    if (area === 'top') {
      // Check if Shift is held - if so, split the node instead of creating trigger
      if (this.shiftPressed) {
        console.log('Shift+click detected in top edge area - initiating node split');
        this._handleNodeSplit(node, mouseX, mouseY);
        return;
      }
      
      // Create vertical trigger (normal behavior)
      if (typeof node.addVTriggerAtMouse === 'function') {
        const trigger = node.addVTriggerAtMouse(mouseX);
        console.log(`Created VTrigger on ${node.label} at u=${trigger.u.toFixed(3)}`);
        
        // Bring node to front for better visibility
        this._bringNodeToFront(node);
        this._updateNodeStates();
      }
    } else if (area === 'right') {
      // Create horizontal trigger
      if (typeof node.addHTriggerAtMouse === 'function') {
        const trigger = node.addHTriggerAtMouse(mouseY);
        console.log(`Created HTrigger on ${node.label} at v=${trigger.v.toFixed(3)}`);
        
        // Bring node to front for better visibility
        this._bringNodeToFront(node);
        this._updateNodeStates();
      }
    }
  }

  /**
   * Find closest trigger under mouse position
   * @param {number} mouseX - Mouse X coordinate
   * @param {number} mouseY - Mouse Y coordinate
   * @param {number} threshold - Hit detection threshold
   * @returns {object|null} Trigger hit info or null
   * @private
   */
  _findTriggerAt(mouseX, mouseY, threshold = 8) {
    // Check all nodes in reverse order (front to back)
    for (let i = this.app.nodes.length - 1; i >= 0; i--) {
      const node = this.app.nodes[i];
      
      // Check for VTriggers
      if (node.vTriggers && node.vTriggers.length > 0) {
        for (let j = 0; j < node.vTriggers.length; j++) {
          const trigger = node.vTriggers[j];
          if (trigger.hits && trigger.hits(mouseX, mouseY, threshold)) {
            return {
              node: node,
              trigger: trigger,
              type: 'v',
              index: j
            };
          }
        }
      }
      
      // Check for HTriggers
      if (node.hTriggers && node.hTriggers.length > 0) {
        for (let j = 0; j < node.hTriggers.length; j++) {
          const trigger = node.hTriggers[j];
          if (trigger.hits && trigger.hits(mouseX, mouseY, threshold)) {
            return {
              node: node,
              trigger: trigger,
              type: 'h',
              index: j
            };
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Update trigger hover state for cursor management
   * @private
   */
  _updateTriggerHover() {
    const mousePos = this.app.canvas.getMousePos();
    const triggerHit = this._findTriggerAt(mousePos.x, mousePos.y, 8);
    
    if (triggerHit) {
      this.triggerHover = {
        active: true,
        node: triggerHit.node,
        trigger: triggerHit.trigger,
        type: triggerHit.type
      };
      
      // Set cursor based on trigger type using P5.js global function
      const cursorType = triggerHit.type === 'v' ? 'ew-resize' : 'ns-resize';
      if (typeof window.cursor === 'function') {
        window.cursor(cursorType);
      }
    } else {
      this.triggerHover = {
        active: false,
        node: null,
        trigger: null,
        type: null
      };
      
      // Reset cursor if not dragging and no other special state
      if (!this.triggerDrag.active && !this.dragState.active) {
        if (typeof window.cursor === 'function') {
          window.cursor('default');
        }
      }
    }
  }

  /**
   * Start trigger dragging
   * @param {object} triggerHit - Trigger hit info from _findTriggerAt
   * @param {number} mouseX - Mouse X coordinate
   * @param {number} mouseY - Mouse Y coordinate
   * @private
   */
  _startTriggerDrag(triggerHit, mouseX, mouseY) {
    this.triggerDrag = {
      active: true,
      node: triggerHit.node,
      trigger: triggerHit.trigger,
      type: triggerHit.type,
      startX: mouseX,
      startY: mouseY
    };
    
    // Bring node to front for better visibility
    this._bringNodeToFront(triggerHit.node);
    
    // Set drag cursor using P5.js global function
    const cursorType = triggerHit.type === 'v' ? 'ew-resize' : 'ns-resize';
    if (typeof window.cursor === 'function') {
      window.cursor(cursorType);
    }
    
    console.log(`Started dragging ${triggerHit.type}Trigger on ${triggerHit.node.label}`);
  }

  /**
   * Handle trigger drag movement
   * @param {number} mouseX - Mouse X coordinate
   * @param {number} mouseY - Mouse Y coordinate
   * @private
   */
  _handleTriggerDrag(mouseX, mouseY) {
    if (!this.triggerDrag.active || !this.triggerDrag.trigger) return;
    
    if (this.triggerDrag.type === 'v') {
      // Move vertical trigger horizontally
      if (typeof this.triggerDrag.trigger.setUFromMouseX === 'function') {
        this.triggerDrag.trigger.setUFromMouseX(mouseX);
      }
    } else if (this.triggerDrag.type === 'h') {
      // Move horizontal trigger vertically  
      if (typeof this.triggerDrag.trigger.setVFromMouseY === 'function') {
        this.triggerDrag.trigger.setVFromMouseY(mouseY);
      }
    }
  }

  /**
   * End trigger dragging
   * @private
   */
  _endTriggerDrag() {
    if (this.triggerDrag.active) {
      console.log(`Ended dragging ${this.triggerDrag.type}Trigger on ${this.triggerDrag.node.label}`);
    }
    
    this.triggerDrag = {
      active: false,
      node: null,
      trigger: null,
      type: null,
      startX: 0,
      startY: 0
    };
    
    // Reset cursor using P5.js global function
    if (typeof window.cursor === 'function') {
      window.cursor('default');
    }
  }

  /**
   * Find port under mouse position
   * @param {number} mouseX - Mouse X coordinate
   * @param {number} mouseY - Mouse Y coordinate
   * @param {number} threshold - Hit detection threshold
   * @returns {object|null} Port hit info or null
   * @private
   */
  _findPortAt(mouseX, mouseY, threshold = 8) {
    // Check all nodes in reverse order (front to back)
    for (let i = this.app.nodes.length - 1; i >= 0; i--) {
      const node = this.app.nodes[i];
      
      // Check VTrigger ports - return actual Port objects (matching HTrigger architecture)
      if (node.vTriggers && node.vTriggers.length > 0) {
        for (let j = 0; j < node.vTriggers.length; j++) {
          const trigger = node.vTriggers[j];
          
          // Check input port - return the actual Port object
          if (trigger.portInput && trigger.portInput.hits(mouseX, mouseY, threshold)) {
            return {
              node: node,
              trigger: trigger.portInput, // Return the Port object, not the VTrigger
              triggerType: 'v',
              type: 'input',
              index: j
            };
          }
          
          // Check output port - return the actual Port object
          if (trigger.portOutput && trigger.portOutput.hits(mouseX, mouseY, threshold)) {
            return {
              node: node,
              trigger: trigger.portOutput, // Return the Port object, not the VTrigger
              triggerType: 'v',
              type: 'output',
              index: j
            };
          }
        }
      }
      
      // Check HTrigger ports - return actual Port objects (matching monolithic script)
      if (node.hTriggers && node.hTriggers.length > 0) {
        for (let j = 0; j < node.hTriggers.length; j++) {
          const trigger = node.hTriggers[j];
          
          // Check up port - return the actual Port object
          if (trigger.portUp && trigger.portUp.hits(mouseX, mouseY, threshold)) {
            return {
              node: node,
              trigger: trigger.portUp, // Return the Port object, not the HTrigger
              triggerType: 'h',
              type: 'up',
              index: j
            };
          }
          
          // Check down port - return the actual Port object
          if (trigger.portDown && trigger.portDown.hits(mouseX, mouseY, threshold)) {
            return {
              node: node,
              trigger: trigger.portDown, // Return the Port object, not the HTrigger
              triggerType: 'h',
              type: 'down',
              index: j
            };
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Handle port click
   * @param {object} portHit - Port hit info from _findPortAt
   * @private
   */
  _handlePortClick(portHit) {
    const { node, trigger, triggerType, type } = portHit;
    
    // Start cable dragging from any port with proper type information
    console.log(`Starting cable drag from ${triggerType}Trigger ${type} port`);
    this._startCableDrag(trigger, this.lastMouseX, this.lastMouseY, type);
    
    // Bring node to front for better visibility
    this._bringNodeToFront(node);
    this._updateNodeStates();
  }

  /**
   * Start cable dragging from a port
   * @param {object} port - The port (trigger) to start dragging from
   * @param {number} mouseX - Mouse X coordinate
   * @param {number} mouseY - Mouse Y coordinate
   * @param {string} portType - Type of clicked port ('input', 'output', 'up', 'down')
   * @private
   */
  _startCableDrag(port, mouseX, mouseY, portType = null) {
    this.cableDrag = {
      active: true,
      startPort: port,
      startX: mouseX,
      startY: mouseY,
      portType: portType // Store the specific port type that was clicked
    };
    
    console.log(`Started cable drag from ${portType || 'unknown'} port`);
  }

  /**
   * Handle cable drag movement
   * @param {number} mouseX - Mouse X coordinate
   * @param {number} mouseY - Mouse Y coordinate
   * @private
   */
  _handleCableDrag(mouseX, mouseY) {
    // Cable drag preview is handled by the rendering system
    // We just need to track the current mouse position
    // The ConnectionRenderer will draw the preview cable
  }

  /**
   * End cable dragging and try to complete connection
   * @param {number} mouseX - Mouse X coordinate
   * @param {number} mouseY - Mouse Y coordinate
   * @private
   */
  _endCableDrag(mouseX, mouseY) {
    if (!this.cableDrag.active || !this.cableDrag.startPort) {
      this.cableDrag = { active: false, startPort: null, startX: 0, startY: 0 };
      return;
    }
    
    // Check if we're dropping on a compatible port
    const targetPortHit = this._findPortAt(mouseX, mouseY, 8);
    
    if (targetPortHit && targetPortHit.trigger !== this.cableDrag.startPort) {
      // NEW: Validate connection before creating it
      if (this._isValidConnectionAttempt(this.cableDrag.startPort, targetPortHit.trigger)) {
        this._createConnection(this.cableDrag.startPort, targetPortHit.trigger);
        console.log('Cable connection created successfully');
      } else {
        console.log('Cable drag ended - connection validation failed (input/output mismatch)');
      }
    } else {
      console.log('Cable drag ended - no valid target port found');
    }
    
    // Reset cable drag state
    this.cableDrag = {
      active: false,
      startPort: null,
      startX: 0,
      startY: 0
    };
  }

  /**
   * Validate if a connection attempt is allowed
   * @param {object} portA - Starting port
   * @param {object} portB - Target port
   * @returns {boolean} True if connection is allowed
   * @private
   */
  _isValidConnectionAttempt(portA, portB) {
    // Basic validation - ports exist and are different
    if (!portA || !portB || portA === portB) return false;
    
    // Get port roles for validation
    const roleA = this._getPortRole(portA);
    const roleB = this._getPortRole(portB);
    
    // Only allow connections between input and output ports
    const validConnection = (roleA === 'in' && roleB === 'out') || (roleA === 'out' && roleB === 'in');
    
    if (!validConnection) {
      console.log(`Connection blocked: ${roleA} port cannot connect to ${roleB} port`);
    }
    
    return validConnection;
  }

  /**
   * Get port role (input/output) from port or legacy trigger
   * @param {object} port - Port or trigger object
   * @returns {string} 'in', 'out', or 'unknown'
   * @private
   */
  _getPortRole(port) {
    // Check if this is a Port object with role property
    if (port.role) {
      return port.role;
    }
    
    // Legacy support: Determine role from port type
    if (port.type === 'input') return 'in';
    if (port.type === 'output') return 'out';
    if (port.type === 'up' || port.type === 'down') return 'out'; // HTrigger ports are outputs
    
    // Fallback: check for legacy _connectedPortType
    if (port._connectedPortType === 'input') return 'in';
    if (port._connectedPortType === 'output') return 'out';
    if (port._connectedPortType === 'up' || port._connectedPortType === 'down') return 'out';
    
    // Default fallback
    return 'unknown';
  }

  /**
   * Create a connection between two ports
   * @param {object} portA - Starting port (trigger)
   * @param {object} portB - Ending port (trigger)
   * @private
   */
  _createConnection(portA, portB) {
    // Store the port types that were clicked for correct positioning
    if (this.cableDrag.portType && !portA._connectedPortType) {
      portA._connectedPortType = this.cableDrag.portType;
      console.log(`Setting portA._connectedPortType = ${this.cableDrag.portType}`);
    }
    
    // Find the port type for portB based on current mouse position
    const targetPortHit = this._findPortAt(this.lastMouseX, this.lastMouseY, 8);
    if (targetPortHit && targetPortHit.trigger === portB && !portB._connectedPortType) {
      portB._connectedPortType = targetPortHit.type;
      console.log(`Setting portB._connectedPortType = ${targetPortHit.type}`);
    }
    
    // Import Connection class dynamically to avoid circular imports
    import('../models/Connection.js').then(({ default: Connection }) => {
      const connection = new Connection(portA, portB);
      
      // Add connection to app's connection manager
      if (this.app.addConnection) {
        this.app.addConnection(connection);
        console.log(`Created connection between ${portA._connectedPortType || 'unknown'} port and ${portB._connectedPortType || 'unknown'} port`);
      } else {
        console.warn('App does not have addConnection method');
      }
    }).catch(error => {
      console.error('Failed to create connection:', error);
    });
  }

  /**
   * Find connection under mouse position
   * @param {number} mouseX - Mouse X coordinate
   * @param {number} mouseY - Mouse Y coordinate
   * @param {number} threshold - Hit detection threshold
   * @returns {object|null} Connection or null
   * @private
   */
  _findConnectionAt(mouseX, mouseY, threshold = 6) {
    if (!this.app.connections || this.app.connections.length === 0) {
      return null;
    }
    
    let closestConnection = null;
    let closestDistance = threshold;
    
    for (const connection of this.app.connections) {
      const distance = connection.distanceToPoint(mouseX, mouseY);
      
      if (distance < closestDistance) {
        closestDistance = distance;
        closestConnection = connection;
      }
    }
    
    return closestConnection;
  }

  /**
   * Update connection hover states
   * @private
   */
  _updateConnectionHover() {
    const mousePos = this.app.canvas.getMousePos();
    const hoveredConnection = this._findConnectionAt(mousePos.x, mousePos.y, 6);
    
    // Reset all connection hover states
    if (this.app.connections) {
      for (const connection of this.app.connections) {
        connection.setHovered(false);
      }
    }
    
    // Set hover state for hit connection
    this.hoveredConnection = hoveredConnection;
    if (hoveredConnection) {
      hoveredConnection.setHovered(true);
    }
  }

  /**
   * Handle connection deletion
   * @param {object} connection - Connection to delete
   * @private
   */
  _deleteConnection(connection) {
    if (this.app.removeConnection) {
      this.app.removeConnection(connection);
      console.log('Connection deleted');
    } else {
      console.warn('App does not have removeConnection method');
    }
    
    this.hoveredConnection = null;
  }

  /**
   * Update port hover states for visual feedback
   * @private
   */
  _updatePortHover() {
    const mousePos = this.app.canvas.getMousePos();
    const portHit = this._findPortAt(mousePos.x, mousePos.y, 8);
    
    // Reset all port hover states
    for (const node of this.app.nodes) {
      // Reset VTrigger port hover states
      if (node.vTriggers) {
        for (const trigger of node.vTriggers) {
          if (trigger.setInputPortHovered) {
            trigger.setInputPortHovered(false);
          }
        }
      }
      
      // Reset HTrigger port hover states
      if (node.hTriggers) {
        for (const trigger of node.hTriggers) {
          if (trigger.setUpPortHovered) {
            trigger.setUpPortHovered(false);
          }
          if (trigger.setDownPortHovered) {
            trigger.setDownPortHovered(false);
          }
        }
      }
    }
    
    // Set hover state for hit port
    if (portHit) {
      const { trigger, triggerType, type } = portHit;
      
      if (triggerType === 'v') {
        if (type === 'input' && trigger.setInputPortHovered) {
          trigger.setInputPortHovered(true);
        }
      } else if (triggerType === 'h') {
        if (type === 'up' && trigger.setUpPortHovered) {
          trigger.setUpPortHovered(true);
        } else if (type === 'down' && trigger.setDownPortHovered) {
          trigger.setDownPortHovered(true);
        }
      }
    }
  }

  /**
   * Check if Shift key is currently pressed
   * Uses P5.js keyIsDown function
   * @returns {boolean} True if Shift is pressed
   * @private
   */
  _isShiftKeyDown() {
    // P5.js keyIsDown with key code 16 for Shift
    // Try accessing as global function (P5.js global mode)
    if (typeof keyIsDown === 'function') {
      const result = keyIsDown(16);
      console.log(`Shift key check: keyIsDown(16) = ${result}`);
      return result;
    }
    
    // Fallback to window.keyIsDown
    if (typeof window.keyIsDown === 'function') {
      const result = window.keyIsDown(16);
      console.log(`Shift key check (window): window.keyIsDown(16) = ${result}`);
      return result;
    }
    
    console.warn('keyIsDown function not available - Shift detection failed');
    return false;
  }

  /**
   * Handle node split operation
   * @param {object} node - Node to split
   * @param {number} mouseX - Mouse X coordinate (determines split position)
   * @param {number} mouseY - Mouse Y coordinate
   * @private
   */
  _handleNodeSplit(node, mouseX, mouseY) {
    // Only split WaveformNodes
    if (typeof node.splitAtU !== 'function') {
      console.warn('Node does not support splitting:', node.label);
      return;
    }

    // Calculate split position u based on mouse X within node
    const { gx, gw } = node.getGraphRect();
    const clampedX = Math.max(gx, Math.min(mouseX, gx + gw));
    const u = (clampedX - gx) / gw;

    console.log(`Attempting to split node "${node.label}" at u=${u.toFixed(3)}`);

    // Perform the split in the model
    const splitResult = node.splitAtU(u);

    if (!splitResult) {
      console.log('Split rejected by model (too close to edge)');
      return;
    }

    const { leftNode, rightNode, portMap } = splitResult;

    // Request AppController to perform the node replacement and connection remapping
    if (typeof this.app.splitNode === 'function') {
      this.app.splitNode(node, leftNode, rightNode, portMap);
      console.log(`Split completed: "${node.label}" → 2 nodes`);
    } else {
      console.error('AppController does not have splitNode method');
    }
  }

  /**
   * Duplicate a node and immediately start dragging the duplicate
   * @param {object} originalNode - Node to duplicate
   * @param {number} mouseX - Mouse X coordinate
   * @param {number} mouseY - Mouse Y coordinate
   * @private
   */
  _duplicateAndDragNode(originalNode, mouseX, mouseY) {
    // Create the duplicate
    const duplicate = this._createNodeDuplicate(originalNode);
    
    // Add duplicate to app's node array
    this.app.addNode(duplicate);
    
    // Set copy cursor immediately
    if (this.app.canvas.setCursor) {
      this.app.canvas.setCursor('copy');
    }
    
    // Start dragging the duplicate (not the original)
    this._startNodeDrag(duplicate, mouseX, mouseY);
    
    console.log(`Created duplicate of "${originalNode.label}" and started dragging`);
  }

  /**
   * Create a duplicate of a node with triggers copied (but not cables)
   * @param {object} node - Node to duplicate
   * @returns {object} Duplicated node
   * @private
   */
  _createNodeDuplicate(node) {
    // Import WaveformNode, VTrigger, HTrigger dynamically
    const WaveformNode = node.constructor;
    
    // Clone waveform samples
    const clonedSamples = [...node.samples];
    
    // Create new node at offset position (+12, +12 like monolithic script)
    const duplicate = new WaveformNode(
      node.x + 12,
      node.y + 12,
      node.label,
      clonedSamples,
      node.w
    );
    
    // Copy metadata
    duplicate.cc = node.cc;
    duplicate.sourceDeviceName = node.sourceDeviceName;
    
    // Copy all VTriggers (import dynamically to avoid circular deps)
    import('../models/VTrigger.js').then(({ default: VTrigger }) => {
      for (const vTrigger of node.vTriggers) {
        duplicate.vTriggers.push(new VTrigger(duplicate, vTrigger.u));
      }
    }).catch(error => {
      console.error('Failed to import VTrigger:', error);
    });
    
    // Copy all HTriggers (import dynamically to avoid circular deps)
    import('../models/HTrigger.js').then(({ default: HTrigger }) => {
      for (const hTrigger of node.hTriggers) {
        duplicate.hTriggers.push(new HTrigger(duplicate, hTrigger.v));
      }
    }).catch(error => {
      console.error('Failed to import HTrigger:', error);
    });
    
    // NOTE: Cables are intentionally NOT copied (matches monolithic behavior)
    
    console.log(`Duplicated node: "${node.label}" with ${node.vTriggers.length} VTriggers and ${node.hTriggers.length} HTriggers`);
    
    return duplicate;
  }

  /**
   * Handle specific create area interactions (for Phase 3+)
   */
  handleCreateArea(node, areaType, mouseX, mouseY) {
    // This method is now implemented via _handleEdgeAreaClick
    this._handleEdgeAreaClick(node, areaType, mouseX, mouseY);
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.nodeStates.clear();
    this._clearInteractionStates();
    console.log('InteractionController: Destroyed');
  }
}
