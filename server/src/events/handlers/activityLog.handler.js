const ActivityLog = require('../../models/ActivityLog');
const { describe } = require('../messages');

module.exports = async function activityLogHandler(event) {
  const meta = {};
  if (event.changes) meta.changes = event.changes;
  if (event.comment) meta.commentId = event.comment._id;
  if (event.assignee) meta.assignee = { id: event.assignee._id, name: event.assignee.name };

  await ActivityLog.create({
    event: event.name,
    ticket: event.ticket?._id,
    ticketNumber: event.ticket?.ticketNumber,
    actor: event.actor?._id,
    message: describe(event),
    meta,
  });
};
