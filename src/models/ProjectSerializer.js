/**
 * ProjectSerializer - Central coordinator for project save/load operations
 * Handles complete application state serialization to/from JSON format
 * Pure model layer - no UI or controller concerns
 */

import WaveformNode from './WaveformNode.js';
import Connection from './Connection.js';

export default class ProjectSerializer {
  constructor() {
    this.currentVersion = '1.0';
    this.supportedVersions = ['1.0'];
  }

  /**
   * Serialize complete project state to JSON
   * @param {array} nodes - Array of WaveformNode instances
   * @param {array} connections - Array of Connection instances
   * @param {object} groupManager - GroupManager instance
   * @param {string} projectName - Project name
   * @returns {object} Complete project data as JSON-serializable object
   */
  serializeProject(nodes, connections, groupManager, projectName = 'Untitled') {
    const projectData = {
      version: this.currentVersion,
      timestamp: Date.now(),
      metadata: {
        name: projectName,
        lastModified: Date.now()
      },
      nodes: nodes.map(node => node.toJSON()),
      connections: connections.map(connection => connection.toJSON()),
      groups: groupManager.toJSON()
    };

    console.log(`ProjectSerializer: Serialized project "${projectName}" with ${nodes.length} nodes, ${connections.length} connections, ${groupManager.groups.length} groups`);
    
    return projectData;
  }

  /**
   * Deserialize project from JSON and restore application state
   * @param {object} jsonData - Project JSON data
   * @returns {object} Restoration package {nodes, connections, restoreGroups, metadata}
   * @throws {Error} If validation fails
   */
  deserializeProject(jsonData) {
    // Validate project data format
    const validation = this.validateProjectData(jsonData);
    if (!validation.valid) {
      throw new Error(`Invalid project data: ${validation.errors.join(', ')}`);
    }

    console.log(`ProjectSerializer: Deserializing project v${jsonData.version}`);

    // Step 1: Restore nodes and build node lookup map
    const nodeMap = new Map();
    const nodes = jsonData.nodes.map(nodeData => {
      const node = WaveformNode.fromJSON(nodeData);
      nodeMap.set(node.id, node);
      return node;
    });

    console.log(`ProjectSerializer: Restored ${nodes.length} nodes`);

    // Step 2: Build port lookup map from restored nodes
    const portMap = this._buildPortMap(nodes);
    const portLookup = (portId) => portMap.get(portId);

    console.log(`ProjectSerializer: Built port map with ${portMap.size} ports`);

    // Step 3: Restore connections using port lookup
    const connections = jsonData.connections
      .map(connectionData => {
        try {
          return Connection.fromJSON(connectionData, portLookup);
        } catch (err) {
          console.warn(`Failed to restore connection:`, err);
          return null;
        }
      })
      .filter(connection => connection !== null);

    console.log(`ProjectSerializer: Restored ${connections.length} connections`);

    // Step 4: Create group restoration function (to be called after nodes are added to scene)
    const restoreGroups = (groupManager) => {
      try {
        groupManager.restoreFromJSON(jsonData.groups, nodeMap);
        console.log(`ProjectSerializer: Groups restored successfully`);
      } catch (err) {
        console.error(`Failed to restore groups:`, err);
      }
    };

    // Return restoration package
    return {
      nodes,
      connections,
      restoreGroups,
      metadata: jsonData.metadata || { name: 'Untitled', lastModified: Date.now() }
    };
  }

  /**
   * Validate project JSON data structure
   * @param {object} data - Project data to validate
   * @returns {object} {valid: boolean, errors: array}
   */
  validateProjectData(data) {
    const errors = [];

    // Check for required top-level fields
    if (!data) {
      errors.push('Project data is null or undefined');
      return { valid: false, errors };
    }

    if (!data.version) {
      errors.push('Missing version field');
    } else if (!this._isVersionSupported(data.version)) {
      errors.push(`Unsupported version: ${data.version} (supported: ${this.supportedVersions.join(', ')})`);
    }

    if (!data.nodes || !Array.isArray(data.nodes)) {
      errors.push('Invalid or missing nodes array');
    }

    if (!data.connections || !Array.isArray(data.connections)) {
      errors.push('Invalid or missing connections array');
    }

    if (!data.groups || !Array.isArray(data.groups)) {
      errors.push('Invalid or missing groups array');
    }

    // Validate metadata structure (optional but should be valid if present)
    if (data.metadata && typeof data.metadata !== 'object') {
      errors.push('Invalid metadata structure');
    }

    // Check for basic node data validity
    if (data.nodes && Array.isArray(data.nodes)) {
      data.nodes.forEach((node, index) => {
        if (!node.id) {
          errors.push(`Node at index ${index} missing id field`);
        }
        if (node.x === undefined || node.y === undefined) {
          errors.push(`Node at index ${index} missing position data`);
        }
        if (!node.samples || !Array.isArray(node.samples)) {
          errors.push(`Node at index ${index} missing or invalid samples array`);
        }
      });
    }

    // Check for basic connection data validity
    if (data.connections && Array.isArray(data.connections)) {
      data.connections.forEach((conn, index) => {
        if (!conn.portA || !conn.portB) {
          errors.push(`Connection at index ${index} missing port references`);
        }
      });
    }

    const isValid = errors.length === 0;
    
    if (isValid) {
      console.log('ProjectSerializer: Validation passed');
    } else {
      console.warn('ProjectSerializer: Validation failed', errors);
    }

    return {
      valid: isValid,
      errors
    };
  }

  /**
   * Build port lookup map from restored nodes
   * Maps port ID → port instance for connection restoration
   * @param {array} nodes - Array of WaveformNode instances
   * @returns {Map} Map of port ID to port instance
   * @private
   */
  _buildPortMap(nodes) {
    const portMap = new Map();

    for (const node of nodes) {
      // Add VTrigger ports
      for (let i = 0; i < node.vTriggers.length; i++) {
        const trigger = node.vTriggers[i];
        
        // Input port
        if (trigger.portInput && trigger.portInput.id) {
          portMap.set(trigger.portInput.id, trigger.portInput);
        }
        
        // Output port
        if (trigger.portOutput && trigger.portOutput.id) {
          portMap.set(trigger.portOutput.id, trigger.portOutput);
        }
      }

      // Add HTrigger ports
      for (let i = 0; i < node.hTriggers.length; i++) {
        const trigger = node.hTriggers[i];
        
        // Up port
        if (trigger.portUp && trigger.portUp.id) {
          portMap.set(trigger.portUp.id, trigger.portUp);
        }
        
        // Down port
        if (trigger.portDown && trigger.portDown.id) {
          portMap.set(trigger.portDown.id, trigger.portDown);
        }
      }
    }

    return portMap;
  }

  /**
   * Check if a project version is supported
   * @param {string} version - Version string to check
   * @returns {boolean} True if version is supported
   * @private
   */
  _isVersionSupported(version) {
    return this.supportedVersions.includes(version);
  }

  /**
   * Get current serializer version
   * @returns {string} Current version
   */
  getVersion() {
    return this.currentVersion;
  }

  /**
   * Get list of supported versions
   * @returns {array} Array of supported version strings
   */
  getSupportedVersions() {
    return [...this.supportedVersions];
  }
}
