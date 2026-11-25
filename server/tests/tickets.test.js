const { api, useTestDatabase, createUser, createTicket } = require('./helpers');

useTestDatabase();

describe('Tickets - user', () => {
  it('creates a ticket with defaults and a ticket number', async () => {
    const alice = await createUser();
    const t = await createTicket(alice);
    expect(t.ticketNumber).toBe('TCK-1001');
    expect(t).toMatchObject({ status: 'open', priority: 'medium', category: 'general' });
    expect(t.createdBy._id).toBe(String(alice.user._id));
  });

  it('only lists and shows the user\'s own tickets', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const aliceTicket = await createTicket(alice);
    await createTicket(bob);

    const list = await api().get('/api/tickets').set(alice.auth);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.pagination.total).toBe(1);

    // Bob cannot read, edit, delete or comment on Alice's ticket (404 hides existence).
    const id = aliceTicket._id;
    expect((await api().get(`/api/tickets/${id}`).set(bob.auth)).status).toBe(404);
    expect((await api().patch(`/api/tickets/${id}`).set(bob.auth).send({ title: 'Hacked title' })).status).toBe(404);
    expect((await api().delete(`/api/tickets/${id}`).set(bob.auth)).status).toBe(404);
    expect((await api().post(`/api/tickets/${id}/comments`).set(bob.auth).send({ body: 'hi' })).status).toBe(404);
  });

  it('lets the owner edit and delete only while the ticket is open', async () => {
    const alice = await createUser();
    const admin = await createUser({ role: 'admin' });
    const t = await createTicket(alice);

    const edit = await api().patch(`/api/tickets/${t._id}`).set(alice.auth).send({ priority: 'high' });
    expect(edit.status).toBe(200);
    expect(edit.body.data.priority).toBe('high');

    await api().patch(`/api/tickets/${t._id}/status`).set(admin.auth).send({ status: 'in_progress' });

    expect((await api().patch(`/api/tickets/${t._id}`).set(alice.auth).send({ priority: 'low' })).status).toBe(409);
    expect((await api().delete(`/api/tickets/${t._id}`).set(alice.auth)).status).toBe(409);
  });

  it('does not let users change status/assignment or unknown fields', async () => {
    const alice = await createUser();
    const t = await createTicket(alice);
    expect((await api().patch(`/api/tickets/${t._id}/status`).set(alice.auth).send({ status: 'resolved' })).status).toBe(403);
    expect((await api().patch(`/api/tickets/${t._id}`).set(alice.auth).send({ status: 'resolved' })).status).toBe(400);
  });

  it('deletes an open ticket', async () => {
    const alice = await createUser();
    const t = await createTicket(alice);
    expect((await api().delete(`/api/tickets/${t._id}`).set(alice.auth)).status).toBe(204);
    expect((await api().get(`/api/tickets/${t._id}`).set(alice.auth)).status).toBe(404);
  });

  it('rejects malformed ids and invalid payloads', async () => {
    const alice = await createUser();
    expect((await api().get('/api/tickets/not-an-id').set(alice.auth)).status).toBe(400);
    const res = await api().post('/api/tickets').set(alice.auth).send({ title: 'x', priority: 'critical' });
    expect(res.status).toBe(400);
  });
});

describe('Tickets - admin', () => {
  async function setup() {
    const admin = await createUser({ role: 'admin' });
    const alice = await createUser();
    const bob = await createUser();
    await createTicket(alice, { title: 'Login page is slow', priority: 'high' });
    await createTicket(alice, { title: 'Invoice is missing', priority: 'low', category: 'billing' });
    await createTicket(bob, { title: 'App crashes on start', priority: 'urgent', category: 'technical' });
    return { admin, alice, bob };
  }

  it('sees every ticket and can filter, search, sort and paginate', async () => {
    const { admin } = await setup();
    const all = await api().get('/api/tickets').set(admin.auth);
    expect(all.body.pagination.total).toBe(3);

    const high = await api().get('/api/tickets?priority=high').set(admin.auth);
    expect(high.body.data.map((t) => t.title)).toEqual(['Login page is slow']);

    const search = await api().get('/api/tickets?q=invoice').set(admin.auth);
    expect(search.body.data).toHaveLength(1);

    const sorted = await api().get('/api/tickets?sort=-priority').set(admin.auth);
    expect(sorted.body.data.map((t) => t.priority)).toEqual(['urgent', 'high', 'low']);

    const page2 = await api().get('/api/tickets?limit=2&page=2').set(admin.auth);
    expect(page2.body.data).toHaveLength(1);
    expect(page2.body.pagination).toMatchObject({ page: 2, totalPages: 2 });
  });

  it('enforces valid status transitions and records timestamps', async () => {
    const { admin, alice } = await setup();
    const t = await createTicket(alice);
    const url = `/api/tickets/${t._id}/status`;

    const resolved = await api().patch(url).set(admin.auth).send({ status: 'resolved' });
    expect(resolved.body.data.status).toBe('resolved');
    expect(resolved.body.data.resolvedAt).not.toBeNull();

    const closed = await api().patch(url).set(admin.auth).send({ status: 'closed' });
    expect(closed.body.data.closedAt).not.toBeNull();

    // closed -> resolved is not allowed; must reopen first.
    expect((await api().patch(url).set(admin.auth).send({ status: 'resolved' })).status).toBe(400);
    const reopened = await api().patch(url).set(admin.auth).send({ status: 'open' });
    expect(reopened.body.data).toMatchObject({ status: 'open', resolvedAt: null, closedAt: null });
  });

  it('assigns tickets only to admins', async () => {
    const { admin, alice } = await setup();
    const t = await createTicket(alice);
    const toUser = await api().patch(`/api/tickets/${t._id}/assign`).set(admin.auth).send({ assignedTo: String(alice.user._id) });
    expect(toUser.status).toBe(400);
    const ok = await api().patch(`/api/tickets/${t._id}/assign`).set(admin.auth).send({ assignedTo: String(admin.user._id) });
    expect(ok.body.data.assignedTo._id).toBe(String(admin.user._id));
  });

  it('returns dashboard stats scoped by role', async () => {
    const { admin, alice } = await setup();
    const adminStats = await api().get('/api/tickets/stats').set(admin.auth);
    expect(adminStats.body.data.total).toBe(3);
    expect(adminStats.body.data.byPriority).toMatchObject({ high: 1, low: 1, urgent: 1, medium: 0 });

    const userStats = await api().get('/api/tickets/stats').set(alice.auth);
    expect(userStats.body.data.total).toBe(2);
  });

  it('blocks non-admins from admin-only routes', async () => {
    const { alice } = await setup();
    expect((await api().get('/api/users/admins').set(alice.auth)).status).toBe(403);
  });
});
