// Canonical permission catalog. Seeded into the Permission table and wired
// to roles via RolePermission so access control is data-driven: an admin can
// regrant/revoke a STAFF permission without a code change.

export const PERMISSIONS = {
  APPLICATIONS_MANAGE: "applications.manage",
  APPLICATIONS_PUBLISH: "applications.publish",
  ORDERS_VIEW: "orders.view",
  ORDERS_MANAGE: "orders.manage",
  CUSTOMERS_VIEW: "customers.view",
  CUSTOMERS_MANAGE: "customers.manage",
  DEPLOYMENTS_VIEW: "deployments.view",
  DEPLOYMENTS_MANAGE: "deployments.manage",
  DOMAINS_MANAGE: "domains.manage",
  HOSTING_MANAGE: "hosting.manage",
  PROVIDERS_MANAGE: "providers.manage",
  INVOICES_MANAGE: "invoices.manage",
  SUBSCRIPTIONS_MANAGE: "subscriptions.manage",
  SUPPORT_MANAGE: "support.manage",
  COUPONS_MANAGE: "coupons.manage",
  QUOTES_MANAGE: "quotes.manage",
  STAFF_MANAGE: "staff.manage",
  SETTINGS_MANAGE: "settings.manage",
  AUDIT_LOG_VIEW: "audit_log.view",
  ANALYTICS_VIEW: "analytics.view",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_CATALOG: { key: PermissionKey; category: string; description: string }[] = [
  { key: PERMISSIONS.APPLICATIONS_MANAGE, category: "Applications", description: "Create and edit applications" },
  { key: PERMISSIONS.APPLICATIONS_PUBLISH, category: "Applications", description: "Publish/unpublish applications" },
  { key: PERMISSIONS.ORDERS_VIEW, category: "Orders", description: "View orders" },
  { key: PERMISSIONS.ORDERS_MANAGE, category: "Orders", description: "Manage order status and refunds" },
  { key: PERMISSIONS.CUSTOMERS_VIEW, category: "Customers", description: "View customer accounts" },
  { key: PERMISSIONS.CUSTOMERS_MANAGE, category: "Customers", description: "Edit customer accounts" },
  { key: PERMISSIONS.DEPLOYMENTS_VIEW, category: "Deployments", description: "View deployments and logs" },
  { key: PERMISSIONS.DEPLOYMENTS_MANAGE, category: "Deployments", description: "Manage and retry deployments" },
  { key: PERMISSIONS.DOMAINS_MANAGE, category: "Domains", description: "Manage domain orders and DNS" },
  { key: PERMISSIONS.HOSTING_MANAGE, category: "Hosting", description: "Manage hosting accounts and plans" },
  { key: PERMISSIONS.PROVIDERS_MANAGE, category: "Providers", description: "Configure third-party providers" },
  { key: PERMISSIONS.INVOICES_MANAGE, category: "Billing", description: "Manage invoices and payments" },
  { key: PERMISSIONS.SUBSCRIPTIONS_MANAGE, category: "Billing", description: "Manage subscriptions" },
  { key: PERMISSIONS.SUPPORT_MANAGE, category: "Support", description: "Manage support tickets" },
  { key: PERMISSIONS.COUPONS_MANAGE, category: "Marketing", description: "Manage coupons and bundles" },
  { key: PERMISSIONS.QUOTES_MANAGE, category: "Marketing", description: "Review customization requests and manage quotes" },
  { key: PERMISSIONS.STAFF_MANAGE, category: "Administration", description: "Manage staff accounts and permissions" },
  { key: PERMISSIONS.SETTINGS_MANAGE, category: "Administration", description: "Configure platform settings" },
  { key: PERMISSIONS.AUDIT_LOG_VIEW, category: "Administration", description: "View audit logs" },
  { key: PERMISSIONS.ANALYTICS_VIEW, category: "Administration", description: "View analytics" },
];

export const ROLE_DEFAULT_PERMISSIONS: Record<"SUPER_ADMIN" | "STAFF" | "CUSTOMER" | "DEVELOPER", PermissionKey[]> = {
  SUPER_ADMIN: PERMISSION_CATALOG.map((p) => p.key),
  STAFF: [
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_MANAGE,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.DEPLOYMENTS_VIEW,
    PERMISSIONS.DEPLOYMENTS_MANAGE,
    PERMISSIONS.DOMAINS_MANAGE,
    PERMISSIONS.HOSTING_MANAGE,
    PERMISSIONS.SUPPORT_MANAGE,
    PERMISSIONS.COUPONS_MANAGE,
    PERMISSIONS.QUOTES_MANAGE,
  ],
  CUSTOMER: [],
  DEVELOPER: [],
};
