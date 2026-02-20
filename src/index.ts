import { serve } from "@hono/node-server";
import { env } from "./env.js";
import { createApp } from "./server.js";

const VERSION = "1.1.0";

async function main() {
  const startTime = Date.now();
  const { app, requestTracker, cleanup } = await createApp();

  const server = serve({
    fetch: app.fetch,
    port: env.PORT,
  });

  const bootMs = Date.now() - startTime;

  console.log("");
  console.log("  ╔═══════════════════════════════════════════════╗");
  console.log(`  ║           LLM Gateway v${VERSION}                 ║`);
  console.log("  ╠═══════════════════════════════════════════════╣");
  console.log(`  ║  API:        http://localhost:${env.PORT}/v1          ║`);
  console.log(`  ║  Health:     http://localhost:${env.PORT}/health      ║`);
  console.log(`  ║  Metrics:    http://localhost:${env.PORT}/metrics     ║`);
  console.log(`  ║  Analytics:  http://localhost:${env.PORT}/api/analytics║`);
  console.log("  ╠═══════════════════════════════════════════════╣");
  console.log(`  ║  Mode:     ${env.NODE_ENV.padEnd(36)}║`);
  console.log(`  ║  Strategy: ${env.DEFAULT_ROUTING_STRATEGY.padEnd(36)}║`);
  console.log(`  ║  Boot:     ${(bootMs + "ms").padEnd(36)}║`);
  console.log("  ╠═══════════════════════════════════════════════╣");
  console.log("  ║  Providers:                                   ║");

  const providerStatus = [
    { name: "Ollama (local)", configured: true },
    { name: "OpenAI", configured: !!env.OPENAI_API_KEY },
    { name: "Anthropic", configured: !!env.ANTHROPIC_API_KEY },
    { name: "Groq", configured: !!env.GROQ_API_KEY },
    { name: "Together AI", configured: !!env.TOGETHER_API_KEY },
  ];

  for (const p of providerStatus) {
    const icon = p.configured ? "+" : "-";
    const status = p.configured ? "active" : "no key";
    const line = `    ${icon} ${p.name}: ${status}`;
    console.log(`  ║  ${line.padEnd(44)}║`);
  }

  console.log("  ╚═══════════════════════════════════════════════╝");
  console.log("");

  // Graceful shutdown with in-flight request tracking
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;

    const active = requestTracker.getActiveCount();
    console.log(`\n  Shutting down gracefully... (${active} active requests)`);

    if (active > 0) {
      console.log("  Waiting for active requests to complete (max 10s)...");
      const deadline = Date.now() + 10000;
      while (requestTracker.getActiveCount() > 0 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const remaining = requestTracker.getActiveCount();
      if (remaining > 0) {
        console.log(`  Force closing with ${remaining} requests still active`);
      }
    }

    const stats = requestTracker.getStats();
    console.log(`  Session stats: ${stats.totalRequests} requests, $${stats.costBreakdown.totalUsd} cost`);
    console.log("  Goodbye!\n");

    cleanup();
    server.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((error) => {
  console.error("Failed to start gateway:", error);
  process.exit(1);
});
