import type { Metadata } from "next";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "FAQ" };

const FAQS = [
  { q: "Do I need any video editing experience?", a: "No. Storyloom is designed so a complete beginner can go from an idea to a finished video, while still exposing scene-level controls for advanced users who want more precision." },
  { q: "What's the difference between an idea and a script?", a: "An idea is a short description of what you want (a sentence or paragraph); Storyloom's AI expands it into a full script and storyboard. A script is your own complete narration text, which Storyloom will break into scenes directly." },
  { q: "Will my characters look the same in every scene?", a: "Yes. Characters you create are stored with a reusable visual identity — appearance, hair, clothing and accessories — that's applied automatically whenever that character appears in a scene." },
  { q: "Can I edit a scene after it's generated?", a: "Yes. You can edit the narration, visual description, camera direction and duration of any scene, and regenerate just that scene without affecting the rest of the project." },
  { q: "What video formats can I export?", a: "MP4 at 720p or 1080p, in 16:9 (widescreen), 9:16 (vertical) or 1:1 (square) — matching whatever platform you're publishing to." },
  { q: "How do credits work?", a: "Credits are consumed by AI-driven steps: script generation, storyboard generation, image generation, animation, voice generation, music generation and final rendering. Editing, previewing and organizing your project are free." },
  { q: "Can I use my own voice for narration?", a: "Where supported, you can upload your own narration audio per scene instead of generating one." },
  { q: "Is my content private?", a: "Yes. Projects, characters and assets are scoped to your account. Only you can access your own projects." },
  { q: "Can I use videos commercially?", a: "Commercial usage rights are included on Creator and Pro plans. Check the plan comparison on the pricing page for details." },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight">Frequently asked questions</h1>
        <p className="mt-4 text-muted-foreground">Everything you need to know before you start creating.</p>
      </div>

      <div className="mt-14 space-y-4">
        {FAQS.map((item) => (
          <Card key={item.q} className="p-5">
            <h3 className="font-display font-semibold">{item.q}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
