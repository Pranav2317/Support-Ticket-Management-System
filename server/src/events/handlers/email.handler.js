const nodemailer = require('nodemailer');
const env = require('../../config/env');
const User = require('../../models/User');
const { describe } = require('../messages');
const { ROLES } = require('../../config/constants');

let transporter = null;
function getTransporter() {
  if (!env.smtp.host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  return transporter;
}

/**
 * Emails the ticket owner when support acts on their ticket.
 * Without SMTP settings the email is only logged to the console (dev mode).
 * Sending is not awaited, so a slow mail server never slows the API down.
 */
module.exports = async function emailHandler(event) {
  if (env.isTest) return;
  if (event.actor.role !== ROLES.ADMIN) return; // only tell customers about staff actions

  const owner = await User.findById(event.ticket.createdBy).select('name email').lean();
  if (!owner) return;

  const subject = `[${event.ticket.ticketNumber}] ${event.ticket.title}`;
  const quoted = event.comment ? `\n\n"${event.comment.body}"` : '';
  const text =
    `Hi ${owner.name},\n\n${describe(event)}.${quoted}\n\n` +
    `Current status: ${event.ticket.status.replace('_', ' ')}\n\n- Helpdesk`;

  const t = getTransporter();
  if (!t) {
    console.log(`[email:dev] to=${owner.email} subject="${subject}"`);
    return;
  }
  t.sendMail({ from: env.smtp.from, to: owner.email, subject, text }).catch((err) =>
    console.error('[email] send failed:', err.message)
  );
};
