import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LEGAL, LEGAL_REVIEWED, legalBySlug } from "@/lib/legal";

export function generateStaticParams() {
  return LEGAL.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const d = legalBySlug((await params).slug);
  return { title: d?.title ?? "Legal" };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const d = legalBySlug((await params).slug);
  if (!d) notFound();
  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">{d.title}</h1>
      <p className="mt-1 text-sm text-muted">Last updated {d.updated}</p>
      {!LEGAL_REVIEWED && <p className="mt-4 rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-warn">Draft template. This document has not yet been reviewed by a qualified lawyer and is not legal advice. It must be reviewed and adapted for your company, jurisdictions and payment providers before launch.</p>}
      <div className="mt-6 space-y-6">{d.sections.map((s) => <section key={s.h}><h2 className="text-lg font-semibold">{s.h}</h2>{s.p.map((t, i) => <p key={i} className="mt-2 text-sm leading-relaxed text-muted">{t}</p>)}</section>)}</div>
    </article>
  );
}
