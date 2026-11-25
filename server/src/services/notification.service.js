const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const { paginate, pageMeta } = require('../utils/pagination');

async function list(user, { page, limit, unread }) {
  const filter = { recipient: user._id };
  if (unread) filter.read = false;
  const p = paginate({ page, limit });
  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate('ticket', 'ticketNumber title'),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: user._id, read: false }),
  ]);
  return { items, unreadCount, pagination: pageMeta(total, p.page, p.limit) };
}

async function markRead(user, id) {
  const n = await Notification.findOneAndUpdate({ _id: id, recipient: user._id }, { read: true }, { new: true });
  if (!n) throw ApiError.notFound('Notification not found');
  return n;
}

async function markAllRead(user) {
  const r = await Notification.updateMany({ recipient: user._id, read: false }, { read: true });
  return { updated: r.modifiedCount };
}

module.exports = { list, markRead, markAllRead };
