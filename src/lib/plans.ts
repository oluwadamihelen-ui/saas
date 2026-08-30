/**
 * Canonical plan definitions. This is the single source of truth used both
 * to seed the `Plan` table (prisma/seed.ts) and to render pricing on the
 * landing page — so pricing/limits are never hard-coded in more than one
 * place. Runtime limit checks always read from the `Plan` row in the
 * database (see lib/subscription.ts), not from this file directly.
 */
export type PlanKey = "FREE" | "GROWTH" | "PRO";

export const PLAN_DEFS: Array<{
  key: PlanKey;
  name: string;
  priceMonthly: number;
  productLimit: number | null;
  aiMessageLimitPerMonth: number | null;
  whatsAppAutomation: boolean;
  features: string[];
}> = [
  {
    key: "FREE",
    name: "Free",
    priceMonthly: 0,
    productLimit: 20,
    aiMessageLimitPerMonth: 20,
    whatsAppAutomation: false,
    features: [
      "Up to 20 products",
      "Basic orders",
      "Basic customers",
      "Basic storefront",
      "Limited Mama AI (20 messages/mo)",
      "Limited WhatsApp automation",
    ],
  },
  {
    key: "GROWTH",
    name: "Growth",
    priceMonthly: 9900,
    productLimit: null,
    aiMessageLimitPerMonth: 300,
    whatsAppAutomation: true,
    features: [
      "Unlimited products",
      "Inventory management",
      "Full CRM",
      "Analytics",
      "WhatsApp automation",
      "Marketing campaigns",
      "Increased Mama AI usage",
      "Team members",
    ],
  },
  {
    key: "PRO",
    name: "Pro",
    priceMonthly: 24900,
    productLimit: null,
    aiMessageLimitPerMonth: null,
    whatsAppAutomation: true,
    features: [
      "Everything in Growth",
      "Advanced Mama AI",
      "Advanced analytics",
      "Advanced automation",
      "Multiple staff accounts",
      "Priority support",
      "Advanced proactive insights",
    ],
  },
];
