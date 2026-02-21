"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"account" | "org">("account");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === "account") {
      setLoading(true);
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        toast.success("Account created! Now set up your organization.");
        setStep("org");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to sign up");
      } finally {
        setLoading(false);
      }
    } else {
      handleOrgCreate();
    }
  };

  const handleOrgCreate = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      const orgSlug = orgName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

      const { error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: orgName,
          slug: orgSlug,
          owner_id: user.id,
        });

      if (orgError) throw orgError;

      const apiKey = `rtr_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

      const { error: keyError } = await supabase
        .from("api_keys")
        .insert({
          name: "Production Key",
          key: apiKey,
          organization_slug: orgSlug,
          environment: "production",
        });

      if (keyError) throw keyError;

      toast.success("Organization created successfully!");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create organization");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-zinc-100">
          {step === "account" ? "Create your account" : "Set up your organization"}
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          {step === "account"
            ? "Get started with RouterAI LLM Gateway"
            : "Your workspace for managing API keys and usage"}
        </p>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <form onSubmit={handleSignup} className="space-y-4">
          {step === "account" ? (
            <>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-zinc-100">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-zinc-100">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                />
                <p className="text-xs text-zinc-500">At least 6 characters</p>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <label htmlFor="orgName" className="text-sm font-medium text-zinc-100">
                Organization Name
              </label>
              <Input
                id="orgName"
                type="text"
                placeholder="Acme Inc"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                disabled={loading}
              />
              <p className="text-xs text-zinc-500">
                Slug: {orgName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "acme-inc"}
              </p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Processing..." : step === "account" ? "Continue" : "Create Organization"}
          </Button>
        </form>
      </div>

      {step === "account" && (
        <div className="text-center text-sm text-zinc-400">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-500 hover:underline">
            Sign in
          </Link>
        </div>
      )}
    </div>
  );
}
