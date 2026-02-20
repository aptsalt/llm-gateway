import { describe, it, expect, beforeEach } from "vitest";
import { BudgetEnforcer } from "../src/budget/budget.js";
import type { ApiKeyRecord } from "../src/budget/api-keys.js";

function makeApiKey(overrides: Partial<ApiKeyRecord> = {}): ApiKeyRecord {
  return {
    id: 1,
    key: "gw-dev-test123",
    name: "Test Key",
    enabled: true,
    monthlyTokenBudget: 100000,
    monthlyCostBudgetUsd: 10.0,
    rateLimitRpm: 60,
    rateLimitTpm: 100000,
    tokensUsedThisMonth: 0,
    costUsedThisMonthUsd: 0,
    ...overrides,
  };
}

describe("BudgetEnforcer", () => {
  let enforcer: BudgetEnforcer;

  beforeEach(() => {
    enforcer = new BudgetEnforcer({ monthlyUsd: 100, monthlyTokens: 1000000 });
  });

  it("allows requests within budget", () => {
    const key = makeApiKey({ tokensUsedThisMonth: 50000, costUsedThisMonthUsd: 5.0 });
    const result = enforcer.checkBudget(key);
    expect(result.allowed).toBe(true);
    expect(result.tokenUsagePercent).toBe(50);
    expect(result.costUsagePercent).toBe(50);
  });

  it("rejects when token budget is exceeded", () => {
    const key = makeApiKey({ tokensUsedThisMonth: 100000 });
    const result = enforcer.checkBudget(key);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("token budget exceeded");
  });

  it("rejects when cost budget is exceeded", () => {
    const key = makeApiKey({ costUsedThisMonthUsd: 10.0 });
    const result = enforcer.checkBudget(key);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("cost budget exceeded");
  });

  it("triggers 80% alert threshold", () => {
    const key = makeApiKey({ tokensUsedThisMonth: 85000 });
    const result = enforcer.checkBudget(key);
    expect(result.allowed).toBe(true);
    expect(result.alertThreshold).toBe(80);
  });

  it("triggers 95% alert threshold", () => {
    const key = makeApiKey({ tokensUsedThisMonth: 96000 });
    const result = enforcer.checkBudget(key);
    expect(result.allowed).toBe(true);
    expect(result.alertThreshold).toBe(95);
  });

  it("allows requests with no budget set", () => {
    const key = makeApiKey({
      monthlyTokenBudget: null,
      monthlyCostBudgetUsd: null,
    });
    const result = enforcer.checkBudget(key);
    expect(result.allowed).toBe(true);
    expect(result.tokenUsagePercent).toBe(0);
    expect(result.costUsagePercent).toBe(0);
  });

  it("rejects when global token budget is exceeded", () => {
    enforcer = new BudgetEnforcer({ monthlyTokens: 100 });
    enforcer.recordGlobalUsage(150, 0);

    const key = makeApiKey();
    const result = enforcer.checkBudget(key);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Global monthly token budget exceeded");
  });

  it("rejects when global cost budget is exceeded", () => {
    enforcer = new BudgetEnforcer({ monthlyUsd: 10 });
    enforcer.recordGlobalUsage(0, 15);

    const key = makeApiKey();
    const result = enforcer.checkBudget(key);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Global monthly cost budget exceeded");
  });

  it("tracks global usage correctly", () => {
    enforcer.recordGlobalUsage(1000, 0.5);
    enforcer.recordGlobalUsage(2000, 1.0);

    const usage = enforcer.getGlobalUsage();
    expect(usage.tokensUsed).toBe(3000);
    expect(usage.costUsed).toBe(1.5);
  });
});
