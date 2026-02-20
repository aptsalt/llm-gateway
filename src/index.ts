import { serve } from "@hono/node-server";
import { env } from "./env.js";
import { createApp } from "./server.js";

async function main() {
  const { app, cleanup } = await createApp();

  const server = serve({
    fetch: app.fetch,
    port: env.PORT,
  });

  console.log(`
  ┌─────────────────────────────────────────┐
  │          LLM Gateway v1.0.0             │
  │                                         │
  │  API:     http://localhost:${env.PORT}        │
  │  Health:  http://localhost:${env.PORT}/health  │
  │  Metrics: http://localhost:${env.PORT}/metrics │
  │  Models:  http://localhost:${env.PORT}/v1/models│
  │                                         │
  │  Mode: ${env.NODE_ENV.padEnd(33)}│
  └─────────────────────────────────────────┘
  `);

  const shutdown = () => {
    console.log("\nShutting down gracefully...");
    cleanup();
    server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("Failed to start gateway:", error);
  process.exit(1);
});
