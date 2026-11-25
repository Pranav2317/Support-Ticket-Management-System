const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const createApp = require('../src/app');
const User = require('../src/models/User');

let mongod;
const app = createApp();
const api = () => request(app);

function useTestDatabase() {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  afterEach(async () => {
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
}

let n = 0;
/** Creates a user directly in the DB and returns { user, token } via the real login endpoint. */
async function createUser({ role = 'user', name } = {}) {
  n += 1;
  const email = `${role}${n}@test.dev`;
  const password = 'Passw0rd!';
  const user = await User.create({ name: name || `${role} ${n}`, email, password, role });
  const res = await api().post('/api/auth/login').send({ email, password });
  return { user, token: res.body.data.token, auth: { Authorization: `Bearer ${res.body.data.token}` } };
}

async function createTicket(owner, overrides = {}) {
  const res = await api()
    .post('/api/tickets')
    .set(owner.auth)
    .send({ title: 'Printer not working', description: 'The office printer shows error E-42.', ...overrides });
  return res.body.data;
}

module.exports = { api, useTestDatabase, createUser, createTicket };
