const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const c = require('../controllers');
const { z, idParam } = require('../validators/common');
const authV = require('../validators/auth.validator');
const ticketV = require('../validators/ticket.validator');
const commentV = require('../validators/comment.validator');
const { ROLES } = require('../config/constants');

const router = Router();
const adminOnly = authorize(ROLES.ADMIN);

// Brute-force protection on credential endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 1000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, please try again later' },
});

router.get('/health', (_req, res) => res.json({ success: true, status: 'ok' }));

// ---- Auth ----
router.post('/auth/register', authLimiter, validate({ body: authV.register }), c.auth.register);
router.post('/auth/login', authLimiter, validate({ body: authV.login }), c.auth.login);
router.get('/auth/me', authenticate, c.auth.me);

// Everything below requires a valid token.
router.use(authenticate);

// ---- Tickets ----
router.get('/tickets/stats', c.tickets.stats);
router.get('/tickets', validate({ query: ticketV.list }), c.tickets.list);
router.post('/tickets', validate({ body: ticketV.create }), c.tickets.create);
router.get('/tickets/:id', validate({ params: idParam }), c.tickets.get);
router.patch('/tickets/:id', validate({ params: idParam, body: ticketV.update }), c.tickets.update);
router.delete('/tickets/:id', validate({ params: idParam }), c.tickets.remove);
router.patch('/tickets/:id/status', adminOnly, validate({ params: idParam, body: ticketV.updateStatus }), c.tickets.updateStatus);
router.patch('/tickets/:id/assign', adminOnly, validate({ params: idParam, body: ticketV.assign }), c.tickets.assign);

// ---- Comments & activity (nested under the ticket they belong to) ----
router.get('/tickets/:id/comments', validate({ params: idParam }), c.comments.list);
router.post('/tickets/:id/comments', validate({ params: idParam, body: commentV.create }), c.comments.create);
router.get('/tickets/:id/activity', validate({ params: idParam }), c.comments.activity);

// ---- Notifications ----
const notifQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  unread: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});
router.get('/notifications', validate({ query: notifQuery }), c.notifications.list);
router.patch('/notifications/read-all', c.notifications.markAllRead);
router.patch('/notifications/:id/read', validate({ params: idParam }), c.notifications.markRead);

// ---- Users (admin) ----
router.get('/users/admins', adminOnly, c.users.listAdmins);

module.exports = router;
