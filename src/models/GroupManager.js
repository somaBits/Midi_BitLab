/**
 * GroupManager - Pure business logic for node grouping
 * Manages groups of nodes for synchronized playback and visual coordination
 * No rendering concerns - pure model layer
 */

import EventEmitter from '../utils/EventEmitter.js';

export default class GroupManager extends EventEmitter {
  constructor() {
    super();
    
    // Array of group objects: [{members: Set, playStart, durationMs, startX, runId}]
    this.groups = [];
    
    console.log('GroupManager: Initialized');
  }

  /**
   * Find which group contains the given node
   * @param {object} node - Node to search for
   * @returns {object|null} Group object or null if node is not grouped
   */
  findGroupContaining(node) {
    if (!node) return null;
    
    for (const group of this.groups) {
      if (group.members.has(node)) {
        return group;
      }
    }
    
    return null;
  }

  /**
   * Ensure two nodes are in the same group (create or merge groups as needed)
   * @param {object} nodeA - First node
   * @param {object} nodeB - Second node
   * @returns {object} The group containing both nodes
   */
  ensureGroupWith(nodeA, nodeB) {
    if (!nodeA || !nodeB) {
      console.warn('GroupManager.ensureGroupWith: Invalid nodes provided');
      return null;
    }
    
    const groupA = this.findGroupContaining(nodeA);
    const groupB = this.findGroupContaining(nodeB);
    
    // Case 1: Both nodes in different groups - merge the groups
    if (groupA && groupB && groupA !== groupB) {
      console.log(`GroupManager: Merging groups (${groupA.members.size} + ${groupB.members.size} nodes)`);
      
      // Add all members from groupB to groupA
      for (const member of groupB.members) {
        groupA.members.add(member);
      }
      
      // Remove groupB
      this._removeGroup(groupB);
      
      this.emit('group-merged', { group: groupA, removedGroup: groupB });
      return groupA;
    }
    
    // Case 2: Only nodeA is grouped - add nodeB to groupA
    if (groupA && !groupB) {
      console.log(`GroupManager: Adding "${nodeB.label}" to existing group (${groupA.members.size} nodes)`);
      groupA.members.add(nodeB);
      this.emit('node-added-to-group', { node: nodeB, group: groupA });
      return groupA;
    }
    
    // Case 3: Only nodeB is grouped - add nodeA to groupB
    if (!groupA && groupB) {
      console.log(`GroupManager: Adding "${nodeA.label}" to existing group (${groupB.members.size} nodes)`);
      groupB.members.add(nodeA);
      this.emit('node-added-to-group', { node: nodeA, group: groupB });
      return groupB;
    }
    
    // Case 4: Neither node is grouped - create new group
    console.log(`GroupManager: Creating new group with "${nodeA.label}" and "${nodeB.label}"`);
    const newGroup = {
      members: new Set([nodeA, nodeB]),
      playStart: null,      // Timestamp when playback started
      durationMs: 0,        // Total playback duration
      startX: null,         // Graph X position where playback started
      runId: null           // Unique ID for current playback session
    };
    
    this.groups.push(newGroup);
    this.emit('group-created', { group: newGroup });
    return newGroup;
  }

  /**
   * Remove a node from its group
   * @param {object} node - Node to ungroup
   * @returns {boolean} True if node was ungrouped, false if not in a group
   */
  ungroupNode(node) {
    if (!node) return false;
    
    const group = this.findGroupContaining(node);
    if (!group) {
      console.log(`GroupManager: Node "${node.label}" is not in a group`);
      return false;
    }
    
    console.log(`GroupManager: Removing "${node.label}" from group (${group.members.size} nodes)`);
    group.members.delete(node);
    
    this.emit('node-removed-from-group', { node, group });
    
    // Clean up if group is now too small
    this.removeEmptyGroups();
    
    return true;
  }

  /**
   * Remove groups with fewer than 2 members
   * Groups need at least 2 nodes to be meaningful
   */
  removeEmptyGroups() {
    const sizeBefore = this.groups.length;
    
    this.groups = this.groups.filter(group => {
      if (group.members.size < 2) {
        console.log(`GroupManager: Removing group with ${group.members.size} member(s)`);
        this.emit('group-removed', { group });
        return false;
      }
      return true;
    });
    
    const removed = sizeBefore - this.groups.length;
    if (removed > 0) {
      console.log(`GroupManager: Cleaned up ${removed} empty group(s)`);
    }
  }

  /**
   * Start synchronized playback for a group
   * @param {object} group - Group to start playing
   * @param {number} startU - Optional normalized U position (0-1) to start from
   */
  startGroupPlayback(group, startU = 0) {
    if (!group || !group.members || group.members.size === 0) {
      console.warn('GroupManager.startGroupPlayback: Invalid group');
      return;
    }
    
    const bounds = this.computeGroupGraphBounds(group);
    const startX = bounds.minGX + (startU * (bounds.maxGX - bounds.minGX));
    
    // Use the new X-based method
    this.startGroupPlaybackFromX(group, startX);
  }

  /**
   * Start synchronized playback for a group from specific X position
   * @param {object} group - Group to start playing
   * @param {number} startX - Global X coordinate to start from
   */
  startGroupPlaybackFromX(group, startX) {
    if (!group || !group.members || group.members.size === 0) {
      console.warn('GroupManager.startGroupPlaybackFromX: Invalid group');
      return;
    }
    
    const bounds = this.computeGroupGraphBounds(group);
    
    // Clamp startX to group bounds
    const clampedStartX = Math.max(bounds.minGX, Math.min(startX, bounds.maxGX));
    
    // Calculate duration based on distance from start to end
    const distance = bounds.maxGX - clampedStartX;
    const SPEED_PX_PER_SEC = 100; // Match PIXELS_PER_SECOND from constants
    const durationMs = Math.max(1, (distance / SPEED_PX_PER_SEC) * 1000);
    
    // Initialize playback state
    group.playStart = performance.now();
    group.startX = clampedStartX;
    group.durationMs = durationMs;
    group.runId = group.playStart; // Use timestamp as unique runId
    
    // Reset all member nodes' playback state and start them playing
    for (const node of group.members) {
      if (node._vFiredThisRun) node._vFiredThisRun.clear();
      if (node._prevTNorm !== undefined) node._prevTNorm = null;
      if (node._lastCCSent !== undefined) node._lastCCSent = -1;
      if (node.hasFiredEnd !== undefined) node.hasFiredEnd = false;
      node._groupRunId = group.runId;
      
      // Start all nodes playing (CC will only output when playhead enters each node)
      node.startPlayback();
    }
    
    console.log(`GroupManager: Started group playback from X=${clampedStartX.toFixed(1)} (${group.members.size} nodes, ${durationMs.toFixed(0)}ms duration)`);
    this.emit('group-playback-started', { group, startX: clampedStartX });
  }

  /**
   * Stop playback for a group
   * @param {object} group - Group to stop
   */
  stopGroupPlayback(group) {
    if (!group) return;
    
    // CRITICAL: Stop all individual node playback
    // This prevents red playheads from appearing after blue playhead completes
    for (const node of group.members) {
      if (node.playing) {
        node.stopPlayback();
      }
    }
    
    group.playStart = null;
    group.runId = null;
    
    console.log(`GroupManager: Stopped group playback and all member nodes (${group.members.size} nodes)`);
    this.emit('group-playback-stopped', { group });
  }

  /**
   * Get the active (playing) group for a given node
   * @param {object} node - Node to check
   * @returns {object|null} Playing group or null
   */
  getActiveGroupFor(node) {
    if (!node) return null;
    
    const group = this.findGroupContaining(node);
    if (!group) return null;
    
    // Check if group is actively playing
    if (group.playStart !== null) {
      return group;
    }
    
    return null;
  }

  /**
   * Get current playback progress for a group (0-1)
   * @param {object} group - Group to check
   * @returns {number} Progress from 0 to 1, or 0 if not playing
   */
  getGroupProgress(group) {
    if (!group || group.playStart === null) return 0;
    
    const elapsed = performance.now() - group.playStart;
    const progress = Math.min(1, elapsed / Math.max(1, group.durationMs));
    
    // Stop playback when complete
    if (progress >= 1) {
      this.stopGroupPlayback(group);
    }
    
    return progress;
  }

  /**
   * Compute rectangular bounds of a group (node body bounds)
   * @param {object} group - Group to compute bounds for
   * @returns {object} {minX, minY, maxX, maxY, midX, midY}
   */
  computeGroupBounds(group) {
    if (!group || !group.members || group.members.size === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, midX: 0, midY: 0 };
    }
    
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    for (const node of group.members) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.w);
      maxY = Math.max(maxY, node.y + node.h);
    }
    
    return {
      minX,
      minY,
      maxX,
      maxY,
      midX: (minX + maxX) / 2,
      midY: (minY + maxY) / 2
    };
  }

  /**
   * Compute graph area bounds of a group (waveform display area)
   * @param {object} group - Group to compute bounds for
   * @returns {object} {minGX, maxGX, minGY, maxGY}
   */
  computeGroupGraphBounds(group) {
    if (!group || !group.members || group.members.size === 0) {
      return { minGX: 0, maxGX: 0, minGY: 0, maxGY: 0 };
    }
    
    let minGX = Infinity;
    let maxGX = -Infinity;
    let minGY = Infinity;
    let maxGY = -Infinity;
    
    for (const node of group.members) {
      const graphRect = node.getGraphRect();
      minGX = Math.min(minGX, graphRect.gx);
      maxGX = Math.max(maxGX, graphRect.gx + graphRect.gw);
      minGY = Math.min(minGY, graphRect.gy);
      maxGY = Math.max(maxGY, graphRect.gy + graphRect.gh);
    }
    
    return { minGX, maxGX, minGY, maxGY };
  }

  /**
   * Get all groups that are currently playing
   * @returns {array} Array of active groups
   */
  getActiveGroups() {
    return this.groups.filter(group => group.playStart !== null);
  }

  /**
   * Get all groups
   * @returns {array} Array of all groups
   */
  getAllGroups() {
    return this.groups;
  }

  /**
   * Check if a node is in any group
   * @param {object} node - Node to check
   * @returns {boolean} True if node is grouped
   */
  isNodeGrouped(node) {
    return this.findGroupContaining(node) !== null;
  }

  /**
   * Get all nodes in the same group as the given node
   * @param {object} node - Node to check
   * @returns {array} Array of nodes in same group (empty if not grouped)
   */
  getGroupMembers(node) {
    const group = this.findGroupContaining(node);
    if (!group) return [];
    
    return Array.from(group.members);
  }

  /**
   * Remove a specific group
   * @param {object} group - Group to remove
   * @private
   */
  _removeGroup(group) {
    const index = this.groups.indexOf(group);
    if (index >= 0) {
      this.groups.splice(index, 1);
      this.emit('group-removed', { group });
    }
  }

  /**
   * Get debug state
   * @returns {object} Debug information
   */
  getDebugState() {
    return {
      totalGroups: this.groups.length,
      activeGroups: this.getActiveGroups().length,
      groups: this.groups.map(g => ({
        memberCount: g.members.size,
        isPlaying: g.playStart !== null,
        progress: this.getGroupProgress(g)
      }))
    };
  }

  /**
   * Serialize groups to JSON
   * @returns {array} Array of group data objects
   */
  toJSON() {
    return this.groups.map(group => ({
      memberIds: Array.from(group.members).map(node => node.id)
    }));
  }

  /**
   * Restore groups from JSON data
   * @param {array} groupsData - Array of serialized group data
   * @param {Map} nodeMap - Map of node ID to node instance
   */
  restoreFromJSON(groupsData, nodeMap) {
    // Clear existing groups
    this.groups = [];
    
    if (!groupsData || !Array.isArray(groupsData)) {
      console.warn('GroupManager.restoreFromJSON: Invalid groups data');
      return;
    }
    
    // Recreate each group
    for (const groupData of groupsData) {
      if (!groupData.memberIds || !Array.isArray(groupData.memberIds)) {
        console.warn('GroupManager.restoreFromJSON: Invalid group data', groupData);
        continue;
      }
      
      // Get node instances from IDs
      const nodes = groupData.memberIds
        .map(id => nodeMap.get(id))
        .filter(node => node !== undefined);
      
      // Only create group if we have at least 2 valid nodes
      if (nodes.length >= 2) {
        // Use ensureGroupWith to create the group
        const firstNode = nodes[0];
        for (let i = 1; i < nodes.length; i++) {
          this.ensureGroupWith(firstNode, nodes[i]);
        }
        console.log(`GroupManager: Restored group with ${nodes.length} nodes`);
      } else {
        console.warn(`GroupManager: Skipped group with ${nodes.length} valid nodes (need at least 2)`);
      }
    }
    
    console.log(`GroupManager: Restored ${this.groups.length} groups from JSON`);
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.groups = [];
    this.removeAllListeners();
    console.log('GroupManager: Destroyed');
  }
}
