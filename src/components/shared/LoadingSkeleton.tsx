"use client";

import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  lines?: number;
}

export function LoadingSkeleton({ className, lines = 1 }: Props) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse bg-border rounded-lg h-4 w-full"
          style={{ opacity: 1 - i * 0.15 }}
        />
      ))}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-2xl bg-pale p-5 space-y-3",
        className
      )}
    >
      <div className="h-4 bg-border rounded w-1/2" />
      <div className="h-3 bg-border rounded w-3/4" />
      <div className="h-8 bg-border rounded-xl w-full mt-2" />
    </div>
  );
}
