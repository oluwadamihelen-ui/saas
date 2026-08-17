import type { Metadata } from "next";
import { Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Examples" };

const EXAMPLES = [
  { title: "Onboarding explainer", style: "Modern Cartoon", useCase: "Product", gradient: "from-brand-400 to-brand-600" },
  { title: "Bedtime story", style: "Storybook", useCase: "Kids", gradient: "from-ember-400 to-ember-600" },
  { title: "Origin story short", style: "Comic", useCase: "Marketing", gradient: "from-brand-500 to-ember-500" },
  { title: "Science lesson", style: "Educational", useCase: "Education", gradient: "from-brand-500 to-ember-400" },
  { title: "Founder story", style: "Cinematic Cartoon", useCase: "Marketing", gradient: "from-brand-700 to-brand-400" },
  { title: "Recycling PSA", style: "Documentary Illustration", useCase: "Nonprofit", gradient: "from-brand-600 to-ember-600" },
];

export default function ExamplesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight">See what you can create</h1>
        <p className="mt-4 text-muted-foreground">
          A sample of the video types creators build with Storyloom — explainers, stories, lessons and short-form marketing.
        </p>
      </div>

      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {EXAMPLES.map((ex) => (
          <Card key={ex.title} className="overflow-hidden p-0">
            <div className={`relative flex aspect-video items-center justify-center bg-gradient-to-br ${ex.gradient}`}>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                <Play className="h-5 w-5 fill-white text-white" />
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-display font-semibold">{ex.title}</h3>
              <div className="mt-2 flex gap-2">
                <Badge variant="brand">{ex.style}</Badge>
                <Badge variant="neutral">{ex.useCase}</Badge>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <p className="mx-auto mt-8 max-w-xl text-center text-sm text-muted-foreground">
        These are illustrative placeholders — sign up to generate real scenes from your own script.
      </p>

      <div className="mt-8 text-center">
        <Button href="/signup" size="lg">Create Your First Video</Button>
      </div>
    </div>
  );
}
