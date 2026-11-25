const Notification = require('../../models/Notification');
const User = require('../../models/User');
const E = require('../eventTypes');
const { describe } = require('../messages');
const { ROLES, TICKET_STATUS } = require('../../config/constants');

const idOf = (v) => (v && v._id ? v._id : v)?.toString();

async function adminIds() {
  const admins = await User.find({ role: ROLES.ADMIN }).select('_id').lean();
  return admins.map((a) => a._id.toString());
}

/** Who should hear about this event? (The actor is filtered out afterwards.) */
async function recipientsFor(event) {
  const { ticket, actor } = event;
  const ownerId = idOf(ticket.createdBy);
  const assigneeId = idOf(ticket.assignedTo);
  const actorIsAdmin = actor.role === ROLES.ADMIN;
  // Messages from the customer go to the assigned agent, or to every admin if unassigned.
  const staff = async () => (assigneeId ? [assigneeId] : adminIds());

  switch (event.name) {
    case E.TICKET_CREATED:
      return adminIds();
    case E.TICKET_UPDATED:
    case E.COMMENT_ADDED:
      return actorIsAdmin ? [ownerId] : staff();
    case E.TICKET_STATUS_CHANGED:
      // A move to "resolved" is announced by TICKET_RESOLVED instead, to avoid duplicates.
      return event.changes.status.to === TICKET_STATUS.RESOLVED ? [] : [ownerId];
    case E.TICKET_RESOLVED:
      return [ownerId];
    case E.TICKET_ASSIGNED:
      return event.assignee ? [idOf(event.assignee)] : [];
    case E.TICKET_DELETED:
      return actorIsAdmin ? [ownerId] : [];
    default:
      return [];
  }
}

module.exports = async function notificationHandler(event) {
  const actorId = idOf(event.actor);
  const recipients = [...new Set(await recipientsFor(event))].filter((id) => id && id !== actorId);
  if (!recipients.length) return;

  const message = describe(event);
  const ticketId = event.name === E.TICKET_DELETED ? undefined : event.ticket._id;
  await Notification.insertMany(
    recipients.map((recipient) => ({ recipient, ticket: ticketId, event: event.name, message }))
  );
};
