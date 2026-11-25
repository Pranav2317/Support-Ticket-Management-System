const E = require('./eventTypes');

const label = (s) => String(s).replace(/_/g, ' ');

/** Human-readable description of an event, shared by the activity log and notifications. */
function describe(event) {
  const { ticket, actor, changes = {} } = event;
  const who = actor?.name || 'Someone';
  const t = ticket?.ticketNumber || 'a ticket';

  switch (event.name) {
    case E.TICKET_CREATED:
      return `${who} created ${t}: "${ticket.title}"`;
    case E.TICKET_UPDATED:
      return `${who} updated ${Object.keys(changes).join(', ')} on ${t}`;
    case E.TICKET_STATUS_CHANGED:
      return `${who} changed status of ${t} from ${label(changes.status.from)} to ${label(changes.status.to)}`;
    case E.TICKET_RESOLVED:
      return `${t} was marked as resolved by ${who}`;
    case E.TICKET_ASSIGNED:
      return event.assignee ? `${who} assigned ${t} to ${event.assignee.name}` : `${who} unassigned ${t}`;
    case E.TICKET_DELETED:
      return `${who} deleted ${t}`;
    case E.COMMENT_ADDED:
      return `${who} commented on ${t}`;
    default:
      return `${event.name} on ${t}`;
  }
}

module.exports = { describe };
