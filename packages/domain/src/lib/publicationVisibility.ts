/**
 * The single gate for "is this publication actually visible to the general
 * public": published (spec's publishing phase) AND cleared by moderation
 * (the Discover moderation queue) — either alone is not enough. Kept pure
 * and shared so Discover's queries and the public watch page's per-viewer
 * check can't drift apart on what "public" means.
 */
export interface VisibilityCheckable {
  visibility: string;
  moderationStatus: string;
}

export function isPublicationPubliclyVisible(publication: VisibilityCheckable): boolean {
  return publication.visibility === "PUBLIC" && publication.moderationStatus === "APPROVED";
}
