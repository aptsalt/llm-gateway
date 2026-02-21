import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { organizations } from "../db/schema.js";
import { getPlan } from "./plans.js";

const STRIPE_METER_EVENT = "llm_tokens_used";

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  meterEventName?: string;
}

export class StripeBilling {
  private config: StripeConfig;
  private db: NodePgDatabase;

  constructor(db: NodePgDatabase, config: StripeConfig) {
    this.db = db;
    this.config = config;
  }

  async recordUsage(orgId: number, tokens: number): Promise<void> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!org?.stripeCustomerId || org.plan === "free") return;

    const response = await fetch("https://api.stripe.com/v1/billing/meter_events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        event_name: this.config.meterEventName ?? STRIPE_METER_EVENT,
        "payload[stripe_customer_id]": org.stripeCustomerId,
        "payload[value]": String(tokens),
        identifier: `${orgId}_${Date.now()}`,
      }),
    });

    if (!response.ok) {
      console.error("Stripe meter event failed:", await response.text());
    }
  }

  async createCheckoutSession(orgId: number, plan: string, successUrl: string, cancelUrl: string): Promise<string> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!org) throw new Error("Organization not found");

    const planConfig = getPlan(plan);
    if (!planConfig.stripePriceId) throw new Error(`No Stripe price configured for plan: ${plan}`);

    const params = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": planConfig.stripePriceId,
      "line_items[0][quantity]": "1",
      success_url: successUrl,
      cancel_url: cancelUrl,
      "metadata[orgId]": String(orgId),
      "metadata[plan]": plan,
    });

    if (org.stripeCustomerId) {
      params.set("customer", org.stripeCustomerId);
    } else {
      params.set("customer_creation", "always");
    }

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    const session = await response.json() as { url: string };
    return session.url;
  }

  async createPortalSession(orgId: number, returnUrl: string): Promise<string> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!org?.stripeCustomerId) throw new Error("No Stripe customer for this organization");

    const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        customer: org.stripeCustomerId,
        return_url: returnUrl,
      }),
    });

    const session = await response.json() as { url: string };
    return session.url;
  }

  async handleWebhook(eventType: string, data: Record<string, unknown>): Promise<void> {
    switch (eventType) {
      case "checkout.session.completed": {
        const metadata = data.metadata as { orgId?: string; plan?: string };
        const orgId = metadata?.orgId ? parseInt(metadata.orgId, 10) : null;
        const plan = metadata?.plan;

        if (orgId && plan) {
          const planConfig = getPlan(plan);
          await this.db
            .update(organizations)
            .set({
              stripeCustomerId: data.customer as string,
              stripeSubscriptionId: data.subscription as string,
              plan,
              monthlyTokenBudget: planConfig.monthlyTokens,
              updatedAt: new Date(),
            })
            .where(eq(organizations.id, orgId));
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subId = data.id as string;
        await this.db
          .update(organizations)
          .set({
            plan: "free",
            monthlyTokenBudget: 100000,
            stripeSubscriptionId: null,
            updatedAt: new Date(),
          })
          .where(eq(organizations.stripeSubscriptionId, subId));
        break;
      }

      case "invoice.payment_failed": {
        const customerId = data.customer as string;
        console.warn(`Payment failed for customer: ${customerId}`);
        break;
      }
    }
  }

  async updateOrgUsage(orgId: number, tokens: number, costUsd: number): Promise<void> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!org) return;

    // Check if month has rolled over
    const now = new Date();
    const resetAt = org.budgetResetAt ? new Date(org.budgetResetAt) : new Date(0);

    if (now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear()) {
      await this.db
        .update(organizations)
        .set({
          tokensUsedThisMonth: tokens,
          costUsedThisMonthUsd: String(costUsd),
          budgetResetAt: now,
          updatedAt: now,
        })
        .where(eq(organizations.id, orgId));
    } else {
      await this.db
        .update(organizations)
        .set({
          tokensUsedThisMonth: (org.tokensUsedThisMonth ?? 0) + tokens,
          costUsedThisMonthUsd: String(Number(org.costUsedThisMonthUsd ?? 0) + costUsd),
          updatedAt: now,
        })
        .where(eq(organizations.id, orgId));
    }
  }
}
