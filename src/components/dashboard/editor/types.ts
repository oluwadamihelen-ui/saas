export type EditorCaption = {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  order: number;
};

export type EditorScene = {
  id: string;
  order: number;
  title: string;
  narration: string | null;
  durationSeconds: number;
  imageUrl: string | null;
  imageStatus: string;
  voiceUrl: string | null;
  voiceDurationSeconds: number | null;
  voiceStatus: string;
  voicePresetId: string | null;
  voiceSpeed: number | null;
  voicePitch: number | null;
  captions: EditorCaption[];
};

export type EditorVoice = {
  id: string;
  name: string;
  style: string;
  language: string;
  accent: string | null;
  gender: string | null;
  previewUrl: string | null;
};

export type EditorMusicTrack = {
  id: string;
  name: string;
  mood: string;
  url: string | null;
  durationSeconds: number | null;
};

export type EditorProjectMusic = {
  id: string;
  musicTrackId: string;
  volume: number;
  fadeInMs: number;
  fadeOutMs: number;
  loop: boolean;
  duckUnderVoice: boolean;
  musicTrack: EditorMusicTrack;
};

export type EditorProject = {
  id: string;
  title: string;
  aspectRatio: string;
  scenes: EditorScene[];
  music: EditorProjectMusic[];
};
