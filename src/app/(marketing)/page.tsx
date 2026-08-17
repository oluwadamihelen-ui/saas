import Link from "next/link";
import {
  ArrowRight,
  Play,
  Wand2,
  Users2,
  Palette,
  Mic,
  Music2,
  Film,
  LayoutTemplate,
  Clapperboard,
  CheckCircle2,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STYLES = [
  { name: "Modern Cartoon", gradient: "from-brand-400 to-brand-600" },
  { name: "Storybook", gradient: "from-ember-400 to-ember-600" },
  { name: "Comic", gradient: "from-brand-500 to-ember-500" },
  { name: "3D Animation", gradient: "from-brand-300 to-brand-700" },
  { name: "Minimal Illustration", gradient: "from-ember-300 to-ember-600" },
  { name: "Hand Drawn", gradient: "from-brand-400 to-ember-400" },
  { name: "Cinematic Cartoon", gradient: "from-brand-700 to-brand-400" },
  { name: "Educational", gradient: "from-brand-500 to-ember-400" },
  { name: "Kids Animation", gradient: "from-ember-400 to-brand-400" },
  { name: "Documentary Illustration", gradient: "from-brand-600 to-ember-600" },
];

const WORKFLOW_STEPS = [
  { icon: Wand2, title: "Enter your idea or script", copy: "Start from a one-line idea or paste a complete script — Storyloom works with either." },
  { icon: LayoutTemplate, title: "AI builds your storyboard", copy: "Your story is analyzed and broken into scenes, each with narration, visuals and camera direction." },
  { icon: Users2, title: "Characters stay consistent", copy: "Create reusable characters once — Storyloom keeps them visually consistent across every scene." },
  { icon: Film, title: "Scenes come to life", copy: "Each scene is rendered as an animated visual, then combined with narration and music." },
  { icon: Clapperboard, title: "Edit, export, done", copy: "Fine-tune in a beginner-friendly editor, then export a finished MP4 in the aspect ratio you need." },
];

const AI_FEATURES = [
  { icon: Wand2, title: "Script-to-storyboard AI", copy: "Turns a rough idea into structured scenes — titles, narration, visuals and timing." },
  { icon: Users2, title: "Character consistency engine", copy: "One reusable character identity, applied automatically across every scene it appears in." },
  { icon: Palette, title: "10 original visual styles", copy: "From storybook to cinematic cartoon — pick a look and Storyloom applies it everywhere." },
  { icon: Mic, title: "Natural voice narration", copy: "Choose a voice, style and language; Storyloom generates studio-quality narration per scene." },
  { icon: Music2, title: "Adaptive background score", copy: "Mood-matched music that automatically ducks under narration so dialogue stays clear." },
  { icon: Film, title: "Async scene generation", copy: "Visuals, animation, voice and music generate in the background — no frozen screens." },
];

const TESTIMONIALS = [
  {
    quote: "I turned a two-paragraph idea into a polished explainer video before my coffee got cold. The character consistency is what sold me.",
    name: "Priya N.",
    role: "Marketing Lead, B2B SaaS",
  },
  {
    quote: "As a teacher, I don't have time to learn a video editor. I write a script, pick a style, and Storyloom hands me a finished lesson video.",
    name: "Daniel O.",
    role: "High School Educator",
  },
  {
    quote: "The storyboard step alone is worth it — I can rearrange scenes before spending a single credit on rendering.",
    name: "Marcus T.",
    role: "Independent Creator",
  },
];

const FAQ_PREVIEW = [
  {
    q: "Do I need any video editing experience?",
    a: "No. Storyloom is built so a complete beginner can go from an idea to a finished video, while still offering scene-level controls for advanced users.",
  },
  {
    q: "Will my characters look the same in every scene?",
    a: "Yes — characters you create are stored with a reusable visual identity that Storyloom applies whenever that character appears.",
  },
  {
    q: "What do credits pay for?",
    a: "Credits cover AI-driven steps like script analysis, image generation, animation, voice, music and final rendering. Editing and previewing are free.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-brand-400/25 blur-3xl" />
          <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-ember-400/20 blur-3xl" />
        </div>

        <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:pb-28 lg:pt-24">
          <div>
            <Badge variant="brand">
              <Star className="h-3 w-3" /> AI-powered animated video creation
            </Badge>
            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Turn Your Ideas Into{" "}
              <span className="brand-gradient-text">Animated Videos</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Write your idea or paste your script. Our AI turns it into a
              complete animated video with scenes, characters, narration,
              music and motion.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button href="/signup" variant="primary" size="lg">
                Create Your First Video <ArrowRight className="h-4 w-4" />
              </Button>
              <Button href="/how-it-works" variant="outline" size="lg">
                <Play className="h-4 w-4" /> Watch Demo
              </Button>
            </div>
            <div className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-success" /> No editing skills needed
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-success" /> Free credits to start
              </div>
            </div>
          </div>

          <div className="relative">
            <Card className="overflow-hidden rounded-2xl p-0 shadow-xl">
              <div className="flex items-center gap-1.5 border-b border-border bg-surface-muted px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-danger/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
                <span className="ml-3 text-xs text-muted-foreground">Scene Preview — Storyloom Editor</span>
              </div>
              <div className="brand-gradient-bg relative aspect-video flex items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                  <Play className="h-6 w-6 fill-white text-white" />
                </div>
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-lg bg-black/25 px-3 py-2 text-xs text-white backdrop-blur">
                  <span>Scene 3 — &quot;The Discovery&quot;</span>
                  <span>0:06</span>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2 p-3">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div
                    key={n}
                    className={`aspect-video rounded-md bg-gradient-to-br ${
                      n === 3 ? "from-brand-400 to-ember-400 ring-2 ring-brand-500" : "from-surface-muted to-border"
                    }`}
                  />
                ))}
              </div>
            </Card>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Illustrative preview of the Storyloom editor interface
            </p>
          </div>
        </div>
      </section>

      {/* Before / After */}
      <section className="border-y border-border bg-surface-muted/40 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight">
                From a rough idea to a finished scene
              </h2>
              <p className="mt-3 max-w-lg text-muted-foreground">
                You provide the story. Storyloom handles the storyboard,
                character art, motion, narration and score — you stay in
                control at every step.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Before</span>
                <p className="mt-2 text-sm leading-relaxed">
                  &quot;A curious fox discovers a glowing forest at night and
                  learns it&apos;s protected by tiny guardian spirits.&quot;
                </p>
              </Card>
              <Card className="overflow-hidden p-0">
                <span className="block px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">After</span>
                <div className="brand-gradient-bg m-4 mt-2 aspect-video rounded-lg" />
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
          <p className="mt-3 text-muted-foreground">
            Five steps from a blank page to a finished, downloadable video.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {WORKFLOW_STEPS.map((step, i) => (
            <Card key={step.title} className="relative p-5">
              <span className="font-display text-3xl font-bold text-brand-200">
                {String(i + 1).padStart(2, "0")}
              </span>
              <step.icon className="mt-3 h-6 w-6 text-brand-500" />
              <h3 className="mt-3 font-display text-sm font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{step.copy}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Visual styles */}
      <section className="border-y border-border bg-surface-muted/40 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              A visual style for every story
            </h2>
            <p className="mt-3 text-muted-foreground">
              Ten original art directions, each with consistent characters and motion.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {STYLES.map((style) => (
              <div key={style.name} className="group">
                <div className={`aspect-square rounded-xl bg-gradient-to-br ${style.gradient} transition-transform group-hover:scale-[1.03]`} />
                <p className="mt-2 text-center text-sm font-medium">{style.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI features */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Everything the pipeline needs, generated for you
          </h2>
          <p className="mt-3 text-muted-foreground">
            One coherent AI pipeline — from story analysis to final render.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {AI_FEATURES.map((f) => (
            <Card key={f.title} className="p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-100">
                <f.icon className="h-5 w-5 text-brand-600" />
              </div>
              <h3 className="mt-4 font-display font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.copy}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Character consistency */}
      <section className="border-y border-border bg-surface-muted/40 py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
          <div>
            <Badge variant="ember">Character consistency</Badge>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight">
              The same character, scene after scene
            </h2>
            <p className="mt-4 text-muted-foreground">
              Create a character once — name, appearance, hair, clothing and
              personality — and Storyloom stores a reusable visual identity
              for it. Every time that character appears in your storyboard,
              the same identity is applied, so your protagonist doesn&apos;t
              change hairstyles between scene 2 and scene 7.
            </p>
            <ul className="mt-6 space-y-3">
              {["Create once, reuse across any project", "Upload a reference image or generate one", "Consistent appearance across every scene"].map((t) => (
                <li key={t} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <Card key={n} className="flex aspect-[3/4] items-center justify-center overflow-hidden p-0">
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-brand-100 to-brand-300">
                  <Users2 className="h-8 w-8 text-brand-700" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Loved by creators and teams</h2>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <Card key={t.name} className="p-6">
              <div className="flex gap-0.5 text-ember-500">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
              <p className="mt-4 text-sm font-semibold">{t.name}</p>
              <p className="text-xs text-muted-foreground">{t.role}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing preview */}
      <section className="border-y border-border bg-surface-muted/40 py-20">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Simple, credit-based pricing</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Start free. Upgrade when you need more monthly credits, longer
            videos, or higher-resolution exports.
          </p>
          <div className="mt-8">
            <Button href="/pricing" variant="primary" size="lg">
              View pricing <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ preview */}
      <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="text-center font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Frequently asked questions
        </h2>
        <div className="mt-10 space-y-4">
          {FAQ_PREVIEW.map((item) => (
            <Card key={item.q} className="p-5">
              <h3 className="font-display font-semibold">{item.q}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
            </Card>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/faq" className="text-sm font-medium text-brand-500 hover:text-brand-600">
            See all questions →
          </Link>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <Card className="brand-gradient-bg overflow-hidden rounded-2xl border-0 p-10 text-center text-white sm:p-16">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Your story is one script away from becoming a video
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/85">
            Join Storyloom and turn your first idea into an animated video today.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button href="/signup" variant="ember" size="lg">
              Create Your First Video <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </section>
    </>
  );
}
