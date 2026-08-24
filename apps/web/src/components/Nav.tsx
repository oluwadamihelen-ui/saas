import Link from "next/link";
import { auth } from "@/lib/auth";

const MOBILE_ITEMS = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/discover", label: "Featured", icon: StarIcon },
  { href: "/projects/new", label: "Create", icon: PlusIcon, accent: true },
  { href: "/my-list", label: "My List", icon: BookmarkIcon },
  { href: "/profile", label: "Profile", icon: UserIcon },
];

const DESKTOP_ITEMS = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/discover", label: "Discover", icon: StarIcon },
  { href: "/my-movies", label: "My Movies", icon: FilmIcon },
  { href: "/projects", label: "Projects", icon: FolderIcon },
  { href: "/projects/new", label: "Create", icon: PlusIcon },
  { href: "/assets", label: "Assets", icon: ImageIcon },
  { href: "/earnings", label: "Earnings", icon: CoinIcon },
  { href: "/studio", label: "Studio", icon: ClapperIcon },
  { href: "/profile", label: "Profile", icon: UserIcon },
];

const ADMIN_ITEM = { href: "/admin", label: "Admin", icon: ShieldIcon, accent: false };

async function isAdmin(): Promise<boolean> {
  const session = await auth();
  return (session?.user as { role?: string } | undefined)?.role === "ADMIN";
}

/** Mobile bottom nav (spec §52). */
export async function MobileNav() {
  const admin = await isAdmin();
  const items = admin ? [...MOBILE_ITEMS, ADMIN_ITEM] : MOBILE_ITEMS;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-cinerra-border/70 bg-cinerra-bg/95 py-2 backdrop-blur-md md:hidden">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex flex-col items-center gap-1 px-3 py-1 text-[11px] transition ${
            item.accent ? "text-white" : "text-cinerra-muted hover:text-cinerra-text"
          }`}
        >
          <span className={item.accent ? "flex h-9 w-9 items-center justify-center rounded-full bg-cinerra-accent shadow-glow" : ""}>
            <item.icon />
          </span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** Desktop sidebar (spec §52). */
export async function DesktopSidebar() {
  const admin = await isAdmin();
  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-56 shrink-0 flex-col gap-1 border-r border-cinerra-border/70 p-4 md:flex">
      {DESKTOP_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-cinerra-muted transition hover:bg-cinerra-surface2/70 hover:text-cinerra-text"
        >
          <span className="text-cinerra-muted transition group-hover:text-cinerra-accent">
            <item.icon />
          </span>
          {item.label}
        </Link>
      ))}
      {admin && (
        <>
          <div className="my-2 border-t border-cinerra-border/70" />
          <Link
            href={ADMIN_ITEM.href}
            className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-cinerra-muted transition hover:bg-cinerra-surface2/70 hover:text-cinerra-text"
          >
            <span className="text-cinerra-muted transition group-hover:text-cinerra-accent">
              <ADMIN_ITEM.icon />
            </span>
            {ADMIN_ITEM.label}
          </Link>
        </>
      )}
    </aside>
  );
}

function iconProps() {
  return { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 } as const;
}

function HomeIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}
function StarIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.8L6 21l1.6-7L2.2 9.2l7.1-.6z" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function BookmarkIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M6 3h12v18l-6-4-6 4z" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}
function FilmIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 4v16M17 4v16M3 9h4M17 9h4M3 15h4M17 15h4" />
    </svg>
  );
}
function FolderIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}
function ImageIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-5-5-9 9" />
    </svg>
  );
}
function CoinIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5c0-1 .9-1.5 2.5-1.5s2.5.6 2.5 1.5-1 1.3-2.5 1.5-2.5.6-2.5 1.5 1 1.5 2.5 1.5 2.5-.5 2.5-1.5M12 6.5v11" />
    </svg>
  );
}
function ClapperIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M3 8h18v12H3z" />
      <path d="M3 8l3-5h3l-3 5zM9 8l3-5h3l-3 5zM15 8l3-5h3l-3 5z" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6z" />
    </svg>
  );
}
