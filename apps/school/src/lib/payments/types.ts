export interface InitializePaymentInput {
  amountMinor: number;
  currency: string;
  reference: string;
  callbackUrl: string;
}

export interface InitializePaymentResult {
  authorizationUrl: string;
}

export interface VerifyPaymentResult {
  status: "success" | "failed" | "pending";
  amountMinor: number;
}

/// Every real gateway (Paystack, Flutterwave, ...) implements this same
/// shape, so swapping one in is a new file + a registry entry — never a
/// change to the invoice/payment code that calls it.
export interface PaymentProvider {
  name: string;
  initialize(input: InitializePaymentInput): Promise<InitializePaymentResult>;
  verify(reference: string): Promise<VerifyPaymentResult>;
}
