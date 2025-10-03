/**
 * Simple EventEmitter for MVC communication
 * Enables loose coupling between Models, Views, and Controllers
 */
export default class EventEmitter {
  constructor() {
    this._events = new Map();
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {function} callback - Event handler
   */
  on(event, callback) {
    if (!this._events.has(event)) {
      this._events.set(event, []);
    }
    this._events.get(event).push(callback);
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {function} callback - Event handler to remove
   */
  off(event, callback) {
    if (!this._events.has(event)) return;
    const callbacks = this._events.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Emit an event to all subscribers
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data = null) {
    if (!this._events.has(event)) return;
    const callbacks = this._events.get(event);
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`EventEmitter error in ${event}:`, error);
      }
    });
  }

  /**
   * Remove all listeners for an event or all events
   * @param {string} event - Optional specific event to clear
   */
  clear(event = null) {
    if (event) {
      this._events.delete(event);
    } else {
      this._events.clear();
    }
  }
}
