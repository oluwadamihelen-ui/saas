"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const GENRES = ["Drama", "Thriller", "Romance", "Mystery", "Horror", "Crime", "Action", "Sci-Fi", "Fantasy", "Comedy", "Family", "Historical", "Psychological", "Supernatural"];
const TONES = ["Dark", "Emotional", "Suspenseful", "Romantic", "Gritty", "Hopeful", "Serious", "Cinematic"];
const FORMATS = [
  { value: "SHORT_FILM", label: "Short Film" },
  { value: "FEATURE_FILM", label: "Feature Film" },
  { value: "MINI_SERIES", label: "Mini-Series" },
  { value: "SERIES", label: "Series" },
];
const EPISODE_OPTIONS = [5, 10, 20, 30, 45];
const ASPECT_RATIOS = [
  { value: "PORTRAIT_9_16", label: "9:16 Portrait" },
  { value: "LANDSCAPE_16_9", label: "16:9 Landscape" },
  { value: "SQUARE_1_1", label: "1:1 Square" },
];
const VISUAL_STYLES = [
  "LIVE_ACTION_FILM",
  "CINEMATIC_DRAMA",
  "DOCUMENTARY",
  "DARK_THRILLER",
  "ROMANTIC_DRAMA",
  "HIGH_END_TELEVISION",
  "PERIOD_DRAMA",
  "ACTION_FILM",
  "HORROR",
  "CUSTOM",
];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function StoryWizardForm({ initialMode }: { initialMode: "INSPIRATION" | "ADAPTATION" }) {
  const router = useRouter();
  const [mode, setMode] = useState<"INSPIRATION" | "ADAPTATION">(initialMode);
  const [title, setTitle] = useState("");
  const [storyIdea, setStoryIdea] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [sourceFileKey, setSourceFileKey] = useState<string | undefined>(undefined);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [genres, setGenres] = useState<string[]>([]);
  const [tones, setTones] = useState<string[]>([]);
  const [setting, setSetting] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [format, setFormat] = useState("MINI_SERIES");
  const [episodeCount, setEpisodeCount] = useState(10);
  const [aspectRatio, setAspectRatio] = useState("PORTRAIT_9_16");
  const [visualStyle, setVisualStyle] = useState("LIVE_ACTION_FILM");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileUpload(file: File) {
    setUploadError(null);
    setUploadingFile(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/projects/source-document", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't read that file.");
      setSourceText(data.text as string);
      setSourceFileKey(data.sourceFileKey as string);
      setUploadedFileName(file.name);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setUploadingFile(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) return setError("Give your movie a title.");
    if (mode === "INSPIRATION" && !storyIdea.trim()) return setError("Describe the movie you want to create.");
    if (mode === "ADAPTATION" && !sourceText.trim()) return setError("Paste or upload your source material.");

    setSubmitting(true);
    try {
      const projectRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          mode,
          format,
          episodeCount: format === "SERIES" || format === "MINI_SERIES" ? episodeCount : 1,
          aspectRatio,
          visualStyle,
          sourceText: mode === "ADAPTATION" ? sourceText : undefined,
          sourceFileKey: mode === "ADAPTATION" ? sourceFileKey : undefined,
        }),
      });
      const projectData = await projectRes.json();
      if (!projectRes.ok) throw new Error(projectData.error ?? "Couldn't create the project.");

      const projectId = projectData.project.id as string;

      const genRes = await fetch(`/api/projects/${projectId}/story/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyIdea, genres, tones, setting: setting || undefined, targetAudience: targetAudience || undefined }),
      });
      const genData = await genRes.json();
      if (!genRes.ok) throw new Error(genData.error ?? "Couldn't start story generation.");

      router.push(`/projects/${projectId}?job=${genData.generationJobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex rounded-full border border-cinerra-border bg-cinerra-surface p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("INSPIRATION")}
          className={`flex-1 rounded-full py-2 font-medium transition ${mode === "INSPIRATION" ? "bg-cinerra-accent text-white" : "text-cinerra-muted"}`}
        >
          Inspiration Mode
        </button>
        <button
          type="button"
          onClick={() => setMode("ADAPTATION")}
          className={`flex-1 rounded-full py-2 font-medium transition ${mode === "ADAPTATION" ? "bg-cinerra-accent text-white" : "text-cinerra-muted"}`}
        >
          Novel Adaptation
        </button>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-cinerra-muted">Title</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={70} placeholder="Give your work a name" />
      </div>

      {mode === "INSPIRATION" ? (
        <div>
          <label className="mb-1 block text-sm font-medium text-cinerra-muted">Story Idea</label>
          <textarea
            className="textarea"
            value={storyIdea}
            onChange={(e) => setStoryIdea(e.target.value)}
            maxLength={20000}
            placeholder="Describe the movie you want to create…"
          />
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-sm font-medium text-cinerra-muted">Source material</label>
          <textarea
            className="textarea"
            value={sourceText}
            onChange={(e) => {
              setSourceText(e.target.value);
              setSourceFileKey(undefined);
              setUploadedFileName(null);
            }}
            placeholder="Paste your screenplay, novel excerpt, or treatment…"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="btn-secondary-sm cursor-pointer">
              {uploadingFile ? "Reading file…" : "Upload PDF, DOCX, or TXT"}
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                disabled={uploadingFile}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void handleFileUpload(file);
                }}
              />
            </label>
            {uploadedFileName && !uploadingFile && <span className="text-xs text-emerald-400">Loaded {uploadedFileName} — feel free to edit the text above.</span>}
          </div>
          {uploadError && <p className="mt-1 text-xs text-red-300">{uploadError}</p>}
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-medium text-cinerra-muted">Genre</label>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((g) => (
            <Chip key={g} label={g} active={genres.includes(g)} onClick={() => setGenres((prev) => toggle(prev, g))} />
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-cinerra-muted">Tone</label>
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <Chip key={t} label={t} active={tones.includes(t)} onClick={() => setTones((prev) => toggle(prev, t))} />
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-cinerra-muted">Setting (optional)</label>
          <input className="input" value={setting} onChange={(e) => setSetting(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-cinerra-muted">Target audience (optional)</label>
          <input className="input" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-cinerra-muted">Movie Length</label>
        <div className="flex flex-wrap gap-2">
          {FORMATS.map((f) => (
            <Chip key={f.value} label={f.label} active={format === f.value} onClick={() => setFormat(f.value)} />
          ))}
        </div>
      </div>

      {(format === "SERIES" || format === "MINI_SERIES") && (
        <div>
          <label className="mb-2 block text-sm font-medium text-cinerra-muted">Episode Count</label>
          <div className="flex flex-wrap gap-2">
            {EPISODE_OPTIONS.map((n) => (
              <Chip key={n} label={String(n)} active={episodeCount === n} onClick={() => setEpisodeCount(n)} />
            ))}
            <input
              type="number"
              min={1}
              max={200}
              value={episodeCount}
              onChange={(e) => setEpisodeCount(Number(e.target.value))}
              className="input w-24"
            />
          </div>
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-medium text-cinerra-muted">Aspect Ratio</label>
        <div className="flex flex-wrap gap-2">
          {ASPECT_RATIOS.map((a) => (
            <Chip key={a.value} label={a.label} active={aspectRatio === a.value} onClick={() => setAspectRatio(a.value)} />
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-cinerra-muted">Visual Style</label>
        <div className="flex flex-wrap gap-2">
          {VISUAL_STYLES.map((s) => (
            <Chip key={s} label={s.replace(/_/g, " ")} active={visualStyle === s} onClick={() => setVisualStyle(s)} />
          ))}
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="btn-primary w-full py-3"
      >
        {submitting ? "Starting…" : "Next"}
      </button>
    </form>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
        active ? "border-cinerra-accent bg-cinerra-accent/20 text-cinerra-text" : "border-cinerra-border text-cinerra-muted hover:text-cinerra-text"
      }`}
    >
      {label}
    </button>
  );
}
