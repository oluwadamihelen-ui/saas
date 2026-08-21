import Link from "next/link";

export interface ProjectCardProps {
  id: string;
  title: string;
  status: string;
  episodeCount: number;
  updatedAt: Date | string;
  visualStyle: string;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  GENERATING: "Generating…",
  READY: "Ready",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export function ProjectCard({ id, title, status, episodeCount, updatedAt, visualStyle }: ProjectCardProps) {
  const updated = new Date(updatedAt);
  return (
    <Link
      href={`/projects/${id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-cinerra-border bg-cinerra-surface transition hover:-translate-y-0.5 hover:border-cinerra-accent/60"
    >
      <div className="flex aspect-[2/3] items-center justify-center bg-gradient-to-br from-cinerra-surface2 to-cinerra-bg text-cinerra-muted">
        <span className="px-4 text-center text-sm">{visualStyle.replace(/_/g, " ")}</span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-1 text-sm font-semibold text-cinerra-text">{title}</h3>
        <div className="flex items-center justify-between text-xs text-cinerra-muted">
          <span className={status === "GENERATING" ? "text-cinerra-accent2" : ""}>{STATUS_LABEL[status] ?? status}</span>
          <span>{episodeCount} ep</span>
        </div>
        <span className="text-[11px] text-cinerra-muted">Updated {updated.toLocaleDateString()}</span>
      </div>
    </Link>
  );
}
