import { AbsoluteFill, Series } from "remotion";
import { Scene } from "./Scene";
import { BackgroundMusic } from "./BackgroundMusic";
import type { RenderInputProps } from "./types";

export function StoryComposition({ scenes, music, fps }: RenderInputProps) {
  const totalFrames = scenes.reduce((sum, s) => sum + s.durationInFrames, 0);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Series>
        {scenes.map((scene, i) => (
          <Series.Sequence key={i} durationInFrames={Math.max(1, scene.durationInFrames)}>
            <Scene scene={scene} />
          </Series.Sequence>
        ))}
      </Series>
      {music && <BackgroundMusic music={music} scenes={scenes} fps={fps} totalFrames={totalFrames} />}
    </AbsoluteFill>
  );
}
