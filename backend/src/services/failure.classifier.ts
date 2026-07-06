import { FailureReason } from '@prisma/client';

// ─── Failure Classification ──────────────────────────

/**
 * Maps a Nomba response code and/or response message to a normalised
 * `FailureReason` enum value. Checks codes first (most reliable), then
 * falls back to keyword matching on the message text.
 */
export function classifyFailure(
  responseCode?: string,
  responseMessage?: string,
): FailureReason {
  const code = responseCode?.toUpperCase().trim() ?? '';
  const message = responseMessage?.toUpperCase() ?? '';

  // Nomba / ISO-8583 response codes
  if (code === 'INSUFFICIENT_FUNDS' || code === '51') return 'INSUFFICIENT_FUNDS';
  if (code === 'EXPIRED_CARD' || code === '54') return 'EXPIRED_CARD';
  if (code === 'TIMEOUT' || code === 'NETWORK_ERROR' || code === '91' || code === '96')
    return 'BANK_NETWORK_TIMEOUT';
  if (code === 'DO_NOT_HONOR' || code === '05') return 'DO_NOT_HONOR';
  if (code === 'INVALID_CARD' || code === '14') return 'INVALID_CARD';

  // Fuzzy match on message text for cases where Nomba doesn't send a standard code
  if (message.includes('INSUFFICIENT') || message.includes('BALANCE')) return 'INSUFFICIENT_FUNDS';
  if (message.includes('EXPIRED')) return 'EXPIRED_CARD';
  if (message.includes('TIMEOUT') || message.includes('NETWORK')) return 'BANK_NETWORK_TIMEOUT';

  return 'UNKNOWN';
}

/**
 * Returns true when the failure reason is permanent and cannot be resolved
 * by retrying — the customer must update their card details.
 */
export function isPermanentFailure(reason: FailureReason): boolean {
  return reason === 'EXPIRED_CARD' || reason === 'INVALID_CARD';
}

/**
 * Returns true when the failure reason is transient and may succeed on retry
 * (e.g. insufficient funds, network timeout, bank decline).
 */
export function isRetriableFailure(reason: FailureReason): boolean {
  return (
    reason === 'INSUFFICIENT_FUNDS' ||
    reason === 'BANK_NETWORK_TIMEOUT' ||
    reason === 'DO_NOT_HONOR' ||
    reason === 'UNKNOWN'
  );
}
