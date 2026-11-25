const mongoose = require('mongoose');
const { TICKET_STATUS, TICKET_PRIORITY, TICKET_CATEGORY } = require('../config/constants');

const PRIORITY_RANK = { low: 1, medium: 2, high: 3, urgent: 4 };

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true, minlength: 5, maxlength: 120 },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 5000 },
    category: { type: String, enum: Object.values(TICKET_CATEGORY), default: TICKET_CATEGORY.GENERAL },
    priority: { type: String, enum: Object.values(TICKET_PRIORITY), default: TICKET_PRIORITY.MEDIUM },
    // Numeric mirror of priority so sorting orders low < medium < high < urgent, not alphabetically.
    priorityRank: { type: Number, default: 2, select: false },
    status: { type: String, enum: Object.values(TICKET_STATUS), default: TICKET_STATUS.OPEN },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    commentCount: { type: Number, default: 0 },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Indexes match the main access patterns:
//  - a user's own tickets, newest first
//  - admin filtering by status / priority, newest first
//  - an agent's assigned queue
ticketSchema.index({ createdBy: 1, createdAt: -1 });
ticketSchema.index({ status: 1, priority: 1, createdAt: -1 });
ticketSchema.index({ assignedTo: 1, status: 1 });

ticketSchema.pre('validate', function setPriorityRank() {
  this.priorityRank = PRIORITY_RANK[this.priority] || 2;
});

ticketSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    delete ret.priorityRank;
    return ret;
  },
});

module.exports = mongoose.model('Ticket', ticketSchema);
