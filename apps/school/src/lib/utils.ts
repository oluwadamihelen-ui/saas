import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(d);
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/// Month + day only, deliberately never the year (e.g. birthday widgets) —
/// birth year is personal information that shouldn't be surfaced outside a
/// profile page that's already gated on viewing full Date of Birth.
export function formatMonthDay(month: number, day: number): string {
  // Any non-leap year works here since we only format month/day; 2001 avoids
  // Feb 29 ever being an invalid date for this purpose.
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(new Date(2001, month - 1, day));
}

export function calculateAge(dateOfBirth: Date): number {
  const now = new Date();
  let age = now.getFullYear() - dateOfBirth.getFullYear();
  const hadBirthdayThisYear =
    now.getMonth() > dateOfBirth.getMonth() ||
    (now.getMonth() === dateOfBirth.getMonth() && now.getDate() >= dateOfBirth.getDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}
