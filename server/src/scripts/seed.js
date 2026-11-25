/**
 * Seeds demo users and tickets. Idempotent: does nothing if the demo admin already exists.
 * Run with `npm run seed` (uses MONGODB_URI). Runs automatically with the in-memory database.
 *
 * Demo credentials can be overridden with SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 */
const User = require('../models/User');
const ticketService = require('../services/ticket.service');
const commentService = require('../services/comment.service');
const { registerEventHandlers } = require('../events');

const ADMIN = {
  name: 'Asha Admin',
  email: process.env.SEED_ADMIN_EMAIL || 'admin@helpdesk.dev',
  password: process.env.SEED_ADMIN_PASSWORD || 'Admin@1234',
  role: 'admin',
};
const AGENT = { name: 'Rohan Support', email: 'agent@helpdesk.dev', password: 'Agent@1234', role: 'admin' };
const USERS = [
  { name: 'Priya Sharma', email: 'user@helpdesk.dev', password: 'User@1234' },
  { name: 'Karan Mehta', email: 'karan@helpdesk.dev', password: 'User@1234' },
];

async function seed({ quiet = true } = {}) {
  registerEventHandlers();
  if (await User.exists({ email: ADMIN.email })) {
    if (!quiet) console.log('[seed] demo data already present, skipping');
    return;
  }

  const admin = await User.create(ADMIN);
  const agent = await User.create(AGENT);
  const [priya, karan] = await User.create(USERS);

  const t1 = await ticketService.create(priya, {
    title: 'Cannot reset my password',
    description: 'The password reset email never arrives. I have checked spam as well.',
    category: 'account',
    priority: 'high',
  });
  const t2 = await ticketService.create(priya, {
    title: 'Charged twice for November invoice',
    description: 'My card statement shows two charges of the same amount for the November invoice.',
    category: 'billing',
    priority: 'urgent',
  });
  await ticketService.create(priya, {
    title: 'Add dark mode to the dashboard',
    description: 'It would be great to have a dark theme for late-night work sessions.',
    category: 'feature_request',
    priority: 'low',
  });
  const t4 = await ticketService.create(karan, {
    title: 'Export to CSV fails with large reports',
    description: 'Exporting a report with more than 10k rows shows a spinner forever and never downloads.',
    category: 'technical',
    priority: 'medium',
  });

  await ticketService.assign(admin, t1._id, agent._id);
  await ticketService.updateStatus(agent, t1._id, 'in_progress');
  await commentService.add(agent, t1._id, 'Thanks Priya, we are checking our mail provider logs now.');
  await commentService.add(priya, t1._id, 'Thank you! Let me know if you need anything from me.');

  await ticketService.updateStatus(admin, t2._id, 'in_progress');
  await commentService.add(admin, t2._id, 'Confirmed the duplicate charge. A refund has been issued.');
  await ticketService.updateStatus(admin, t2._id, 'resolved');

  await ticketService.assign(admin, t4._id, admin._id);

  if (!quiet) {
    console.log('[seed] demo data created:');
    console.log(`  admin  ${ADMIN.email} / ${ADMIN.password}`);
    console.log(`  agent  ${AGENT.email} / ${AGENT.password}`);
    console.log(`  user   ${USERS[0].email} / ${USERS[0].password}`);
  }
}

module.exports = { seed };

if (require.main === module) {
  const { connectDB, disconnectDB } = require('../config/db');
  connectDB()
    .then(() => seed({ quiet: false }))
    .then(disconnectDB)
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
