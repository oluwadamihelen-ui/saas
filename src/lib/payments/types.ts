export interface ProviderKeys {
  publicKey: string;
  secretKey: string;
  /** Only set for providers whose webhook signature uses a value distinct from the API secret key (Flutterwave). */
  webhookSecret?: string;
}

export interface InitializeChargeInput {
  /** Major currency unit (e.g. 5000 for NGN 5,000.00) -- each adapter converts to whatever unit its API expects. */
  amount: number;
  currency: string;
  email: string;
  /** Our own Payment.reference -- passed to the gateway as its transaction reference so the webhook can look the row back up. */
  reference: string;
  redirectUrl: string;
  customerName?: string;
}

export interface InitializeChargeResult {
  checkoutUrl: string;
}

export interface VerifyChargeResult {
  success: boolean;
  /** Major currency unit, converted back from whatever unit the provider returns. */
  amount: number;
  currency: string;
  status: string;
}

export interface PaymentProviderAdapter {
  /** Starts a hosted checkout session; the guest completes payment on the provider's own page. */
  initializeCharge(keys: ProviderKeys, input: InitializeChargeInput): Promise<InitializeChargeResult>;
  /** Re-fetches the transaction status directly from the provider -- never trust a webhook body alone. */
  verifyCharge(keys: ProviderKeys, reference: string): Promise<VerifyChargeResult>;
  /** True if the raw webhook request genuinely came from this provider. */
  verifyWebhookSignature(keys: ProviderKeys, rawBody: string, headers: Headers): boolean;
  /** Pulls our own Payment.reference back out of the parsed webhook body. */
  extractReference(payload: unknown): string | null;
}
