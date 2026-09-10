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
  legalName: "Schoolum",
  tagline: "The intelligent operating system for modern schools.",
  shortTagline: "Manage your entire school from one intelligent platform.",
  description:
    "Schoolum brings students, teachers, parents, academics, finance, communication and AI-powered insights together in one intelligent school management platform.",
  aiName: "Schoolum AI",
  aiShortName: "Schoolum Intelligence",
  supportEmail: "support@schoolum.app",
  salesEmail: "hello@schoolum.app",
  domain: "schoolum.app",
  social: {
    twitter: "@schoolum",
  },
} as const;

export type Brand = typeof brand;
