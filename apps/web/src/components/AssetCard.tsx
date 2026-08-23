import { formatBytes, formatDuration } from "@/lib/format";

const KIND_LABELS: Record<string, string> = {
  CHARACTER_REFERENCE: "Character Reference",
  LOCATION_REFERENCE: "Location Reference",
  WARDROBE_REFERENCE: "Wardrobe Reference",
  PROP_REFERENCE: "Prop Reference",
  STORYBOARD_FRAME: "Storyboard Frame",
  GENERATED_IMAGE: "Generated Image",
  GENERATED_VIDEO: "Shot Video",
  GENERATED_AUDIO: "Generated Audio",
  UPLOAD: "Uploaded Source",
  EXPORT: "Export",
  POSTER: "Poster",
  THUMBNAIL: "Thumbnail",
};

export interface AssetCardData {
  id: string;
  type: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
  kind: string;
  url: string;
  bytes: number | null;
  durationSeconds: number | null;
  createdAt: Date | string;
  projectTitle: string;
}

export function AssetCard({ asset, showProject }: { asset: AssetCardData; showProject: boolean }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-cinerra-border/80 bg-cinerra-surface shadow-card">
      <div className="flex aspect-video items-center justify-center overflow-hidden bg-cinerra-surface2">
        <AssetPreview asset={asset} />
      </div>
      <div className="flex flex-col gap-1 p-3">
        <p className="line-clamp-1 text-xs font-medium text-cinerra-text">{KIND_LABELS[asset.kind] ?? asset.kind.replace(/_/g, " ")}</p>
        {showProject && <p className="line-clamp-1 text-[11px] text-cinerra-muted">{asset.projectTitle}</p>}
        <div className="flex items-center justify-between text-[11px] text-cinerra-muted">
          <span>{asset.durationSeconds ? formatDuration(asset.durationSeconds) : formatBytes(asset.bytes)}</span>
          <a href={asset.url} target="_blank" rel="noreferrer" download className="text-cinerra-accent hover:underline">
            Download
          </a>
        </div>
      </div>
    </div>
  );
}

function AssetPreview({ asset }: { asset: AssetCardData }) {
  if (asset.type === "IMAGE") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={asset.url} alt={asset.kind} className="h-full w-full object-cover" />;
  }
  if (asset.type === "VIDEO") {
    // eslint-disable-next-line jsx-a11y/media-has-caption
    return <video src={asset.url} controls preload="metadata" className="h-full w-full object-cover" />;
  }
  if (asset.type === "AUDIO") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-3">
        <AudioIcon />
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio src={asset.url} controls className="w-full" />
      </div>
    );
  }
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-cinerra-muted">
      <DocumentIcon />
      <span className="text-[10px]">Document</span>
    </div>
  );
}

function AudioIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cinerra-muted">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}
