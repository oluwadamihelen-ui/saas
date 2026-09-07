import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";

const VALID_SLUGS = ["terms", "privacy", "refunds", "acceptable-use"];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const setting = await prisma.setting.findUnique({ where: { key: `legal.${slug}` } });
  const data = setting?.value as { title?: string } | undefined;
  return { title: data?.title ?? "Legal" };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!VALID_SLUGS.includes(slug)) notFound();

  const setting = await prisma.setting.findUnique({ where: { key: `legal.${slug}` } });
  const data = setting?.value as { title: string; body: string } | undefined;

  if (!data) notFound();

  return (
    <div className="container-shell py-14">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">{data.title}</h1>
        <div className="mt-6 whitespace-pre-line text-sm leading-relaxed text-muted">{data.body}</div>
      </div>
    </div>
  );
}
