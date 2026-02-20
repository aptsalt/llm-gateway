import { describe, it, expect, beforeEach } from "vitest";
import { CircuitBreaker, CircuitBreakerManager } from "../src/reliability/circuit-breaker.js";

describe("CircuitBreaker", () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker("test-provider", {
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      halfOpenMaxAttempts: 2,
    });
  });

  it("starts in closed state", () => {
    expect(breaker.getState()).toBe("closed");
    expect(breaker.canExecute()).toBe(true);
  });

  it("stays closed on success", () => {
    breaker.recordSuccess();
    expect(breaker.getState()).toBe("closed");
    expect(breaker.canExecute()).toBe(true);
  });

  it("stays closed below failure threshold", () => {
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getState()).toBe("closed");
    expect(breaker.canExecute()).toBe(true);
  });

  it("opens after reaching failure threshold", () => {
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getState()).toBe("open");
    expect(breaker.canExecute()).toBe(false);
  });

  it("transitions to half-open after reset timeout", async () => {
    // Trip the breaker
    for (let i = 0; i < 3; i++) breaker.recordFailure();
    expect(breaker.getState()).toBe("open");

    // Wait for reset timeout
    await new Promise((resolve) => setTimeout(resolve, 1100));

    expect(breaker.getState()).toBe("half-open");
    expect(breaker.canExecute()).toBe(true);
  });

  it("closes from half-open on enough successes", async () => {
    for (let i = 0; i < 3; i++) breaker.recordFailure();
    await new Promise((resolve) => setTimeout(resolve, 1100));

    expect(breaker.getState()).toBe("half-open");

    // Record successes equal to halfOpenMaxAttempts
    breaker.recordSuccess();
    breaker.recordSuccess();

    expect(breaker.getState()).toBe("closed");
    expect(breaker.canExecute()).toBe(true);
  });

  it("re-opens from half-open on failure", async () => {
    for (let i = 0; i < 3; i++) breaker.recordFailure();
    await new Promise((resolve) => setTimeout(resolve, 1100));

    expect(breaker.getState()).toBe("half-open");
    breaker.recordFailure();

    expect(breaker.getState()).toBe("open");
    expect(breaker.canExecute()).toBe(false);
  });

  it("resets failure count on success in closed state", () => {
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordSuccess();

    // Should have reset, so 3 more failures needed to trip
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getState()).toBe("closed");
  });

  it("can be manually reset", () => {
    for (let i = 0; i < 3; i++) breaker.recordFailure();
    expect(breaker.getState()).toBe("open");

    breaker.reset();
    expect(breaker.getState()).toBe("closed");
    expect(breaker.canExecute()).toBe(true);
  });

  it("returns correct stats", () => {
    breaker.recordFailure();
    breaker.recordFailure();
    const stats = breaker.getStats();
    expect(stats.state).toBe("closed");
    expect(stats.failureCount).toBe(2);
    expect(stats.lastFailureTime).toBeGreaterThan(0);
  });
});

describe("CircuitBreakerManager", () => {
  let manager: CircuitBreakerManager;

  beforeEach(() => {
    manager = new CircuitBreakerManager();
  });

  it("creates breakers on demand", () => {
    expect(manager.canExecute("provider-a")).toBe(true);
    manager.recordFailure("provider-a");
    expect(manager.canExecute("provider-a")).toBe(true);
  });

  it("tracks breakers per provider independently", () => {
    // Trip provider-a
    for (let i = 0; i < 5; i++) manager.recordFailure("provider-a");
    expect(manager.canExecute("provider-a")).toBe(false);

    // Provider-b should still be open
    expect(manager.canExecute("provider-b")).toBe(true);
  });

  it("returns all stats", () => {
    manager.recordFailure("provider-a");
    manager.recordSuccess("provider-b");

    const stats = manager.getAllStats();
    expect(stats.size).toBe(2);
    expect(stats.has("provider-a")).toBe(true);
    expect(stats.has("provider-b")).toBe(true);
  });
});
