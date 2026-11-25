// Domain events emitted by the service layer.
module.exports = Object.freeze({
  TICKET_CREATED: 'ticket.created',
  TICKET_UPDATED: 'ticket.updated',
  TICKET_STATUS_CHANGED: 'ticket.status_changed',
  TICKET_RESOLVED: 'ticket.resolved',
  TICKET_ASSIGNED: 'ticket.assigned',
  TICKET_DELETED: 'ticket.deleted',
  COMMENT_ADDED: 'comment.added',
});
