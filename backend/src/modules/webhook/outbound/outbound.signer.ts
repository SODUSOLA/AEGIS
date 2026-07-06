import crypto from 'crypto';

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
