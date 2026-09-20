/// Centralized Schoolum product identity. This is the ONE place the
/// platform's own name/tagline/copy lives — pages and components should
/// import from here instead of hard-coding "Schoolum" so the product can
/// be re-labelled (or white-labelled) without a repo-wide find/replace.
///
/// This is distinct from a tenant school's own identity (name/logo/brand
/// color), which lives in the `School` row and renders via
/// `<SchoolLogo>`/`<BrandStyle>` — never here.
export const brand = {
  name: "Schoolum",
  shortName: "Schoolum",
  /// The registered company that owns and operates Schoolum — distinct
  /// from `name` (the product/brand). Used everywhere the site needs to
  /// name the actual legal entity: footer copyright lines, the Terms of
  /// Service and Privacy Policy's "who you're contracting with" clauses,
  /// and the About page.
  legalName: "Numi Innovations LTD",
  tagline: "The intelligent operating system for modern schools.",
  shortTagline: "Manage your entire school from one intelligent platform.",
  description:
    "Schoolum brings students, teachers, parents, academics, finance, communication and AI-powered insights together in one intelligent school management platform.",
  aiName: "Schoolum AI",
  aiShortName: "Schoolum Intelligence",
  supportEmail: "support@schoolum.app",
  salesEmail: "hello@schoolum.app",
  domain: "schoolum.app",
  /// Seeded with demo logins for every role — the one thing "view a
  /// Schoolum demo" links to for a Buyer Program account. This app serves
  /// it directly: middleware.ts rewrites this hostname's root path to
  /// src/app/demo/page.tsx (one-click "Continue as X" buttons, reading
  /// from src/lib/demo.ts), and `npm run db:seed` provisions the actual
  /// "Horizon Academy" sample school those accounts sign into. The
  /// subdomain itself still needs to be added as a Domain on this Vercel
  /// project (with a matching DNS record) before it resolves.
  demoUrl: "https://demo.schoolum.io",
  social: {
    twitter: "@schoolum",
  },
} as const;

export type Brand = typeof brand;
