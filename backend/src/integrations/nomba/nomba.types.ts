// ─── Nomba API Types ───────────────────────────────────

/** OAuth2 client credentials grant payload for Nomba authentication. */
export interface NombaTokenRequest {
  grant_type: 'client_credentials';
  client_id: string;
  client_secret: string;
}

/** Payload for refreshing an existing Nomba token before expiry. */
export interface NombaRefreshTokenRequest {
  grant_type: 'refresh_token';
  refresh_token: string;
}

/** Response shape for both token-issue and token-refresh endpoints. */
export interface NombaTokenResponse {
  code: string;
  description: string;
  data: {
    businessId: string;
    access_token: string;
    refresh_token: string;
    expiresAt: string;
  };
}

/** Core order fields required when initiating a charge with Nomba. */
export interface NombaOrder {
  orderReference?: string;
  customerId?: string;
  callbackUrl: string;
  customerEmail: string;
  amount: number;
  currency: 'NGN';
  accountId?: string;
}

/** Request body for creating a checkout order with tokenization flag. */
export interface NombaCheckoutOrderRequest {
  order: NombaOrder;
  tokenizeCard: boolean;
}

/** Response from the checkout order endpoint — contains the hosted checkout link. */
export interface NombaCheckoutOrderResponse {
  code: string;
  description: string;
  data: {
    checkoutLink: string;
    orderReference: string;
  };
}

/** Request body for charging a previously tokenized card. */
export interface NombaTokenizedChargeRequest {
  order: NombaOrder;
  tokenKey: string;
}

/** Response from a tokenized-card charge attempt. */
export interface NombaTokenizedChargeResponse {
  code: string;
  description: string;
  data: {
    status: boolean;
    message: string;
  };
}

/** Response from verifying a transaction by order reference. */
export interface NombaTransactionVerifyResponse {
  code: string;
  description: string;
  data: {
    transactionId: string;
    orderReference: string;
    type: string;
    transactionAmount: number;
    currency: string;
    responseCode: string;
    originatingFrom: string;
    time: string;
  };
}

/** Webhook payload Nomba sends to our callback URL for payment lifecycle events. */
export interface NombaWebhookPayload {
  event_type: 'payment_success' | 'payout_success' | 'payment_failed' | 'payment_reversal' | 'payout_failed' | 'payout_refund';
  requestId: string;
  data: {
    merchant: {
      walletId: string;
      walletBalance: number;
      userId: string;
    };
    terminal: Record<string, unknown>;
    transaction: {
      fee: number;
      sessionId?: string;
      type: string;
      transactionId: string;
      responseCode: string;
      originatingFrom: string;
      transactionAmount: number;
      narration?: string;
      time: string;
      merchantTxRef?: string;
      cardIssuer?: string;
    };
    customer: Record<string, unknown>;
    order?: {
      orderId: string;
      orderReference: string;
      amount: number;
      currency: string;
      customerEmail?: string;
      customerId?: string;
      isTokenizedCardPayment: string;
      paymentMethod: string;
    };
    tokenizedCardData?: {
      tokenKey: string;
      customerEmail: string;
      cardType: string;
      cardPan: string;
      tokenExpirationDate: string;
    };
  };
}

/** Normalised result returned by the charge pipeline to the caller. */
export interface ChargeResult {
  success: boolean;
  rawResponse: NombaTokenizedChargeResponse;
  failureCode?: string;
  failureMessage?: string;
  orderReference?: string;
}
