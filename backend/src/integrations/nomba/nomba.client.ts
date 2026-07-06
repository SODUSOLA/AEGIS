import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { getNombaAccessToken, invalidateNombaTokens } from './nomba.auth';
import {
  NombaTokenizedChargeRequest,
  NombaTokenizedChargeResponse,
  NombaTransactionVerifyResponse,
  ChargeResult,
} from './nomba.types';

// ─── Constants ────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 30_000;

// ─── Internal HTTP Helpers ────────────────────────────

/**
 * Wraps a Nomba API call with auth-header injection and automatic 401 retry.
 * On a 401 response the cached token is invalidated and a single retry is made.
 */
async function nombaRequest<T>(
  path: string,
  options: RequestInit,
  retryOnAuth = true,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const accessToken = await getNombaAccessToken();

    const response = await fetch(`${env.NOMBA_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        accountId: env.NOMBA_ACCOUNT_ID,
        ...options.headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Stale / revoked token — clear cache and retry once
    if (response.status === 401 && retryOnAuth) {
      await invalidateNombaTokens();
      return nombaRequest<T>(path, options, false);
    }

    return (await response.json()) as T;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Nomba API request timed out after ${REQUEST_TIMEOUT_MS}ms: ${path}`);
    }
    throw error;
  }
}

// ─── Public API ───────────────────────────────────────

/**
 * Charges a tokenized card via Nomba's tokenized-card-payment endpoint.
 * Converts kobo to naira (Nomba expects naira) and returns a normalised ChargeResult.
 */
export async function chargeTokenizedCard(
  amountKobo: number,
  tokenKey: string,
  customerEmail: string,
  customerId: string,
  orderReference: string,
  callbackUrl: string,
): Promise<ChargeResult> {
  // Nomba API expects amounts in naira (whole currency units)
  const amountNaira = Number((amountKobo / 100).toFixed(2));

  const requestBody: NombaTokenizedChargeRequest = {
    order: {
      orderReference,
      customerId,
      customerEmail,
      callbackUrl,
      amount: amountNaira,
      currency: 'NGN',
      accountId: env.NOMBA_SUB_ACCOUNT_ID, // sub-account routing
    },
    tokenKey,
  };

  logger.info('Initiating Nomba tokenized charge', {
    orderReference,
    amountKobo,
    amountNaira,
    tokenKeyPrefix: tokenKey.substring(0, 8),
    customerEmailDomain: customerEmail.split('@')[1],
  });

  let rawResponse: NombaTokenizedChargeResponse;

  try {
    rawResponse = await nombaRequest<NombaTokenizedChargeResponse>(
      '/v1/checkout/tokenized-card-payment',
      { method: 'POST', body: JSON.stringify(requestBody) },
    );
  } catch (networkError) {
    logger.error('Nomba charge network error', {
      orderReference,
      error: networkError instanceof Error ? networkError.message : 'Unknown',
    });

    return {
      success: false,
      rawResponse: {
        code: 'NETWORK_ERROR',
        description: 'Network error during charge',
        data: { status: false, message: 'Request timed out or network failure' },
      },
      failureCode: 'TIMEOUT',
      failureMessage: 'Charge request timed out — Nigerian network issue or Nomba outage',
    };
  }

  const isSuccess = rawResponse.code === '00' && rawResponse.data?.status === true;

  logger.info('Nomba charge response received', {
    orderReference,
    success: isSuccess,
    code: rawResponse.code,
    message: rawResponse.data?.message,
  });

  return {
    success: isSuccess,
    rawResponse,
    orderReference,
    failureCode: isSuccess ? undefined : rawResponse.code,
    failureMessage: isSuccess ? undefined : rawResponse.data?.message ?? rawResponse.description,
  };
}

/** Looks up a transaction by its order reference (used for reconciliation). */
export async function verifyTransactionByReference(
  orderReference: string,
): Promise<NombaTransactionVerifyResponse> {
  return nombaRequest<NombaTransactionVerifyResponse>(
    `/v1/checkout/order/${orderReference}`,
    { method: 'GET' },
  );
}
