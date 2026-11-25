const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Counter = require('../models/Counter');
const ApiError = require('../utils/ApiError');
const { paginate, pageMeta, escapeRegex } = require('../utils/pagination');
const { ROLES, TICKET_STATUS, STATUS_TRANSITIONS } = require('../config/constants');
const { eventBus, events: E } = require('../events');

const isAdmin = (user) => user.role === ROLES.ADMIN;
const isOwner = (user, ticket) => String(ticket.createdBy._id || ticket.createdBy) === String(user._id);

const POPULATE = [
  { path: 'createdBy', select: 'name email role' },
  { path: 'assignedTo', select: 'name email role' },
];

/** Small, stable snapshot of a ticket that goes into events. */
const snapshot = (t) => ({
  _id: t._id,
  ticketNumber: t.ticketNumber,
  title: t.title,
  status: t.status,
  priority: t.priority,
  createdBy: t.createdBy?._id || t.createdBy,
  assignedTo: t.assignedTo?._id || t.assignedTo || null,
});
const actorOf = (u) => ({ _id: u._id, name: u.name, role: u.role });

/**
 * Loads a ticket the user is allowed to see. Non-owners get 404 (not 403) so the API
 * does not reveal which ticket ids exist.
 */
async function getAccessibleTicket(user, id, { populate = false } = {}) {
  const query = Ticket.findById(id);
  if (populate) query.populate(POPULATE);
  const ticket = await query;
  if (!ticket || (!isAdmin(user) && !isOwner(user, ticket))) throw ApiError.notFound('Ticket not found');
  return ticket;
}

async function create(user, data) {
  const seq = await Counter.next('ticket');
  const ticket = await Ticket.create({ ...data, ticketNumber: `TCK-${1000 + seq}`, createdBy: user._id });
  await eventBus.publish(E.TICKET_CREATED, { ticket: snapshot(ticket), actor: actorOf(user) });
  return ticket.populate(POPULATE);
}

async function list(user, q) {
  const filter = {};
  if (!isAdmin(user)) filter.createdBy = user._id; // users only ever see their own tickets
  else if (q.createdBy) filter.createdBy = q.createdBy;

  if (q.status) filter.status = q.status;
  if (q.priority) filter.priority = q.priority;
  if (q.category) filter.category = q.category;
  if (q.assignedTo === 'me') filter.assignedTo = user._id;
  else if (q.assignedTo === 'none') filter.assignedTo = null;
  else if (q.assignedTo) filter.assignedTo = q.assignedTo;

  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ title: rx }, { description: rx }, { ticketNumber: rx }];
  }

  const desc = q.sort.startsWith('-');
  let field = q.sort.replace(/^-/, '');
  if (field === 'priority') field = 'priorityRank';
  const sort = { [field]: desc ? -1 : 1, _id: desc ? -1 : 1 };

  const { page, limit, skip } = paginate(q);
  const [items, total] = await Promise.all([
    Ticket.find(filter).sort(sort).skip(skip).limit(limit).populate(POPULATE),
    Ticket.countDocuments(filter),
  ]);
  return { items, pagination: pageMeta(total, page, limit) };
}

const getById = (user, id) => getAccessibleTicket(user, id, { populate: true });

async function update(user, id, data) {
  const ticket = await getAccessibleTicket(user, id);
  if (!isAdmin(user) && ticket.status !== TICKET_STATUS.OPEN) {
    throw ApiError.conflict('Tickets can only be edited while they are open');
  }

  const changes = {};
  for (const [key, value] of Object.entries(data)) {
    if (ticket[key] !== value) {
      changes[key] = { from: ticket[key], to: value };
      ticket[key] = value;
    }
  }
  if (!Object.keys(changes).length) return ticket.populate(POPULATE);

  await ticket.save();
  await eventBus.publish(E.TICKET_UPDATED, { ticket: snapshot(ticket), actor: actorOf(user), changes });
  return ticket.populate(POPULATE);
}

async function updateStatus(admin, id, status) {
  const ticket = await getAccessibleTicket(admin, id);
  const from = ticket.status;
  if (from === status) return ticket.populate(POPULATE);
  if (!STATUS_TRANSITIONS[from].includes(status)) {
    throw ApiError.badRequest(`Cannot change status from ${from} to ${status}`);
  }

  ticket.status = status;
  if (status === TICKET_STATUS.RESOLVED) ticket.resolvedAt = new Date();
  if (status === TICKET_STATUS.CLOSED) ticket.closedAt = new Date();
  if (status === TICKET_STATUS.OPEN || status === TICKET_STATUS.IN_PROGRESS) {
    ticket.resolvedAt = null;
    ticket.closedAt = null;
  }
  await ticket.save();

  const payload = { ticket: snapshot(ticket), actor: actorOf(admin), changes: { status: { from, to: status } } };
  await eventBus.publish(E.TICKET_STATUS_CHANGED, payload);
  if (status === TICKET_STATUS.RESOLVED) await eventBus.publish(E.TICKET_RESOLVED, payload);
  return ticket.populate(POPULATE);
}

async function assign(admin, id, assignedTo) {
  const ticket = await getAccessibleTicket(admin, id);
  let assignee = null;
  if (assignedTo) {
    assignee = await User.findById(assignedTo).select('name role');
    if (!assignee || assignee.role !== ROLES.ADMIN) {
      throw ApiError.badRequest('Tickets can only be assigned to an admin');
    }
  }
  if (String(ticket.assignedTo || '') === String(assignedTo || '')) return ticket.populate(POPULATE);

  ticket.assignedTo = assignee ? assignee._id : null;
  await ticket.save();
  await eventBus.publish(E.TICKET_ASSIGNED, {
    ticket: snapshot(ticket),
    actor: actorOf(admin),
    assignee: assignee && { _id: assignee._id, name: assignee.name },
  });
  return ticket.populate(POPULATE);
}

async function remove(user, id) {
  const ticket = await getAccessibleTicket(user, id);
  if (!isAdmin(user) && ticket.status !== TICKET_STATUS.OPEN) {
    throw ApiError.conflict('Tickets can only be deleted while they are open');
  }
  const snap = snapshot(ticket);
  await Promise.all([
    Comment.deleteMany({ ticket: ticket._id }),
    Notification.deleteMany({ ticket: ticket._id }),
    ticket.deleteOne(),
  ]);
  // Activity logs are kept on purpose: the audit trail should survive deletions.
  await eventBus.publish(E.TICKET_DELETED, { ticket: snap, actor: actorOf(user) });
}

async function stats(user) {
  const match = isAdmin(user) ? {} : { createdBy: new mongoose.Types.ObjectId(String(user._id)) };
  const [facet] = await Ticket.aggregate([
    { $match: match },
    {
      $facet: {
        total: [{ $count: 'n' }],
        byStatus: [{ $group: { _id: '$status', n: { $sum: 1 } } }],
        byPriority: [{ $group: { _id: '$priority', n: { $sum: 1 } } }],
        byCategory: [{ $group: { _id: '$category', n: { $sum: 1 } } }],
        unassigned: [{ $match: { assignedTo: null, status: { $in: ['open', 'in_progress'] } } }, { $count: 'n' }],
        resolution: [
          { $match: { resolvedAt: { $ne: null } } },
          { $group: { _id: null, avgMs: { $avg: { $subtract: ['$resolvedAt', '$createdAt'] } } } },
        ],
      },
    },
  ]);

  const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.n]));
  const avgMs = facet.resolution[0]?.avgMs;
  return {
    total: facet.total[0]?.n || 0,
    byStatus: { open: 0, in_progress: 0, resolved: 0, closed: 0, ...toMap(facet.byStatus) },
    byPriority: { low: 0, medium: 0, high: 0, urgent: 0, ...toMap(facet.byPriority) },
    byCategory: toMap(facet.byCategory),
    unassigned: facet.unassigned[0]?.n || 0,
    avgResolutionHours: avgMs ? Math.round((avgMs / 36e5) * 10) / 10 : null,
  };
}

module.exports = { create, list, getById, update, updateStatus, assign, remove, stats, getAccessibleTicket };
