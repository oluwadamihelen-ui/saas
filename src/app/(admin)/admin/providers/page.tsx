import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { testProviderConnection, saveProviderCredential } from "./actions";

export const metadata: Metadata = { title: "Providers" };

const MODE_VARIANT: Record<string, "neutral" | "accent" | "success" | "danger"> = {
  MOCK: "neutral",
  CONFIGURED: "accent",
  CONNECTED: "success",
  ERROR: "danger",
};

export default async function AdminProvidersPage() {
  await requirePermission(PERMISSIONS.PROVIDERS_MANAGE);
  const providers = await prisma.provider.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Providers</h1>
        <p className="mt-1 text-sm text-muted">
          Third-party integrations behind a common interface. Mock providers let the platform run without live credentials.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {providers.map((provider) => {
          const testConnection = testProviderConnection.bind(null, provider.id);
          const saveCredential = saveProviderCredential.bind(null, provider.id);
          return (
            <Card key={provider.id}>
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{provider.name}</p>
                    <p className="text-xs uppercase tracking-wide text-muted">{provider.type}</p>
                  </div>
                  <Badge variant={MODE_VARIANT[provider.mode] ?? "neutral"}>{provider.mode}</Badge>
                </div>

                {provider.lastTestResult && (
                  <p className="text-xs text-muted">
                    Last tested {provider.lastTestedAt ? formatDate(provider.lastTestedAt) : ""}: {provider.lastTestResult}
                  </p>
                )}

                <form action={testConnection}>
                  <Button type="submit" size="sm" variant="secondary">
                    Test Connection
                  </Button>
                </form>

                {provider.adapterKey !== "mock" && (
                  <form action={saveCredential} className="flex items-center gap-2 border-t border-border pt-3">
                    <Input name="key" placeholder="Credential key (e.g. secretKey)" className="h-8 text-xs" />
                    <Input name="value" type="password" placeholder="Value" className="h-8 text-xs" />
                    <Button type="submit" size="sm" variant="outline">
                      Save
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
