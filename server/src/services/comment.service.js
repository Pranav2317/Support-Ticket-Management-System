const Comment = require('../models/Comment');
const Ticket = require('../models/Ticket');
const ActivityLog = require('../models/ActivityLog');
const ApiError = require('../utils/ApiError');
const { ROLES, TICKET_STATUS } = require('../config/constants');
const { eventBus, events: E } = require('../events');
const { getAccessibleTicket } = require('./ticket.service');

async function list(user, ticketId) {
  await getAccessibleTicket(user, ticketId);
  return Comment.find({ ticket: ticketId }).sort({ createdAt: 1 }).populate('author', 'name role');
}

async function add(user, ticketId, body) {
  const ticket = await getAccessibleTicket(user, ticketId);
  if (user.role !== ROLES.ADMIN && ticket.status === TICKET_STATUS.CLOSED) {
    throw ApiError.conflict('This ticket is closed. Ask support to reopen it before commenting.');
  }

  const comment = await Comment.create({ ticket: ticket._id, author: user._id, body });
  await Ticket.updateOne({ _id: ticket._id }, { $inc: { commentCount: 1 } });

  await eventBus.publish(E.COMMENT_ADDED, {
    ticket: {
      _id: ticket._id,
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      status: ticket.status,
      createdBy: ticket.createdBy,
      assignedTo: ticket.assignedTo,
    },
    actor: { _id: user._id, name: user.name, role: user.role },
    comment: { _id: comment._id, body: comment.body },
  });
  return comment.populate('author', 'name role');
}

async function activity(user, ticketId) {
  await getAccessibleTicket(user, ticketId);
  return ActivityLog.find({ ticket: ticketId }).sort({ createdAt: 1 }).populate('actor', 'name role');
}

module.exports = { list, add, activity };
