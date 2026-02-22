"use client";

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, CreditCard, ExternalLink } from "lucide-react";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: [
      "100K tokens/month",
      "Basic caching",
      "Community support",
      "3 API keys",
    ],
    current: true,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    features: [
      "5M tokens/month",
      "Advanced caching",
      "Priority support",
      "Unlimited API keys",
      "Custom routing rules",
      "Usage analytics",
    ],
    current: false,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    features: [
      "Unlimited tokens",
      "Dedicated support",
      "SLA guarantee",
      "Custom integrations",
      "Advanced security",
      "Team collaboration",
    ],
    current: false,
  },
];

export default function BillingPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Billing</h1>
        <p className="mt-1 text-muted-foreground">Manage your subscription and usage</p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription className="text-muted-foreground">
                You are currently on the Free plan
              </CardDescription>
            </div>
            <Badge>Free</Badge>
          </div>
        </CardHeader>
        <div className="p-6 border-t border-border">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Token Usage This Month</span>
                <span className="text-sm font-medium">72K / 100K</span>
              </div>
              <div className="h-2 bg-accent rounded-full overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: "72%" }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">28K tokens remaining</p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div>
                <p className="text-sm font-medium">Need more tokens?</p>
                <p className="text-xs text-muted-foreground">Upgrade to Pro for 5M tokens/month</p>
              </div>
              <Button>Upgrade Plan</Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={`bg-card border-border ${
              plan.current ? "ring-2 ring-blue-500" : ""
            }`}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{plan.name}</CardTitle>
                {plan.current && <Badge>Current</Badge>}
              </div>
              <div className="mt-4">
                <span className="text-3xl font-bold">{plan.price}</span>
                {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
              </div>
            </CardHeader>
            <div className="p-6 border-t border-border">
              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                variant={plan.current ? "outline" : "default"}
                className="mt-6 w-full"
                disabled={plan.current}
              >
                {plan.current ? "Current Plan" : plan.name === "Enterprise" ? "Contact Sales" : "Upgrade"}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Payment Method</CardTitle>
          <CardDescription className="text-muted-foreground">
            Manage your payment information
          </CardDescription>
        </CardHeader>
        <div className="p-6 border-t border-border">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-accent p-2">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No payment method</p>
                <p className="text-xs text-muted-foreground">Add a card to upgrade your plan</p>
              </div>
            </div>
            <Button variant="outline" size="sm">
              Add Card
            </Button>
          </div>
        </div>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
          <CardDescription className="text-muted-foreground">
            View past invoices and payments
          </CardDescription>
        </CardHeader>
        <div className="p-6 border-t border-border">
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No billing history yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Your invoices will appear here once you upgrade
            </p>
          </div>
        </div>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Customer Portal</CardTitle>
          <CardDescription className="text-muted-foreground">
            Manage subscriptions via Stripe
          </CardDescription>
        </CardHeader>
        <div className="p-6 border-t border-border">
          <Button variant="outline" className="w-full">
            <ExternalLink className="mr-2 h-4 w-4" />
            Open Stripe Portal
          </Button>
          <p className="mt-2 text-xs text-muted-foreground text-center">
            Update payment methods, view invoices, and manage subscriptions
          </p>
        </div>
      </Card>
    </div>
  );
}
