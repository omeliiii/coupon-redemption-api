import { buildApp } from './app.js';
import { config } from './config.js';

async function main() {
  const app = buildApp();

  try {
    await app.listen({
      host: config.server.host,
      port: config.server.port,
    });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
