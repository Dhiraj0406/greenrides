import { cn } from "@/lib/utils";
import type { BookingStatus, RideStatus } from "@/types";

const STATUS_CONFIG: Record<
  BookingStatus | RideStatus,
  { label: string; className: string }
> = {
  PENDING:     { label: "Pending",     className: "bg-gold/20 text-gold border-gold/30" },
  CONFIRMED:   { label: "Confirmed",   className: "bg-leaf/20 text-leaf border-leaf/30" },
  CANCELLED:   { label: "Cancelled",   className: "bg-red-100 text-red-600 border-red-200" },
  COMPLETED:   { label: "Completed",   className: "bg-pale text-forest-b border-leaf/30" },
  REFUNDED:    { label: "Refunded",    className: "bg-warm text-sub border-border" },
  SCHEDULED:   { label: "Scheduled",   className: "bg-leaf/20 text-leaf border-leaf/30" },
  IN_PROGRESS: { label: "In Progress", className: "bg-gold/20 text-gold border-gold/30" },
};

interface Props {
  status: BookingStatus | RideStatus;
  className?: string;
}

export function StatusBadge({ status, className }: Props) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: "bg-border text-sub border-border",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
