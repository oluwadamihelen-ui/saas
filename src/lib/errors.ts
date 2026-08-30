/**
 * Split out from lib/tenant.ts so modules that only need to throw/catch a
 * TenantError (lib/orders.ts, lib/subscription.ts, AI tools) don't have to
 * pull in next-auth just to get an error class.
 */
export class TenantError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}
