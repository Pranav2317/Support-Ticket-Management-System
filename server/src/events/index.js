const eventBus = require('./eventBus');
const E = require('./eventTypes');
const activityLogHandler = require('./handlers/activityLog.handler');
const notificationHandler = require('./handlers/notification.handler');
const emailHandler = require('./handlers/email.handler');

let registered = false;

/** Wires every handler to the events it cares about. Called once at startup. */
function registerEventHandlers() {
  if (registered) return;
  registered = true;

  // Every event goes to the audit trail.
  eventBus.subscribe('*', 'activityLog', activityLogHandler);

  // In-app notifications.
  for (const evt of Object.values(E)) eventBus.subscribe(evt, 'notification', notificationHandler);

  // Email only for events the ticket owner cares about.
  for (const evt of [E.TICKET_STATUS_CHANGED, E.TICKET_RESOLVED, E.COMMENT_ADDED]) {
    eventBus.subscribe(evt, 'email', emailHandler);
  }
}

module.exports = { eventBus, events: E, registerEventHandlers };
