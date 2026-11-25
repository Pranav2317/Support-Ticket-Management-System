const { api, useTestDatabase, createUser } = require('./helpers');

useTestDatabase();

describe('Auth', () => {
  const valid = { name: 'Jane Doe', email: 'jane@test.dev', password: 'secret123' };

  it('registers a user, never as admin, and hides the password', async () => {
    const res = await api().post('/api/auth/register').send({ ...valid, role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe('user');
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('rejects duplicate emails', async () => {
    await api().post('/api/auth/register').send(valid);
    const res = await api().post('/api/auth/register').send(valid);
    expect(res.status).toBe(409);
  });

  it('validates input', async () => {
    const res = await api().post('/api/auth/register').send({ name: 'J', email: 'nope', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.errors.map((e) => e.field)).toEqual(
      expect.arrayContaining(['body.name', 'body.email', 'body.password'])
    );
  });

  it('logs in with correct credentials and rejects wrong ones with a generic message', async () => {
    await api().post('/api/auth/register').send(valid);
    const ok = await api().post('/api/auth/login').send({ email: valid.email, password: valid.password });
    expect(ok.status).toBe(200);

    const bad = await api().post('/api/auth/login').send({ email: valid.email, password: 'wrong-pass1' });
    const unknown = await api().post('/api/auth/login').send({ email: 'ghost@test.dev', password: 'x' });
    expect(bad.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(bad.body.message).toBe(unknown.body.message);
  });

  it('blocks NoSQL operator injection in login', async () => {
    await api().post('/api/auth/register').send(valid);
    const res = await api().post('/api/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } });
    expect(res.status).toBe(400);
  });

  it('requires a valid token for protected routes', async () => {
    expect((await api().get('/api/auth/me')).status).toBe(401);
    expect((await api().get('/api/tickets').set('Authorization', 'Bearer garbage')).status).toBe(401);

    const { auth } = await createUser();
    const me = await api().get('/api/auth/me').set(auth);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toMatch(/@test\.dev$/);
  });
});
