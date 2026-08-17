import type { Metadata } from "next";
import {
  Wand2, Users2, Palette, Mic, Music2, Film, LayoutTemplate,
  Type, Download, Layers, ShieldCheck, Gauge,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Features" };

const FEATURES = [
  { icon: Wand2, title: "AI script analysis", copy: "Paste a script or a one-line idea — Storyloom identifies structure, tone and pacing automatically." },
  { icon: LayoutTemplate, title: "Structured storyboards", copy: "Every script becomes an editable set of scene cards: narration, visuals, camera direction and duration." },
  { icon: Users2, title: "Character consistency", copy: "Reusable character profiles keep appearance, clothing and personality identical across every scene." },
  { icon: Palette, title: "10 original visual styles", copy: "Modern Cartoon, Storybook, Comic, 3D, Minimal, Hand Drawn, Cinematic, Educational, Kids and Documentary." },
  { icon: Film, title: "Async scene generation", copy: "Images, animation, voice and music generate in the background with clear per-stage progress." },
  { icon: Mic, title: "Voice studio", copy: "Language, accent, speaking style, speed and pitch control, with per-scene voice overrides." },
  { icon: Music2, title: "Adaptive music", copy: "Mood-based scoring with automatic ducking under narration, fades and loop control." },
  { icon: Type, title: "Captions & text overlays", copy: "Auto-generated captions from narration, plus custom titles and lower thirds." },
  { icon: Layers, title: "Beginner-friendly editor", copy: "A focused timeline — scenes, audio and captions — without a professional NLE's complexity." },
  { icon: Download, title: "Flexible export", copy: "720p or 1080p, in 16:9, 9:16 or 1:1, ready for any platform." },
  { icon: ShieldCheck, title: "Private by default", copy: "Your projects, characters and assets are scoped to your account and never shared." },
  { icon: Gauge, title: "Credit-based usage", copy: "Transparent, auditable credit ledger for every AI-driven generation step." },
];

export default function FeaturesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight">Everything you need to go from idea to video</h1>
        <p className="mt-4 text-muted-foreground">
          Storyloom combines script understanding, consistent character art, voice, music and editing into one guided workflow.
        </p>
      </div>
      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <Card key={f.title} className="p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-100">
              <f.icon className="h-5 w-5 text-brand-600" />
            </div>
            <h3 className="mt-4 font-display font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.copy}</p>
          </Card>
        ))}
      </div>
      <div className="mt-16 text-center">
        <Button href="/signup" size="lg">Create Your First Video</Button>
      </div>
    </div>
  );
}
