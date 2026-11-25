const ROLES = Object.freeze({ USER: 'user', ADMIN: 'admin' });

const TICKET_STATUS = Object.freeze({
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
});

const TICKET_PRIORITY = Object.freeze({ LOW: 'low', MEDIUM: 'medium', HIGH: 'high', URGENT: 'urgent' });

const TICKET_CATEGORY = Object.freeze({
  TECHNICAL: 'technical',
  BILLING: 'billing',
  ACCOUNT: 'account',
  FEATURE_REQUEST: 'feature_request',
  GENERAL: 'general',
});

// Allowed status transitions (admin workflow). Anything not listed is rejected.
const STATUS_TRANSITIONS = Object.freeze({
  open: ['in_progress', 'resolved', 'closed'],
  in_progress: ['open', 'resolved', 'closed'],
  resolved: ['in_progress', 'closed'], // reopen or close
  closed: ['open'], // reopen
});

module.exports = { ROLES, TICKET_STATUS, TICKET_PRIORITY, TICKET_CATEGORY, STATUS_TRANSITIONS };
