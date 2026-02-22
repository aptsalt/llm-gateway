"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured) {
      router.push("/dashboard");
      return;
    }

    const checkAuth = async () => {
      const supabase = createClient();
      if (!supabase) {
        router.push("/dashboard");
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    };

    checkAuth();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-muted-foreground">Loading...</div>
    </div>
  );
}
