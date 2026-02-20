import { describe, it, expect, beforeEach } from "vitest";
import { RequestTracker } from "../src/observability/request-tracker.js";

describe("RequestTracker", () => {
  let tracker: RequestTracker;

  beforeEach(() => {
    tracker = new RequestTracker();
  });

  it("tracks active requests", () => {
    tracker.track("req-1");
    tracker.track("req-2");
    expect(tracker.getActiveCount()).toBe(2);
  });

  it("completes requests and removes from active", () => {
    tracker.track("req-1");
    tracker.complete("req-1");
    expect(tracker.getActiveCount()).toBe(0);
  });

  it("returns stats with zero requests", () => {
    const stats = tracker.getStats();
    expect(stats.totalRequests).toBe(0);
    expect(stats.activeRequests).toBe(0);
    expect(stats.avgResponseTimeMs).toBe(0);
    expect(stats.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it("tracks completed request count", () => {
    tracker.track("req-1");
    tracker.track("req-2");
    tracker.complete("req-1");
    tracker.complete("req-2");
    const stats = tracker.getStats();
    expect(stats.totalRequests).toBe(2);
    expect(stats.activeRequests).toBe(0);
  });

  it("calculates average response time", async () => {
    tracker.track("req-1");
    await new Promise((resolve) => setTimeout(resolve, 50));
    tracker.complete("req-1");
    const stats = tracker.getStats();
    expect(stats.avgResponseTimeMs).toBeGreaterThanOrEqual(30);
  });

  it("ignores completing unknown request ids", () => {
    tracker.complete("unknown");
    expect(tracker.getActiveCount()).toBe(0);
  });
});
