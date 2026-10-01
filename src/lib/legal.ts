/**
 * Draft legal documents. These are starting templates written for the product's boundaries
 * (technology + marketplace; no custody of funds, no trade execution, no personalised advice).
 * They are NOT legal advice and must be reviewed by a qualified lawyer before launch.
 */
export const LEGAL_REVIEWED = false;

export interface LegalDoc { slug: string; title: string; updated: string; sections: { h: string; p: string[] }[] }

const UPDATED = "1 October 2026";

export const LEGAL: LegalDoc[] = [
  {
    slug: "terms", title: "Terms of Service", updated: UPDATED,
    sections: [
      { h: "1. What RiskPilot is", p: ["RiskPilot provides software tools for position-size calculation, risk tracking, trade journaling, historical backtesting and a marketplace where independent creators offer trading indicators and strategies to other users.", "RiskPilot is a technology and marketplace service. It is not a broker, exchange, investment adviser, signal provider or fund manager."] },
      { h: "2. What RiskPilot does not do", p: ["We do not hold, manage or transmit your trading funds. We do not place, execute or copy trades. We do not give personalised investment advice or recommendations to buy or sell any instrument. We do not guarantee any return, any result of any indicator or strategy, or that any calculation is free from error."] },
      { h: "3. Your responsibilities", p: ["You are responsible for your own trading decisions and for checking every calculation, including broker contract specifications, before you rely on it. Results labelled “Estimated” depend on specifications you have not confirmed with your broker.", "You must be at least 18 years old and legally able to enter this agreement."] },
      { h: "4. Accounts and acceptable use", p: ["Keep your login secure. Do not attempt to access other users' data, reverse-engineer the service, upload malware, scrape the marketplace, or use the service for unlawful purposes. We may suspend accounts that breach these terms."] },
      { h: "5. Subscriptions and payments", p: ["Paid plans renew only if you have enabled automatic renewal; you can turn it off at any time in Plan & billing. Payments are processed by third-party providers; we do not store card details. Prices may change for future periods with notice."] },
      { h: "6. Backtests and analytics", p: ["Backtests, parameter tests and analytics are historical simulations based on data and assumptions that you or a creator provide. They do not predict or indicate future performance and ignore real-world factors such as liquidity, execution and market changes."] },
      { h: "7. Marketplace", p: ["Products on the marketplace are created and sold by independent creators, who are solely responsible for their descriptions and claims. See the Marketplace Seller Terms and Refund Policy. We may remove listings that breach our rules."] },
      { h: "8. Liability", p: ["To the extent permitted by law, RiskPilot is provided “as is” and we are not liable for trading losses, lost profits or indirect damages arising from use of the service or any marketplace product. Nothing excludes liability that cannot be excluded by law."] },
      { h: "9. Changes and contact", p: ["We may update these terms; continued use after notice means you accept the update. Questions: use the contact details shown in the app."] },
    ],
  },
  {
    slug: "privacy", title: "Privacy Policy", updated: UPDATED,
    sections: [
      { h: "1. What we collect", p: ["Account data (name, email, password hash), the trading records you enter (trades, notes, screenshots, risk settings), Indicator Lab content (including private Pine Script source and uploaded candle data), marketplace activity (purchases, reviews), and basic technical logs.", "We do not connect to your broker and we do not collect broker passwords."] },
      { h: "2. How we use it", p: ["To provide and secure the service, process payments, show you analytics, operate the marketplace, send service messages (and optional Telegram alerts you enable), prevent abuse and comply with law."] },
      { h: "3. Private source code", p: ["Pine Script you store is private to you. It is not displayed to other users unless you explicitly choose to include source code with a product you sell. Platform administrators may read source only for moderation or security review; each such access is logged."] },
      { h: "4. Sharing", p: ["Creators see sales counts, earnings and — where you supply it for access delivery — your TradingView username, but not your email or payment details. Payment providers process your payment data under their own policies. We do not sell personal data."] },
      { h: "5. Payout details", p: ["Creator payout details are encrypted at rest and visible only to the creator and to administrators who process payouts."] },
      { h: "6. Retention and your rights", p: ["You can export your trade data (Pro) and ask us to delete your account. Some records (payments, refunds, audit logs) may be kept as required by law. Depending on where you live, you may have rights of access, correction and deletion; contact us to exercise them."] },
      { h: "7. Security", p: ["We use encryption in transit, hashed passwords, access controls and audit logging. No system is perfectly secure; tell us promptly if you suspect a problem."] },
    ],
  },
  {
    slug: "risk-disclosure", title: "Risk Disclosure", updated: UPDATED,
    sections: [
      { h: "Trading involves substantial risk", p: ["Trading leveraged products such as forex, CFDs, gold, indices and crypto involves substantial risk of loss and is not suitable for everyone. You can lose more than your initial deposit. Only trade with money you can afford to lose."] },
      { h: "Calculations depend on specifications", p: ["Position sizes and risk figures depend on contract size, tick size, tick value, lot limits, exchange rates and your broker's rules, which vary and change. Always verify contract specifications with your broker. Anything marked “Estimated” has not been confirmed."] },
      { h: "Backtests are not forecasts", p: ["Backtests are simulations on historical data under stated assumptions. They can be over-fitted, omit real costs and market conditions, and rarely repeat. Optimizing parameters can make past results look better than future results will be. Out-of-sample results are also historical and also not a guarantee."] },
      { h: "No advice, no signals", p: ["RiskPilot does not tell you what to buy or sell and gives no personalised advice. Indicators sold on the marketplace are tools made by third parties; their descriptions are not endorsed by RiskPilot."] },
      { h: "Be sceptical", p: ["Be cautious of any product promising guaranteed profits, certain win rates or “risk-free” trading. Such claims are prohibited on our marketplace; report them."] },
    ],
  },
  {
    slug: "seller-terms", title: "Marketplace Seller Terms", updated: UPDATED,
    sections: [
      { h: "1. Eligibility and review", p: ["Creators must complete a profile and submit each listing for review. We may approve, reject, suspend or remove listings and creators at our discretion, including for breaches of these terms."] },
      { h: "2. Your content and claims", p: ["You are responsible for your listing, your indicator's behaviour and every claim you make. You must own or have the right to sell what you list.", "You must not claim or imply guaranteed profits, certain or unrealistic win rates, “risk-free” trading, income promises, or that your product predicts the market. Backtest results must be presented as historical simulations."] },
      { h: "3. Backtest transparency", p: ["Any backtest you show must display its instrument, timeframe, period, starting balance, risk model, spread, commission and slippage assumptions, number of trades, data source, and whether it is in-sample or out-of-sample. Results on synthetic or unverified data may not be used as evidence."] },
      { h: "4. Source code protection", p: ["By default, buyers receive access, not your source code. We will not expose your private Pine Script to buyers unless you choose “source code included” for that product. Administrators may read your source for moderation or security review; accesses are logged."] },
      { h: "5. Pricing, commission and fees", p: ["You set your price within the limits we publish. The platform commission, payment-processing fees, any taxes and the holding period before earnings become available are configured by RiskPilot and shown to you; the terms in force when an order is placed apply to that order."] },
      { h: "6. Refunds and chargebacks", p: ["If a sale is refunded or charged back, the related earnings are reversed from your balance, which may become negative until offset by future sales."] },
      { h: "7. Payouts", p: ["Payouts are made from your available balance above the minimum threshold, to payout details you provide and that we have verified. You are responsible for your own taxes. We may withhold payouts while investigating suspected abuse or fraud."] },
      { h: "8. Updates and support", p: ["Publish new versions with an accurate change log. Honour the licensing model you advertise: subscribers receive updates while subscribed; one-time buyers receive updates according to the update policy shown on your listing."] },
      { h: "9. Prohibited", p: ["Malicious code, scraping or resale of others' work, fake reviews, manipulating ratings, misleading screenshots, and circumventing the platform's payment or review systems."] },
    ],
  },
  {
    slug: "refund-policy", title: "Refund Policy", updated: UPDATED,
    sections: [
      { h: "RiskPilot subscriptions", p: ["You can cancel renewal at any time; access continues until the end of the paid period. If you believe you were charged in error, contact us within 14 days and we will review it."] },
      { h: "Marketplace products", p: ["Digital indicator access is generally non-refundable once delivered, except where required by law or where the product is materially different from its listing (for example, it does not work as documented, or the listing broke marketplace rules). Contact us within 14 days of purchase with details.", "Approved refunds return the amount charged to your original payment method (provider fees may not be returned). Your access to the product ends and the creator's related earnings are reversed."] },
      { h: "What is not a reason for a refund", p: ["Trading losses made while using a product are not grounds for a refund: no product on the marketplace is guaranteed to be profitable."] },
      { h: "Subscriptions to creators", p: ["Creator subscriptions are time-limited access licences. Cancelling stops renewal; it does not refund the current period unless the product is materially different from its listing."] },
    ],
  },
];

export const legalBySlug = (slug: string) => LEGAL.find((d) => d.slug === slug);
