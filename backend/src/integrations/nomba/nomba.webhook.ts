import crypto from 'crypto';
import { NombaWebhookPayload } from './nomba.types';

// ─── Webhook Verification ─────────────────────────────

/**
 * Verifies the HMAC-SHA256 signature that Nomba attaches to every webhook call.
 * The payload fields are concatenated with `:` separators and hashed with the
 * merchant's webhook secret; the result is compared (case-insensitively) to the
 * signature Nomba sends in the header.
 */
export function verifyNombaWebhookSignature(
  payload: NombaWebhookPayload,
  nombaSignature: string,
  nombaTimestamp: string,
  webhookSecret: string,
): boolean {
  try {
    const { data } = payload;
    const merchant = data.merchant ?? {};
    const transaction = data.transaction ?? {};

    const eventType = payload.event_type ?? '';
    const requestId = payload.requestId ?? '';
    const userId = merchant.userId ?? '';
    const walletId = merchant.walletId ?? '';
    const transactionId = transaction.transactionId ?? '';
    const transactionType = transaction.type ?? '';
    const transactionTime = transaction.time ?? '';
    let transactionResponseCode = transaction.responseCode ?? '';
    // Nomba sometimes sends the literal string "null" — treat it as empty
    if (transactionResponseCode === 'null') transactionResponseCode = '';

    const hashingPayload = [
      eventType,
      requestId,
      userId,
      walletId,
      transactionId,
      transactionType,
      transactionTime,
      transactionResponseCode,
      nombaTimestamp,
    ].join(':');

    const computedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(hashingPayload)
      .digest('base64');

    return computedSignature.toLowerCase() === nombaSignature.toLowerCase();
  } catch {
    return false;
  }
}

// ─── Payload Extraction ───────────────────────────────

/**
 * Extracts tokenized-card metadata from a webhook payload.
 * Returns null if the webhook does not contain tokenized card data (e.g. it
 * was a one-time checkout rather than a tokenised payment).
 */
export function extractTokenizedCardDataFromWebhook(payload: NombaWebhookPayload): {
  tokenKey: string;
  cardType: string;
  cardPan: string;
  tokenExpirationDate: string;
} | null {
  const cardData = payload.data?.tokenizedCardData;
  if (!cardData?.tokenKey || cardData.tokenKey.trim() === '') {
    return null;
  }
  return {
    tokenKey: cardData.tokenKey,
    cardType: cardData.cardType,
    cardPan: cardData.cardPan,
    tokenExpirationDate: cardData.tokenExpirationDate,
  };
}
