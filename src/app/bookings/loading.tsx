import { CardSkeleton } from "@/components/shared/LoadingSkeleton";

export default function BookingsLoading() {
  return (
    <div className="green-container min-h-screen bg-cream pb-24">
      <div className="h-28 animate-pulse bg-forest" />
      <div className="px-4 mt-4 space-y-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
