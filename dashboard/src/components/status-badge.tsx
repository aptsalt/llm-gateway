"use client";

import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "healthy" | "degraded" | "unhealthy";
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        status === "healthy" && "bg-green-100 text-green-800",
        status === "degraded" && "bg-yellow-100 text-yellow-800",
        status === "unhealthy" && "bg-red-100 text-red-800"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "healthy" && "bg-green-500",
          status === "degraded" && "bg-yellow-500",
          status === "unhealthy" && "bg-red-500"
        )}
      />
      {label ?? status}
    </span>
  );
}
