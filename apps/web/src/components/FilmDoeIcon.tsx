/** The FilmDoe brand mark — the exact provided icon artwork (violet→magenta), not a recreation. */
export function FilmDoeIcon({ className = "" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/filmdoe-icon.png" alt="" className={`object-contain ${className}`} />;
}
