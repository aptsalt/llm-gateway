export interface PlanConfig {
  id: string;
  name: string;
  priceMonthly: number;
  monthlyTokens: number;
  rpm: number;
  tpm: number;
  maxProviders: number;
  semanticCache: boolean;
  budgetAlerts: boolean;
  customRouting: boolean;
  platformFallback: boolean;
  stripePriceId?: string;
}

export const PLANS: Record<string, PlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    monthlyTokens: 100_000,
    rpm: 30,
    tpm: 50_000,
    maxProviders: 2,
    semanticCache: false,
    budgetAlerts: false,
    customRouting: false,
    platformFallback: false,
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceMonthly: 29,
    monthlyTokens: 1_000_000,
    rpm: 120,
    tpm: 200_000,
    maxProviders: 10,
    semanticCache: false,
    budgetAlerts: false,
    customRouting: false,
    platformFallback: false,
  },
  growth: {
    id: "growth",
    name: "Growth",
    priceMonthly: 99,
    monthlyTokens: 10_000_000,
    rpm: 600,
    tpm: 1_000_000,
    maxProviders: 10,
    semanticCache: true,
    budgetAlerts: true,
    customRouting: false,
    platformFallback: true,
  },
  scale: {
    id: "scale",
    name: "Scale",
    priceMonthly: 299,
    monthlyTokens: 100_000_000,
    rpm: 2_400,
    tpm: 5_000_000,
    maxProviders: 10,
    semanticCache: true,
    budgetAlerts: true,
    customRouting: true,
    platformFallback: true,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    priceMonthly: 999,
    monthlyTokens: Number.MAX_SAFE_INTEGER,
    rpm: 10_000,
    tpm: 50_000_000,
    maxProviders: 10,
    semanticCache: true,
    budgetAlerts: true,
    customRouting: true,
    platformFallback: true,
  },
};

export function getPlan(planId: string): PlanConfig {
  return PLANS[planId] ?? PLANS.free;
}

export function canUseSemantcCache(plan: string): boolean {
  return getPlan(plan).semanticCache;
}

export function canUsePlatformFallback(plan: string): boolean {
  return getPlan(plan).platformFallback;
}
