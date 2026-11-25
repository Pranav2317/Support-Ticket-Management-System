const { api, useTestDatabase, createUser, createTicket } = require('./helpers');
const ActivityLog = require('../src/models/ActivityLog');
const Notification = require('../src/models/Notification');
const eventBus = require('../src/events/eventBus');

useTestDatabase();

describe('Comments', () => {
  it('lets owners and admins comment, in order, with authors attached', async () => {
    const alice = await createUser({ name: 'Alice' });
    const admin = await createUser({ role: 'admin', name: 'Agent Smith' });
    const t = await createTicket(alice);

    await api().post(`/api/tickets/${t._id}/comments`).set(alice.auth).send({ body: 'Any update?' }).expect(201);
    await api().post(`/api/tickets/${t._id}/comments`).set(admin.auth).send({ body: 'Looking into it.' }).expect(201);

    const res = await api().get(`/api/tickets/${t._id}/comments`).set(alice.auth);
    expect(res.body.data.map((c) => [c.author.name, c.body])).toEqual([
      ['Alice', 'Any update?'],
      ['Agent Smith', 'Looking into it.'],
    ]);
    const ticket = await api().get(`/api/tickets/${t._id}`).set(alice.auth);
    expect(ticket.body.data.commentCount).toBe(2);
  });

  it('stops users commenting on closed tickets, but not admins', async () => {
    const alice = await createUser();
    const admin = await createUser({ role: 'admin' });
    const t = await createTicket(alice);
    await api().patch(`/api/tickets/${t._id}/status`).set(admin.auth).send({ status: 'closed' });

    expect((await api().post(`/api/tickets/${t._id}/comments`).set(alice.auth).send({ body: 'hi' })).status).toBe(409);
    expect((await api().post(`/api/tickets/${t._id}/comments`).set(admin.auth).send({ body: 'note' })).status).toBe(201);
  });

  it('rejects empty comments', async () => {
    const alice = await createUser();
    const t = await createTicket(alice);
    expect((await api().post(`/api/tickets/${t._id}/comments`).set(alice.auth).send({ body: '   ' })).status).toBe(400);
  });
});

describe('Event-driven activity log and notifications', () => {
  it('records every lifecycle event in the activity log', async () => {
    const alice = await createUser({ name: 'Alice' });
    const admin = await createUser({ role: 'admin', name: 'Admin' });
    const t = await createTicket(alice);

    await api().patch(`/api/tickets/${t._id}`).set(alice.auth).send({ priority: 'high' });
    await api().post(`/api/tickets/${t._id}/comments`).set(alice.auth).send({ body: 'Please hurry' });
    await api().patch(`/api/tickets/${t._id}/status`).set(admin.auth).send({ status: 'resolved' });

    const res = await api().get(`/api/tickets/${t._id}/activity`).set(alice.auth);
    expect(res.body.data.map((a) => a.event)).toEqual([
      'ticket.created',
      'ticket.updated',
      'comment.added',
      'ticket.status_changed',
      'ticket.resolved',
    ]);
    expect(res.body.data[3].message).toBe('Admin changed status of TCK-1001 from open to resolved');
  });

  it('notifies the right people and never the actor', async () => {
    const alice = await createUser();
    const admin1 = await createUser({ role: 'admin' });
    const admin2 = await createUser({ role: 'admin' });
    const t = await createTicket(alice);

    // New ticket -> every admin.
    expect(await Notification.countDocuments({ event: 'ticket.created' })).toBe(2);

    // Assigned -> only the assignee is notified about further customer activity.
    await api().patch(`/api/tickets/${t._id}/assign`).set(admin1.auth).send({ assignedTo: String(admin2.user._id) });
    await api().post(`/api/tickets/${t._id}/comments`).set(alice.auth).send({ body: 'hello?' });
    const commentNotes = await Notification.find({ event: 'comment.added' });
    expect(commentNotes.map((n) => String(n.recipient))).toEqual([String(admin2.user._id)]);

    // Resolved -> the owner gets exactly one notification (no duplicate status_changed one).
    await api().patch(`/api/tickets/${t._id}/status`).set(admin2.auth).send({ status: 'resolved' });
    const aliceNotes = await api().get('/api/notifications').set(alice.auth);
    expect(aliceNotes.body.data.map((n) => n.event)).toEqual(['ticket.resolved']);
    expect(aliceNotes.body.unreadCount).toBe(1);

    await api().patch('/api/notifications/read-all').set(alice.auth).expect(200);
    const after = await api().get('/api/notifications').set(alice.auth);
    expect(after.body.unreadCount).toBe(0);
  });

  it('keeps the audit trail after a ticket is deleted', async () => {
    const alice = await createUser();
    const t = await createTicket(alice);
    await api().delete(`/api/tickets/${t._id}`).set(alice.auth).expect(204);
    const logs = await ActivityLog.find({ ticketNumber: t.ticketNumber }).sort('createdAt');
    expect(logs.map((l) => l.event)).toEqual(['ticket.created', 'ticket.deleted']);
  });

  it('isolates handler failures from the request', async () => {
    eventBus.subscribe('ticket.created', 'broken', async () => {
      throw new Error('boom');
    });
    const alice = await createUser();
    const res = await api()
      .post('/api/tickets')
      .set(alice.auth)
      .send({ title: 'Still works fine', description: 'A failing handler must not fail the request.' });
    expect(res.status).toBe(201);
    expect(await ActivityLog.countDocuments({ event: 'ticket.created' })).toBe(1);
  });
});
