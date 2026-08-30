import { getCurrentBusiness } from "@/lib/current-business";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { WhatsAppSettingsForm } from "@/components/dashboard/whatsapp/whatsapp-settings-form";

export default async function WhatsAppPage() {
  const current = await getCurrentBusiness();
  if (!current) return null;
  const { business } = current;

  const account = await prisma.whatsAppAccount.findUnique({ where: { businessId: business.id } });
  const conversations = await prisma.conversation.findMany({
    where: { businessId: business.id },
    include: {
      contact: true,
      customer: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { lastMessageAt: "desc" },
    take: 20,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">WhatsApp</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connected through Meta&apos;s official WhatsApp Business Platform (Cloud API).
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Connection</h2>
            <Badge variant={account?.isConnected ? "success" : "outline"}>
              {account?.isConnected ? `Connected · ${account.displayPhoneNumber ?? account.phoneNumberId}` : "Not connected"}
            </Badge>
          </div>
          <WhatsAppSettingsForm
            businessId={business.id}
            initial={{
              phoneNumberId: account?.phoneNumberId ?? "",
              wabaId: account?.wabaId ?? "",
              displayPhoneNumber: account?.displayPhoneNumber ?? "",
            }}
          />
          <p className="mt-4 text-xs text-muted-foreground">
            Webhook URL: <code>{process.env.NEXT_PUBLIC_APP_URL}/api/whatsapp/webhook</code> — register this in
            Meta for Developers with your verify token.
          </p>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Conversations</h2>
        {conversations.length === 0 ? (
          <EmptyState icon={MessageCircle} title="No conversations yet." description="Customer chats from WhatsApp will appear here." />
        ) : (
          <div className="space-y-2">
            {conversations.map((c) => (
              <Card key={c.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium">{c.customer?.name || c.contact?.profileName || c.contact?.waId}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {typeof c.messages[0]?.content === "object" && c.messages[0]?.content
                        ? JSON.stringify(c.messages[0].content).slice(0, 80)
                        : "—"}
                    </p>
                  </div>
                  {c.lastMessageAt && (
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(c.lastMessageAt), { addSuffix: true })}
                    </span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
