import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/// Same photoUrl-or-initials fallback already used on the student profile
/// page (students/[id]/page.tsx) and transcript page, pulled out so the
/// birthday widget/directory (which mixes student photos and staff
/// avatars in one list) can reuse it instead of re-implementing the
/// ternary a third time.
export function PersonAvatar({ name, photoUrl, className }: { name: string; photoUrl: string | null; className?: string }) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- photoUrl/avatarUrl may be a data: URL (uploaded), which next/image cannot optimize.
      <img src={photoUrl} alt={name} className={cn("shrink-0 rounded-full border border-border object-cover", className)} />
    );
  }
  return <Avatar name={name} className={className} />;
}
