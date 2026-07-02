export interface NombaTokenRequest {
  grant_type: 'client_credentials';
  client_id: string;
  client_secret: string;
}

export interface NombaRefreshTokenRequest {
  grant_type: 'refresh_token';
  refresh_token: string;
}

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

export interface NombaOrder {
  orderReference?: string;
  customerId?: string;
  callbackUrl: string;
  customerEmail: string;
  amount: number;
  currency: 'NGN';
  accountId?: string;
}

export interface NombaCheckoutOrderRequest {
  order: NombaOrder;
  tokenizeCard: boolean;
}

export interface NombaCheckoutOrderResponse {
  code: string;
  description: string;
  data: {
    checkoutLink: string;
    orderReference: string;
  };
}

export interface NombaTokenizedChargeRequest {
  order: NombaOrder;
  tokenKey: string;
}

export interface NombaTokenizedChargeResponse {
  code: string;
  description: string;
  data: {
    status: boolean;
    message: string;
  };
}

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

export interface ChargeResult {
  success: boolean;
  rawResponse: NombaTokenizedChargeResponse;
  failureCode?: string;
  failureMessage?: string;
  orderReference?: string;
}
