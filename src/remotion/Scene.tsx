import { AbsoluteFill, Audio, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { RenderScene } from "./types";

export function Scene({ scene }: { scene: RenderScene }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Gentle Ken Burns push-in so static scene images don't feel static.
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.06], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const currentMs = (frame / fps) * 1000;
  const activeCaption = scene.captions.find((c) => currentMs >= c.startMs && currentMs < c.endMs);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Img
        src={scene.imageUrl}
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` }}
      />
      {activeCaption && (
        <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: "8%" }}>
          <div
            style={{
              background: "rgba(0,0,0,0.72)",
              color: "white",
              padding: "14px 28px",
              borderRadius: 12,
              fontSize: 40,
              fontFamily: "sans-serif",
              fontWeight: 600,
              maxWidth: "82%",
              textAlign: "center",
              lineHeight: 1.3,
            }}
          >
            {activeCaption.text}
          </div>
        </AbsoluteFill>
      )}
      {scene.voiceUrl && <Audio src={scene.voiceUrl} />}
    </AbsoluteFill>
  );
}
