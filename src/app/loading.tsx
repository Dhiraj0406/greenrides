import { CardSkeleton } from "@/components/shared/LoadingSkeleton";

export default function Loading() {
  return (
    <div className="green-container min-h-screen bg-cream">
      <div className="h-48 animate-pulse bg-forest" />
      <div className="px-4 mt-4 space-y-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
