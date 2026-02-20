import type { ApiKeyRecord } from "./api-keys.js";

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  tokenUsagePercent: number;
  costUsagePercent: number;
  alertThreshold?: number;
}

export interface GlobalBudget {
  monthlyUsd?: number;
  monthlyTokens?: number;
}

export class BudgetEnforcer {
  private globalBudget: GlobalBudget;
  private globalTokensUsed = 0;
  private globalCostUsed = 0;

  constructor(globalBudget?: GlobalBudget) {
    this.globalBudget = globalBudget ?? {};
  }

  checkBudget(apiKey: ApiKeyRecord): BudgetCheckResult {
    // Check per-key token budget
    const tokenUsagePercent = apiKey.monthlyTokenBudget
      ? (apiKey.tokensUsedThisMonth / apiKey.monthlyTokenBudget) * 100
      : 0;

    if (apiKey.monthlyTokenBudget && apiKey.tokensUsedThisMonth >= apiKey.monthlyTokenBudget) {
      return {
        allowed: false,
        reason: `Monthly token budget exceeded (${apiKey.tokensUsedThisMonth}/${apiKey.monthlyTokenBudget})`,
        tokenUsagePercent: 100,
        costUsagePercent: this.getCostPercent(apiKey),
      };
    }

    // Check per-key cost budget
    const costUsagePercent = this.getCostPercent(apiKey);
    if (apiKey.monthlyCostBudgetUsd && apiKey.costUsedThisMonthUsd >= apiKey.monthlyCostBudgetUsd) {
      return {
        allowed: false,
        reason: `Monthly cost budget exceeded ($${apiKey.costUsedThisMonthUsd.toFixed(4)}/$${apiKey.monthlyCostBudgetUsd})`,
        tokenUsagePercent,
        costUsagePercent: 100,
      };
    }

    // Check global budget
    if (this.globalBudget.monthlyUsd && this.globalCostUsed >= this.globalBudget.monthlyUsd) {
      return {
        allowed: false,
        reason: `Global monthly cost budget exceeded`,
        tokenUsagePercent,
        costUsagePercent,
      };
    }

    if (this.globalBudget.monthlyTokens && this.globalTokensUsed >= this.globalBudget.monthlyTokens) {
      return {
        allowed: false,
        reason: `Global monthly token budget exceeded`,
        tokenUsagePercent,
        costUsagePercent,
      };
    }

    // Check alert thresholds
    let alertThreshold: number | undefined;
    if (tokenUsagePercent >= 95 || costUsagePercent >= 95) {
      alertThreshold = 95;
    } else if (tokenUsagePercent >= 80 || costUsagePercent >= 80) {
      alertThreshold = 80;
    }

    return {
      allowed: true,
      tokenUsagePercent,
      costUsagePercent,
      alertThreshold,
    };
  }

  recordGlobalUsage(tokens: number, costUsd: number): void {
    this.globalTokensUsed += tokens;
    this.globalCostUsed += costUsd;
  }

  getGlobalUsage(): { tokensUsed: number; costUsed: number; budget: GlobalBudget } {
    return {
      tokensUsed: this.globalTokensUsed,
      costUsed: this.globalCostUsed,
      budget: this.globalBudget,
    };
  }

  private getCostPercent(apiKey: ApiKeyRecord): number {
    return apiKey.monthlyCostBudgetUsd
      ? (apiKey.costUsedThisMonthUsd / apiKey.monthlyCostBudgetUsd) * 100
      : 0;
  }
}
