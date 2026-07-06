import crypto from 'crypto';

// ─── HMAC Signing ────────────────────────────────────

/** Sign a raw JSON body with HMAC-SHA256 using the endpoint's secret and return the signature + timestamp. */
export function signOutboundPayload(
  rawBody: string,
  endpointSecret: string,
): { signature: string; timestamp: string } {
  const timestamp = Date.now().toString();
  const signature = `sha256=${crypto
    .createHmac('sha256', endpointSecret)
    .update(rawBody)
    .digest('base64')}`;

  return { signature, timestamp };
}

// ─── Headers Builder ─────────────────────────────────

/** Build the set of HTTP headers required for an outbound webhook delivery, including HMAC signature and metadata. */
export function buildDeliveryHeaders(
  rawBody: string,
  endpointSecret: string,
  eventType: string,
  deliveryId: string,
): Record<string, string> {
  const { signature, timestamp } = signOutboundPayload(rawBody, endpointSecret);

  return {
    'Content-Type': 'application/json',
    'x-aegis-signature': signature,
    'x-aegis-timestamp': timestamp,
    'x-aegis-event': eventType,
    'x-aegis-delivery': deliveryId,
  };
}
