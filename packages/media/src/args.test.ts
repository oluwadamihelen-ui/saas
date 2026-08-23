import { describe, expect, it } from "vitest";
import {
  buildAddSilentAudioArgs,
  buildApplyVolumeArgs,
  buildConcatArgs,
  buildExtractFrameArgs,
  buildMixAudioArgs,
  buildMuxAudioArgs,
  buildOverlayMusicArgs,
} from "./args.js";

describe("buildApplyVolumeArgs", () => {
  it("applies a volume filter and re-encodes to mp3", () => {
    const args = buildApplyVolumeArgs("in.mp3", "out.mp3", 0.5);
    expect(args).toContain("-af");
    expect(args).toContain("volume=0.5");
    expect(args.at(-1)).toBe("out.mp3");
  });

  it("passes muted (volume 0) through the same filter rather than a special case", () => {
    const args = buildApplyVolumeArgs("in.mp3", "out.mp3", 0);
    expect(args).toContain("volume=0");
  });
});

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

describe("buildMixAudioArgs", () => {
  it("throws when given no inputs", () => {
    expect(() => buildMixAudioArgs([], "out.mp3")).toThrow();
  });

  it("just copies through a single input rather than building a filtergraph", () => {
    const args = buildMixAudioArgs(["only.mp3"], "out.mp3");
    expect(args).toEqual(["-y", "-i", "only.mp3", "-c:a", "copy", "out.mp3"]);
  });

  it("builds an amix filtergraph over every input, keeping the longest duration", () => {
    const args = buildMixAudioArgs(["dialogue.mp3", "sfx.mp3"], "out.mp3");
    const joined = args.join(" ");
    expect(joined).toContain("-i dialogue.mp3");
    expect(joined).toContain("-i sfx.mp3");
    expect(joined).toContain("[0:a][1:a]amix=inputs=2:duration=longest:dropout_transition=0[aout]");
    expect(joined).toContain("-map [aout]");
    expect(args.at(-1)).toBe("out.mp3");
  });
});

describe("buildOverlayMusicArgs", () => {
  it("loops the music input and mixes it under the existing audio at reduced volume", () => {
    const args = buildOverlayMusicArgs("episode.mp4", "score.mp3", "out.mp4");
    const joined = args.join(" ");
    expect(joined).toContain("-stream_loop -1 -i score.mp3");
    expect(joined).toContain("[1:a]volume=0.25[music]");
    expect(joined).toContain("[0:a][music]amix=inputs=2:duration=first:dropout_transition=0[aout]");
    expect(joined).toContain("-c:v copy");
    expect(args).toContain("-shortest");
  });

  it("honors a custom music volume", () => {
    const args = buildOverlayMusicArgs("episode.mp4", "score.mp3", "out.mp4", { musicVolume: 0.4 });
    expect(args.join(" ")).toContain("[1:a]volume=0.4[music]");
  });
});

describe("buildExtractFrameArgs", () => {
  it("seeks to the timestamp and grabs exactly one frame", () => {
    const args = buildExtractFrameArgs("shot.mp4", "frame.jpg", 2.5);
    expect(args).toEqual(["-y", "-ss", "2.5", "-i", "shot.mp4", "-frames:v", "1", "-q:v", "3", "frame.jpg"]);
  });

  it("clamps a negative timestamp to zero", () => {
    const args = buildExtractFrameArgs("shot.mp4", "frame.jpg", -1);
    expect(args).toContain("0");
    expect(args).not.toContain("-1");
  });
});
