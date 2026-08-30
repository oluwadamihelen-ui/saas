import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string, currency = "NGN") {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  const symbol = currency === "NGN" ? "₦" : currency + " ";
  return `${symbol}${value.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatNumber(n: number) {
  return n.toLocaleString("en-NG");
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function generateOrderNumber() {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `MAMA-${Date.now().toString().slice(-6)}${rand}`;
}
