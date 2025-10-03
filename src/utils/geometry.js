/**
 * Pure geometry utilities for MIDI Viz
 * No dependencies, no state - just mathematical functions
 */

/**
 * Calculate squared distance between two points
 * @param {number} ax - First point X
 * @param {number} ay - First point Y
 * @param {number} bx - Second point X
 * @param {number} by - Second point Y
 * @returns {number} Squared distance
 */
export function dist2(ax, ay, bx, by) {
  return (ax - bx) ** 2 + (ay - by) ** 2;
}

/**
 * Check if point is inside rectangle
 * @param {number} px - Point X
 * @param {number} py - Point Y
 * @param {number} x - Rectangle X
 * @param {number} y - Rectangle Y
 * @param {number} w - Rectangle width
 * @param {number} h - Rectangle height
 * @returns {boolean} True if point is inside rectangle
 */
export function pointInRect(px, py, x, y, w, h) {
  return px >= x && px <= x + w && py >= y && py <= y + h;
}

/**
 * Calculate distance from point to line segment
 * @param {number} px - Point X
 * @param {number} py - Point Y
 * @param {number} ax - Segment start X
 * @param {number} ay - Segment start Y
 * @param {number} bx - Segment end X
 * @param {number} by - Segment end Y
 * @returns {number} Distance from point to segment
 */
export function pointToSegmentDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return Math.hypot(px - ax, py - ay);
  
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(px - bx, py - by);
  
  const t = c1 / c2;
  const qx = ax + t * vx;
  const qy = ay + t * vy;
  return Math.hypot(px - qx, py - qy);
}

/**
 * Calculate minimum distance between two rectangles
 * @param {number} ax - First rect X
 * @param {number} ay - First rect Y
 * @param {number} aw - First rect width
 * @param {number} ah - First rect height
 * @param {number} bx - Second rect X
 * @param {number} by - Second rect Y
 * @param {number} bw - Second rect width
 * @param {number} bh - Second rect height
 * @returns {number} Minimum distance between rectangles
 */
export function rectsMinDistance(ax, ay, aw, ah, bx, by, bw, bh) {
  const ax2 = ax + aw;
  const ay2 = ay + ah;
  const bx2 = bx + bw;
  const by2 = by + bh;
  
  const dx = (ax > bx2) ? (ax - bx2) : (bx > ax2 ? (bx - ax2) : 0);
  const dy = (ay > by2) ? (ay - by2) : (by - ay2 > 0 ? (by - ay2) : 0);
  
  return Math.hypot(dx, dy);
}

/**
 * Calculate distance from point to rectangle edge
 * @param {number} px - Point X
 * @param {number} py - Point Y
 * @param {number} rx - Rectangle X
 * @param {number} ry - Rectangle Y
 * @param {number} rw - Rectangle width
 * @param {number} rh - Rectangle height
 * @returns {number} Distance from point to rectangle edge
 */
export function pointRectDistance(px, py, rx, ry, rw, rh) {
  const dx = (px < rx) ? (rx - px) : (px > rx + rw ? px - (rx + rw) : 0);
  const dy = (py < ry) ? (ry - py) : (py > ry + rh ? py - (ry + rh) : 0);
  return Math.hypot(dx, dy);
}

/**
 * Compute docking snap positions for node alignment
 * @param {object} leadNode - Node being dragged
 * @param {number} proposedX - Proposed X position
 * @param {number} proposedY - Proposed Y position
 * @param {array} allNodes - All nodes in scene
 * @param {number} snapDistance - Maximum snap distance
 * @param {number} nearDistance - Distance to consider nodes "nearby"
 * @returns {object} {x, y, guideV, guideH, snappedTo}
 */
export function computeDockSnap(leadNode, proposedX, proposedY, allNodes, snapDistance = 8, nearDistance = 20) {
  let snapX = proposedX;
  let snapY = proposedY;
  let bestDx = null;
  let bestDy = null;
  let snappedTo = null;
  let guideV = null;
  let guideH = null;

  const leadRect = { x: proposedX, y: proposedY, w: leadNode.w, h: leadNode.h };
  const leadPoints = {
    left: proposedX,
    cx: proposedX + leadNode.w / 2,
    right: proposedX + leadNode.w,
    top: proposedY,
    cy: proposedY + leadNode.h / 2,
    bottom: proposedY + leadNode.h
  };

  for (const otherNode of allNodes) {
    if (otherNode === leadNode) continue;
    
    const minDist = rectsMinDistance(
      leadRect.x, leadRect.y, leadRect.w, leadRect.h,
      otherNode.x, otherNode.y, otherNode.w, otherNode.h
    );
    
    if (minDist > nearDistance) continue;

    const otherPoints = {
      left: otherNode.x,
      cx: otherNode.x + otherNode.w / 2,
      right: otherNode.x + otherNode.w,
      top: otherNode.y,
      cy: otherNode.y + otherNode.h / 2,
      bottom: otherNode.y + otherNode.h
    };

    // Check horizontal alignment
    for (const [leadKey, leadX] of Object.entries(leadPoints)) {
      if (leadKey === 'top' || leadKey === 'cy' || leadKey === 'bottom') continue;
      
      for (const [otherKey, otherX] of Object.entries(otherPoints)) {
        if (otherKey === 'top' || otherKey === 'cy' || otherKey === 'bottom') continue;
        
        const dx = otherX - leadX;
        if (Math.abs(dx) <= snapDistance && (bestDx === null || Math.abs(dx) < Math.abs(bestDx))) {
          bestDx = dx;
          snapX = proposedX + dx;
          guideV = otherX;
          snappedTo = otherNode;
        }
      }
    }

    // Check vertical alignment
    for (const [leadKey, leadY] of Object.entries(leadPoints)) {
      if (leadKey === 'left' || leadKey === 'cx' || leadKey === 'right') continue;
      
      for (const [otherKey, otherY] of Object.entries(otherPoints)) {
        if (otherKey === 'left' || otherKey === 'cx' || otherKey === 'right') continue;
        
        const dy = otherY - leadY;
        if (Math.abs(dy) <= snapDistance && (bestDy === null || Math.abs(dy) < Math.abs(bestDy))) {
          bestDy = dy;
          snapY = proposedY + dy;
          guideH = otherY;
          snappedTo = otherNode;
        }
      }
    }
  }

  return { x: snapX, y: snapY, guideV, guideH, snappedTo };
}

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation between two values
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} Interpolated value
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Map a value from one range to another
 * @param {number} value - Input value
 * @param {number} start1 - Input range start
 * @param {number} stop1 - Input range end
 * @param {number} start2 - Output range start
 * @param {number} stop2 - Output range end
 * @returns {number} Mapped value
 */
export function map(value, start1, stop1, start2, stop2) {
  const ratio = (value - start1) / (stop1 - start1);
  return start2 + ratio * (stop2 - start2);
}
