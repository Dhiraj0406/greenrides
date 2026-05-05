import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupees(paise: number): string {
  return `₹${Math.round(paise / 100)}`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const num = digits.startsWith("91") ? digits.slice(2) : digits;
  return `+91 ${num.slice(0, 5)} ${num.slice(5)}`;
}

export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
