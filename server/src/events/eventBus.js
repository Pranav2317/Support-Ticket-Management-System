const env = require('../config/env');

/**
 * Minimal in-process event bus.
 *
 * - Services publish domain events after the database write succeeds.
 * - Handlers (activity log, notifications, email) subscribe by event name, or '*' for all.
 * - Handlers run concurrently and are isolated: one failing handler is logged and never
 *   breaks the request or the other handlers.
 *
 * The interface (publish/subscribe) has the same shape as a message broker, so moving to
 * Redis / RabbitMQ / BullMQ later only changes this file.
 */
class EventBus {
  constructor() {
    this.handlers = new Map();
  }

  subscribe(eventName, handlerName, fn) {
    if (!this.handlers.has(eventName)) this.handlers.set(eventName, []);
    this.handlers.get(eventName).push({ name: handlerName, fn });
  }

  async publish(eventName, payload) {
    const event = { name: eventName, occurredAt: new Date(), ...payload };
    const targets = [...(this.handlers.get(eventName) || []), ...(this.handlers.get('*') || [])];

    const results = await Promise.allSettled(targets.map((h) => h.fn(event)));
    results.forEach((r, i) => {
      if (r.status === 'rejected' && !env.isTest) {
        console.error(`[events] handler "${targets[i].name}" failed for ${eventName}:`, r.reason);
      }
    });
    return results;
  }
}

module.exports = new EventBus();
