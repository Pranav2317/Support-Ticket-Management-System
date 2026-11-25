const mongoose = require('mongoose');
const env = require('./env');

// Reject query-selector injection such as { "email": { "$gt": "" } } at the ODM level.
mongoose.set('sanitizeFilter', true);
mongoose.set('strictQuery', true);

let memoryServer = null;

/**
 * Connects to MongoDB. If MONGODB_URI is not set outside production, an in-memory
 * MongoDB is started so the project runs with zero setup (data is lost on restart).
 */
async function connectDB(uri = env.mongoUri) {
  let target = uri;
  if (!target) {
    if (env.isProd) throw new Error('MONGODB_URI must be set in production');
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    target = memoryServer.getUri('helpdesk');
    console.warn('[db] MONGODB_URI not set - using an in-memory MongoDB (data is not persisted)');
  }
  await mongoose.connect(target);
  return { inMemory: Boolean(memoryServer) };
}

async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

module.exports = { connectDB, disconnectDB };
