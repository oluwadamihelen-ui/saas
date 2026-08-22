import { describe, expect, it } from "vitest";
import { buildAddSilentAudioArgs, buildConcatArgs, buildMuxAudioArgs } from "./args.js";

describe("buildMuxAudioArgs", () => {
  it("maps video from the first input and audio from the second, trimmed to the shorter", () => {
    const args = buildMuxAudioArgs("shot.mp4", "dialogue.mp3", "out.mp4");
    expect(args).toContain("-shortest");
    expect(args.join(" ")).toContain("-map 0:v:0");
    expect(args.join(" ")).toContain("-map 1:a:0");
    expect(args.at(-1)).toBe("out.mp4");
  });
});

describe("buildAddSilentAudioArgs", () => {
  it("synthesizes a silent audio track via anullsrc", () => {
    const args = buildAddSilentAudioArgs("shot.mp4", "out.mp4");
    expect(args).toContain("anullsrc=channel_layout=stereo:sample_rate=44100");
    expect(args).toContain("-shortest");
  });
});

describe("buildConcatArgs", () => {
  it("throws when given no inputs", () => {
    expect(() => buildConcatArgs([], "out.mp4")).toThrow();
  });

  it("just copies through a single input rather than building a filtergraph", () => {
    const args = buildConcatArgs(["only.mp4"], "out.mp4");
    expect(args).toEqual(["-y", "-i", "only.mp4", "-c", "copy", "out.mp4"]);
  });

  it("builds a concat filtergraph referencing every input's video and audio streams", () => {
    const args = buildConcatArgs(["a.mp4", "b.mp4", "c.mp4"], "out.mp4");
    const joined = args.join(" ");
    expect(joined).toContain("-i a.mp4");
    expect(joined).toContain("-i b.mp4");
    expect(joined).toContain("-i c.mp4");
    expect(joined).toContain("[0:v:0][0:a:0][1:v:0][1:a:0][2:v:0][2:a:0]concat=n=3:v=1:a=1[outv][outa]");
    expect(args.at(-1)).toBe("out.mp4");
  });

  it("scales and pads the combined output to an exact target resolution when requested", () => {
    const args = buildConcatArgs(["a.mp4", "b.mp4"], "out.mp4", { width: 1080, height: 1920 });
    const joined = args.join(" ");
    expect(joined).toContain("concat=n=2:v=1:a=1[cv][outa]");
    expect(joined).toContain("[cv]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1[outv]");
  });

  it("still scales a single input rather than falling back to a plain copy", () => {
    const args = buildConcatArgs(["only.mp4"], "out.mp4", { width: 1280, height: 720 });
    expect(args).not.toContain("-c");
    expect(args.join(" ")).toContain("scale=1280:720");
  });
});
