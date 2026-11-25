// Controllers are thin: read validated input, call a service, shape the HTTP response.
// Express 5 forwards rejected promises to the error handler, so no try/catch is needed.
const authService = require('../services/auth.service');
const ticketService = require('../services/ticket.service');
const commentService = require('../services/comment.service');
const notificationService = require('../services/notification.service');
const User = require('../models/User');
const { ROLES } = require('../config/constants');

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

const auth = {
  register: async (req, res) => ok(res, await authService.register(req.valid.body), 201),
  login: async (req, res) => ok(res, await authService.login(req.valid.body)),
  me: async (req, res) => ok(res, { user: req.user }),
};

const tickets = {
  list: async (req, res) => {
    const { items, pagination } = await ticketService.list(req.user, req.valid.query);
    res.json({ success: true, data: items, pagination });
  },
  create: async (req, res) => ok(res, await ticketService.create(req.user, req.valid.body), 201),
  get: async (req, res) => ok(res, await ticketService.getById(req.user, req.valid.params.id)),
  update: async (req, res) => ok(res, await ticketService.update(req.user, req.valid.params.id, req.valid.body)),
  updateStatus: async (req, res) =>
    ok(res, await ticketService.updateStatus(req.user, req.valid.params.id, req.valid.body.status)),
  assign: async (req, res) =>
    ok(res, await ticketService.assign(req.user, req.valid.params.id, req.valid.body.assignedTo)),
  remove: async (req, res) => {
    await ticketService.remove(req.user, req.valid.params.id);
    res.status(204).end();
  },
  stats: async (req, res) => ok(res, await ticketService.stats(req.user)),
};

const comments = {
  list: async (req, res) => ok(res, await commentService.list(req.user, req.valid.params.id)),
  create: async (req, res) =>
    ok(res, await commentService.add(req.user, req.valid.params.id, req.valid.body.body), 201),
  activity: async (req, res) => ok(res, await commentService.activity(req.user, req.valid.params.id)),
};

const notifications = {
  list: async (req, res) => {
    const { items, unreadCount, pagination } = await notificationService.list(req.user, req.valid.query);
    res.json({ success: true, data: items, unreadCount, pagination });
  },
  markRead: async (req, res) => ok(res, await notificationService.markRead(req.user, req.valid.params.id)),
  markAllRead: async (req, res) => ok(res, await notificationService.markAllRead(req.user)),
};

const users = {
  // Used by the admin UI to populate the "assign to" dropdown.
  listAdmins: async (_req, res) => ok(res, await User.find({ role: ROLES.ADMIN }).select('name email role').sort('name')),
};

module.exports = { auth, tickets, comments, notifications, users };
