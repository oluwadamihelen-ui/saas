import { describe, expect, it } from "vitest";
import { PERMISSIONS, PERMISSION_CATALOG, ROLE_DEFAULT_PERMISSIONS } from "@/lib/auth/permissions";

describe("RBAC permission catalog", () => {
  it("grants SUPER_ADMIN every permission in the catalog", () => {
    const allKeys = PERMISSION_CATALOG.map((p) => p.key).sort();
    expect([...ROLE_DEFAULT_PERMISSIONS.SUPER_ADMIN].sort()).toEqual(allKeys);
  });

  it("does not grant CUSTOMER any administrative permission", () => {
    expect(ROLE_DEFAULT_PERMISSIONS.CUSTOMER).toEqual([]);
  });

  it("scopes STAFF to operational permissions and excludes platform administration", () => {
    const staffPermissions = ROLE_DEFAULT_PERMISSIONS.STAFF;
    expect(staffPermissions).toContain(PERMISSIONS.ORDERS_MANAGE);
    expect(staffPermissions).toContain(PERMISSIONS.DEPLOYMENTS_MANAGE);
    expect(staffPermissions).not.toContain(PERMISSIONS.STAFF_MANAGE);
    expect(staffPermissions).not.toContain(PERMISSIONS.PROVIDERS_MANAGE);
  });

  it("has no duplicate permission keys", () => {
    const keys = PERMISSION_CATALOG.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
