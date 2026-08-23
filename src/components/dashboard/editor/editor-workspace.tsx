"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { EditorSceneList } from "./editor-scene-list";
import { EditorPreview } from "./editor-preview";
import { EditorTimeline } from "./editor-timeline";
import { EditorScenePanel } from "./editor-scene-panel";
import { EditorMusicPanel } from "./editor-music-panel";
import type { EditorProject, EditorVoice, EditorMusicTrack } from "./types";

export function EditorWorkspace({
  project,
  voices,
  musicTracks,
}: {
  project: EditorProject;
  voices: EditorVoice[];
  musicTracks: EditorMusicTrack[];
}) {
  const scenes = project.scenes;
  const currentMusic = project.music[0] ?? null;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [rightTab, setRightTab] = useState<"scene" | "music">("scene");

  const narrationRef = useRef<HTMLAudioElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const indexRef = useRef(currentIndex);

  useEffect(() => {
    indexRef.current = currentIndex;
  }, [currentIndex]);

  const scene = scenes[currentIndex];

  function goToIndex(i: number) {
    setCurrentTime(0);
    setCurrentIndex(Math.max(0, Math.min(scenes.length - 1, i)));
  }

  function togglePlay() {
    setIsPlaying((prev) => {
      const next = !prev;
      if (next) setCurrentTime(0);
      return next;
    });
  }

  function stopAtEnd() {
    setIsPlaying(false);
    setCurrentTime(0);
  }

  // Drives scene playback: narration audio when present, a timer otherwise.
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (!isPlaying || !scene) return;

    if (scene.voiceUrl && narrationRef.current) {
      const audio = narrationRef.current;
      audio.src = scene.voiceUrl;
      audio.currentTime = 0;
      audio.play().catch(() => undefined);
    } else {
      const duration = scene.durationSeconds;
      let elapsed = 0;
      timerRef.current = setInterval(() => {
        elapsed += 0.1;
        setCurrentTime(elapsed);
        if (elapsed >= duration) {
          if (indexRef.current >= scenes.length - 1) {
            stopAtEnd();
          } else {
            goToIndex(indexRef.current + 1);
          }
        }
      }, 100);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, isPlaying]);

  // Narration audio event wiring (mount once).
  useEffect(() => {
    const audio = narrationRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => {
      if (indexRef.current >= scenes.length - 1) {
        stopAtEnd();
      } else {
        goToIndex(indexRef.current + 1);
      }
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes.length]);

  // Background music playback + ducking.
  useEffect(() => {
    const audio = musicRef.current;
    if (!audio || !currentMusic?.musicTrack.url) return;

    audio.loop = currentMusic.loop;
    const duckFactor = currentMusic.duckUnderVoice && scene?.voiceUrl ? 0.3 : 1;
    audio.volume = muted ? 0 : currentMusic.volume * duckFactor * volume;

    if (isPlaying) {
      if (audio.src !== currentMusic.musicTrack.url) audio.src = currentMusic.musicTrack.url;
      if (audio.paused) audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  }, [isPlaying, currentMusic, scene, muted, volume]);

  // Narration volume/mute.
  useEffect(() => {
    if (narrationRef.current) narrationRef.current.volume = muted ? 0 : volume;
  }, [muted, volume]);

  const activeCaption = scene?.captions.find((c) => {
    const ms = currentTime * 1000;
    return ms >= c.startMs && ms < c.endMs;
  });

  return (
    <div className="mx-auto flex h-full max-w-[1500px] flex-col">
      <audio ref={narrationRef} />
      <audio ref={musicRef} />

      <div className="flex items-center justify-between">
        <Link href={`/projects/${project.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to project
        </Link>
        <h1 className="font-display text-sm font-semibold">{project.title} — Editor</h1>
      </div>

      {scenes.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border bg-surface p-16 text-center text-sm text-muted-foreground">
          This project has no scenes yet. Generate a storyboard first.
        </div>
      ) : (
        <>
          <div className="mt-4 grid flex-1 grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-3">
              <EditorSceneList scenes={scenes} currentIndex={currentIndex} onSelect={goToIndex} />
            </div>

            <div className="col-span-12 lg:col-span-6">
              <EditorPreview
                scene={scene}
                aspectRatio={project.aspectRatio}
                sceneIndex={currentIndex}
                sceneCount={scenes.length}
                isPlaying={isPlaying}
                currentTime={currentTime}
                activeCaptionText={activeCaption?.text ?? null}
                muted={muted}
                volume={volume}
                onTogglePlay={togglePlay}
                onPrev={() => goToIndex(currentIndex - 1)}
                onNext={() => goToIndex(currentIndex + 1)}
                onMuteToggle={() => setMuted((m) => !m)}
                onVolumeChange={setVolume}
              />
            </div>

            <div className="col-span-12 lg:col-span-3">
              <div className="mb-2 flex gap-1 rounded-lg bg-surface-muted p-1">
                <button
                  type="button"
                  onClick={() => setRightTab("scene")}
                  className={cn("flex-1 rounded-md py-1.5 text-xs font-medium", rightTab === "scene" ? "bg-surface shadow-sm" : "text-muted-foreground")}
                >
                  Scene
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab("music")}
                  className={cn("flex-1 rounded-md py-1.5 text-xs font-medium", rightTab === "music" ? "bg-surface shadow-sm" : "text-muted-foreground")}
                >
                  Music
                </button>
              </div>
              {rightTab === "scene" && scene ? (
                <EditorScenePanel key={scene.id} scene={scene} voices={voices} />
              ) : (
                <EditorMusicPanel projectId={project.id} tracks={musicTracks} current={currentMusic} />
              )}
            </div>
          </div>

          <div className="mt-4">
            <EditorTimeline scenes={scenes} currentIndex={currentIndex} currentSceneElapsed={currentTime} onSelect={goToIndex} />
          </div>
        </>
      )}
    </div>
  );
}
