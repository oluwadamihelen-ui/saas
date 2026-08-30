import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createBusinessSchema } from "@/lib/validation/business";
import { apiError } from "@/lib/api-helpers";
import { slugify } from "@/lib/utils";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const memberships = await prisma.businessMember.findMany({
    where: { userId: session.user.id },
    include: { business: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ businesses: memberships.map((m) => ({ ...m.business, role: m.role })) });
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json();
    const data = createBusinessSchema.parse(body);

    const baseSlug = slugify(data.name) || "business";
    let slug = baseSlug;
    let attempt = 0;
    while (await prisma.business.findUnique({ where: { slug } })) {
      attempt += 1;
      slug = `${baseSlug}-${attempt + 1}`;
    }

    const freePlan = await prisma.plan.findUnique({ where: { key: "FREE" } });

    const business = await prisma.business.create({
      data: {
        name: data.name,
        slug,
        ownerName: data.ownerName,
        phone: data.phone,
        email: data.email,
        country: data.country,
        currency: data.currency,
        category: data.category,
        onboardingStep: "CATEGORY",
        members: { create: { userId: session.user.id, role: "OWNER" } },
        settings: { create: {} },
        paymentSettings: { create: {} },
        marketingSettings: { create: {} },
        ...(freePlan
          ? { subscription: { create: { planId: freePlan.id } } }
          : {}),
      },
    });

    return NextResponse.json({ business }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
