const mongoose = require('mongoose');

// Append-only audit trail written by the event system (see src/events).
const activityLogSchema = new mongoose.Schema(
  {
    event: { type: String, required: true },
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', index: true },
    ticketNumber: String, // kept so the log stays readable after a ticket is deleted
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    message: { type: String, required: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activityLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
