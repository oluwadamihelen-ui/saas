export type RenderCaption = {
  text: string;
  startMs: number;
  endMs: number;
};

export type RenderScene = {
  imageUrl: string;
  durationInFrames: number;
  voiceUrl: string | null;
  captions: RenderCaption[];
};

export type RenderMusic = {
  url: string;
  volume: number;
  fadeInMs: number;
  fadeOutMs: number;
  loop: boolean;
  duckUnderVoice: boolean;
};

export type RenderInputProps = {
  scenes: RenderScene[];
  music: RenderMusic | null;
  fps: number;
  width: number;
  height: number;
};
