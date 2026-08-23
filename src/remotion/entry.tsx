import { Composition, registerRoot } from "remotion";
import { StoryComposition } from "./StoryComposition";
import type { RenderInputProps } from "./types";

const defaultProps: RenderInputProps = {
  scenes: [],
  music: null,
  fps: 30,
  width: 1920,
  height: 1080,
};

function Root() {
  return (
    <Composition
      id="story-video"
      component={StoryComposition}
      durationInFrames={30}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={defaultProps}
      calculateMetadata={async ({ props }) => {
        const totalFrames = props.scenes.reduce((sum, s) => sum + s.durationInFrames, 0);
        return {
          durationInFrames: Math.max(1, totalFrames),
          fps: props.fps,
          width: props.width,
          height: props.height,
        };
      }}
    />
  );
}

registerRoot(Root);
