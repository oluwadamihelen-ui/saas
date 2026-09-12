export interface GatewayCredentials {
  publicKey: string;
  secretKey: string;
}

export interface InitializePaymentInput {
  amountMinor: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  payerEmail: string;
}

export interface InitializePaymentResult {
  authorizationUrl: string;
}

export interface VerifyPaymentResult {
  status: "success" | "failed" | "pending";
  amountMinor: number;
}

/// Every real gateway (Paystack, Flutterwave, Korapay) implements this
/// same shape, so adding one is a new file + a registry entry — never a
/// change to the invoice/admission code that calls it. `credentials` is
/// omitted only for the built-in mock provider; every real adapter
/// requires the school's own public/secret key pair, resolved per-school
/// by registry.ts rather than read from a single process-wide env var.
export interface PaymentProvider {
  name: string;
  initialize(input: InitializePaymentInput, credentials?: GatewayCredentials): Promise<InitializePaymentResult>;
  verify(reference: string, credentials?: GatewayCredentials): Promise<VerifyPaymentResult>;
}
