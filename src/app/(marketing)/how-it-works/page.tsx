import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PenLine, Sparkles, LayoutTemplate, Users2, Image as ImageIcon,
  Film, Mic, Music2, Clapperboard, Download,
} from "lucide-react";

export const metadata: Metadata = { title: "How It Works" };

const STEPS = [
  { icon: PenLine, title: "1. Enter your idea or script", copy: "Start with a one-line idea, paste a finished script, upload a document, or ask the AI to draft one for you. Set language, audience, target length and aspect ratio." },
  { icon: Sparkles, title: "2. AI analyzes your script", copy: "Storyloom reads for structure, tone and pacing so the storyboard that follows actually matches your story." },
  { icon: LayoutTemplate, title: "3. AI builds a storyboard", copy: "Your script is broken into scenes — each with a title, narration, visual description, location, camera direction and duration — shown as editable cards." },
  { icon: Users2, title: "4. Characters are created or reused", copy: "Storyloom identifies characters in your story and creates reusable visual profiles, or you can build your own character library in advance." },
  { icon: ImageIcon, title: "5. Scene visuals are generated", copy: "Each scene gets a generated image in your chosen visual style, using your characters' stored identity for consistency." },
  { icon: Film, title: "6. Scenes are animated", copy: "Visuals are brought to motion with camera movement and animation intensity you control per scene." },
  { icon: Mic, title: "7. Narration is generated", copy: "Pick a voice, style, speed and pitch — globally or per scene — and Storyloom generates the narration audio." },
  { icon: Music2, title: "8. Music is added", copy: "Choose a mood-matched track; it automatically ducks under narration with configurable fades." },
  { icon: Clapperboard, title: "9. Preview and edit", copy: "Everything comes together in a simple timeline editor — reorder scenes, adjust captions, swap voices or regenerate anything that's not right." },
  { icon: Download, title: "10. Export your video", copy: "Render at 720p or 1080p in 16:9, 9:16 or 1:1, then download, share, or start a new version." },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight">How Storyloom works</h1>
        <p className="mt-4 text-muted-foreground">
          One connected pipeline from a raw idea to a finished, downloadable video.
        </p>
      </div>

      <div className="mt-16 space-y-6">
        {STEPS.map((step) => (
          <Card key={step.title} className="flex gap-5 p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-100">
              <step.icon className="h-6 w-6 text-brand-600" />
            </div>
            <div>
              <h3 className="font-display font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{step.copy}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-16 text-center">
        <Button href="/signup" size="lg">Create Your First Video</Button>
      </div>
    </div>
  );
}
