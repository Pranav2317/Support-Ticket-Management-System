const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const createApp = require('./app');
const { seed } = require('./scripts/seed');

async function start() {
  const { inMemory } = await connectDB();
  // An in-memory database starts empty, so fill it with demo data automatically.
  if (inMemory) await seed({ quiet: false });

  const server = createApp().listen(env.port, () => {
    console.log(`[server] API listening on http://localhost:${env.port}/api (${env.nodeEnv})`);
  });

  const shutdown = async (signal) => {
    console.log(`[server] ${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
