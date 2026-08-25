import type { DiscoverCardData } from "@/lib/discover";
import { MarketingHeader } from "./MarketingHeader";
import { MarketingHero } from "./MarketingHero";
import { HowItWorks } from "./HowItWorks";
import { PopularMovies } from "./PopularMovies";
import { MarketingFooter } from "./MarketingFooter";

/** Public landing page shown to logged-out visitors at "/". */
export function MarketingHome({ popular }: { popular: DiscoverCardData[] }) {
  return (
    <div className="min-h-screen bg-rewards-cream">
      <MarketingHeader />
      <MarketingHero />
      <HowItWorks />
      <PopularMovies items={popular} />
      <MarketingFooter />
    </div>
  );
}
