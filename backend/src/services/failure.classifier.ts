import { FailureReason } from '@prisma/client';

export function classifyFailure(
  responseCode?: string,
  responseMessage?: string,
): FailureReason {
  const code = responseCode?.toUpperCase().trim() ?? '';
  const message = responseMessage?.toUpperCase() ?? '';

  if (code === 'INSUFFICIENT_FUNDS' || code === '51') return 'INSUFFICIENT_FUNDS';
  if (code === 'EXPIRED_CARD' || code === '54') return 'EXPIRED_CARD';
  if (code === 'TIMEOUT' || code === 'NETWORK_ERROR' || code === '91' || code === '96')
    return 'BANK_NETWORK_TIMEOUT';
  if (code === 'DO_NOT_HONOR' || code === '05') return 'DO_NOT_HONOR';
  if (code === 'INVALID_CARD' || code === '14') return 'INVALID_CARD';

  if (message.includes('INSUFFICIENT') || message.includes('BALANCE')) return 'INSUFFICIENT_FUNDS';
  if (message.includes('EXPIRED')) return 'EXPIRED_CARD';
  if (message.includes('TIMEOUT') || message.includes('NETWORK')) return 'BANK_NETWORK_TIMEOUT';

  return 'UNKNOWN';
}

export function isPermanentFailure(reason: FailureReason): boolean {
  return reason === 'EXPIRED_CARD' || reason === 'INVALID_CARD';
}

export function isRetriableFailure(reason: FailureReason): boolean {
  return (
    reason === 'INSUFFICIENT_FUNDS' ||
    reason === 'BANK_NETWORK_TIMEOUT' ||
    reason === 'DO_NOT_HONOR' ||
    reason === 'UNKNOWN'
  );
}
