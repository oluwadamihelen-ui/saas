import { z } from "zod";
import { prisma } from "@/lib/db";
import { notifyUser } from "@/lib/services/notifications";
import { recordAuditLog } from "@/lib/security/audit";

export const customizationRequestSchema = z.object({
  applicationId: z.string().uuid().optional().or(z.literal("")),
  description: z.string().trim().min(20, "Please describe what you need in a bit more detail (20+ characters).").max(5000),
  budget: z.coerce.number().positive().optional(),
  deadline: z.string().optional(),
});

export type CustomizationRequestInput = z.infer<typeof customizationRequestSchema>;

export async function createCustomizationRequest(customerId: string, input: CustomizationRequestInput) {
  const request = await prisma.customizationRequest.create({
    data: {
      customerId,
      applicationId: input.applicationId || undefined,
      description: input.description,
      budget: input.budget,
      deadline: input.deadline ? new Date(input.deadline) : undefined,
      status: "SUBMITTED",
    },
  });

  await recordAuditLog({
    actorId: customerId,
    action: "customization_request.submitted",
    resourceType: "CustomizationRequest",
    resourceId: request.id,
  });

  return request;
}

export async function markRequestUnderReview(requestId: string, actorId: string) {
  const request = await prisma.customizationRequest.update({ where: { id: requestId }, data: { status: "REVIEWING" } });
  await recordAuditLog({ actorId, action: "customization_request.reviewing", resourceType: "CustomizationRequest", resourceId: requestId });
  return request;
}

export async function declineRequest(requestId: string, actorId: string) {
  const request = await prisma.customizationRequest.update({ where: { id: requestId }, data: { status: "DECLINED" } });
  await recordAuditLog({ actorId, action: "customization_request.declined", resourceType: "CustomizationRequest", resourceId: requestId });
  await notifyUser(request.customerId, {
    type: "customization_request.declined",
    title: "Custom work request declined",
    message: "We're not able to take on this request right now. Contact support if you have questions.",
  });
  return request;
}
